from __future__ import annotations

from typing import Any

from app.services.credit_scoring.common import (
    ScoreBand,
    has_adverse_signal,
    monthly_payment,
    parse_years,
    requirements_section,
    safe_text,
    score_from_descending,
    to_float,
    years_since,
)


def score_credit_card_capacity(payload: Any) -> float:
    applicant = requirements_section(payload, "applicantPersonal")
    banking = requirements_section(payload, "bankingRelationships")
    monthly_income = to_float(getattr(payload, "monthly_income", 0.0))
    other_income = to_float(getattr(payload, "other_income", 0.0))
    debt_obligations = to_float(getattr(payload, "debt_obligations", 0.0))
    total_income = max(monthly_income + other_income, 0.0)
    payment = monthly_payment(payload)
    amortization_ratio = (payment / total_income * 100.0) if total_income > 0 else 100.0
    marital_status = safe_text(applicant.get("maritalStatus")).lower()
    married = "married" in marital_status

    if married:
        dti_score = score_from_descending(
            100.0 - amortization_ratio,
            [
                ScoreBand(80.0, 8.0),
                ScoreBand(70.0, 6.0),
                ScoreBand(60.0, 4.0),
                ScoreBand(50.0, 2.0),
            ],
        )
    else:
        dti_score = score_from_descending(
            100.0 - amortization_ratio,
            [
                ScoreBand(80.0, 4.0),
                ScoreBand(70.0, 3.0),
                ScoreBand(60.0, 2.0),
            ],
        )

    disposable_income = total_income - debt_obligations - payment
    disposable_score = score_from_descending(
        disposable_income,
        [
            ScoreBand(100000.0, 6.0),
            ScoreBand(80000.0, 5.0),
            ScoreBand(60000.0, 4.0),
            ScoreBand(40000.0, 2.0),
        ],
    )

    household_members = max(int(to_float(applicant.get("numberOfDependents"), 0.0)), 0)
    household_score = {
        0: 6.0,
        1: 5.0,
        2: 4.0,
        3: 3.0,
        4: 2.0,
    }.get(household_members, 0.0)

    avg_daily_balance = max(
        to_float(banking.get("averageDailyBalance"), 0.0),
        to_float(banking.get("currentBalance"), 0.0),
    )
    average_balance_score = score_from_descending(
        avg_daily_balance,
        [
            ScoreBand(100000.0, 5.0),
            ScoreBand(10000.0, 3.0),
        ],
    )

    return dti_score + disposable_score + household_score + average_balance_score


def score_credit_card_character(payload: Any) -> float:
    banking = requirements_section(payload, "bankingRelationships")
    due_diligence = requirements_section(payload, "enhancedDueDiligence")
    supporting = requirements_section(payload, "supportingDocuments")

    prior_loans = int(to_float(due_diligence.get("numberOfActiveLoans"), 0.0))
    adverse = has_adverse_signal(
        due_diligence.get("previousLoanRestructuringDisclosures"),
        due_diligence.get("priorBankingRelationships"),
        due_diligence.get("characterAndIntegrityAssessmentAnswers"),
        due_diligence.get("spendingBehaviorQuestionnaire"),
    )

    has_credit_history = (
        prior_loans > 0
        or bool(safe_text(banking.get("creditCardNumber")))
        or bool(safe_text(banking.get("loanLender")))
    )
    structured_credit_history_score = score_credit_payment_history(
        safe_text(banking.get("creditPaymentHistory"))
    )
    if structured_credit_history_score != 0.0 or safe_text(banking.get("creditPaymentHistory")):
        borrowing_score = structured_credit_history_score
    elif adverse:
        borrowing_score = -10.0
    elif has_credit_history:
        borrowing_score = 10.0
    else:
        borrowing_score = 0.0

    current_balance = to_float(banking.get("currentBalance"), 0.0)
    structured_account_handling_score = score_account_handling(
        safe_text(banking.get("accountHandling"))
    )
    if structured_account_handling_score != 0.0 or safe_text(banking.get("accountHandling")):
        deposit_score = structured_account_handling_score
    elif adverse and current_balance <= 0:
        deposit_score = -5.0
    elif current_balance >= 100000.0:
        deposit_score = 5.0
    elif current_balance > 0 or safe_text(banking.get("accountNumber")):
        deposit_score = 3.0
    else:
        deposit_score = 0.0

    utility_docs_present = any(
        bool(supporting.get(key))
        for key in ("utilityBill", "waterBill", "internetBill", "bankStatements")
    )
    structured_utility_score = score_utility_credit_bureau_status(
        safe_text(banking.get("utilityCreditBureauStatus"))
    )
    if structured_utility_score != 0.0 or safe_text(banking.get("utilityCreditBureauStatus")):
        utility_score = structured_utility_score
    elif adverse:
        utility_score = -6.0
    elif utility_docs_present:
        utility_score = 6.0
    elif has_credit_history:
        utility_score = 3.0
    else:
        utility_score = 0.0

    lifestyle_indicator = safe_text(due_diligence.get("lifestyleIndicator")).lower()
    if "respectable" in lifestyle_indicator:
        lifestyle_score = 4.0
    elif "adverse" in lifestyle_indicator or "signs" in lifestyle_indicator:
        lifestyle_score = 0.0
    else:
        lifestyle_score = 0.0 if adverse else 4.0

    return borrowing_score + deposit_score + utility_score + lifestyle_score


