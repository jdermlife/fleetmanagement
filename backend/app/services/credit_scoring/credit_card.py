from __future__ import annotations

from typing import Any

from app.services.credit_scoring.common import requirements_section, safe_text, to_float, years_since


def score_credit_card_capital(payload: Any) -> float:
    banking = requirements_section(payload, "bankingRelationships")
    monthly_income = max(to_float(getattr(payload, "monthly_income", 0.0), 0.0), 1.0)
    requested_limit = max(
        to_float(getattr(payload, "loan_amount", 0.0), 0.0),
        to_float(banking.get("creditLimit"), 0.0),
    )
    available_limit = to_float(banking.get("creditLimit"), 0.0)
    outstanding_balance = to_float(banking.get("outstandingBalance"), 0.0)

    if available_limit > 0:
        utilization_ratio = (outstanding_balance / available_limit) * 100.0
        if utilization_ratio <= 30.0:
            utilization_score = 7.0
        elif utilization_ratio <= 50.0:
            utilization_score = 5.0
        elif utilization_ratio <= 75.0:
            utilization_score = 3.0
        else:
            utilization_score = 0.0
    else:
        utilization_score = 0.0

    relationship_years = years_since(safe_text(banking.get("memberSince")))
    has_card_relationship = bool(safe_text(banking.get("creditCardNumber")))
    if has_card_relationship and relationship_years > 5.0:
        card_relationship_score = 7.0
    elif has_card_relationship and relationship_years >= 2.0:
        card_relationship_score = 5.0
    elif has_card_relationship:
        card_relationship_score = 3.0
    else:
        card_relationship_score = 0.0

    products_count = sum(
        1
        for value in (
            banking.get("accountNumber"),
            banking.get("creditCardNumber"),
            banking.get("loanLender"),
        )
        if safe_text(value)
    )
    current_balance = to_float(banking.get("currentBalance"), 0.0)
    if products_count >= 2 and current_balance > 0:
        banking_score = 6.0
    elif current_balance > 0:
        banking_score = 4.0
    elif products_count > 0:
        banking_score = 2.0
    else:
        banking_score = 0.0

    requested_multiple = requested_limit / monthly_income if monthly_income > 0 else 99.0
    if requested_multiple <= 2.0:
        limit_score = 5.0
    elif requested_multiple <= 3.0:
        limit_score = 3.0
    elif requested_multiple > 3.0:
        limit_score = 1.0
    else:
        limit_score = 0.0
    if requested_limit <= 0:
        limit_score = 0.0

    return utilization_score + card_relationship_score + banking_score + limit_score
