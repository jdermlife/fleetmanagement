from __future__ import annotations

from typing import Any


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_score_100(value: Any) -> float:
    numeric = _to_float(value, 0.0)
    if numeric <= 0:
        return 0.0
    if numeric <= 100:
        return numeric
    return min(numeric / 10.0, 100.0)


def _grade_for_score(final_score: float) -> str:
    if final_score >= 85:
        return "A"
    if final_score >= 80:
        return "A-"
    if final_score >= 75:
        return "B+"
    if final_score >= 70:
        return "B"
    if final_score >= 60:
        return "C"
    return "D"


def compute_decision(final_score: float, requested_grade: str | None = None) -> dict[str, str]:
    if final_score >= 80:
        return {
            "final_grade": requested_grade or "A-",
            "decision": "APPROVE",
        }

    if final_score >= 65:
        return {
            "final_grade": requested_grade or "B",
            "decision": "REVIEW",
        }

    return {
        "final_grade": requested_grade or "C",
        "decision": "DECLINE",
    }


def evaluate(
    credit: dict[str, Any],
    fraud: dict[str, Any],
    behavior: dict[str, Any],
    social: dict[str, Any],
    risk: dict[str, Any],
    profit: dict[str, Any],
) -> dict[str, Any]:
    component_scores = {
        "credit_score": _normalize_score_100(credit.get("total_credit_score")),
        "fraud_score": _normalize_score_100(fraud.get("overall_fraud_score")),
        "behavior_score": _normalize_score_100(
            behavior.get("overall_psychometric_score")
        ),
        "social_score": _normalize_score_100(social.get("overall_social_score")),
        "risk_score": _normalize_score_100(risk.get("overall_credit_risk_score")),
        "profit_score": _normalize_score_100(profit.get("profitability_score")),
    }
    weighted_score = (
        (component_scores["credit_score"] * 0.20)
        + (component_scores["fraud_score"] * 0.10)
        + (component_scores["behavior_score"] * 0.15)
        + (component_scores["social_score"] * 0.05)
        + (component_scores["risk_score"] * 0.35)
        + (component_scores["profit_score"] * 0.15)
    )
    decision_uplift = 1.5 if (
        component_scores["credit_score"] >= 80
        and component_scores["risk_score"] >= 80
        and component_scores["profit_score"] >= 75
    ) else 0.0
    final_score = float(round(min(weighted_score + decision_uplift, 100.0)))
    final_grade = _grade_for_score(final_score)
    outcome = compute_decision(final_score, requested_grade=final_grade)

    return {
        "component_scores": component_scores,
        "final_score": final_score,
        "final_grade": outcome["final_grade"],
        "decision": outcome["decision"],
    }