def score_credit_card_condition(payload: Any) -> float:
    employment = requirements_section(payload, "employmentInformation")
    address = requirements_section(payload, "addressInformation")

    employment_location = safe_text(employment.get("employmentLocation")).lower()
    employment_status = safe_text(employment.get("employmentStatus")).lower()
    if "not locally" in employment_location or any(
        keyword in employment_status for keyword in ("abroad", "overseas", "foreign")
    ):
        employment_score = 4.0
    elif "ofw" in employment_status or "locally" in employment_location or employment_status:
        employment_score = 8.0
    else:
        employment_score = 0.0

    employer_business_years = max(
        to_float(employment.get("employerBusinessYears"), 0.0),
        0.0,
    )
    service_years = max(
        parse_years(employment.get("totalYearsWorking")),
        years_since(safe_text(employment.get("dateHired"))),
    )
    employer_score = score_from_descending(
        employer_business_years if employer_business_years > 0 else service_years,
        [
            ScoreBand(10.0, 7.0),
            ScoreBand(5.0, 5.0),
            ScoreBand(3.0, 3.0),
        ],
    )
    service_score = score_from_descending(
        service_years,
        [
            ScoreBand(5.0, 5.0),
            ScoreBand(3.0, 3.0),
            ScoreBand(1.0, 1.0),
        ],
    )
    stay_years = parse_years(address.get("lengthOfStay"))
    stay_score = score_from_descending(
        stay_years,
        [
            ScoreBand(5.0, 5.0),
            ScoreBand(3.0, 3.0),
            ScoreBand(1.0, 1.0),
        ],
    )

    return employment_score + employer_score + service_score + stay_score


def score_credit_card_capital(payload: Any) -> float:
    banking = requirements_section(payload, "bankingRelationships")
    product = requirements_section(payload, "productInformation")
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

    explicit_relationship_status = safe_text(
        banking.get("creditCardRelationshipStatus")
    ).lower()
    relationship_years = years_since(safe_text(banking.get("memberSince")))
    has_card_relationship = bool(safe_text(banking.get("creditCardNumber")))
    if "more than 5 years" in explicit_relationship_status:
        card_relationship_score = 7.0
    elif "2–5 years" in explicit_relationship_status or "2-5 years" in explicit_relationship_status:
        card_relationship_score = 5.0
    elif "less than 2 years" in explicit_relationship_status or "new cardholder" in explicit_relationship_status:
        card_relationship_score = 3.0
    elif "no previous" in explicit_relationship_status:
        card_relationship_score = 0.0
    elif has_card_relationship and relationship_years > 5.0:
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
    banking_relationship_tier = safe_text(banking.get("bankingRelationshipTier")).lower()
    if "premium/preferred" in banking_relationship_tier or "premium" in banking_relationship_tier:
        banking_score = 6.0
    elif "active savings/current account" in banking_relationship_tier or "regular transactions" in banking_relationship_tier:
        banking_score = 4.0
    elif "limited banking relationship" in banking_relationship_tier:
        banking_score = 2.0
    elif "no banking relationship" in banking_relationship_tier:
        banking_score = 0.0
    elif products_count >= 2 and current_balance > 0:
        banking_score = 6.0
    elif current_balance > 0:
        banking_score = 4.0
    elif products_count > 0:
        banking_score = 2.0
    else:
        banking_score = 0.0

    policy_maximum_limit = max(
        to_float(getattr(payload, "policy_maximum_credit_limit", 0.0), 0.0),
        to_float(getattr(payload, "policyMaximumCreditLimit", 0.0), 0.0),
        to_float(product.get("policyMaximumCreditLimit"), 0.0),
        to_float(product.get("maximumCreditLimit"), 0.0),
        to_float(product.get("creditCardPolicyMaximum"), 0.0),
    )
    requested_multiple = requested_limit / monthly_income if monthly_income > 0 else 99.0
    if policy_maximum_limit > 0 and requested_limit > policy_maximum_limit:
        limit_score = 0.0
    elif requested_multiple <= 2.0:
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


def score_credit_payment_history(value: str) -> float:
    normalized = safe_text(value).lower()
    if "excellent" in normalized or "no past due" in normalized:
        return 10.0
    if "satisfactory" in normalized:
        return 5.0
    if "no previous" in normalized:
        return 0.0
    if "not properly" in normalized or "delayed" in normalized:
        return -10.0
    return 0.0


def score_account_handling(value: str) -> float:
    normalized = safe_text(value).lower()
    if "excellent" in normalized:
        return 5.0
    if "satisfactory" in normalized:
        return 3.0
    if "not properly" in normalized:
        return -5.0
    return 0.0


def score_utility_credit_bureau_status(value: str) -> float:
    normalized = safe_text(value).lower()
    if "very satisfactory" in normalized or "satisfactory" in normalized:
        return 6.0
    if "dismissed" in normalized or "settled" in normalized:
        return 3.0
    if "not satisfactory" in normalized:
        return -6.0
    return 0.0
