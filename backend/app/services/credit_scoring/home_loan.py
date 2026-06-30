from __future__ import annotations

from typing import Any

from app.services.credit_scoring.common import (
    monthly_payment,
    parse_years,
    requirements_section,
    safe_text,
    score_from_keyword,
    to_float,
    years_since,
)


def score_home_loan_capacity(payload: Any) -> float:
    applicant = requirements_section(payload, "applicantPersonal")
    banking = requirements_section(payload, "bankingRelationships")

    monthly_income = max(to_float(getattr(payload, "monthly_income", 0.0), 0.0), 0.0)
    other_income = max(to_float(getattr(payload, "other_income", 0.0), 0.0), 0.0)
    total_income = monthly_income + other_income
    debt_obligations = max(to_float(getattr(payload, "debt_obligations", 0.0), 0.0), 0.0)
    payment = monthly_payment(payload)

    if total_income > 0:
        amortization_ratio = (payment / total_income) * 100.0
        debt_service_ratio = ((debt_obligations + payment) / total_income) * 100.0
    else:
        amortization_ratio = 100.0
        debt_service_ratio = 100.0

    if amortization_ratio <= 20.0:
        debt_to_income_score = 4.0
    elif amortization_ratio <= 30.0:
        debt_to_income_score = 3.0
    elif amortization_ratio <= 40.0:
        debt_to_income_score = 2.0
    elif amortization_ratio <= 50.0:
        debt_to_income_score = 1.0
    else:
        debt_to_income_score = 0.0

    if debt_service_ratio < 20.0:
        debt_service_score = 45.0
    elif debt_service_ratio < 30.0:
        debt_service_score = 35.0
    elif debt_service_ratio < 40.0:
        debt_service_score = 25.0
    elif debt_service_ratio < 50.0:
        debt_service_score = 5.0
    else:
        debt_service_score = 0.0

    household_members = max(int(to_float(applicant.get("numberOfDependents"), 0.0)), 0)
    household_score = {
        0: 4.0,
        1: 3.0,
        2: 2.0,
        3: 1.0,
    }.get(household_members, 0.0)

    average_daily_balance = max(
        to_float(banking.get("averageDailyBalance"), 0.0),
        to_float(banking.get("currentBalance"), 0.0),
    )
    if average_daily_balance >= 100000.0:
        balance_score = 2.0
    elif average_daily_balance >= 10000.0:
        balance_score = 1.0
    else:
        balance_score = 0.0

    return debt_to_income_score + debt_service_score + household_score + balance_score


def score_home_loan_character(payload: Any) -> float:
    banking = requirements_section(payload, "bankingRelationships")
    due_diligence = requirements_section(payload, "enhancedDueDiligence")
    supporting = requirements_section(payload, "supportingDocuments")

    credit_history_text = safe_text(banking.get("creditPaymentHistory")).lower()
    has_credit_history = any(
        safe_text(value)
        for value in (
            banking.get("creditCardNumber"),
            banking.get("loanLender"),
            due_diligence.get("numberOfActiveLoans"),
        )
    )
    if "excellent" in credit_history_text or "no past due" in credit_history_text:
        borrowing_score = 7.0
    elif "satisfactory" in credit_history_text:
        borrowing_score = 3.0
    elif "no previous" in credit_history_text:
        borrowing_score = 0.0
    elif "not properly" in credit_history_text or "delayed" in credit_history_text:
        borrowing_score = -10.0
    elif has_credit_history:
        borrowing_score = 7.0
    else:
        borrowing_score = 0.0

    account_handling_text = safe_text(banking.get("accountHandling")).lower()
    has_bank_account = bool(safe_text(banking.get("accountNumber"))) or (
        to_float(banking.get("currentBalance"), 0.0) > 0
    )
    if "excellent" in account_handling_text or "no returned checks" in account_handling_text:
        deposit_score = 3.0
    elif "satisfactory" in account_handling_text:
        deposit_score = 1.0
    elif "not properly" in account_handling_text:
        deposit_score = -10.0
    elif has_bank_account:
        deposit_score = 3.0
    else:
        deposit_score = 0.0

    utility_text = safe_text(banking.get("utilityCreditBureauStatus")).lower()
    utility_docs_present = any(
        bool(supporting.get(key))
        for key in ("utilityBill", "waterBill", "internetBill", "bankStatements")
    )
    if "very satisfactory" in utility_text or "satisfactory" in utility_text:
        utility_score = 2.0
    elif "dismissed" in utility_text or "settled" in utility_text:
        utility_score = 1.0
    elif "not satisfactory" in utility_text:
        utility_score = -10.0
    elif utility_docs_present:
        utility_score = 2.0
    else:
        utility_score = 0.0

    lifestyle_text = safe_text(due_diligence.get("lifestyleIndicator")).lower()
    if "respectable" in lifestyle_text:
        lifestyle_score = 3.0
    elif "adverse" in lifestyle_text or "gambling" in lifestyle_text or "drinking" in lifestyle_text:
        lifestyle_score = 0.0
    else:
        lifestyle_score = 3.0

    return borrowing_score + deposit_score + utility_score + lifestyle_score


