from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.profile_monthly_snapshot import ProfileMonthlySnapshot


def current_snapshot_month() -> date:
    return date.today().replace(day=1)


def save_monthly_profile_snapshot(
    db: Session,
    *,
    user_id: int,
    profile_id: str | None,
    profile_data: dict,
    snapshot_month: date | None = None,
    financial_health_score: float | None = None,
    financial_health_summary: dict | None = None,
    credit_health_score: float | None = None,
    credit_health_summary: dict | None = None,
    net_worth_positioning_score: float | None = None,
    net_worth_summary: dict | None = None,
    budget_tracking_score: float | None = None,
    budget_tracking_summary: dict | None = None,
    loan_monitoring_score: float | None = None,
    loan_monitoring_summary: dict | None = None,
    bill_reminder_score: float | None = None,
    bill_reminder_summary: dict | None = None,
    loan_application_id: int | None = None,
) -> ProfileMonthlySnapshot:
    month = (snapshot_month or current_snapshot_month()).replace(day=1)
    snapshot = db.scalar(
        select(ProfileMonthlySnapshot).where(
            ProfileMonthlySnapshot.user_id == user_id,
            ProfileMonthlySnapshot.snapshot_month == month,
        )
    )

    if snapshot is None:
        snapshot = ProfileMonthlySnapshot(user_id=user_id, snapshot_month=month)
        db.add(snapshot)

    snapshot.source_profile_id = profile_id
    snapshot.source_loan_application_id = loan_application_id
    snapshot.profile_data = profile_data
    snapshot.financial_health_score = financial_health_score
    snapshot.financial_health_summary = financial_health_summary
    snapshot.credit_health_score = credit_health_score
    snapshot.credit_health_summary = credit_health_summary
    snapshot.net_worth_positioning_score = net_worth_positioning_score
    snapshot.net_worth_summary = net_worth_summary
    snapshot.budget_tracking_score = budget_tracking_score
    snapshot.budget_tracking_summary = budget_tracking_summary
    snapshot.loan_monitoring_score = loan_monitoring_score
    snapshot.loan_monitoring_summary = loan_monitoring_summary
    snapshot.bill_reminder_score = bill_reminder_score
    snapshot.bill_reminder_summary = bill_reminder_summary

    db.commit()
    db.refresh(snapshot)
    return snapshot