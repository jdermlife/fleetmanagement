from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.fastapi_auth import CurrentUser
from app.models.subscription import (
    Subscription,
    SubscriptionPayment,
    SubscriptionPlan,
    SubscriptionRecordUsageEvent,
)

SUBSCRIPTION_BILLED_ROLES = {
    "subscriber",
    "subscriber_borrower",
    "subscriber_lender",
}


def _to_float(value: Decimal | float | int | None) -> float:
    if value is None:
        return 0.0

    return float(value)


def _calculate_monthly_due(
    *,
    role_code: str | None,
    records_this_month: int,
    minimum_monthly_fee: Decimal | float | int | None,
    per_record_fee: Decimal | float | int | None,
    monthly_price: Decimal | float | int | None,
) -> float:
    normalized_role = (role_code or "").strip().lower()
    minimum_fee = _to_float(minimum_monthly_fee)
    record_fee = _to_float(per_record_fee)
    plan_monthly_price = _to_float(monthly_price)

    if normalized_role == "subscriber_lender":
        return max(minimum_fee if minimum_fee > 0 else 2000.0, record_fee * records_this_month)

    if normalized_role == "subscriber_borrower":
        return minimum_fee if minimum_fee > 0 else (plan_monthly_price if plan_monthly_price > 0 else 100.0)

    if minimum_fee > 0:
        return minimum_fee

    return plan_monthly_price


def _has_sufficient_payment_for_month(
    db: Session,
    subscription_id: int,
    period_start: datetime,
    amount_due: float,
) -> bool:
    if amount_due <= 0:
        return True

    period_end = (period_start + timedelta(days=32)).replace(day=1)

    paid_total = (
        db.query(func.coalesce(func.sum(SubscriptionPayment.amount), 0))
        .filter(SubscriptionPayment.subscription_id == subscription_id)
        .filter(SubscriptionPayment.payment_status == "SUCCESS")
        .filter(SubscriptionPayment.paid_at >= period_start)
        .filter(SubscriptionPayment.paid_at < period_end)
        .scalar()
    )

    return _to_float(paid_total) >= amount_due