def score_home_loan_collateral(payload: Any) -> float:
    collateral = requirements_section(payload, "collateralInformation")
    applicant = requirements_section(payload, "otherInformation")
    product = requirements_section(payload, "productInformation")

    explicit_marketability = safe_text(collateral.get("propertyMarketabilityCategory")).lower()
    property_descriptor = " ".join(
        filter(
            None,
            [
                safe_text(product.get("homeCollateralType")),
                safe_text(collateral.get("propertyAddress")),
            ],
        )
    ).lower()
    if "class a" in explicit_marketability or "class b" in explicit_marketability or "class c" in explicit_marketability or "subdivision" in explicit_marketability or "condominium" in explicit_marketability:
        marketability_score = 3.0
    elif "lowcost" in explicit_marketability or "low cost" in explicit_marketability:
        marketability_score = 2.0
    elif "outside" in explicit_marketability:
        marketability_score = 0.0
    else:
        marketability_score = score_from_keyword(
            property_descriptor,
            [
                (("subdivision", "condominium", "condo"), 3.0),
                (("lowcost", "low cost"), 2.0),
            ],
            fallback=0.0 if not property_descriptor else 2.0,
        )

    property_value = max(
        to_float(collateral.get("propertyAppraisedValue"), 0.0),
        to_float(getattr(payload, "appraised_value", 0.0), 0.0),
    )
    if property_value > 3000000.0:
        value_score = 3.0
    elif property_value >= 1000000.0:
        value_score = 2.0
    elif property_value >= 300000.0:
        value_score = 1.0
    else:
        value_score = 0.0

    explicit_house_unit = safe_text(collateral.get("houseUnitModelCategory")).lower()
    if "single detached" in explicit_house_unit:
        unit_model_score = 4.0
    elif "single attached" in explicit_house_unit or "condominium" in explicit_house_unit:
        unit_model_score = 3.0
    elif "townhouse" in explicit_house_unit:
        unit_model_score = 2.0
    elif "row house" in explicit_house_unit:
        unit_model_score = 0.0
    else:
        unit_model_score = score_from_keyword(
            property_descriptor,
            [
                (("single detached",), 4.0),
                (("single attached", "condominium", "condo"), 3.0),
                (("townhouse",), 2.0),
                (("row house",), 0.0),
            ],
            fallback=0.0 if not property_descriptor else 3.0,
        )

    explicit_collateral_type = safe_text(collateral.get("collateralOccupancyType")).lower()
    home_ownership = safe_text(applicant.get("homeOwnership")).lower()
    if "primary residence" in explicit_collateral_type:
        collateral_type_score = 5.0
    elif "not used" in explicit_collateral_type:
        collateral_type_score = 3.0
    elif any(keyword in home_ownership for keyword in ("owner", "owned", "mortgaged")):
        collateral_type_score = 5.0
    elif property_descriptor:
        collateral_type_score = 3.0
    else:
        collateral_type_score = 0.0

    return marketability_score + value_score + unit_model_score + collateral_type_score


def score_home_loan_condition(payload: Any) -> float:
    employment = requirements_section(payload, "employmentInformation")
    address = requirements_section(payload, "addressInformation")

    employment_location = safe_text(employment.get("employmentLocation")).lower()
    employment_status = safe_text(employment.get("employmentStatus")).lower()
    employment_text = " ".join(filter(None, [employment_location, employment_status]))
    if "ofw" in employment_text:
        employment_score = 5.0
    elif "locally employed" in employment_text or "local" in employment_text:
        employment_score = 5.0
    elif "not locally employed" in employment_text or any(
        keyword in employment_text for keyword in ("abroad", "overseas", "foreign")
    ):
        employment_score = 4.0
    elif employment_text:
        employment_score = 4.0
    else:
        employment_score = 0.0

    service_years = max(
        parse_years(employment.get("totalYearsWorking")),
        years_since(safe_text(employment.get("dateHired"))),
    )
    employer_business_years = max(
        to_float(employment.get("employerBusinessYears"), 0.0),
        service_years,
    )
    if employer_business_years > 10.0:
        employer_score = 4.0
    elif employer_business_years >= 5.0:
        employer_score = 3.0
    elif employer_business_years >= 3.0:
        employer_score = 2.0
    else:
        employer_score = 0.0

    if service_years >= 5.0:
        service_score = 3.0
    elif service_years >= 3.0:
        service_score = 2.0
    elif service_years >= 1.0:
        service_score = 1.0
    else:
        service_score = 0.0

    stay_years = parse_years(address.get("lengthOfStay"))
    if stay_years >= 5.0:
        stay_score = 3.0
    elif stay_years >= 3.0:
        stay_score = 2.0
    elif stay_years >= 1.0:
        stay_score = 1.0
    else:
        stay_score = 0.0

    return employment_score + employer_score + service_score + stay_score
