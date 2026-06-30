from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.services.credit_scoring.common import (
    HIGH_DEMAND_AUTO_BRANDS,
    LOW_DEMAND_AUTO_BRANDS,
    POPULAR_AUTO_BRANDS,
    requirements_section,
    safe_text,
    score_from_keyword,
    to_float,
)
from app.services.credit_scoring.home_loan import (
    score_home_loan_capacity,
    score_home_loan_character,
    score_home_loan_condition,
)


def score_auto_loan_capacity(payload: Any) -> float:
    return score_home_loan_capacity(payload)


def score_auto_loan_character(payload: Any) -> float:
    return score_home_loan_character(payload)


def score_auto_loan_condition(payload: Any) -> float:
    return score_home_loan_condition(payload)


def compute_auto_loan_collateral_breakdown(payload: Any) -> dict[str, float]:
    collateral = requirements_section(payload, "collateralAssetDetails")
    product = requirements_section(payload, "productInformation")

    explicit_marketability = safe_text(collateral.get("vehicleMarketabilityCategory")).lower()
    brand = safe_text(collateral.get("brand") or collateral.get("maker")).lower()
    if "high-demand" in explicit_marketability or "brand new, high-demand" in explicit_marketability:
        marketability_score = 3.0
    elif "moderate resale demand" in explicit_marketability or "popular brands" in explicit_marketability:
        marketability_score = 2.0
    elif "limited-market" in explicit_marketability or "low-demand brands" in explicit_marketability:
        marketability_score = 1.0
    elif "obsolete" in explicit_marketability or "difficult-to-sell" in explicit_marketability:
        marketability_score = 0.0
    elif brand in HIGH_DEMAND_AUTO_BRANDS:
        marketability_score = 3.0
    elif brand in POPULAR_AUTO_BRANDS:
        marketability_score = 2.0
    elif brand in LOW_DEMAND_AUTO_BRANDS:
        marketability_score = 1.0
    else:
        marketability_score = 0.0 if not brand else 1.0

    vehicle_value = max(
        to_float(collateral.get("appraisedValue"), 0.0),
        to_float(product.get("autoSellingPrice"), 0.0),
        to_float(getattr(payload, "appraised_value", 0.0), 0.0),
    )
    if vehicle_value > 2500000.0:
        value_score = 4.0
    elif vehicle_value >= 1500001.0:
        value_score = 3.0
    elif vehicle_value >= 800001.0:
        value_score = 2.0
    elif vehicle_value >= 300001.0:
        value_score = 1.0
    else:
        value_score = 0.0

    explicit_condition = safe_text(collateral.get("vehicleConditionCategory")).lower()
    year_text = safe_text(collateral.get("year") or product.get("autoYearModel"))
    current_year = datetime.now(UTC).year
    vehicle_year = int(to_float(year_text, 0.0)) if year_text else 0
    vehicle_age = max(current_year - vehicle_year, 0) if vehicle_year else 99
    if "brand new" in explicit_condition:
        age_score = 4.0
    elif "1-3 years" in explicit_condition or "1 to 3 years" in explicit_condition:
        age_score = 3.0
    elif "4-6 years" in explicit_condition or "4 to 6 years" in explicit_condition:
        age_score = 2.0
    elif "fair/poor" in explicit_condition or "more than 6 years" in explicit_condition:
        age_score = 0.0
    elif vehicle_age <= 0:
        age_score = 4.0
    elif vehicle_age <= 3:
        age_score = 3.0
    elif vehicle_age <= 6:
        age_score = 2.0
    else:
        age_score = 0.0

    explicit_vehicle_type = safe_text(collateral.get("vehicleTypeCategory")).lower()
    vehicle_type = safe_text(collateral.get("assetType") or product.get("autoVehicleClassification")).lower()
    if "passenger vehicle" in explicit_vehicle_type:
        type_score = 4.0
    elif "suv" in explicit_vehicle_type or "mpv" in explicit_vehicle_type or "pickup" in explicit_vehicle_type:
        type_score = 3.0
    elif "commercial vehicle" in explicit_vehicle_type or "light truck" in explicit_vehicle_type:
        type_score = 2.0
    elif "heavy equipment" in explicit_vehicle_type or "specialized" in explicit_vehicle_type:
        type_score = 1.0
    elif "salvage" in explicit_vehicle_type or "rebuilt" in explicit_vehicle_type or "unregistered" in explicit_vehicle_type:
        type_score = 0.0
    else:
        type_score = score_from_keyword(
            vehicle_type,
            [
                (("passenger", "sedan", "hatchback"), 4.0),
                (("suv", "mpv", "pickup"), 3.0),
                (("commercial", "van", "light truck"), 2.0),
                (("heavy equipment", "specialized"), 1.0),
                (("salvage", "rebuilt", "unregistered"), 0.0),
            ],
            fallback=0.0 if not vehicle_type else 2.0,
        )

    return {
        "marketability_score": marketability_score,
        "value_score": value_score,
        "age_score": age_score,
        "type_score": type_score,
        "total_score": marketability_score + value_score + age_score + type_score,
    }


def score_auto_loan_collateral(payload: Any) -> float:
    return compute_auto_loan_collateral_breakdown(payload)["total_score"]
