from __future__ import annotations

import asyncio
from typing import Any

from app.api_path_compat import ApiPathCompatibilityMiddleware


def run_middleware(path: str) -> tuple[str, bytes]:
    observed: dict[str, Any] = {}

    async def downstream(scope, receive, send):
        observed["path"] = scope["path"]
        observed["raw_path"] = scope["raw_path"]

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        return None

    scope = {
        "type": "http",
        "path": path,
        "raw_path": path.encode("ascii"),
    }
    asyncio.run(ApiPathCompatibilityMiddleware(downstream)(scope, receive, send))
    return observed["path"], observed["raw_path"]


def test_collapses_duplicate_api_prefix_from_same_origin_proxy():
    assert run_middleware("/api/api/auth/google-token") == (
        "/api/auth/google-token",
        b"/api/auth/google-token",
    )


def test_maps_proxied_health_check_to_root_health_endpoint():
    assert run_middleware("/api/health") == ("/health", b"/health")


def test_maps_proxied_ai_request_to_root_ai_router():
    assert run_middleware("/api/ai/page-assistant/public") == (
        "/ai/page-assistant/public",
        b"/ai/page-assistant/public",
    )


def test_preserves_normal_api_paths():
    assert run_middleware("/api/auth/apple-token") == (
        "/api/auth/apple-token",
        b"/api/auth/apple-token",
    )


def test_preserves_non_http_scopes():
    observed: dict[str, str] = {}

    async def downstream(scope, receive, send):
        observed["path"] = scope["path"]

    async def invoke():
        scope = {"type": "websocket", "path": "/api/api/socket"}
        await ApiPathCompatibilityMiddleware(downstream)(scope, None, None)

    asyncio.run(invoke())
    assert observed["path"] == "/api/api/socket"
