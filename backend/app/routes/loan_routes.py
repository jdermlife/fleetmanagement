from __future__ import annotations

from io import BytesIO
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status as http_status
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import selectinload


from app.database import SessionLocal
from app.fastapi_auth import CurrentUser, require_roles
from app.models.loan_application import (
    AIRecommendation,
    CollateralScore,
    CreditBureauReport,
    CreditScore,
    DecisionAuditTrail,
    FraudScore,
    LoanApplication,
    OverallScore,
    ProfitabilityScore,
    PsychometricScore,
    RelationshipScore,
    SocialScore,
)
from app.schemas.loan_schema import LoanApplicationCreate
from app.services.loan_repository_io import (
    apply_repository_filters,
    generate_csv_bytes,
    generate_xlsx_bytes,
    parse_upload_rows,
    upsert_loan_applications,
)
from app.services.overall_scoring_engine import compute_quant_score_package

router = APIRouter()

VALID_STATUSES = {
    "DRAFT",
    "SUBMITTED",
    "UNDER REVIEW",
    "CREDIT REVIEW",
    "REVIEWED",
    "APPROVED",
    "REJECTED",
    "RELEASED",
    "CANCELLED",
}

LOAN_APPLICATION_LOAD_OPTIONS = (
    selectinload(LoanApplication.credit_scores),
    selectinload(LoanApplication.fraud_scores),
    selectinload(LoanApplication.social_scores),
    selectinload(LoanApplication.psychometric_scores),
    selectinload(LoanApplication.credit_bureau_reports),
    selectinload(LoanApplication.collateral_scores),
    selectinload(LoanApplication.profitability_scores),
    selectinload(LoanApplication.relationship_scores),
    selectinload(LoanApplication.ai_recommendations),
    selectinload(LoanApplication.overall_scores),
    selectinload(LoanApplication.decision_audit_trail),
)


