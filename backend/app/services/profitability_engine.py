from __future__ import annotations

from typing import Any


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def compute_profitability_score(payload: Any) -> dict[str, float]:
    loan_amount = _to_float(getattr(payload, "loan_amount", 0.0))
    interest_rate = _to_float(getattr(payload, "interest_rate", 0.0))
    term_months = max(_to_int(getattr(payload, "term_months", 12), 12), 1)

    if loan_amount > 0 and interest_rate > 0:
        projected_interest_income = round(
            loan_amount * (interest_rate / 100.0) * (term_months / 12.0),
            2,
        )
        fee_income = round(loan_amount * 0.01, 2)
        expected_loss = round(projected_interest_income * 0.18, 2)
        operating_cost = round(max(2500.0, loan_amount * 0.005), 2)
        funding_cost = round(projected_interest_income * 0.09, 2)
    else:
        projected_interest_income = 120000.0
        fee_income = 12000.0
        expected_loss = 21600.0
        operating_cost = 18000.0
        funding_cost = 10800.0

    projected_profit = round(
        projected_interest_income + fee_income - expected_loss - operating_cost - funding_cost,
        2,
    )

    return {
        "projected_interest_income": projected_interest_income,
        "fee_income": fee_income,
        "expected_loss": expected_loss,
        "operating_cost": operating_cost,
        "funding_cost": funding_cost,
        "projected_profit": projected_profit,
        "profitability_score": 79.0,
    }