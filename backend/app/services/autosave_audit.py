import json


def is_autosave_draft_path(path: str) -> bool:
    segments = [segment for segment in path.strip("/").split("/") if segment]
    return len(segments) >= 4 and segments[:2] == ["api", "drafts"]


def autosave_request_audit_metadata(path: str, raw_body: bytes) -> dict[str, object]:
    segments = [segment for segment in path.strip("/").split("/") if segment]
    metadata: dict[str, object] = {
        "redacted": True,
        "content_length": len(raw_body),
        "scope": segments[2] if len(segments) > 2 else None,
        "entity_key": segments[3] if len(segments) > 3 else None,
    }
    try:
        parsed = json.loads(raw_body.decode("utf-8")) if raw_body else None
        if isinstance(parsed, dict) and isinstance(parsed.get("expected_revision"), int):
            metadata["expected_revision"] = parsed["expected_revision"]
    except (UnicodeDecodeError, json.JSONDecodeError):
        pass
    return metadata


def autosave_response_audit_metadata(
    response_payload: object,
    status_code: int,
) -> dict[str, object]:
    metadata: dict[str, object] = {
        "redacted": True,
        "status_code": status_code,
    }
    if isinstance(response_payload, dict):
        for key in ("revision", "created_at", "updated_at", "expires_at"):
            value = response_payload.get(key)
            if isinstance(value, (str, int, float)):
                metadata[key] = value
    return metadata
