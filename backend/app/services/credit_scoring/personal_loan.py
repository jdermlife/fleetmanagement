from __future__ import annotations

from typing import Any

from app.services.credit_scoring.common import (
    parse_years,
    requirements_section,
    safe_text,
    score_from_descending,
    to_float,
    years_since,
    ScoreBand,
)


def score_personal_loan_capital(payload: Any) -> float:
    banking = requirements_section(payload, "bankingRelationships")
    employment = requirements_section(payload, "employmentInformation")

    current_balance = to_float(banking.get("currentBalance"), 0.0)
    if current_balance > 500000.0:
        savings_score = 7.0
    elif current_balance >= 200000.0:
        savings_score = 5.0
    elif current_balance >= 50000.0:
        savings_score = 3.0
    else:
        savings_score = 0.0

    income_years = max(
        parse_years(employment.get("totalYearsWorking")),
        years_since(safe_text(employment.get("dateHired"))),
    )
    income_stability_score = score_from_descending(
        income_years,
        [
            ScoreBand(5.0, 7.0),
            ScoreBand(3.0, 5.0),
            ScoreBand(1.0, 3.0),
        ],
    )

    monthly_expenses = max(to_float(employment.get("monthlyLivingExpenses"), 0.0), 1.0)
    liquid_assets = (
        current_balance
        + max(to_float(employment.get("investmentIncome"), 0.0), 0.0)
        + max(to_float(employment.get("businessIncome"), 0.0), 0.0)
        + max(to_float(employment.get("pensionIncome"), 0.0), 0.0)
    )
    months_of_coverage = liquid_assets / monthly_expenses if monthly_expenses > 0 else 0.0
    emergency_score = score_from_descending(
        months_of_coverage,
        [
            ScoreBand(12.0, 6.0),
            ScoreBand(6.0, 4.0),
            ScoreBand(3.0, 2.0),
        ],
    )

    secondary_sources = 0
    for numeric_value in (
        employment.get("otherSourcesOfIncome"),
        employment.get("investmentIncome"),
        employment.get("businessIncome"),
        employment.get("pensionIncome"),
    ):
        if to_float(numeric_value, 0.0) > 0:
            secondary_sources += 1
    if safe_text(employment.get("otherIncome")):
        secondary_sources = max(secondary_sources, 1)

    if secondary_sources >= 2:
        secondary_income_score = 5.0
    elif secondary_sources == 1:
        secondary_income_score = 3.0
    else:
        secondary_income_score = 0.0

    return savings_score + income_stability_score + emergency_score + secondary_income_score
