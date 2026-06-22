import os
import time

from fastapi import FastAPI, Request, Response
try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
except ImportError:  # pragma: no cover - handled at runtime when dependencies are optional
    sentry_sdk = None
    FastApiIntegration = None

try:
    from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
except ImportError:  # pragma: no cover - handled at runtime when dependencies are optional
    CONTENT_TYPE_LATEST = "text/plain; version=0.0.4; charset=utf-8"
    Counter = None
    Gauge = None
    Histogram = None
    generate_latest = None

_HTTP_REQUESTS_TOTAL = (
    Counter(
        "http_requests_total",
        "Total HTTP requests",
        ["method", "path", "status"],
    )
    if Counter is not None
    else None
)

_HTTP_REQUEST_DURATION_SECONDS = (
    Histogram(
        "http_request_duration_seconds",
        "HTTP request duration in seconds",
        ["method", "path"],
    )
    if Histogram is not None
    else None
)

_HTTP_IN_PROGRESS = (
    Gauge(
        "http_requests_in_progress",
        "In-progress HTTP requests",
        ["method", "path"],
    )
    if Gauge is not None
    else None
)


def _normalize_path(request: Request) -> str:
    route = request.scope.get("route")
    if route and getattr(route, "path", None):
        return route.path
    return request.url.path


def _init_sentry() -> bool:
    if sentry_sdk is None or FastApiIntegration is None:
        return False

    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return False

    traces_sample_rate = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.0"))
    profiles_sample_rate = float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.0"))

    sentry_sdk.init(
        dsn=dsn,
        integrations=[FastApiIntegration()],
        environment=os.getenv("SENTRY_ENVIRONMENT", os.getenv("ENVIRONMENT", "development")),
        release=os.getenv("SENTRY_RELEASE"),
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=profiles_sample_rate,
        send_default_pii=os.getenv("SENTRY_SEND_DEFAULT_PII", "false").lower() == "true",
    )
    return True


def setup_observability(app: FastAPI) -> None:
    app.state.sentry_enabled = _init_sentry()
    prometheus_enabled = all(
        metric is not None
        for metric in (_HTTP_REQUESTS_TOTAL, _HTTP_REQUEST_DURATION_SECONDS, _HTTP_IN_PROGRESS)
    ) and generate_latest is not None
    app.state.prometheus_enabled = prometheus_enabled

    @app.middleware("http")
    async def prometheus_middleware(request: Request, call_next):
        if not app.state.prometheus_enabled:
            return await call_next(request)

        path = _normalize_path(request)
        method = request.method
        started = time.perf_counter()

        _HTTP_IN_PROGRESS.labels(method=method, path=path).inc()
        try:
            response = await call_next(request)
        except Exception:
            _HTTP_REQUESTS_TOTAL.labels(method=method, path=path, status="500").inc()
            _HTTP_REQUEST_DURATION_SECONDS.labels(method=method, path=path).observe(
                time.perf_counter() - started
            )
            raise
        finally:
            _HTTP_IN_PROGRESS.labels(method=method, path=path).dec()

        _HTTP_REQUESTS_TOTAL.labels(
            method=method,
            path=path,
            status=str(response.status_code),
        ).inc()
        _HTTP_REQUEST_DURATION_SECONDS.labels(method=method, path=path).observe(
            time.perf_counter() - started
        )
        return response

    @app.get("/metrics", include_in_schema=False)
    def metrics() -> Response:
        if not app.state.prometheus_enabled:
            return Response(
                content="# Prometheus client not installed\n",
                status_code=503,
                media_type="text/plain",
            )
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
