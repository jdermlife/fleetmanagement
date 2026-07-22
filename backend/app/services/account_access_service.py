from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os

from app.models.users import User

TRIAL_VALIDITY_DAYS = int(os.getenv("ACCOUNT_TRIAL_VALIDITY_DAYS", "3"))
PAID_VALIDITY_DAYS = int(os.getenv("ACCOUNT_PAID_VALIDITY_DAYS", "31"))


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def configure_new_account_access(user: User, now: datetime | None = None) -> None:
    current_time = now or _utc_now()
    user.account_access_expires_at = current_time + timedelta(days=TRIAL_VALIDITY_DAYS)
    user.is_active = True
    if not user.account_status or user.account_status.upper() in {"PENDING", "SUSPENDED"}:
        user.account_status = "ACTIVE"


def renew_account_access_after_payment(user: User, paid_at: datetime | None = None) -> None:
    effective_paid_at = paid_at or _utc_now()
    user.account_access_expires_at = effective_paid_at + timedelta(days=PAID_VALIDITY_DAYS)
    user.is_active = True
    user.account_status = "ACTIVE"


def deactivate_if_access_expired(user: User, now: datetime | None = None) -> bool:
    if user.account_access_expires_at is None:
        return False

    current_time = now or _utc_now()
    if user.account_access_expires_at > current_time:
        return False

    if user.account_status and user.account_status.upper() == "DELETED":
        return False

    if user.is_active or (user.account_status or "").upper() != "SUSPENDED":
        user.is_active = False
        user.account_status = "SUSPENDED"
        return True

    return False
