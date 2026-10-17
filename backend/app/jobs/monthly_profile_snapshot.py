from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, time, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.loan_application import LoanApplication
from app.models.profile_history import ProfileHistory
from app.models.profile_monthly_snapshot import ProfileMonthlySnapshot
from app.models.users import User
from app.services.profile_monthly_snapshot import save_monthly_profile_snapshot


SessionFactory = Callable[[], Session]

HISTORY_SCORE_FIELDS = {
    "financial_health_score": ("financial_health_score", "financial_health_summary"),
    "credit_health_score": ("credit_health_score", "credit_health_summary"),
    "net_worth_snapshot": ("net_worth_positioning_score", "net_worth_summary"),
    "budget_snapshot": ("budget_tracking_score", "budget_tracking_summary"),
    "loan_monitoring": ("loan_monitoring_score", "loan_monitoring_summary"),
    "bill_payment": ("bill_reminder_score", "bill_reminder_summary"),
}


def completed_month_ends(as_of: date, count: int = 3) -> list[date]:
    cursor = as_of.replace(day=1)
    month_ends: list[date] = []
    for _ in range(count):
        previous_month_end = date.fromordinal(cursor.toordinal() - 1)
        month_ends.append(previous_month_end)
        cursor = previous_month_end.replace(day=1)
    return month_ends


def _score_from_payload(payload: dict[str, Any]) -> float | None:
    result = payload.get("result")
    candidate = result.get("score") if isinstance(result, dict) else payload.get("score")
    if isinstance(candidate, bool):
        return None
    try:
        return float(candidate) if candidate is not None else None
    except (TypeError, ValueError):
        return None


def _latest_profile_history(
    db: Session,
    *,
    user_id: int,
    category: str,
    cutoff: datetime,
) -> ProfileHistory | None:
    return db.scalar(
        select(ProfileHistory)
        .where(
            ProfileHistory.owner_id == user_id,
            ProfileHistory.category == category,
            ProfileHistory.observed_at <= cutoff,
        )
        .order_by(ProfileHistory.observed_at.desc(), ProfileHistory.id.desc())
        .limit(1)
    )


def _latest_loan_application(
    db: Session,
    *,
    user_id: int,
    cutoff: datetime,
) -> LoanApplication | None:
    return db.scalar(
        select(LoanApplication)
        .where(
            or_(
                LoanApplication.created_by == user_id,
                LoanApplication.created_by_user_id == user_id,
            ),
            LoanApplication.created_at <= cutoff,
            func.coalesce(LoanApplication.updated_at, LoanApplication.created_at) <= cutoff,
        )
        .order_by(
            LoanApplication.updated_at.desc(),
            LoanApplication.created_at.desc(),
            LoanApplication.id.desc(),
        )
        .limit(1)
    )


def _snapshot_values(
    db: Session,
    *,
    user_id: int,
    cutoff: datetime,
) -> tuple[dict[str, Any], dict[str, Any], LoanApplication | None]:
    values: dict[str, Any] = {}
    profile_data: dict[str, Any] = {}
    source_loan_application_id: int | None = None

    for category, (score_field, summary_field) in HISTORY_SCORE_FIELDS.items():
        history = _latest_profile_history(
            db,
            user_id=user_id,
            category=category,
            cutoff=cutoff,
        )
        if history is None:
            continue
        payload = history.payload if isinstance(history.payload, dict) else {}
        result = payload.get("result")
        values[score_field] = _score_from_payload(payload)
        values[summary_field] = result if isinstance(result, dict) else payload
        if not profile_data and isinstance(payload.get("profile"), dict):
            profile_data = payload["profile"]
        if source_loan_application_id is None:
            source_loan_application_id = history.loan_application_id

    loan_application = _latest_loan_application(db, user_id=user_id, cutoff=cutoff)
    if loan_application is not None:
        requirements = loan_application.requirements if isinstance(loan_application.requirements, dict) else {}
        build_profile = requirements.get("buildProfile")
        if not profile_data and isinstance(build_profile, dict):
            profile_data = build_profile
        source_loan_application_id = source_loan_application_id or loan_application.id

    profile_data = {
        **profile_data,
        "automatic_snapshot": {
            "cutoff": cutoff.date().isoformat(),
            "source": "scheduled_month_end",
        },
    }
    values["loan_application_id"] = source_loan_application_id
    return values, profile_data, loan_application


def run_monthly_profile_snapshots(
    *,
    as_of: date | None = None,
    months: int = 3,
    session_factory: SessionFactory = SessionLocal,
) -> int:
    generated = 0
    today = as_of or date.today()

    with session_factory() as db:
        for month_end in completed_month_ends(today, months):
            cutoff = datetime.combine(month_end, time.max, tzinfo=timezone.utc)
            user_ids = db.scalars(
                select(User.id).where(
                    User.created_at <= cutoff,
                    User.is_deleted.is_(False),
                )
            ).all()

            for user_id in user_ids:
                snapshot_month = month_end.replace(day=1)
                existing = db.scalar(
                    select(ProfileMonthlySnapshot.id).where(
                        ProfileMonthlySnapshot.user_id == user_id,
                        ProfileMonthlySnapshot.snapshot_month == snapshot_month,
                    )
                )
                if existing is not None:
                    continue

                values, profile_data, loan_application = _snapshot_values(
                    db,
                    user_id=user_id,
                    cutoff=cutoff,
                )
                profile_id = loan_application.application_no if loan_application is not None else None
                if not profile_id:
                    profile_id = str(profile_data.get("profileId") or "").strip() or f"ACCOUNT-{user_id}"

                try:
                    save_monthly_profile_snapshot(
                        db,
                        user_id=user_id,
                        profile_id=profile_id,
                        profile_data=profile_data,
                        snapshot_month=snapshot_month,
                        **values,
                    )
                except IntegrityError:
                    db.rollback()
                    continue
                generated += 1

    return generated