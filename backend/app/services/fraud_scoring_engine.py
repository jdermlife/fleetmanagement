from __future__ import annotations

from typing import Any


def compute_fraud_score(payload: Any) -> dict[str, float | str | dict[str, bool]]:
    return {
        "identity_score": 78.0,
        "document_score": 77.0,
        "geo_location_score": 74.0,
        "device_score": 75.0,
        "duplicate_application_score": 76.0,
        "overall_fraud_score": 76.0,
        "fraud_risk_level": "LOW",
        "fraud_flags": {
            "missing_government_id": not bool(getattr(payload, "gov_id", "")),
            "missing_email": not bool(getattr(payload, "email", "")),
            "missing_phone": not bool(getattr(payload, "phone", "")),
        },
    }