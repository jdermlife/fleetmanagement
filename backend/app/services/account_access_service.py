from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os

from sqlalchemy import and_

from app.models.notification import Notification, NotificationChannel, NotificationPriority
from app.models.users import User
from app.services.notification_service import queue_notification

TRIAL_VALIDITY_HOURS = int(os.getenv("ACCOUNT_TRIAL_VALIDITY_HOURS", "48"))
TRIAL_REMINDER_HOURS = int(os.getenv("ACCOUNT_TRIAL_REMINDER_HOURS", "8"))
TRIAL_GRACE_HOURS = int(os.getenv("ACCOUNT_TRIAL_GRACE_HOURS", "24"))
PAID_VALIDITY_DAYS = int(os.getenv("ACCOUNT_PAID_VALIDITY_DAYS", "31"))


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def configure_new_account_access(user: User, now: datetime | None = None) -> None:
    current_time = now or _utc_now()
    user.account_access_expires_at = current_time + timedelta(hours=TRIAL_VALIDITY_HOURS)
    user.is_active = True
    if not user.account_status or user.account_status.upper() in {"PENDING", "SUSPENDED"}:
        user.account_status = "ACTIVE"


def renew_account_access_after_payment(user: User, paid_at: datetime | None = None) -> None:
    effective_paid_at = paid_at or _utc_now()
    user.account_access_expires_at = effective_paid_at + timedelta(days=PAID_VALIDITY_DAYS)
    user.is_active = True
    user.account_status = "ACTIVE"


def has_verified_paid_access(user: User) -> bool:
    subscription = getattr(user, "subscription", None)
    return bool(
        subscription
        and (getattr(subscription, "status", "") or "").upper() == "ACTIVE"
        and (getattr(subscription, "subscription_type", "") or "").upper()
        in {"PAID", "LIFETIME"}
    )


def get_account_access_state(user: User, now: datetime | None = None) -> dict[str, object]:
    current_time = now or _utc_now()
    expires_at = user.account_access_expires_at
    paid_access = has_verified_paid_access(user)

    if expires_at is None:
        return {
            "access_state": "PAID" if paid_access else "TRIAL",
            "trial_expires_at": None,
            "grace_expires_at": None,
            "reminder_visible": False,
            "payment_required": False,
        }

    if paid_access:
        state = "PAID" if current_time < expires_at else "LOCKED"
        return {
            "access_state": state,
            "trial_expires_at": None,
            "grace_expires_at": expires_at,
            "reminder_visible": state == "LOCKED",
            "payment_required": state == "LOCKED",
        }

    reminder_at = expires_at - timedelta(hours=TRIAL_REMINDER_HOURS)
    grace_expires_at = expires_at + timedelta(hours=TRIAL_GRACE_HOURS)
    if current_time < reminder_at:
        state = "TRIAL"
    elif current_time < expires_at:
        state = "TRIAL_REMINDER"
    elif current_time < grace_expires_at:
        state = "GRACE"
    else:
        state = "LOCKED"

    return {
        "access_state": state,
        "trial_expires_at": expires_at,
        "grace_expires_at": grace_expires_at,
        "reminder_visible": state in {"TRIAL_REMINDER", "GRACE", "LOCKED"},
        "payment_required": state in {"GRACE", "LOCKED"},
    }


def deactivate_if_access_expired(user: User, now: datetime | None = None) -> bool:
    if user.account_access_expires_at is None:
        return False

    access_state = get_account_access_state(user, now)
    if access_state["access_state"] != "LOCKED":
        return False

    if user.account_status and user.account_status.upper() == "DELETED":
        return False

    if user.is_active or (user.account_status or "").upper() != "SUSPENDED":
        user.is_active = False
        user.account_status = "SUSPENDED"
        return True

    return False


def queue_due_trial_reminders(db, now: datetime | None = None) -> int:
    current_time = now or _utc_now()
    reminder_window_start = current_time - timedelta(hours=TRIAL_GRACE_HOURS)
    reminder_window_end = current_time + timedelta(hours=TRIAL_REMINDER_HOURS)
    users = db.query(User).filter(
        and_(
            User.account_access_expires_at.is_not(None),
            User.account_access_expires_at > reminder_window_start,
            User.account_access_expires_at <= reminder_window_end,
            User.is_deleted.is_(False),
        )
    ).all()
    queued = 0

    for user in users:
        state = get_account_access_state(user, current_time)
        if state["access_state"] not in {"TRIAL_REMINDER", "GRACE"}:
            continue

        source_record_id = f"{user.id}:{user.account_access_expires_at.isoformat()}"
        existing = db.query(Notification.id).filter(
            Notification.event_type == "trial_expiration_reminder",
            Notification.source_table == "users",
            Notification.source_record_id == source_record_id,
        ).first()
        if existing:
            continue

        title = "Your FILSCORE free trial is ending"
        message = (
            "Your 2-day free trial expires in 8 hours. Choose a subscription and complete "
            "payment through PayMongo or PayPal to keep uninterrupted access."
        )
        for channel, destination in (
            (NotificationChannel.IN_APP, None),
            (NotificationChannel.EMAIL, user.email),
        ):
            if channel == NotificationChannel.EMAIL and not destination:
                continue
            queue_notification(
                db,
                user_id=user.id,
                event_type="trial_expiration_reminder",
                channel=channel,
                title=title,
                message=message,
                priority=NotificationPriority.HIGH,
                payload={
                    "trial_expires_at": user.account_access_expires_at.isoformat(),
                    "grace_expires_at": state["grace_expires_at"].isoformat(),
                },
                destination=destination,
                source_table="users",
                source_record_id=source_record_id,
                created_by="trial-access-policy",
            )
            queued += 1

    if queued:
        db.commit()
    return queued
