from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.profile_history import ProfileHistory


def save_monthly_profile_history(
    db: Session,
    *,
    user_id: int,
    created_by: int,
    profile_data: dict,
    financial_health: dict,
    credit_health: dict,
    net_worth: dict,
    budget: dict,
    loan_monitoring: dict,
    bill_payment: dict,
    loan_application_id: int | None = None,
) -> None:
    now = datetime.now(timezone.utc)
    snapshot_month = now.date().replace(day=1)
    records = [
        ("financial_health_score", financial_health),
        ("credit_health_score", credit_health),
        ("net_worth_snapshot", net_worth),
        ("budget_snapshot", budget),
        ("loan_monitoring", loan_monitoring),
        ("bill_payment", bill_payment),
    ]

    for category, payload in records:
        existing = db.scalar(
            select(ProfileHistory).where(
                ProfileHistory.owner_id == user_id,
                ProfileHistory.snapshot_month == snapshot_month,
                ProfileHistory.category == category,
            )
        )
        full_payload = {"profile": profile_data, "result": payload}
        if existing:
            existing.payload = full_payload
            existing.observed_at = now
            existing.created_by = created_by
            existing.loan_application_id = loan_application_id
        else:
            db.add(ProfileHistory(
                owner_id=user_id,
                loan_application_id=loan_application_id,
                category=category,
                snapshot_month=snapshot_month,
                observed_at=now,
                payload=full_payload,
                created_by=created_by,
            ))

    db.commit()