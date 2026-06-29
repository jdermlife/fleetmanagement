from __future__ import annotations

from typing import Any

from app.services.credit_scoring.common import (
    requirements_section,
    safe_text,
    score_from_keyword,
    to_float,
)


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
        marketability_score = 7.0
    elif "lowcost" in explicit_marketability or "low cost" in explicit_marketability:
        marketability_score = 4.0
    elif "outside" in explicit_marketability:
        marketability_score = 0.0
    else:
        marketability_score = score_from_keyword(
            property_descriptor,
            [
                (("subdivision", "condominium", "condo"), 7.0),
                (("lowcost", "low cost"), 4.0),
            ],
            fallback=0.0 if not property_descriptor else 4.0,
        )

    property_value = max(
        to_float(collateral.get("propertyAppraisedValue"), 0.0),
        to_float(getattr(payload, "appraised_value", 0.0), 0.0),
    )
    if property_value >= 3000000.0:
        value_score = 7.0
    elif property_value >= 1000000.0:
        value_score = 5.0
    elif property_value >= 300000.0:
        value_score = 3.0
    elif property_value > 0:
        value_score = 1.0
    else:
        value_score = 0.0

    explicit_house_unit = safe_text(collateral.get("houseUnitModelCategory")).lower()
    if "single detached" in explicit_house_unit:
        unit_model_score = 6.0
    elif "single attached" in explicit_house_unit or "condominium" in explicit_house_unit:
        unit_model_score = 4.0
    elif "townhouse" in explicit_house_unit:
        unit_model_score = 2.0
    elif "row house" in explicit_house_unit:
        unit_model_score = 0.0
    else:
        unit_model_score = score_from_keyword(
            property_descriptor,
            [
                (("single detached",), 6.0),
                (("single attached", "condominium", "condo"), 4.0),
                (("townhouse",), 2.0),
                (("row house",), 0.0),
            ],
            fallback=0.0 if not property_descriptor else 4.0,
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
