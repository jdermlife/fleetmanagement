from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LeaseScorecardInput:
    customer_name: str
    company_name: str
    vehicle_type: str
    vehicle_value: float
    down_payment: float
    requested_amount: float
    monthly_income: float
    existing_debt: float
    lease_term_months: int
    credit_score: int
    years_in_business: float
    employment_years: float


def compute_lease_scorecard(payload: LeaseScorecardInput) -> dict[str, float | str]:
    financed_amount = max(payload.requested_amount - payload.down_payment, 0.0)
    monthly_estimated_payment = financed_amount / max(payload.lease_term_months, 1)

    debt_service_ratio = (payload.existing_debt + monthly_estimated_payment) / max(payload.monthly_income, 1)
    loan_to_value = financed_amount / max(payload.vehicle_value, 1)
    equity_ratio = payload.down_payment / max(payload.vehicle_value, 1)
    stability_basis = max(payload.years_in_business, payload.employment_years)

    credit_component = _credit_component(payload.credit_score)
    affordability_component = _affordability_component(debt_service_ratio)
    equity_component = _equity_component(equity_ratio)
    stability_component = _stability_component(stability_basis)
    asset_component = _asset_component(loan_to_value)

    final_score = round(
        credit_component * 0.35
        + affordability_component * 0.30
        + equity_component * 0.15
        + stability_component * 0.10
        + asset_component * 0.10,
        2,
    )

    risk_grade = _risk_grade(final_score)
    decision = _decision(final_score)

    summary = (
        f"{payload.customer_name} scored {final_score:.2f}/100 with grade {risk_grade}. "
        f"Estimated monthly lease payment is {monthly_estimated_payment:.2f} and the recommended decision is {decision}."
    )

    return {
        "monthlyEstimatedPayment": round(monthly_estimated_payment, 2),
        "debtServiceRatio": round(debt_service_ratio, 4),
        "loanToValue": round(loan_to_value, 4),
        "creditComponent": round(credit_component, 2),
        "affordabilityComponent": round(affordability_component, 2),
        "equityComponent": round(equity_component, 2),
        "stabilityComponent": round(stability_component, 2),
        "assetComponent": round(asset_component, 2),
        "finalScore": final_score,
        "riskGrade": risk_grade,
        "decision": decision,
        "summary": summary,
    }


def _credit_component(credit_score: int) -> float:
    if credit_score >= 760:
        return 95
    if credit_score >= 720:
        return 88
    if credit_score >= 680:
        return 76
    if credit_score >= 640:
        return 63
    if credit_score >= 600:
        return 48
    return 30


def _affordability_component(debt_service_ratio: float) -> float:
    if debt_service_ratio <= 0.25:
        return 95
    if debt_service_ratio <= 0.35:
        return 82
    if debt_service_ratio <= 0.45:
        return 68
    if debt_service_ratio <= 0.55:
        return 52
    return 30


def _equity_component(equity_ratio: float) -> float:
    if equity_ratio >= 0.35:
        return 94
    if equity_ratio >= 0.25:
        return 82
    if equity_ratio >= 0.15:
        return 68
    if equity_ratio >= 0.10:
        return 55
    return 35


def _stability_component(stability_years: float) -> float:
    if stability_years >= 7:
        return 92
    if stability_years >= 5:
        return 82
    if stability_years >= 3:
        return 70
    if stability_years >= 1:
        return 55
    return 38


def _asset_component(loan_to_value: float) -> float:
    if loan_to_value <= 0.55:
        return 94
    if loan_to_value <= 0.70:
        return 84
    if loan_to_value <= 0.80:
        return 72
    if loan_to_value <= 0.90:
        return 58
    return 36


def _risk_grade(final_score: float) -> str:
    if final_score >= 85:
        return "A"
    if final_score >= 75:
        return "B"
    if final_score >= 65:
        return "C"
    if final_score >= 50:
        return "D"
    return "E"


def _decision(final_score: float) -> str:
    if final_score >= 80:
        return "Approve"
    if final_score >= 65:
        return "Conditional Approval"
    if final_score >= 50:
        return "Manual Review"
    return "Decline"
