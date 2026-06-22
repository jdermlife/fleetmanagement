import os
import time
from collections import defaultdict
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


RATE_LIMIT_ENABLED = os.getenv("ENABLE_RATE_LIMIT", "true").lower() == "true"
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW", "60"))
RATE_LIMIT_BACKEND = os.getenv("RATE_LIMIT_BACKEND", "memory").lower()
RATE_LIMIT_REDIS_URL = os.getenv("REDIS_URL", "")


class _MemoryLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def consume(self, key: str) -> tuple[bool, int, int]:
        now = time.time()
        window_start = now - self.window_seconds

        with self._lock:
            self._requests[key] = [timestamp for timestamp in self._requests[key] if timestamp > window_start]
            count = len(self._requests[key])
            if count >= self.max_requests:
                reset = int(min(self._requests[key]) + self.window_seconds)
                return False, 0, max(reset, int(now))

            self._requests[key].append(now)
            remaining = self.max_requests - len(self._requests[key])
            reset = int(now + self.window_seconds)
            return True, remaining, reset


class _RedisLimiter:
    def __init__(self, redis_url: str, max_requests: int, window_seconds: int):
        try:
            from redis import Redis
        except ImportError as exc:
            raise RuntimeError(
                "redis package is required when RATE_LIMIT_BACKEND=redis"
            ) from exc

        self._client = Redis.from_url(redis_url, decode_responses=True)
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    def consume(self, key: str) -> tuple[bool, int, int]:
        bucket_key = f"rate-limit:{key}"
        now = int(time.time())

        pipe = self._client.pipeline()
        pipe.incr(bucket_key, 1)
        pipe.ttl(bucket_key)
        count, ttl = pipe.execute()

        if ttl in (-1, -2):
            self._client.expire(bucket_key, self.window_seconds)
            ttl = self.window_seconds

        remaining = max(0, self.max_requests - int(count))
        reset = now + max(0, int(ttl))
        allowed = int(count) <= self.max_requests
        return allowed, remaining, reset


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)

        if RATE_LIMIT_BACKEND == "redis" and RATE_LIMIT_REDIS_URL:
            self.limiter = _RedisLimiter(
                RATE_LIMIT_REDIS_URL,
                RATE_LIMIT_REQUESTS,
                RATE_LIMIT_WINDOW_SECONDS,
            )
        else:
            self.limiter = _MemoryLimiter(
                RATE_LIMIT_REQUESTS,
                RATE_LIMIT_WINDOW_SECONDS,
            )

    async def dispatch(self, request: Request, call_next):
        if request.url.path in {"/", "/health", "/metrics"}:
            return await call_next(request)

        client_host = request.client.host if request.client else "unknown"
        key = f"{client_host}:{request.url.path}"

        allowed, remaining, reset = self.limiter.consume(key)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please try again later."},
                headers={
                    "X-RateLimit-Limit": str(RATE_LIMIT_REQUESTS),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(RATE_LIMIT_REQUESTS)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset)
        return response