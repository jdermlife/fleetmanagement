from __future__ import annotations

from starlette.types import ASGIApp, Receive, Scope, Send


def normalize_api_path(path: str) -> str:
    if path == "/api/api":
        return "/api"
    if path.startswith("/api/api/"):
        return path[len("/api"):]
    if path == "/api/health":
        return "/health"
    return path


class ApiPathCompatibilityMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        path = str(scope.get("path") or "")
        normalized_path = normalize_api_path(path)
        if normalized_path != path:
            scope = {**scope, "path": normalized_path}
            raw_path = scope.get("raw_path")
            if isinstance(raw_path, bytes) and raw_path.startswith(b"/api/api"):
                scope["raw_path"] = raw_path[len(b"/api"):]
            else:
                scope["raw_path"] = normalized_path.encode("utf-8")

        await self.app(scope, receive, send)