def evaluate_loan_record_create_entitlement(db: Session, user: CurrentUser) -> dict[str, object]:
    normalized_role = user.role.lower()
    # Keep UTC semantics without using deprecated datetime.utcnow().
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if normalized_role == "admin" or normalized_role not in SUBSCRIPTION_BILLED_ROLES:
        return {
            "allowed": True,
            "reason": "ROLE_NOT_BILLED",
            "message": "Record creation is allowed.",
            "role_code": normalized_role,
            "records_in_free_window": 0,
            "records_this_month": 0,
            "free_limit": 0,
            "free_days": 0,
            "free_window_active": False,
            "amount_due_this_month": 0.0,
            "has_paid_current_period": True,
        }

    # Prefer SQL function result when available.
    try:
        row = db.execute(
            text("SELECT * FROM fn_check_record_entitlement(:user_id, NOW())"),
            {"user_id": user.id},
        ).mappings().first()
    except Exception:
        row = None

    if row:
        amount_due = _to_float(row.get("amount_due_this_month"))
        allowed = bool(row.get("allowed", False))
        return {
            "allowed": allowed,
            "reason": row.get("reason") or ("ALLOWED" if allowed else "PAYMENT_REQUIRED"),
            "message": (
                "Record creation is allowed."
                if allowed
                else f"Payment required before creating a new record. Amount due this month: PHP {amount_due:,.2f}."
            ),
            "role_code": row.get("role_code") or normalized_role,
            "records_in_free_window": int(row.get("records_in_free_window") or 0),
            "records_this_month": int(row.get("records_this_month") or 0),
            "free_limit": int(row.get("free_limit") or 0),
            "free_days": int(row.get("free_days") or 0),
            "free_window_active": bool(row.get("free_window_active", False)),
            "amount_due_this_month": amount_due,
            "has_paid_current_period": allowed,
        }

    # Fallback implementation if SQL function is unavailable.
    try:
        subscription = (
            db.query(Subscription)
            .join(SubscriptionPlan, Subscription.plan_id == SubscriptionPlan.id)
            .filter(Subscription.user_id == user.id)
            .filter(Subscription.status.in_(["TRIAL", "ACTIVE"]))
            .filter(Subscription.is_deleted.is_(False))
            .order_by(Subscription.created_at.desc())
            .first()
        )
    except Exception:
        return {
            "allowed": True,
            "reason": "ENTITLEMENT_UNAVAILABLE",
            "message": "Entitlement check is temporarily unavailable. Record creation is allowed.",
            "role_code": normalized_role,
            "records_in_free_window": 0,
            "records_this_month": 0,
            "free_limit": 0,
            "free_days": 0,
            "free_window_active": False,
            "amount_due_this_month": 0.0,
            "has_paid_current_period": True,
        }

    if not subscription or not subscription.plan:
        return {
            "allowed": False,
            "reason": "NO_ACTIVE_SUBSCRIPTION",
            "message": "No active subscription found. Please subscribe to continue.",
            "role_code": normalized_role,
            "records_in_free_window": 0,
            "records_this_month": 0,
            "free_limit": 0,
            "free_days": 0,
            "free_window_active": False,
            "amount_due_this_month": 0.0,
            "has_paid_current_period": False,
        }

    plan = subscription.plan
    role_code = (plan.role_code or normalized_role).lower()
    free_limit = plan.free_record_limit_lifetime or 0
    free_days = plan.free_days_from_start or 0
    subscription_start = subscription.subscription_start or now.date()
    free_window_end = datetime.combine(subscription_start, datetime.min.time()) + timedelta(days=free_days)
    free_window_active = free_days > 0 and now <= free_window_end

    records_in_free_window = (
        db.query(func.count(SubscriptionRecordUsageEvent.id))
        .filter(SubscriptionRecordUsageEvent.subscription_id == subscription.id)
        .filter(
            SubscriptionRecordUsageEvent.event_ts >= datetime.combine(subscription_start, datetime.min.time())
        )
        .filter(SubscriptionRecordUsageEvent.event_ts <= free_window_end)
        .scalar()
        or 0
    )

    billing_month = now.date().replace(day=1)
    records_this_month = (
        db.query(func.count(SubscriptionRecordUsageEvent.id))
        .filter(SubscriptionRecordUsageEvent.subscription_id == subscription.id)
        .filter(SubscriptionRecordUsageEvent.billing_month == billing_month)
        .scalar()
        or 0
    )

    amount_due = _calculate_monthly_due(
        role_code=role_code,
        records_this_month=records_this_month,
        minimum_monthly_fee=plan.minimum_monthly_fee,
        per_record_fee=plan.per_record_fee,
        monthly_price=plan.monthly_price,
    )

    free_allowed = free_window_active and records_in_free_window < free_limit
    has_paid_current_period = _has_sufficient_payment_for_month(
        db,
        subscription.id,
        datetime(now.year, now.month, 1),
        amount_due,
    )
    allowed = free_allowed or has_paid_current_period

    return {
        "allowed": allowed,
        "reason": "FREE_USAGE_AVAILABLE" if free_allowed else ("PAID_CURRENT_PERIOD" if has_paid_current_period else "PAYMENT_REQUIRED"),
        "message": (
            "Record creation is allowed under your free usage window."
            if free_allowed
            else (
                "Record creation is allowed. Current period payment is up to date."
                if has_paid_current_period
                else f"Payment required before creating a new record. Amount due this month: PHP {amount_due:,.2f}."
            )
        ),
        "role_code": role_code,
        "records_in_free_window": int(records_in_free_window),
        "records_this_month": int(records_this_month),
        "free_limit": int(free_limit),
        "free_days": int(free_days),
        "free_window_active": bool(free_window_active),
        "amount_due_this_month": float(amount_due),
        "has_paid_current_period": bool(has_paid_current_period),
    }
