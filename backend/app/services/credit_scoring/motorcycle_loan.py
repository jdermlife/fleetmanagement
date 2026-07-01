from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.services.credit_scoring.common import (
    monthly_payment,
    requirements_section,
    safe_text,
    to_float,
)


HIGH_DEMAND_MOTORCYCLE_BRANDS = {"honda", "yamaha", "suzuki", "kawasaki"}
ESTABLISHED_MOTORCYCLE_BRANDS = {
    "kymco",
    "vespa",
    "bmw",
    "ducati",
    "ktm",
    "benelli",
    "cfmoto",
    "triumph",
}
LOW_DEMAND_MOTORCYCLE_BRANDS = {"rusi", "motorstar", "skygo", "keeway"}


def score_motorcycle_loan_capacity(payload: Any) -> float:
    banking = requirements_section(payload, "bankingRelationships")
    due_diligence = requirements_section(payload, "enhancedDueDiligence")
    employment = requirements_section(payload, "employmentInformation")

    monthly_income = max(to_float(getattr(payload, "monthly_income", 0.0), 0.0), 0.0)
    other_income = max(to_float(getattr(payload, "other_income", 0.0), 0.0), 0.0)
    total_income = monthly_income + other_income
    debt_obligations = max(to_float(getattr(payload, "debt_obligations", 0.0), 0.0), 0.0)
    proposed_amortization = max(
        to_float(banking.get("loanMonthlyAmortization"), 0.0),
        monthly_payment(payload),
    )
    dsr = ((debt_obligations + proposed_amortization) / total_income * 100.0) if total_income > 0 else 100.0

    if dsr <= 20.0:
        dsr_score = 15.0
    elif dsr <= 30.0:
        dsr_score = 12.0
    elif dsr <= 40.0:
        dsr_score = 8.0
    elif dsr <= 50.0:
        dsr_score = 4.0
    else:
        dsr_score = 0.0

    disposable_income = total_income - debt_obligations - proposed_amortization
    if disposable_income > 50000.0:
        disposable_score = 8.0
    elif disposable_income >= 35000.0:
        disposable_score = 6.0
    elif disposable_income >= 20000.0:
        disposable_score = 4.0
    elif disposable_income >= 10000.0:
        disposable_score = 2.0
    else:
        disposable_score = 0.0

    average_daily_balance = max(
        to_float(banking.get("averageDailyBalance"), 0.0),
        to_float(banking.get("currentBalance"), 0.0),
    )
    if average_daily_balance > 200000.0:
        adb_score = 6.0
    elif average_daily_balance >= 100000.0:
        adb_score = 5.0
    elif average_daily_balance >= 50000.0:
        adb_score = 3.0
    else:
        adb_score = 0.0

    secondary_income_profile = safe_text(due_diligence.get("secondaryIncomeProfile")).lower()
    if "multiple stable" in secondary_income_profile:
        secondary_income_score = 6.0
    elif "one additional regular" in secondary_income_profile or "one stable" in secondary_income_profile:
        secondary_income_score = 4.0
    elif "occasional" in secondary_income_profile:
        secondary_income_score = 2.0
    elif "no secondary" in secondary_income_profile:
        secondary_income_score = 0.0
    else:
        additional_sources = 0
        for numeric_value in (
            employment.get("otherSourcesOfIncome"),
            employment.get("investmentIncome"),
            employment.get("businessIncome"),
            employment.get("pensionIncome"),
        ):
            if to_float(numeric_value, 0.0) > 0:
                additional_sources += 1
        if safe_text(employment.get("otherIncome")):
            additional_sources = max(additional_sources, 1)

        if additional_sources >= 2:
            secondary_income_score = 6.0
        elif additional_sources == 1:
            secondary_income_score = 4.0
        else:
            secondary_income_score = 0.0

    return dsr_score + disposable_score + adb_score + secondary_income_score


