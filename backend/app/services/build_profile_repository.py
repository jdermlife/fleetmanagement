from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.fastapi_auth import CurrentUser
from app.models.loan_application import LoanApplication
from app.services.loan_application_profile_columns import apply_profile_columns


def _number(values: dict[str, Any], key: str) -> float:
    try:
        return float(values.get(key) or 0)
    except (TypeError, ValueError):
        return 0


def upsert_build_profile_record(
    db: Session,
    user: CurrentUser,
    profile: dict[str, Any],
    profile_id: str,
) -> tuple[LoanApplication, bool]:
    normalized_profile_id = profile_id.strip()
    payload_profile_id = str(profile.get("profileId") or "").strip()
    if (
        not normalized_profile_id
        or len(normalized_profile_id) > 255
        or payload_profile_id != normalized_profile_id
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Profile ID must match the application number.",
        )

    values = profile.get("values")
    if not isinstance(values, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Build Profile values are required.",
        )

    record = (
        db.query(LoanApplication)
        .filter(LoanApplication.application_no == normalized_profile_id)
        .first()
    )
    created = record is None
    if created:
        record = LoanApplication(
            application_no=normalized_profile_id,
            created_by=user.id,
            created_by_user_id=user.id,
            status="Draft",
        )
        db.add(record)
    elif record.created_by != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to update this profile draft",
        )

    borrower_name = str(values.get("fullName") or "").strip()
    record.product_type = str(values.get("productType") or "Personal Loan")
    record.client_name = borrower_name
    record.borrower_name = borrower_name
    record.email = str(values.get("email") or "")
    record.phone = str(values.get("mobileNumber") or "")
    record.gov_id = str(
        values.get("governmentId") or values.get("otherGovernmentIdNumber") or ""
    )
    record.address = str(values.get("address") or "")
    record.monthly_income = _number(values, "monthlyIncome")
    record.other_income = _number(values, "otherIncome")
    record.debt_obligations = _number(values, "debtObligations")
    record.loan_amount = _number(values, "requestedAmount")
    record.term_months = int(_number(values, "loanTerm"))
    record.interest_rate = _number(values, "interestRate")
    record.purpose = str(values.get("loanPurpose") or "")
    record.vehicle_info = " ".join(
        str(values.get(key) or "").strip()
        for key in ("maker", "brand", "model", "year")
        if str(values.get(key) or "").strip()
    )
    record.appraised_value = _number(values, "appraisedValue") or _number(
        values, "propertyAppraisedValue"
    )
    record.committee_remarks = record.committee_remarks or ""
    record.executive_approval = bool(record.executive_approval)
    record.dti = record.dti or 0
    record.dsr = record.dsr or 0
    record.ltv = record.ltv or 0
    record.scorecard_total = record.scorecard_total or 0
    record.ai_probability = record.ai_probability or 0
    record.updated_by = user.id
    record.requirements = {
        **(record.requirements or {}),
        "buildProfile": jsonable_encoder(profile),
    }
    apply_profile_columns(record, record.requirements)
    return record, created