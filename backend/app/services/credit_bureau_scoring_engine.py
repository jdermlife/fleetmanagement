from __future__ import annotations

from typing import Any


MODEL_NAME = "FILSCORE Credit Bureau Scorecard"
MODEL_VERSION = "credit-bureau-scorecard-v1"
MAX_RAW_SCORE = 110


SCORE_MAPS: dict[str, dict[str, int]] = {
    "creditBureauLatePaymentFrequency": {
        "No late payments": 30,
        "1–2 late payments (30 days or less)": 25,
        "1–2 late payments (≤30 days)": 25,
        "3–5 late payments": 18,
        "More than 5 late payments": 10,
        "Loan currently in default": 0,
        "Loan in default": 0,
    },
    "creditBureauDelinquencyDefaultHistory": {
        "No delinquency/default": 20,
        "Delinquency resolved over 5 years ago": 15,
        "Delinquency resolved within last 5 years": 10,
        "Delinquency resolved within the last 5 years": 10,
        "Current delinquency": 5,
        "Current default / foreclosure / repossession": 0,
    },
    "creditBureauOverallBalanceRatio": {
        "Less than 20%": 15,
        "20–40%": 12,
        "41–60%": 8,
        "61–80%": 4,
        "Above 80%": 0,
    },
    "creditBureauActiveLoanCount": {
        "1–2": 5,
        "3–4": 4,
        "5–6": 3,
        "7–8": 2,
        "More than 8": 0,
    },
    "creditBureauCollectionCallsLast12Months": {
        "None": 5,
        "1–2": 4,
        "3–4": 3,
        "5–6": 2,
        "More than 6": 0,
    },
    "creditBureauCreditHistoryLength": {
        "More than 10 years": 5,
        "5–10 years": 4,
        "3–5 years": 3,
        "1–3 years": 2,
        "Less than 1 year": 0,
    },
    "creditBureauWrittenOffAccountStatus": {
        "No written-off account": 5,
        "Settled with full payment": 4,
        "Settled for less than full amount": 2,
        "Settled for less than the full amount": 2,
        "Written-off but already closed": 1,
        "Written off but already closed": 1,
        "Active written-off account": 0,
    },
    "creditBureauLegalCaseCollectionStatus": {
        "None": 5,
        "Previous case already dismissed/resolved": 4,
        "Previous collection fully paid": 3,
        "Active collection account": 1,
        "Active legal case": 0,
    },
    "creditBureauUnpaidDebtRecord": {
        "None": 5,
        "Yes – More than 10 years ago": 4,
        "Yes – Within the last 10 years": 2,
        "Yes – Within the last 5 years": 0,
        "Yes - More than 10 years already": 4,
        "Yes - in the last 10 years": 2,
        "Yes - in last 5 years": 0,
    },
    "creditBureauLoanAmount": {
        "Less than 1,000": 3,
        "1,000–5,000": 2,
        "More than 1,000 but less than 5,000": 2,
        "More than 5,000": 0,
        "Not Applicable": 3,
    },
    "creditBureauLoanPaidStatus": {
        "Fully paid with certification": 2,
        "Fully paid with Certification": 2,
        "Fully paid without certification": 1,
        "Fully paid without Certification": 1,
        "Not yet paid": 0,
        "Not yet": 0,
        "Not Applicable": 2,
        "Not Applicable - No loan": 2,
    },
}


SECTION_NAMES = {
    "creditBureauLatePaymentFrequency": "payment_history",
    "creditBureauDelinquencyDefaultHistory": "delinquency_default_history",
    "creditBureauOverallBalanceRatio": "outstanding_balance",
    "creditBureauActiveLoanCount": "active_loans",
    "creditBureauCollectionCallsLast12Months": "collection_calls",
    "creditBureauCreditHistoryLength": "credit_history",
    "creditBureauWrittenOffAccountStatus": "written_off_accounts",
    "creditBureauLegalCaseCollectionStatus": "legal_cases_collections",
    "creditBureauUnpaidDebtRecord": "previous_unpaid_debt",
    "creditBureauLoanAmount": "largest_unpaid_loan",
    "creditBureauLoanPaidStatus": "settlement_status",
}


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _payment_interpretation(score: int) -> str:
    return {
        30: "Excellent payment discipline",
        25: "Minor isolated delays",
        18: "Moderate repayment concern",
        10: "Frequent late payer",
        0: "Serious repayment risk",
    }.get(score, "Payment history not provided")


def _utilization_score(credit_limit: float, outstanding_balance: float) -> tuple[float | None, int]:
    if credit_limit <= 0:
        return None, 0

    utilization = max(0.0, (outstanding_balance / credit_limit) * 100.0)
    if utilization < 30:
        return utilization, 10
    if utilization <= 50:
        return utilization, 8
    if utilization <= 70:
        return utilization, 5
    if utilization <= 90:
        return utilization, 2
    return utilization, 0


def compute_credit_bureau_score(
    values: dict[str, Any],
    credit_limit: Any,
    outstanding_balance: Any,
) -> dict[str, Any]:
    section_scores: dict[str, int] = {}
    answers: dict[str, str] = {}
    answered_sections = 0

    for field, score_map in SCORE_MAPS.items():
        answer = str(values.get(field, "")).strip()
        score = score_map.get(answer, 0)
        section_scores[SECTION_NAMES[field]] = score
        answers[field] = answer
        if answer in score_map:
            answered_sections += 1

    utilization_percent, utilization_score = _utilization_score(
        _to_float(credit_limit),
        _to_float(outstanding_balance),
    )
    section_scores["credit_utilization"] = utilization_score
    if utilization_percent is not None:
        answered_sections += 1

    raw_score = sum(section_scores.values())
    normalized_score = round((raw_score / MAX_RAW_SCORE) * 100.0, 2)

    return {
        "score": normalized_score,
        "raw_score": raw_score,
        "max_raw_score": MAX_RAW_SCORE,
        "answered_sections": answered_sections,
        "total_sections": 12,
        "completion_percent": round((answered_sections / 12) * 100.0, 2),
        "utilization_percent": round(utilization_percent, 2) if utilization_percent is not None else None,
        "section_scores": section_scores,
        "answers": answers,
        "payment_history_interpretation": _payment_interpretation(section_scores["payment_history"]),
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
    }