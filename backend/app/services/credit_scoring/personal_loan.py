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


def score_personal_loan_capacity(payload: Any) -> float:
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


def score_personal_loan_character(payload: Any) -> float:
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
    credit_history_text = safe_text(banking.get("creditPaymentHistory")).lower()
    if "excellent" in credit_history_text or "no past due" in credit_history_text:
        borrowing_score = 10.0
    elif "satisfactory" in credit_history_text:
        borrowing_score = 5.0
    elif "no previous" in credit_history_text:
        borrowing_score = 0.0
    elif "not properly" in credit_history_text or "delayed" in credit_history_text:
        borrowing_score = -10.0
    elif adverse:
        borrowing_score = -10.0
    elif has_credit_history:
        borrowing_score = 10.0
    else:
        borrowing_score = 0.0

    current_balance = to_float(banking.get("currentBalance"), 0.0)
    account_handling_text = safe_text(banking.get("accountHandling")).lower()
    if "excellent" in account_handling_text:
        deposit_score = 5.0
    elif "satisfactory" in account_handling_text:
        deposit_score = 3.0
    elif "not properly" in account_handling_text:
        deposit_score = -5.0
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
    utility_text = safe_text(banking.get("utilityCreditBureauStatus")).lower()
    if "very satisfactory" in utility_text or "satisfactory" in utility_text:
        utility_score = 6.0
    elif "dismissed" in utility_text or "settled" in utility_text:
        utility_score = 3.0
    elif "not satisfactory" in utility_text:
        utility_score = -6.0
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


def score_personal_loan_condition(payload: Any) -> float:
    employment = requirements_section(payload, "employmentInformation")
    address = requirements_section(payload, "addressInformation")

    employment_location = safe_text(employment.get("employmentLocation")).lower()
    employment_status = safe_text(employment.get("employmentStatus")).lower()
    if "not locally" in employment_location or any(
        keyword in employment_status for keyword in ("abroad", "overseas", "foreign", "ofw")
    ):
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


def score_personal_loan_capital(payload: Any) -> float:
    banking = requirements_section(payload, "bankingRelationships")
    employment = requirements_section(payload, "employmentInformation")
    due_diligence = requirements_section(payload, "enhancedDueDiligence")

    current_balance = to_float(banking.get("currentBalance"), 0.0)
    average_savings_balance = max(
        to_float(banking.get("averageSavingsBalance"), 0.0),
        current_balance,
    )
    deposit_regularity = safe_text(banking.get("depositRegularity")).lower()
    if average_savings_balance > 500000.0 and "regular" in deposit_regularity:
        savings_score = 7.0
    elif average_savings_balance >= 200000.0:
        savings_score = 5.0
    elif average_savings_balance >= 50000.0:
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

    secondary_income_profile = safe_text(due_diligence.get("secondaryIncomeProfile")).lower()
    if "multiple stable" in secondary_income_profile:
        secondary_income_score = 5.0
    elif "one additional regular" in secondary_income_profile:
        secondary_income_score = 3.0
    elif "occasional" in secondary_income_profile:
        secondary_income_score = 1.0
    elif "no secondary" in secondary_income_profile:
        secondary_income_score = 0.0
    else:
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