def score_motorcycle_loan_character(payload: Any) -> float:
    banking = requirements_section(payload, "bankingRelationships")
    address = requirements_section(payload, "addressInformation")

    credit_history = safe_text(banking.get("creditPaymentHistory")).lower()
    if "excellent" in credit_history or "no past due" in credit_history:
        credit_history_score = 10.0
    elif "satisfactory" in credit_history:
        credit_history_score = 6.0
    elif "no previous" in credit_history:
        credit_history_score = 4.0
    elif "poor" in credit_history or "not properly" in credit_history or "delayed" in credit_history:
        credit_history_score = 0.0
    elif safe_text(banking.get("loanLender")) or safe_text(banking.get("creditCardNumber")):
        credit_history_score = 6.0
    else:
        credit_history_score = 4.0

    deposit_handling = safe_text(banking.get("accountHandling")).lower()
    if "excellent" in deposit_handling:
        deposit_score = 5.0
    elif "good" in deposit_handling or "satisfactory" in deposit_handling:
        deposit_score = 3.0
    else:
        deposit_score = 0.0

    utility_status = safe_text(banking.get("utilityCreditBureauStatus")).lower()
    if "excellent" in utility_status or "very satisfactory" in utility_status or "satisfactory" in utility_status:
        utility_score = 5.0
    elif "minor" in utility_status or "dismissed" in utility_status or "settled" in utility_status:
        utility_score = 3.0
    else:
        utility_score = 0.0

    stay_years = max(to_float(address.get("lengthOfStay"), 0.0), 0.0)
    if stay_years == 0:
        from app.services.credit_scoring.common import parse_years

        stay_years = parse_years(address.get("lengthOfStay"))
    if stay_years >= 5.0:
        discipline_score = 5.0
    elif stay_years >= 3.0:
        discipline_score = 3.0
    elif stay_years >= 1.0:
        discipline_score = 1.0
    else:
        discipline_score = 0.0

    return credit_history_score + deposit_score + utility_score + discipline_score


def score_motorcycle_loan_collateral(payload: Any) -> float:
    collateral = requirements_section(payload, "collateralAssetDetails")

    explicit_marketability = safe_text(collateral.get("vehicleMarketabilityCategory")).lower()
    brand = safe_text(collateral.get("brand") or collateral.get("maker")).lower()
    if any(keyword in explicit_marketability for keyword in ("honda", "yamaha", "suzuki", "kawasaki")):
        brand_score = 6.0
    elif "other established" in explicit_marketability:
        brand_score = 4.0
    elif "low-demand" in explicit_marketability:
        brand_score = 2.0
    elif "unknown" in explicit_marketability or "obsolete" in explicit_marketability:
        brand_score = 0.0
    elif brand in HIGH_DEMAND_MOTORCYCLE_BRANDS:
        brand_score = 6.0
    elif brand in ESTABLISHED_MOTORCYCLE_BRANDS:
        brand_score = 4.0
    elif brand in LOW_DEMAND_MOTORCYCLE_BRANDS:
        brand_score = 2.0
    else:
        brand_score = 0.0 if not brand else 2.0

    motorcycle_value = max(
        to_float(collateral.get("appraisedValue"), 0.0),
        to_float(getattr(payload, "appraised_value", 0.0), 0.0),
    )
    if motorcycle_value > 250000.0:
        value_score = 5.0
    elif motorcycle_value >= 150000.0:
        value_score = 4.0
    elif motorcycle_value >= 80000.0:
        value_score = 3.0
    elif motorcycle_value >= 50000.0:
        value_score = 2.0
    else:
        value_score = 0.0

    year_text = safe_text(collateral.get("year"))
    current_year = datetime.now(UTC).year
    vehicle_year = int(to_float(year_text, 0.0)) if year_text else 0
    vehicle_age = max(current_year - vehicle_year, 0) if vehicle_year else 99
    if vehicle_age <= 0:
        age_score = 5.0
    elif vehicle_age <= 2:
        age_score = 4.0
    elif vehicle_age <= 5:
        age_score = 2.0
    else:
        age_score = 0.0

    intended_use = safe_text(collateral.get("motorcycleIntendedUse")).lower()
    if "personal use" in intended_use and "occasional" not in intended_use:
        intended_use_score = 4.0
    elif "occasional business" in intended_use:
        intended_use_score = 3.0
    elif "delivery" in intended_use or "ride-hailing" in intended_use:
        intended_use_score = 2.0
    elif "commercial" in intended_use or "high mileage" in intended_use:
        intended_use_score = 0.0
    else:
        intended_use_score = 0.0

    return brand_score + value_score + age_score + intended_use_score


