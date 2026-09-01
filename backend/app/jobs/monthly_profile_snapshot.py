from collections.abc import Callable
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.users import User
from app.services.profile_monthly_snapshot import save_monthly_profile_snapshot


ProfileLoader = Callable[[Session, int], dict[str, Any] | None]
ScoreCalculator = Callable[[Session, int, dict[str, Any]], dict[str, Any]]


def run_monthly_profile_snapshots(
    *,
    load_current_profile: ProfileLoader,
    calculate_profile_scores: ScoreCalculator,
) -> None:
    with SessionLocal() as db:
        users = db.scalars(select(User)).all()
        for user in users:
            profile = load_current_profile(db, user.id)
            if not profile:
                continue
            scores = calculate_profile_scores(db, user.id, profile)
            save_monthly_profile_snapshot(
                db,
                user_id=user.id,
                profile_id=profile.get("profile_id"),
                profile_data=profile,
                loan_application_id=profile.get("loan_application_id"),
                financial_health_score=scores.get("financial_health_score"),
                financial_health_summary=scores.get("financial_health_summary"),
                credit_health_score=scores.get("credit_health_score"),
                credit_health_summary=scores.get("credit_health_summary"),
                net_worth_positioning_score=scores.get("net_worth_positioning_score"),
                net_worth_summary=scores.get("net_worth_summary"),
                budget_tracking_score=scores.get("budget_tracking_score"),
                budget_tracking_summary=scores.get("budget_tracking_summary"),
                loan_monitoring_score=scores.get("loan_monitoring_score"),
                loan_monitoring_summary=scores.get("loan_monitoring_summary"),
                bill_reminder_score=scores.get("bill_reminder_score"),
                bill_reminder_summary=scores.get("bill_reminder_summary"),
            )