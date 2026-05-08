from __future__ import annotations

import os
import time
from collections import defaultdict
from functools import wraps
from typing import Callable


class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds
        
        self.requests[key] = [t for t in self.requests[key] if t > window_start]
        
        if len(self.requests[key]) >= self.max_requests:
            return False
        
        self.requests[key].append(now)
        return True

    def remaining(self, key: str) -> int:
        now = time.time()
        window_start = now - self.window_seconds
        self.requests[key] = [t for t in self.requests[key] if t > window_start]
        return max(0, self.max_requests - len(self.requests[key]))


rate_limiter = RateLimiter(
    max_requests=int(os.getenv("RATE_LIMIT_REQUESTS", "100")),
    window_seconds=int(os.getenv("RATE_LIMIT_WINDOW", "60"))
)


def rate_limit(max_requests: int = 100, window_seconds: int = 60):
    def decorator(fn: Callable):
        limiter = RateLimiter(max_requests, window_seconds)
        
        @wraps(fn)
        def decorated(*args, **kwargs):
            from flask import request, jsonify
            
            key = request.remote_addr or "unknown"
            if request.authorization:
                key = f"{key}:{request.authorization.username}"
            
            if not limiter.is_allowed(key):
                return jsonify({"error": "Rate limit exceeded. Please try again later."}), 429
            
            response = fn(*args, **kwargs)
            
            remaining = limiter.remaining(key)
            if hasattr(response, "headers"):
                response.headers["X-RateLimit-Limit"] = str(max_requests)
                response.headers["X-RateLimit-Remaining"] = str(remaining)
                response.headers["X-RateLimit-Reset"] = str(int(time.time() + window_seconds))
            
            return response
        return decorated
    return decorator