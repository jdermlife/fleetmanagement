from __future__ import annotations

from typing import Any

from app.services.credit_scoring import (
    GradeBand,
    ScoreBand,
    grade_for_score,
    has_adverse_signal,
    monthly_payment,
    normalize_product_type,
    parse_years,
    requirements_section,
    score_account_handling,
    safe_text,
    score_auto_loan_collateral,
    score_credit_card_capital,
    score_credit_payment_history,
    score_from_descending,
    score_home_loan_collateral,
    score_personal_loan_capital,
    score_utility_credit_bureau_status,
    to_float,
    years_since,
)


def _score_capacity(payload: Any) -> float:
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


def _score_character(payload: Any) -> float:
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


def _score_condition(payload: Any) -> float:
    employment = requirements_section(payload, "employmentInformation")
    address = requirements_section(payload, "addressInformation")

    employment_location = safe_text(employment.get("employmentLocation")).lower()
    employment_status = safe_text(employment.get("employmentStatus")).lower()
    if "not locally" in employment_location or any(keyword in employment_status for keyword in ("abroad", "overseas", "foreign", "ofw")):
        employment_score = 4.0
    elif "locally" in employment_location or employment_status:
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


def _score_product_specific_sections(payload: Any, product_type: str) -> tuple[float, float]:
    if product_type == "Home Loan":
        return 0.0, score_home_loan_collateral(payload)
    if product_type == "Auto Loan":
        return 0.0, score_auto_loan_collateral(payload)
    if product_type == "Credit Card":
        return score_credit_card_capital(payload), 0.0
    return score_personal_loan_capital(payload), 0.0


def compute_credit_score(payload: Any) -> dict[str, float | str]:
    product_type = normalize_product_type(payload)
    capacity_score = _score_capacity(payload)
    character_score = _score_character(payload)
    conditions_score = _score_condition(payload)
    capital_score, collateral_score = _score_product_specific_sections(payload, product_type)

    scorecard_total = round(
        capacity_score + character_score + capital_score + collateral_score + conditions_score,
        2,
    )
    bureau_score = round(min(850.0, max(300.0, 300.0 + (scorecard_total * 5.5))), 2)
    grade = grade_for_score(scorecard_total)

    return {
        "character_score": round(character_score, 2),
        "capacity_score": round(capacity_score, 2),
        "capital_score": round(capital_score, 2),
        "collateral_score": round(collateral_score, 2),
        "conditions_score": round(conditions_score, 2),
        "bureau_score": bureau_score,
        "internal_score": round(scorecard_total, 2),
        "total_credit_score": round(scorecard_total, 2),
        "credit_grade": grade.label,
        "model_version": f"product-scorecard-v1:{product_type}",
    }


def evaluate(application: Any) -> dict[str, float | str]:
    return compute_credit_score(application)
