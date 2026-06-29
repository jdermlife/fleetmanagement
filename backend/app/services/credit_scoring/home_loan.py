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

    property_descriptor = " ".join(
        filter(
            None,
            [
                safe_text(product.get("homeCollateralType")),
                safe_text(collateral.get("propertyAddress")),
            ],
        )
    ).lower()
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

    home_ownership = safe_text(applicant.get("homeOwnership")).lower()
    if any(keyword in home_ownership for keyword in ("owner", "owned", "mortgaged")):
        collateral_type_score = 5.0
    elif property_descriptor:
        collateral_type_score = 3.0
    else:
        collateral_type_score = 0.0

    return marketability_score + value_score + unit_model_score + collateral_type_score
