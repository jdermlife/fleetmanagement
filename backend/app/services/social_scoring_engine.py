from __future__ import annotations

from typing import Any


def compute_social_score(_: Any) -> dict[str, float]:
    return {
        "residence_stability_score": 70.0,
        "employment_stability_score": 74.0,
        "family_stability_score": 71.0,
        "education_score": 73.0,
        "banking_relationship_score": 72.0,
        "overall_social_score": 72.0,
    }


def evaluate(application: Any) -> dict[str, float]:
    return compute_social_score(application)
