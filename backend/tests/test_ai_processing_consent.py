import asyncio
from datetime import datetime
from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile

from app.routes.ai import (
    AI_PROCESSING_CONSENT_VERSION,
    _ai_consent_metadata,
    _require_ai_processing_consent,
    meeting_minutes,
    parse_loan_document,
    transcribe,
)


@pytest.mark.parametrize(
    ("consent", "version"),
    [
        (False, AI_PROCESSING_CONSENT_VERSION),
        (True, ""),
        (True, "outdated"),
    ],
)
def test_ai_processing_requires_affirmative_current_consent(consent, version):
    with pytest.raises(HTTPException) as error:
        _require_ai_processing_consent(consent, version)

    assert error.value.status_code == 422


def test_ai_processing_consent_metadata_records_proof():
    _require_ai_processing_consent(True, AI_PROCESSING_CONSENT_VERSION)

    metadata = _ai_consent_metadata(
        AI_PROCESSING_CONSENT_VERSION,
        "audio transcription",
    )

    assert metadata["ai_processing_consent"] is True
    assert metadata["consent_version"] == AI_PROCESSING_CONSENT_VERSION
    assert metadata["provider"] == "OpenAI"
    assert metadata["purpose"] == "audio transcription"
    assert datetime.fromisoformat(metadata["consent_timestamp"]).tzinfo is not None


@pytest.mark.parametrize(
    "route_call",
    [
        lambda: transcribe(
            audio=UploadFile(filename="meeting.webm", file=BytesIO(b"audio")),
            ai_processing_consent=False,
            consent_version="",
            current_user=None,
        ),
        lambda: meeting_minutes(
            data={"transcript": "Meeting transcript"},
            current_user=None,
        ),
        lambda: parse_loan_document(
            file=UploadFile(filename="document.png", file=BytesIO(b"image")),
            ai_processing_consent=False,
            consent_version="",
            current_user=None,
        ),
    ],
)
def test_sensitive_ai_routes_reject_missing_consent(route_call):
    with pytest.raises(HTTPException) as error:
        asyncio.run(route_call())

    assert error.value.status_code == 422