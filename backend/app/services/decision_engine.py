from __future__ import annotations


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