def get_loan_application_or_404(db, application_no: str) -> LoanApplication:
    record = (
        db.query(LoanApplication)
        .options(*LOAN_APPLICATION_LOAD_OPTIONS)
        .filter(LoanApplication.application_no == application_no)
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    return record


def is_admin_user(user: CurrentUser) -> bool:
    return user.role.lower() == "admin"


def is_subscriber_user(user: CurrentUser) -> bool:
    return user.role.lower() == "subscriber"


def enforce_loan_application_access(user: CurrentUser, record: LoanApplication) -> None:
    if is_admin_user(user):
        return

    if is_subscriber_user(user) and record.created_by == user.id:
        return

    raise HTTPException(
        status_code=http_status.HTTP_403_FORBIDDEN,
        detail="You are not allowed to access this loan application",
    )


def model_to_payload(model: Any) -> dict[str, Any]:
    if isinstance(model, dict):
        return model

    return model.dict() if hasattr(model, "dict") else {}


def serialize_related_record(record: Any, fields: list[str], timestamp_field: str = "created_at"):
    if not record:
        return None

    payload = {"id": record.id}
    for field in fields:
        payload[field] = getattr(record, field)
    payload[timestamp_field] = getattr(record, timestamp_field, None)
    return payload


def latest_record(records: list[Any]) -> Any:
    if not records:
        return None

    return max(
        records,
        key=lambda item: (
            getattr(item, "created_at", None) or getattr(item, "changed_at", None),
            item.id or 0,
        ),
    )


def serialize_loan_application_fields(record: LoanApplication) -> dict[str, Any]:
    return {
        "id": record.id,
        "application_no": record.application_no,
        "created_by": record.created_by,
        "status": record.status,
        "product_type": record.product_type,
        "borrower_name": record.borrower_name,
        "email": record.email,
        "phone": record.phone,
        "gov_id": record.gov_id,
        "address": record.address,
        "monthly_income": record.monthly_income,
        "other_income": record.other_income,
        "debt_obligations": record.debt_obligations,
        "loan_amount": record.loan_amount,
        "term_months": record.term_months,
        "interest_rate": record.interest_rate,
        "purpose": record.purpose,
        "vehicle_info": record.vehicle_info,
        "appraised_value": record.appraised_value,
        "committee_remarks": record.committee_remarks,
        "executive_approval": record.executive_approval,
        "dti": record.dti,
        "dsr": record.dsr,
        "ltv": record.ltv,
        "scorecard_total": record.scorecard_total,
        "ai_probability": record.ai_probability,
        "requirements": record.requirements or {},
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


def serialize_loan_application(record: LoanApplication) -> dict[str, Any]:
    latest_credit_score = latest_record(record.credit_scores)
    latest_fraud_score = latest_record(record.fraud_scores)
    latest_social_score = latest_record(record.social_scores)
    latest_psychometric_score = latest_record(record.psychometric_scores)
    latest_credit_bureau_report = latest_record(record.credit_bureau_reports)
    latest_collateral_score = latest_record(record.collateral_scores)
    latest_profitability_score = latest_record(record.profitability_scores)
    latest_relationship_score = latest_record(record.relationship_scores)
    latest_ai_recommendation = latest_record(record.ai_recommendations)
    latest_overall_score = latest_record(record.overall_scores)

    return {
        **serialize_loan_application_fields(record),
        "credit_scores": serialize_related_record(
            latest_credit_score,
            [
                "character_score",
                "capacity_score",
                "capital_score",
                "collateral_score",
                "conditions_score",
                "bureau_score",
                "internal_score",
                "total_credit_score",
                "credit_grade",
                "model_version",
            ],
        ),
        "fraud_scores": serialize_related_record(
            latest_fraud_score,
            [
                "identity_score",
                "document_score",
                "geo_location_score",
                "device_score",
                "duplicate_application_score",
                "overall_fraud_score",
                "fraud_risk_level",
                "fraud_flags",
            ],
        ),
        "social_scores": serialize_related_record(
            latest_social_score,
            [
                "residence_stability_score",
                "employment_stability_score",
                "family_stability_score",
                "education_score",
                "banking_relationship_score",
                "overall_social_score",
            ],
        ),
        "psychometric_scores": serialize_related_record(
            latest_psychometric_score,
            [
                "discipline_score",
                "planning_score",
                "responsibility_score",
                "honesty_score",
                "resilience_score",
                "overall_psychometric_score",
                "questionnaire_answers",
            ],
        ),
        "credit_bureau_reports": serialize_related_record(
            latest_credit_bureau_report,
            [
                "bureau_name",
                "bureau_score",
                "total_loans",
                "active_loans",
                "closed_loans",
                "delinquent_accounts",
                "defaulted_accounts",
                "outstanding_balance",
                "report_json",
                "report_date",
            ],
        ),
        "collateral_scores": serialize_related_record(
            latest_collateral_score,
            [
                "ltv_score",
                "asset_quality_score",
                "marketability_score",
                "insurance_score",
                "overall_collateral_score",
            ],
        ),
        "profitability_scores": serialize_related_record(
            latest_profitability_score,
            [
                "projected_interest_income",
                "fee_income",
                "expected_loss",
                "operating_cost",
                "funding_cost",
                "projected_profit",
                "profitability_score",
            ],
        ),
        "relationship_scores": serialize_related_record(
            latest_relationship_score,
            [
                "customer_since",
                "number_of_accounts",
                "deposit_balance",
                "prior_loans",
                "relationship_score",
            ],
        ),
        "ai_recommendations": serialize_related_record(
            latest_ai_recommendation,
            [
                "recommendation",
                "confidence_score",
                "explanation",
                "suggested_amount",
                "ai_model",
            ],
        ),
        "overall_scores": serialize_related_record(
            latest_overall_score,
            [
                "credit_score",
                "fraud_score",
                "social_score",
                "psychometric_score",
                "collateral_score",
                "profitability_score",
                "relationship_score",
                "final_score",
                "final_grade",
                "final_decision",
            ],
        ),
        "decision_audit_trail": [
            {
                "id": item.id,
                "previous_status": item.previous_status,
                "new_status": item.new_status,
                "remarks": item.remarks,
                "changed_by": item.changed_by,
                "changed_at": item.changed_at,
            }
            for item in sorted(
                record.decision_audit_trail,
                key=lambda item: (item.changed_at, item.id or 0),
                reverse=True,
            )
        ],
    }


def serialize_loan_application_list_item(record: LoanApplication) -> dict[str, Any]:
    return serialize_loan_application_fields(record)


def upsert_related_record(
    db,
    loan_application: LoanApplication,
    relationship_name: str,
    model_class,
    payload_model: Any,
) -> None:
    payload = model_to_payload(payload_model)
    existing_items = getattr(loan_application, relationship_name)
    related_record = latest_record(existing_items)

    if related_record is None:
        related_record = model_class(loan_application_id=loan_application.id)
        db.add(related_record)
        existing_items.append(related_record)

    for field, value in payload.items():
        setattr(related_record, field, value)


def append_decision_audit_entry(
    db,
    loan_application,
    previous_status,
    new_status,
    remarks=None,
    changed_by=None,

) -> None:
    if previous_status == new_status:
        return

    audit_entry = DecisionAuditTrail(
        loan_application_id=loan_application.id,
        previous_status=previous_status,
        new_status=new_status,
        remarks=remarks,
        changed_by=changed_by,
    )
    db.add(audit_entry)


def append_workflow_history_entry(
    db,
    loan_application: LoanApplication,
    previous_status: str | None,
    new_status: str,
    user: CurrentUser,
    reason: str | None = None,
) -> None:
    if previous_status == new_status:
        return

    from_state = str(previous_status) if previous_status else "UNKNOWN"
    to_state = str(new_status) if new_status else "UNKNOWN"

    try:
        db.execute(
            text(
                """
                INSERT INTO workflow_history
                (entity_type, entity_id, from_state, to_state, performed_by, user_role, reason, metadata, created_at)
                VALUES (:entity_type, :entity_id, :from_state, :to_state, :performed_by, :user_role, :reason, :metadata, NOW())
                """
            ),
            {
                "entity_type": "loan",
                "entity_id": loan_application.id,
                "from_state": from_state,
                "to_state": to_state,
                "performed_by": user.id,
                "user_role": user.role,
                "reason": reason,
                "metadata": {},
            },
        )
    except Exception:
        # Keep primary workflow functional even if workflow_history is unavailable.
        pass


def persist_score_details(
    db,
    loan_application: LoanApplication,
    data: LoanApplicationCreate,
) -> None:
    upsert_related_record(db, loan_application, "credit_scores", CreditScore, data.credit_scores)
    upsert_related_record(db, loan_application, "fraud_scores", FraudScore, data.fraud_scores)
    upsert_related_record(db, loan_application, "social_scores", SocialScore, data.social_scores)
    upsert_related_record(
        db,
        loan_application,
        "psychometric_scores",
        PsychometricScore,
        data.psychometric_scores,
    )
    upsert_related_record(
        db,
        loan_application,
        "credit_bureau_reports",
        CreditBureauReport,
        data.credit_bureau_reports,
    )
    upsert_related_record(
        db,
        loan_application,
        "collateral_scores",
        CollateralScore,
        data.collateral_scores,
    )
    upsert_related_record(
        db,
        loan_application,
        "profitability_scores",
        ProfitabilityScore,
        data.profitability_scores,
    )
    upsert_related_record(
        db,
        loan_application,
        "relationship_scores",
        RelationshipScore,
        data.relationship_scores,
    )
    upsert_related_record(
        db,
        loan_application,
        "ai_recommendations",
        AIRecommendation,
        data.ai_recommendations,
    )
    upsert_related_record(
        db,
        loan_application,
        "overall_scores",
        OverallScore,
        data.overall_scores,
    )


def build_scored_loan_application(
    data: LoanApplicationCreate,
) -> tuple[LoanApplicationCreate, dict[str, Any]]:
    score_package = compute_quant_score_package(data)
    scored_data = data.model_copy(
        update={
            "scorecard_total": int(score_package["overall_scores"]["final_score"]),
            "ai_probability": float(score_package["overall_scores"]["final_score"]),
            "credit_scores": score_package["credit_scores"],
            "fraud_scores": score_package["fraud_scores"],
            "social_scores": score_package["social_scores"],
            "psychometric_scores": score_package["psychometric_scores"],
            "credit_bureau_reports": score_package["credit_bureau_reports"],
            "collateral_scores": score_package["collateral_scores"],
            "profitability_scores": score_package["profitability_scores"],
            "relationship_scores": score_package["relationship_scores"],
            "ai_recommendations": score_package["ai_recommendations"],
            "overall_scores": score_package["overall_scores"],
        }
    )
    return scored_data, score_package["quant_scores"]


def apply_loan_application_fields(record: LoanApplication, data: LoanApplicationCreate) -> None:
    record.status = data.status
    record.product_type = data.product_type

    record.borrower_name = data.borrower_name
    record.email = data.email
    record.phone = data.phone
    record.gov_id = data.gov_id
    record.address = data.address

    record.monthly_income = data.monthly_income
    record.other_income = data.other_income
    record.debt_obligations = data.debt_obligations

    record.loan_amount = data.loan_amount
    record.term_months = data.term_months
    record.interest_rate = data.interest_rate
    record.purpose = data.purpose

    record.vehicle_info = data.vehicle_info
    record.appraised_value = data.appraised_value

    record.committee_remarks = data.committee_remarks
    record.executive_approval = data.executive_approval

    record.dti = data.dti
    record.dsr = data.dsr
    record.ltv = data.ltv

    record.scorecard_total = data.scorecard_total
    record.ai_probability = data.ai_probability

    record.requirements = data.requirements


@router.post(
    "/loan-applications",
    status_code=http_status.HTTP_201_CREATED,
)
def create_loan_application(
    data: LoanApplicationCreate,
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
):
    db = SessionLocal()

    try:
        scored_data, quant_scores = build_scored_loan_application(data)
        existing_record = (
            db.query(LoanApplication)
            .filter(LoanApplication.application_no == scored_data.application_no)
            .first()
        )

        if existing_record:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="Application already exists",
            )

        record = LoanApplication(
            application_no=scored_data.application_no,
            created_by=user.id
        )
        apply_loan_application_fields(record, scored_data)
        db.add(record)
        db.flush()

        persist_score_details(db, record, scored_data)
        append_decision_audit_entry(
            db,
            record,
            previous_status=None,
            new_status=scored_data.status,
            remarks=scored_data.committee_remarks,
            changed_by=getattr(user, "username", str(user.id)),
        )
        append_workflow_history_entry(
            db,
            record,
            previous_status=None,
            new_status=scored_data.status,
            user=user,
            reason=scored_data.committee_remarks,
        )

        db.commit()
        db.refresh(record)

        return {
            "message": "Loan application saved",
            "application_no": record.application_no,
            "quant_scores": quant_scores,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@router.post(
    "/loan-applications/compute-quant-scores",
)
def compute_quant_scores(
    data: LoanApplicationCreate,
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
):
    db = SessionLocal()

    try:
        scored_data, quant_scores = build_scored_loan_application(data)
        record = (
            db.query(LoanApplication)
            .filter(LoanApplication.application_no == scored_data.application_no)
            .first()
        )
        previous_status = record.status if record else None

        if record is not None:
            enforce_loan_application_access(user, record)

        if record is None:
            record = LoanApplication(
                application_no=scored_data.application_no,
                created_by=user.id,
            )
            db.add(record)
            db.flush()

        record.application_no = scored_data.application_no
        apply_loan_application_fields(record, scored_data)
        persist_score_details(db, record, scored_data)
        append_decision_audit_entry(
            db,
            record,
            previous_status=previous_status,
            new_status=scored_data.status,
            remarks=scored_data.committee_remarks,
            changed_by=getattr(user, "username", str(user.id)),
        )
        append_workflow_history_entry(
            db,
            record,
            previous_status=previous_status,
            new_status=scored_data.status,
            user=user,
            reason=scored_data.committee_remarks,
        )

        db.commit()
        db.refresh(record)

        return {
            "message": "QuantScores computed and stored",
            "application_no": record.application_no,
            "quant_scores": quant_scores,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@router.get(
    "/loan-applications",
)
def get_loan_applications(
    status: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=25000),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
):
    db = SessionLocal()

    try:
        query = db.query(LoanApplication)
        if is_subscriber_user(user):
            query = query.filter(LoanApplication.created_by == user.id)
        query = apply_repository_filters(query, status, date_from, date_to)
        loans = (
            query.order_by(LoanApplication.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        total = query.count()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "records": [serialize_loan_application_list_item(loan) for loan in loans],
        }
    finally:
        db.close()


@router.post(
    "/loan-applications/import",
    dependencies=[Depends(require_roles("Admin"))],
)
async def import_loan_applications(file: UploadFile = File(...)):
    db = SessionLocal()

    try:
        file_bytes = await file.read()
        rows = parse_upload_rows(file.filename or "upload.csv", file_bytes)
        result = upsert_loan_applications(db, rows)

        return {
            "message": (
                f"Bulk import completed. Inserted: {result['inserted']}, "
                f"Updated: {result['updated']}, Skipped: {result['skipped']}"
            ),
            **result,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@router.get(
    "/loan-applications/export",
)
def export_loan_applications(
    status: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    format: str = Query(default="csv"),
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
):
    db = SessionLocal()

    try:
        query = db.query(LoanApplication)
        if is_subscriber_user(user):
            query = query.filter(LoanApplication.created_by == user.id)
        query = apply_repository_filters(query, status, date_from, date_to)
        records = query.order_by(LoanApplication.created_at.desc()).all()

        normalized_format = format.lower()
        if normalized_format == "xlsx":
            content = generate_xlsx_bytes(records)
            media_type = (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            extension = "xlsx"
        else:
            content = generate_csv_bytes(records)
            media_type = "text/csv"
            extension = "csv"

        return StreamingResponse(
            BytesIO(content),
            media_type=media_type,
            headers={
                "Content-Disposition": (
                    f'attachment; filename="loan-repository-export.{extension}"'
                )
            },
        )
    finally:
        db.close()


@router.put(
    "/loan-applications/{application_no}/status",
)
def update_status(
    application_no: str,
    status: str,
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
):
    db = SessionLocal()

    try:
        status = status.upper()
        if status not in VALID_STATUSES:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Invalid status.",
            )

        record = get_loan_application_or_404(db, application_no)
        if status == "REVIEWED":
            record.reviewed_by = user.id
        if status == "APPROVED":
            record.approved_by = user.id
        if status == "RELEASED":
            record.released_by = user.id

        enforce_loan_application_access(user, record)
        previous_status = record.status

        record.status = status
        append_decision_audit_entry(
            db,
            record,
            previous_status=previous_status,
            new_status=status,
            remarks=record.committee_remarks,
            changed_by=getattr(user, "username", str(user.id)),
        )
        append_workflow_history_entry(
            db,
            record,
            previous_status=previous_status,
            new_status=status,
            user=user,
            reason=record.committee_remarks,
        )

        db.commit()
        return {"message": f"Status updated to {status}"}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@router.get(
    "/loan-applications/{application_no}",
)
def get_loan_application(
    application_no: str,
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
):
    db = SessionLocal()

    try:
        record = get_loan_application_or_404(db, application_no)
        enforce_loan_application_access(user, record)
        return serialize_loan_application(record)
    finally:
        db.close()


@router.put(
    "/loan-applications/{application_no}",
)
def update_loan_application(
    application_no: str,
    data: LoanApplicationCreate,
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
   
):
    db = SessionLocal()

    try:
        scored_data, quant_scores = build_scored_loan_application(data)
        record = get_loan_application_or_404(db, application_no)
        enforce_loan_application_access(user, record)
        previous_status = record.status

        if (
            scored_data.application_no != application_no
            and db.query(LoanApplication)
            .filter(LoanApplication.application_no == scored_data.application_no)
            .first()
        ):
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="Application number already exists",
            )

        record.application_no = scored_data.application_no
        apply_loan_application_fields(record, scored_data)
        record.updated_by = user.id
        persist_score_details(db, record, scored_data)
        append_decision_audit_entry(
            db,
            record,
            previous_status=previous_status,
            new_status=scored_data.status,
            remarks=record.committee_remarks,
            changed_by=getattr(user, "username", str(user.id)),
        )
        append_workflow_history_entry(
            db,
            record,
            previous_status=previous_status,
            new_status=scored_data.status,
            user=user,
            reason=record.committee_remarks,
        )

        db.commit()
        db.refresh(record)
        return {
            "message": "Loan application updated",
            "application_no": record.application_no,
            "quant_scores": quant_scores,
        }

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