def compute_motorcycle_loan_collateral_breakdown(payload: Any) -> dict[str, float]:
    collateral = requirements_section(payload, "collateralAssetDetails")
    total_score = score_motorcycle_loan_collateral(payload)

    brand = safe_text(collateral.get("brand") or collateral.get("maker")).lower()
    explicit_marketability = safe_text(collateral.get("vehicleMarketabilityCategory")).lower()
    if any(keyword in explicit_marketability for keyword in ("honda", "yamaha", "suzuki", "kawasaki")) or brand in HIGH_DEMAND_MOTORCYCLE_BRANDS:
        marketability_score = 6.0
    elif "other established" in explicit_marketability or brand in ESTABLISHED_MOTORCYCLE_BRANDS:
        marketability_score = 4.0
    elif "low-demand" in explicit_marketability or brand in LOW_DEMAND_MOTORCYCLE_BRANDS:
        marketability_score = 2.0
    else:
        marketability_score = 0.0 if not brand else 2.0

    motorcycle_value = max(
        to_float(collateral.get("appraisedValue"), 0.0),
        to_float(getattr(payload, "appraised_value", 0.0), 0.0),
    )
    if motorcycle_value > 250000.0:
        value_score = 5.0
    elif motorcycle_value >= 150000.0:
        value_score = 4.0
    elif motorcycle_value >= 80000.0:
        value_score = 3.0
    elif motorcycle_value >= 50000.0:
        value_score = 2.0
    else:
        value_score = 0.0

    year_text = safe_text(collateral.get("year"))
    current_year = datetime.now(UTC).year
    vehicle_year = int(to_float(year_text, 0.0)) if year_text else 0
    vehicle_age = max(current_year - vehicle_year, 0) if vehicle_year else 99
    if vehicle_age <= 0:
        age_score = 5.0
    elif vehicle_age <= 2:
        age_score = 4.0
    elif vehicle_age <= 5:
        age_score = 2.0
    else:
        age_score = 0.0

    intended_use = safe_text(collateral.get("motorcycleIntendedUse")).lower()
    if "personal use" in intended_use and "occasional" not in intended_use:
        intended_use_score = 4.0
    elif "occasional business" in intended_use:
        intended_use_score = 3.0
    elif "delivery" in intended_use or "ride-hailing" in intended_use:
        intended_use_score = 2.0
    elif "commercial" in intended_use or "high mileage" in intended_use:
        intended_use_score = 0.0
    else:
        intended_use_score = 0.0

    return {
        "marketability_score": marketability_score,
        "value_score": value_score,
        "age_score": age_score,
        "use_score": intended_use_score,
        "total_score": total_score,
    }


def score_motorcycle_loan_condition(payload: Any) -> float:
    employment = requirements_section(payload, "employmentInformation")
    address = requirements_section(payload, "addressInformation")

    employment_status = safe_text(employment.get("employmentStatus")).lower()
    employer_years = max(to_float(employment.get("employerBusinessYears"), 0.0), 0.0)
    if "permanent" in employment_status or "government" in employment_status or "ofw" in employment_status:
        employment_type_score = 8.0
    elif "business owner" in employment_status and employer_years > 3.0:
        employment_type_score = 7.0
    elif "self-employed" in employment_status or "self employed" in employment_status:
        employment_type_score = 5.0
    elif "contract" in employment_status:
        employment_type_score = 3.0
    elif "unemployed" in employment_status:
        employment_type_score = 0.0
    else:
        employment_type_score = 3.0 if employment_status else 0.0

    from app.services.credit_scoring.common import parse_years, years_since

    service_years = max(
        parse_years(employment.get("totalYearsWorking")),
        years_since(safe_text(employment.get("dateHired"))),
    )
    if service_years > 5.0:
        service_score = 5.0
    elif service_years >= 3.0:
        service_score = 4.0
    elif service_years >= 1.0:
        service_score = 2.0
    else:
        service_score = 0.0

    residential_years = parse_years(address.get("lengthOfStay"))
    if residential_years > 5.0:
        residential_score = 4.0
    elif residential_years >= 3.0:
        residential_score = 3.0
    elif residential_years >= 1.0:
        residential_score = 2.0
    else:
        residential_score = 0.0

    if employer_years > 10.0:
        employer_stability_score = 3.0
    elif employer_years >= 5.0:
        employer_stability_score = 2.0
    elif employer_years >= 1.0:
        employer_stability_score = 1.0
    else:
        employer_stability_score = 0.0

    return employment_type_score + service_score + residential_score + employer_stability_score
