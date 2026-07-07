from __future__ import annotations

import os
import re

DEFAULT_FRONTEND_ORIGINS = (
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://fleetmanagement.vercel.app",
    "https://fleetmanagement-flame.vercel.app",
    "https://fleetmanagement-n8u4pr3bu-jdionedas-projects.vercel.app",
)

DEFAULT_FRONTEND_ORIGIN_REGEX = (
    r"^https://fleetmanagement(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?\.vercel\.app$"
)


def parse_frontend_origins(raw_origins: str | None) -> list[str]:
    if not raw_origins:
        return []

    return [
        origin.strip()
        for origin in raw_origins.split(",")
        if origin.strip()
    ]


def get_configured_frontend_origins() -> list[str]:
    return parse_frontend_origins(os.getenv("FRONTEND_ORIGINS", ""))


def get_allowed_frontend_origins(configured_origins: list[str] | None = None) -> list[str]:
    origins = [
        *DEFAULT_FRONTEND_ORIGINS,
        *(configured_origins if configured_origins is not None else get_configured_frontend_origins()),
    ]
    return list(dict.fromkeys(origins))


def get_frontend_origin_regex() -> str:
    configured_regex = os.getenv("FRONTEND_ORIGIN_REGEX", "").strip()
    return configured_regex or DEFAULT_FRONTEND_ORIGIN_REGEX


def is_allowed_frontend_origin(
    origin: str,
    allowed_origins: list[str] | None = None,
    origin_regex: str | None = None,
) -> bool:
    if origin in (allowed_origins if allowed_origins is not None else get_allowed_frontend_origins()):
        return True

    resolved_regex = origin_regex if origin_regex is not None else get_frontend_origin_regex()
    return bool(resolved_regex and re.fullmatch(resolved_regex, origin))
