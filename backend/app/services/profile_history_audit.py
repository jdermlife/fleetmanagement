import json


def is_profile_history_path(path: str) -> bool:
    segments = [segment for segment in path.strip("/").split("/") if segment]
    return len(segments) >= 4 and segments[:2] == ["api", "profiles"] and segments[3] == "history"


def profile_history_request_audit_metadata(path: str, raw_body: bytes) -> dict[str, object]:
    segments = [segment for segment in path.strip("/").split("/") if segment]
    metadata: dict[str, object] = {
        "redacted": True,
        "content_length": len(raw_body),
        "application_no": segments[2] if len(segments) > 2 else None,
        "history_id": segments[4] if len(segments) > 4 else None,
    }
    try:
        parsed = json.loads(raw_body.decode("utf-8")) if raw_body else None
        if isinstance(parsed, dict):
            for key in ("category", "observed_at"):
                value = parsed.get(key)
                if isinstance(value, str):
                    metadata[key] = value
    except (UnicodeDecodeError, json.JSONDecodeError):
        pass
    return metadata


def profile_history_response_audit_metadata(
    response_payload: object,
    status_code: int,
) -> dict[str, object]:
    metadata: dict[str, object] = {
        "redacted": True,
        "status_code": status_code,
    }
    if isinstance(response_payload, dict):
        for key in ("id", "application_no", "category", "observed_at", "created_at", "total"):
            value = response_payload.get(key)
            if isinstance(value, (str, int, float)):
                metadata[key] = value
        items = response_payload.get("items")
        if isinstance(items, list):
            metadata["returned_count"] = len(items)
    return metadata