from __future__ import annotations

from typing import Any


def compute_psychometric_score(payload: Any) -> dict[str, float | dict[str, Any]]:
    requirements = getattr(payload, "requirements", {}) or {}
    questionnaire = requirements.get("optionalPsychometricQuestionnaire", {})

    return {
        "discipline_score": 80.0,
        "planning_score": 81.0,
        "responsibility_score": 82.0,
        "honesty_score": 83.0,
        "resilience_score": 79.0,
        "overall_psychometric_score": 81.0,
        "questionnaire_answers": questionnaire,
    }