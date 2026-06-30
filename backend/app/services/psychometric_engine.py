from __future__ import annotations

from typing import Any


PSYCHOMETRIC_RESPONSE_SCORES = {
    "strongly agree": 4,
    "agree": 3,
    "neutral": 2,
    "disagree": 1,
    "strongly disagree": 0,
}

LEGACY_RESPONSE_SCORES = {
    "strongly agree": 5,
    "agree": 4,
    "neutral": 3,
    "disagree": 2,
    "strongly disagree": 1,
}

PSYCHOMETRIC_SECTIONS: list[tuple[str, tuple[str, ...]]] = [
    ("financial_discipline", ("q01", "q02", "q03", "q04", "q05")),
    ("savings_behavior", ("q06", "q07", "q08", "q09", "q10")),
    ("repayment_responsibility", ("q11", "q12", "q13", "q14", "q15")),
    ("planning_organization", ("q16", "q17", "q18", "q19", "q20")),
    ("self_control", ("q21", "q22", "q23", "q24", "q25")),
    ("risk_awareness", ("q26", "q27", "q28", "q29", "q30")),
    ("integrity_consistency", ("q31", "q32", "q33", "q34", "q35")),
    ("career_mindset", ("q36", "q37", "q38", "q39", "q40")),
    ("financial_resilience", ("q41", "q42", "q43", "q44", "q45")),
    ("social_responsibility", ("q46", "q47", "q48", "q49", "q50")),
]


def _normalized_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def _score_new_assessment(questionnaire: dict[str, Any]) -> dict[str, float | dict[str, Any]] | None:
    answered = sum(1 for value in questionnaire.values() if _normalized_text(value))
    if answered == 0:
        return None

    section_scores: list[float] = []
    for _, fields in PSYCHOMETRIC_SECTIONS:
        raw_score = sum(
            PSYCHOMETRIC_RESPONSE_SCORES.get(_normalized_text(questionnaire.get(field)), 0)
            for field in fields
        )
        section_scores.append(round((raw_score / 20.0) * 100.0, 2))

    discipline_score = round((section_scores[0] + section_scores[1] + section_scores[4]) / 3.0, 2)
    planning_score = round((section_scores[3] + section_scores[5]) / 2.0, 2)
    responsibility_score = round((section_scores[2] + section_scores[9]) / 2.0, 2)
    honesty_score = round(section_scores[6], 2)
    resilience_score = round((section_scores[7] + section_scores[8]) / 2.0, 2)
    overall_psychometric_score = round(sum(section_scores) / len(section_scores), 2)

    return {
        "discipline_score": discipline_score,
        "planning_score": planning_score,
        "responsibility_score": responsibility_score,
        "honesty_score": honesty_score,
        "resilience_score": resilience_score,
        "overall_psychometric_score": overall_psychometric_score,
        "questionnaire_answers": questionnaire,
    }


def _score_legacy_assessment(questionnaire: dict[str, Any]) -> dict[str, float | dict[str, Any]] | None:
    values = [
        LEGACY_RESPONSE_SCORES.get(_normalized_text(questionnaire.get(f"question{index:02d}")), 0)
        for index in range(1, 21)
    ]
    answered = [value for value in values if value > 0]
    if not answered:
        return None

    def _slice_score(start: int, end: int) -> float:
        slice_values = [value for value in values[start:end] if value > 0]
        if not slice_values:
            return 0.0
        return round((sum(slice_values) / (len(slice_values) * 5.0)) * 100.0, 2)

    discipline_score = _slice_score(0, 4)
    planning_score = _slice_score(4, 8)
    responsibility_score = _slice_score(8, 12)
    honesty_score = _slice_score(12, 16)
    resilience_score = _slice_score(16, 20)
    overall_psychometric_score = round(
        (sum(answered) / (len(answered) * 5.0)) * 100.0,
        2,
    )

    return {
        "discipline_score": discipline_score,
        "planning_score": planning_score,
        "responsibility_score": responsibility_score,
        "honesty_score": honesty_score,
        "resilience_score": resilience_score,
        "overall_psychometric_score": overall_psychometric_score,
        "questionnaire_answers": questionnaire,
    }


def compute_psychometric_score(payload: Any) -> dict[str, float | dict[str, Any]]:
    requirements = getattr(payload, "requirements", {}) or {}
    questionnaire = requirements.get("psychometricAssessment", {})

    if isinstance(questionnaire, dict):
        computed = _score_new_assessment(questionnaire)
        if computed is not None:
            return computed

    legacy_questionnaire = requirements.get("optionalPsychometricQuestionnaire", {})
    if isinstance(legacy_questionnaire, dict):
        computed = _score_legacy_assessment(legacy_questionnaire)
        if computed is not None:
            return computed

    return {
        "discipline_score": 80.0,
        "planning_score": 81.0,
        "responsibility_score": 82.0,
        "honesty_score": 83.0,
        "resilience_score": 79.0,
        "overall_psychometric_score": 81.0,
        "questionnaire_answers": questionnaire if isinstance(questionnaire, dict) else {},
    }


def evaluate(payload: Any) -> dict[str, float | dict[str, Any]]:
    return compute_psychometric_score(payload)
