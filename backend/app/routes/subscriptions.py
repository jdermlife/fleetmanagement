from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import json
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from app.database import SessionLocal, set_rls_context
from app.fastapi_auth import CurrentUser, require_roles
from app.models.subscription import (
    Feature,
    PaymentProvider,
    PaymentWebhook,
    PlanFeature,
    Subscription,
    SubscriptionEvent,
    SubscriptionInvoice,
    SubscriptionPayment,
    SubscriptionPlan,
    SubscriptionUsage,
)
from app.models.users import User
from app.schemas.subscription_schema import (
    FeatureCreate,
    FreeSubscriptionCreateRequest,
    PayPalCaptureOrderRequest,
    PayPalCreateOrderRequest,
    PaymentProviderCreate,
    PayMongoCheckoutCreate,
    PaymentWebhookCreate,
    PlanFeatureAssignRequest,
    SubscriptionCheckoutCreateRequest,
    SubscriptionCreate,
    SubscriptionEventCreate,
    SubscriptionInvoiceCreate,
    SubscriptionPaymentCreate,
    SubscriptionPaymentUpdate,
    SubscriptionPlanCreate,
    SubscriptionPlanUpdate,
    SubscriptionUpdate,
    SubscriptionUsageCreate,
)
from app.services.email_service import send_email
from app.services.paymongo import (
    PayMongoAPIError,
    PayMongoConfigurationError,
    PayMongoSignatureError,
    create_checkout_session,
    verify_webhook_signature,
)
from app.services.paypal import (
    PayPalAPIError,
    PayPalConfigurationError,
    PayPalSignatureError,
    capture_order as capture_paypal_order_api,
    create_order as create_paypal_order_api,
    verify_webhook_signature as verify_paypal_webhook_signature,
)
from app.services.subscription_entitlement import evaluate_loan_record_create_entitlement

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


def _session_with_rls(user: CurrentUser):
    db = SessionLocal()
    set_rls_context(db, user.id, user.role)
    return db


def _is_admin(user: CurrentUser) -> bool:
    return user.role.lower() == "admin"


def _serialize_plan(plan: SubscriptionPlan) -> dict:
    return {
        "id": plan.id,
        "plan_code": plan.plan_code,
        "plan_name": plan.plan_name,
        "description": plan.description,
        "billing_cycle": plan.billing_cycle,
        "monthly_price": float(plan.monthly_price) if plan.monthly_price is not None else None,
        "yearly_price": float(plan.yearly_price) if plan.yearly_price is not None else None,
        "currency": plan.currency,
        "max_users": plan.max_users,
        "max_vehicles": plan.max_vehicles,
        "max_drivers": plan.max_drivers,
        "max_storage_gb": plan.max_storage_gb,
        "trial_days": plan.trial_days,
        "display_order": plan.display_order,
        "is_public": plan.is_public,
        "is_custom_pricing": plan.is_custom_pricing,
        "max_ai_requests_per_month": plan.max_ai_requests_per_month,
        "max_api_calls_per_month": plan.max_api_calls_per_month,
        "max_documents": plan.max_documents,
        "max_reports": plan.max_reports,
        "max_meetings": plan.max_meetings,
        "max_storage_files": plan.max_storage_files,
        "storage_unit": plan.storage_unit,
        "support_level": plan.support_level,
        "sla_hours": plan.sla_hours,
        "color_code": plan.color_code,
        "icon_name": plan.icon_name,
        "free_record_limit_lifetime": plan.free_record_limit_lifetime,
        "free_days_from_start": plan.free_days_from_start,
        "minimum_monthly_fee": float(plan.minimum_monthly_fee) if plan.minimum_monthly_fee is not None else None,
        "per_record_fee": float(plan.per_record_fee) if plan.per_record_fee is not None else None,
        "role_code": plan.role_code,
        "ai_enabled": plan.ai_enabled,
        "api_enabled": plan.api_enabled,
        "reporting_enabled": plan.reporting_enabled,
        "is_active": plan.is_active,
        "created_at": plan.created_at,
        "updated_at": plan.updated_at,
    }


@router.get("/entitlement/loan-record-create")
def get_loan_record_creation_entitlement(
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
):
    db = _session_with_rls(user)
    try:
        return evaluate_loan_record_create_entitlement(db, user)
    finally:
        db.close()


@router.get("/public-plans")
def list_public_plans():
    db = SessionLocal()
    try:
        rows = (
            db.query(SubscriptionPlan)
            .order_by(SubscriptionPlan.display_order.asc(), SubscriptionPlan.plan_name.asc())
            .all()
        )
        return [
            _serialize_plan(item)
            for item in rows
            if item.is_active and item.is_public
        ]
    finally:
        db.close()


def _serialize_subscription(subscription: Subscription) -> dict:
    return {
        "id": subscription.id,
        "subscription_no": subscription.subscription_no,
        "user_id": subscription.user_id,
        "plan_id": subscription.plan_id,
        "status": subscription.status,
        "subscription_type": subscription.subscription_type,
        "trial_start": subscription.trial_start,
        "trial_end": subscription.trial_end,
        "subscription_start": subscription.subscription_start,
        "subscription_end": subscription.subscription_end,
        "auto_renew": subscription.auto_renew,
        "payment_provider_id": subscription.payment_provider_id,
        "next_billing_date": subscription.next_billing_date,
        "cancellation_reason": subscription.cancellation_reason,
        "cancelled_at": subscription.cancelled_at,
        "cancelled_by": subscription.cancelled_by,
        "grace_period_end": subscription.grace_period_end,
        "renewal_count": subscription.renewal_count,
        "last_payment_date": subscription.last_payment_date,
        "next_invoice_date": subscription.next_invoice_date,
        "current_users": subscription.current_users,
        "current_vehicles": subscription.current_vehicles,
        "current_drivers": subscription.current_drivers,
        "current_storage_gb": float(subscription.current_storage_gb) if subscription.current_storage_gb is not None else None,
        "current_ai_requests": subscription.current_ai_requests,
        "current_api_calls": subscription.current_api_calls,
        "tenant_id": subscription.tenant_id,
        "created_by": subscription.created_by,
        "updated_by": subscription.updated_by,
        "deleted_by": subscription.deleted_by,
        "deleted_at": subscription.deleted_at,
        "is_deleted": subscription.is_deleted,
        "remarks": subscription.remarks,
        "created_at": subscription.created_at,
        "updated_at": subscription.updated_at,
    }


def _serialize_subscription_payment(payment: SubscriptionPayment) -> dict:
    return {
        "id": payment.id,
        "payment_reference": payment.payment_reference,
        "subscription_id": payment.subscription_id,
        "provider_id": payment.provider_id,
        "invoice_no": payment.invoice_no,
        "amount": float(payment.amount) if payment.amount is not None else None,
        "currency": payment.currency,
        "payment_method": payment.payment_method,
        "payment_status": payment.payment_status,
        "provider_transaction_id": payment.provider_transaction_id,
        "paid_at": payment.paid_at,
        "created_at": payment.created_at,
    }


def _add_months(value: date, months: int) -> date:
    total_months = (value.year * 12 + (value.month - 1)) + months
    next_year = total_months // 12
    next_month = total_months % 12 + 1
    next_day = min(value.day, monthrange(next_year, next_month)[1])
    return date(next_year, next_month, next_day)


def _calculate_next_billing_date(plan: SubscriptionPlan | None, paid_date: date) -> date | None:
    if plan is None:
        return None
    if plan.billing_cycle == "YEARLY":
        return _add_months(paid_date, 12)
    if plan.billing_cycle == "QUARTERLY":
        return _add_months(paid_date, 3)
    return _add_months(paid_date, 1)


def _apply_successful_payment(
    db,
    payment: SubscriptionPayment,
    subscription: Subscription | None = None,
) -> None:
    target_subscription = subscription or getattr(payment, "subscription", None)
    if target_subscription is None:
        target_subscription = db.query(Subscription).filter(Subscription.id == payment.subscription_id).first()
    if target_subscription is None:
        return

    paid_at = payment.paid_at or datetime.now(timezone.utc)
    payment.paid_at = paid_at

    target_subscription.status = "ACTIVE"
    if target_subscription.subscription_type != "LIFETIME":
        target_subscription.subscription_type = "PAID"
    target_subscription.last_payment_date = paid_at.date()

    plan = getattr(target_subscription, "plan", None)
    if plan is None:
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == target_subscription.plan_id).first()
    target_subscription.next_billing_date = _calculate_next_billing_date(plan, paid_at.date())

    owning_user = db.query(User).filter(User.id == target_subscription.user_id).first()
    if owning_user is not None:
        owning_user.subscription_id = target_subscription.id


def _subscription_checkout_amount(plan: SubscriptionPlan) -> Decimal:
    monthly_price = Decimal(str(plan.monthly_price or 0))
    yearly_price = Decimal(str(plan.yearly_price or 0))
    minimum_fee = Decimal(str(plan.minimum_monthly_fee or 0))
    billing_cycle = (plan.billing_cycle or "MONTHLY").upper()

    if billing_cycle == "YEARLY":
        amount = yearly_price if yearly_price > 0 else monthly_price * 12
    elif billing_cycle == "QUARTERLY":
        amount = monthly_price * 3
    else:
        amount = monthly_price
    if amount <= 0:
        amount = minimum_fee
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _amount_to_centavos(amount: Decimal) -> int:
    return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _build_subscription_no(prefix: str = "SUB") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12].upper()}"


def _find_default_free_plan(db) -> SubscriptionPlan | None:
    free_plan = (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.is_active.is_(True))
        .filter(SubscriptionPlan.is_public.is_(True))
        .filter(
            (SubscriptionPlan.monthly_price.is_(None)) | (SubscriptionPlan.monthly_price <= 0)
        )
        .order_by(SubscriptionPlan.display_order.asc(), SubscriptionPlan.plan_name.asc())
        .first()
    )
    if free_plan is not None:
        return free_plan

    return (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.is_active.is_(True))
        .order_by(SubscriptionPlan.display_order.asc(), SubscriptionPlan.plan_name.asc())
        .first()
    )


def generate_pdf_invoice(payment: SubscriptionPayment, subscription: Subscription, plan: SubscriptionPlan | None) -> dict:
    amount = float(payment.amount) if payment.amount is not None else 0.0
    return {
        "invoice_no": payment.invoice_no or f"INV-{payment.id}",
        "payment_reference": payment.payment_reference,
        "subscription_no": subscription.subscription_no,
        "plan_name": plan.plan_name if plan is not None else "Subscription",
        "currency": payment.currency or "PHP",
        "amount": amount,
        "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
    }


def _send_invoice_email(user: User | None, invoice: dict) -> None:
    if user is None or not user.email:
        return
    subject = f"Payment received: {invoice.get('invoice_no', 'Invoice')}"
    body = (
        "Your subscription payment has been confirmed.\n\n"
        f"Invoice No: {invoice.get('invoice_no')}\n"
        f"Subscription: {invoice.get('subscription_no')}\n"
        f"Plan: {invoice.get('plan_name')}\n"
        f"Amount: {invoice.get('currency')} {invoice.get('amount')}\n"
        f"Reference: {invoice.get('payment_reference')}\n"
    )
    send_email(user.email, subject, body)


def _mark_payment_success(
    db,
    *,
    payment: SubscriptionPayment,
    provider: PaymentProvider,
    payment_method: str,
    processed_at: datetime,
    paid_at: datetime | None = None,
) -> None:
    if payment.payment_status == "SUCCESS":
        return

    payment.paid_at = paid_at or processed_at
    payment.payment_method = payment_method[:50]
    payment.payment_status = "SUCCESS"

    subscription = getattr(payment, "subscription", None)
    if subscription is None:
        subscription = (
            db.query(Subscription)
            .filter(Subscription.id == payment.subscription_id)
            .first()
        )
    if subscription is None:
        raise HTTPException(status_code=404, detail="Subscription not found for payment")

    subscription.payment_provider_id = provider.id
    _apply_successful_payment(db, payment, subscription=subscription)

    if payment.invoice_no:
        existing_invoice = (
            db.query(SubscriptionInvoice)
            .filter(SubscriptionInvoice.invoice_no == payment.invoice_no)
            .first()
        )
    else:
        existing_invoice = None
    if existing_invoice is None:
        db.add(
            SubscriptionInvoice(
                invoice_no=payment.invoice_no or f"INV-{payment.id}",
                subscription_id=subscription.id,
                invoice_date=processed_at.date(),
                due_date=processed_at.date(),
                subtotal=payment.amount,
                tax=0,
                total=payment.amount,
                status="PAID",
            )
        )

    try:
        plan = getattr(subscription, "plan", None)
        if plan is None:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()
        owning_user = db.query(User).filter(User.id == subscription.user_id).first()
        invoice = generate_pdf_invoice(payment, subscription, plan)
        _send_invoice_email(owning_user, invoice)
    except Exception:
        # Email or invoice rendering issues should not fail payment activation.
        pass


@router.get("/plans")
def list_plans(
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
):
    db = _session_with_rls(user)
    try:
        rows = db.query(SubscriptionPlan).order_by(SubscriptionPlan.plan_name.asc()).all()
        return [_serialize_plan(item) for item in rows]
    finally:
        db.close()


@router.post("/plans")
def create_plan(
    payload: SubscriptionPlanCreate,
    user: CurrentUser = Depends(require_roles("Admin")),
):
    db = _session_with_rls(user)
    try:
        existing = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_code == payload.plan_code).first()
        if existing:
            raise HTTPException(status_code=409, detail="Plan code already exists")

        row = SubscriptionPlan(**payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
        return _serialize_plan(row)
    finally:
        db.close()


@router.patch("/plans/{plan_id}")
def update_plan(
    plan_id: int,
    payload: SubscriptionPlanUpdate,
    user: CurrentUser = Depends(require_roles("Admin")),
):
    db = _session_with_rls(user)
    try:
        row = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Plan not found")

        updates = payload.model_dump(exclude_unset=True)
        plan_code = updates.get("plan_code")
        if plan_code and plan_code != row.plan_code:
            existing = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_code == plan_code).first()
            if existing and existing.id != row.id:
                raise HTTPException(status_code=409, detail="Plan code already exists")

        for key, value in updates.items():
            setattr(row, key, value)

        db.commit()
        db.refresh(row)
        return _serialize_plan(row)
    finally:
        db.close()


@router.get("")
def list_subscriptions(
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
    status: str | None = Query(default=None),
):
    db = _session_with_rls(user)
    try:
        query = db.query(Subscription)
        if not _is_admin(user):
            query = query.filter(Subscription.user_id == user.id)
        if status:
            query = query.filter(Subscription.status == status)
        rows = query.order_by(Subscription.created_at.desc()).all()
        return [_serialize_subscription(item) for item in rows]
    finally:
        db.close()


@router.get("/me")
def get_my_subscription(
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
):
    db = _session_with_rls(user)
    try:
        row = (
            db.query(Subscription)
            .filter(Subscription.user_id == user.id)
            .order_by(Subscription.created_at.desc())
            .first()
        )
        return _serialize_subscription(row) if row else None
    finally:
        db.close()


@router.post("/create-free")
def create_free_subscription(
    payload: FreeSubscriptionCreateRequest,
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
):
    db = _session_with_rls(user)
    try:
        target_user_id = payload.user_id if _is_admin(user) and payload.user_id else user.id

        existing = (
            db.query(Subscription)
            .filter(Subscription.user_id == target_user_id)
            .filter(Subscription.status.in_(["PENDING", "TRIAL", "ACTIVE", "SUSPENDED"]))
            .order_by(Subscription.created_at.desc())
            .first()
        )
        if existing is not None:
            return _serialize_subscription(existing)

        free_plan = _find_default_free_plan(db)
        if free_plan is None:
            raise HTTPException(status_code=422, detail="No subscription plans are configured")

        row = Subscription(
            subscription_no=_build_subscription_no("FREE"),
            user_id=target_user_id,
            plan_id=free_plan.id,
            status="PENDING",
            subscription_type="FREE",
            subscription_start=date.today(),
            auto_renew=True,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _serialize_subscription(row)
    finally:
        db.close()


@router.post("/create-checkout")
def create_checkout_for_plan(
    payload: SubscriptionCheckoutCreateRequest,
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
):
    db = _session_with_rls(user)
    try:
        normalized_cycle = payload.billing_cycle.upper()
        plan = (
            db.query(SubscriptionPlan)
            .filter(SubscriptionPlan.plan_code == payload.plan)
            .filter(SubscriptionPlan.billing_cycle == normalized_cycle)
            .first()
        )
        if plan is None:
            raise HTTPException(status_code=404, detail="Subscription plan not found")

        subscription = Subscription(
            subscription_no=_build_subscription_no("SUB"),
            user_id=user.id,
            plan_id=plan.id,
            status="PENDING",
            subscription_type="PAID",
            subscription_start=date.today(),
            auto_renew=True,
        )
        db.add(subscription)
        db.flush()

        provider = (
            db.query(PaymentProvider)
            .filter(PaymentProvider.provider_code == "PAYMONGO")
            .first()
        )
        if provider is None or provider.is_active is False:
            raise HTTPException(status_code=503, detail="PayMongo payment provider is not active")

        amount = _subscription_checkout_amount(plan)
        if amount <= 0:
            raise HTTPException(status_code=422, detail="Subscription plan has no payable amount")

        payment_reference = f"PM-{uuid.uuid4().hex.upper()}"[:35]
        owning_user = db.query(User).filter(User.id == subscription.user_id).first()

        try:
            checkout = create_checkout_session(
                amount_centavos=_amount_to_centavos(amount),
                currency=(plan.currency or "PHP").upper(),
                description=f"{plan.plan_name} subscription payment",
                item_name=f"{plan.plan_name} subscription",
                reference_number=payment_reference,
                customer_name=getattr(owning_user, "username", None),
                customer_email=getattr(owning_user, "email", None),
                metadata={
                    "user_id": str(subscription.user_id),
                    "subscription_id": str(subscription.id),
                    "plan": plan.plan_code,
                },
            )
        except PayMongoConfigurationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except PayMongoAPIError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        payment = SubscriptionPayment(
            payment_reference=payment_reference,
            subscription_id=subscription.id,
            provider_id=provider.id,
            invoice_no=subscription.subscription_no,
            amount=amount,
            currency=(plan.currency or "PHP").upper(),
            payment_method="PayMongo Checkout",
            payment_status="PENDING",
            provider_transaction_id=checkout["checkout_id"],
        )
        subscription.status = "PENDING"
        db.add(subscription)
        db.add(payment)
        db.commit()

        return {"checkout_url": checkout["checkout_url"]}
    finally:
        db.close()


@router.post("")
def create_subscription(
    payload: SubscriptionCreate,
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
):
    db = _session_with_rls(user)
    try:
        existing = db.query(Subscription).filter(Subscription.subscription_no == payload.subscription_no).first()
        if existing:
            raise HTTPException(status_code=409, detail="Subscription number already exists")

        user_id = payload.user_id if _is_admin(user) and payload.user_id else user.id
        row = Subscription(**payload.model_dump(exclude={"user_id"}), user_id=user_id)
        db.add(row)
        db.commit()
        db.refresh(row)
        return _serialize_subscription(row)
    finally:
        db.close()


@router.patch("/{subscription_id}")
def update_subscription(
    subscription_id: int,
    payload: SubscriptionUpdate,
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
):
    db = _session_with_rls(user)
    try:
        row = db.query(Subscription).filter(Subscription.id == subscription_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Subscription not found")
        if not _is_admin(user) and row.user_id != user.id:
            raise HTTPException(status_code=403, detail="Cannot update another user's subscription")

        updates = payload.model_dump(exclude_unset=True)
        if not _is_admin(user) and "user_id" in updates:
            raise HTTPException(status_code=403, detail="Cannot reassign subscription ownership")

        for key, value in updates.items():
            setattr(row, key, value)

        db.commit()
        db.refresh(row)
        return _serialize_subscription(row)
    finally:
        db.close()


@router.patch("/{subscription_id}/status")
def update_subscription_status(
    subscription_id: int,
    status: str,
    user: CurrentUser = Depends(require_roles("Admin")),
):
    db = _session_with_rls(user)
    try:
        row = db.query(Subscription).filter(Subscription.id == subscription_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Subscription not found")
        row.status = status
        db.commit()
        db.refresh(row)
        return _serialize_subscription(row)
    finally:
        db.close()


@router.get("/providers")
def list_payment_providers(user: CurrentUser = Depends(require_roles("Admin", "Subscriber"))):
    db = _session_with_rls(user)
    try:
        rows = db.query(PaymentProvider).order_by(PaymentProvider.provider_name.asc()).all()
        return [
            {
                "id": item.id,
                "provider_code": item.provider_code,
                "provider_name": item.provider_name,
                "api_endpoint": item.api_endpoint,
                "webhook_url": item.webhook_url,
                "is_active": item.is_active,
                "created_at": item.created_at,
            }
            for item in rows
        ]
    finally:
        db.close()


@router.post("/providers")
def create_payment_provider(
    payload: PaymentProviderCreate,
    user: CurrentUser = Depends(require_roles("Admin")),
):
    db = _session_with_rls(user)
    try:
        existing = db.query(PaymentProvider).filter(PaymentProvider.provider_code == payload.provider_code).first()
        if existing:
            raise HTTPException(status_code=409, detail="Provider code already exists")
        row = PaymentProvider(**payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "id": row.id,
            "provider_code": row.provider_code,
            "provider_name": row.provider_name,
            "api_endpoint": row.api_endpoint,
            "webhook_url": row.webhook_url,
            "is_active": row.is_active,
            "created_at": row.created_at,
        }
    finally:
        db.close()


@router.get("/payments")
def list_subscription_payments(
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
):
    db = _session_with_rls(user)
    try:
        query = db.query(SubscriptionPayment).join(Subscription, Subscription.id == SubscriptionPayment.subscription_id)
        if not _is_admin(user):
            query = query.filter(Subscription.user_id == user.id)
        rows = query.order_by(SubscriptionPayment.created_at.desc()).all()
        return [_serialize_subscription_payment(item) for item in rows]
    finally:
        db.close()


@router.post("/payments/paymongo/checkout")
def create_paymongo_checkout(
    payload: PayMongoCheckoutCreate,
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
):
    db = _session_with_rls(user)
    try:
        subscription = db.query(Subscription).filter(Subscription.id == payload.subscription_id).first()
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")
        if not _is_admin(user) and subscription.user_id != user.id:
            raise HTTPException(status_code=403, detail="Cannot pay for another user's subscription")

        provider = (
            db.query(PaymentProvider)
            .filter(PaymentProvider.provider_code == "PAYMONGO")
            .first()
        )
        if provider is None or provider.is_active is False:
            raise HTTPException(status_code=503, detail="PayMongo payment provider is not active")

        plan = getattr(subscription, "plan", None)
        if plan is None:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()
        if plan is None:
            raise HTTPException(status_code=422, detail="Subscription plan is unavailable")

        amount = _subscription_checkout_amount(plan)
        if amount <= 0:
            raise HTTPException(status_code=422, detail="Subscription plan has no payable amount")

        currency = (plan.currency or "PHP").upper()
        payment_reference = f"PM-{uuid.uuid4().hex.upper()}"[:35]
        owning_user = db.query(User).filter(User.id == subscription.user_id).first()

        try:
            checkout = create_checkout_session(
                amount_centavos=_amount_to_centavos(amount),
                currency=currency,
                description=f"{plan.plan_name} subscription payment",
                item_name=f"{plan.plan_name} subscription",
                reference_number=payment_reference,
                customer_name=getattr(owning_user, "username", None),
                customer_email=getattr(owning_user, "email", None),
                metadata={
                    "user_id": str(subscription.user_id),
                    "subscription_id": str(subscription.id),
                    "plan": plan.plan_code,
                },
            )
        except PayMongoConfigurationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except PayMongoAPIError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        payment = SubscriptionPayment(
            payment_reference=payment_reference,
            subscription_id=subscription.id,
            provider_id=provider.id,
            invoice_no=payload.invoice_no or subscription.subscription_no,
            amount=amount,
            currency=currency,
            payment_method="PayMongo Checkout",
            payment_status="PENDING",
            provider_transaction_id=checkout["checkout_id"],
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)
        return {
            "checkout_id": checkout["checkout_id"],
            "checkout_url": checkout["checkout_url"],
            "amount": float(amount),
            "currency": currency,
            "payment": _serialize_subscription_payment(payment),
        }
    finally:
        db.close()


@router.post("/payments/paymongo/webhook")
async def receive_paymongo_webhook(
    request: Request,
    paymongo_signature: str | None = Header(default=None, alias="Paymongo-Signature"),
):
    if not paymongo_signature:
        raise HTTPException(status_code=401, detail="Missing PayMongo signature")

    raw_payload = await request.body()
    try:
        signature_mode = verify_webhook_signature(raw_payload, paymongo_signature)
    except PayMongoConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PayMongoSignatureError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    try:
        payload = json.loads(raw_payload)
        event = payload["data"]
        event_id = str(event["id"])
        event_attributes = event["attributes"]
        event_type = str(event_attributes["type"])
        livemode = bool(event_attributes["livemode"])
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid PayMongo webhook payload") from exc

    if (signature_mode == "live") != livemode:
        raise HTTPException(status_code=401, detail="PayMongo signature mode mismatch")
    if not event_id.startswith("evt_"):
        raise HTTPException(status_code=400, detail="Invalid PayMongo event identifier")

    db = SessionLocal()
    try:
        provider = (
            db.query(PaymentProvider)
            .filter(PaymentProvider.provider_code == "PAYMONGO")
            .first()
        )
        if provider is None or provider.is_active is False:
            raise HTTPException(status_code=503, detail="PayMongo payment provider is not active")

        if event_type != "checkout_session.payment.paid":
            db.add(
                PaymentWebhook(
                    provider_id=provider.id,
                    event_type=event_type,
                    payload=payload,
                    processed=False,
                )
            )
            db.commit()
            return {"received": True, "processed": False}

        try:
            checkout = event_attributes["data"]
            checkout_id = str(checkout["id"])
            if not checkout_id.startswith("cs_"):
                raise ValueError("invalid checkout identifier")
            checkout_attributes = checkout["attributes"]
            checkout_metadata = checkout_attributes.get("metadata") or {}
            paid_payments = [
                item
                for item in checkout_attributes.get("payments", [])
                if item.get("attributes", {}).get("status") == "paid"
            ]
            paid_payment = paid_payments[0]
            paid_attributes = paid_payment["attributes"]
            paid_amount_centavos = int(paid_attributes["amount"])
            paid_currency = str(paid_attributes["currency"]).upper()
        except (IndexError, KeyError, TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Incomplete paid checkout payload") from exc

        payment = (
            db.query(SubscriptionPayment)
            .filter(SubscriptionPayment.provider_id == provider.id)
            .filter(SubscriptionPayment.provider_transaction_id == checkout_id)
            .first()
        )
        if payment is None and isinstance(checkout_metadata, dict):
            metadata_subscription_id = checkout_metadata.get("subscription_id")
            if metadata_subscription_id is not None:
                try:
                    metadata_subscription_id_int = int(metadata_subscription_id)
                except (TypeError, ValueError):
                    metadata_subscription_id_int = None
                if metadata_subscription_id_int is not None:
                    payment = (
                        db.query(SubscriptionPayment)
                        .filter(SubscriptionPayment.subscription_id == metadata_subscription_id_int)
                        .filter(SubscriptionPayment.provider_id == provider.id)
                        .order_by(SubscriptionPayment.created_at.desc())
                        .first()
                    )
        if payment is None:
            raise HTTPException(status_code=404, detail="Pending checkout payment not found")

        expected_amount_centavos = _amount_to_centavos(Decimal(str(payment.amount or 0)))
        expected_currency = (payment.currency or "").upper()
        if paid_amount_centavos != expected_amount_centavos or paid_currency != expected_currency:
            raise HTTPException(status_code=409, detail="Paid checkout amount does not match")

        processed_at = datetime.now(timezone.utc)
        if payment.payment_status != "SUCCESS":
            paid_at_value = paid_attributes.get("paid_at")
            paid_at = (
                datetime.fromtimestamp(int(paid_at_value), tz=timezone.utc)
                if paid_at_value is not None
                else processed_at
            )
            source = paid_attributes.get("source") or {}
            payment_method = str(source.get("type") or "PayMongo Checkout")
            _mark_payment_success(
                db,
                payment=payment,
                provider=provider,
                payment_method=payment_method,
                processed_at=processed_at,
                paid_at=paid_at,
            )

        db.add(
            PaymentWebhook(
                provider_id=provider.id,
                event_type=event_type,
                payload=payload,
                processed=True,
                processed_at=processed_at,
            )
        )
        db.commit()
        return {"received": True, "processed": True}
    finally:
        db.close()


@router.post("/payments/paypal/create-order")
def create_paypal_order(
    payload: PayPalCreateOrderRequest,
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
):
    db = _session_with_rls(user)
    try:
        subscription = db.query(Subscription).filter(Subscription.id == payload.subscription_id).first()
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")
        if not _is_admin(user) and subscription.user_id != user.id:
            raise HTTPException(status_code=403, detail="Cannot pay for another user's subscription")

        provider = (
            db.query(PaymentProvider)
            .filter(PaymentProvider.provider_code == "PAYPAL")
            .first()
        )
        if provider is None or provider.is_active is False:
            raise HTTPException(status_code=503, detail="PayPal payment provider is not active")

        plan = getattr(subscription, "plan", None)
        if plan is None:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()
        if plan is None:
            raise HTTPException(status_code=422, detail="Subscription plan is unavailable")

        amount = _subscription_checkout_amount(plan)
        if amount <= 0:
            raise HTTPException(status_code=422, detail="Subscription plan has no payable amount")

        currency = (plan.currency or "PHP").upper()
        payment_reference = f"PP-{uuid.uuid4().hex.upper()}"[:35]

        try:
            order = create_paypal_order_api(
                amount=amount,
                currency=currency,
                description=f"{plan.plan_name} subscription payment",
                payment_reference=payment_reference,
                custom_id=payment_reference,
                invoice_id=payload.invoice_no or subscription.subscription_no,
            )
        except PayPalConfigurationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except PayPalAPIError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        payment = SubscriptionPayment(
            payment_reference=payment_reference,
            subscription_id=subscription.id,
            provider_id=provider.id,
            invoice_no=payload.invoice_no or subscription.subscription_no,
            amount=amount,
            currency=currency,
            payment_method="PayPal Order",
            payment_status="PENDING",
            provider_transaction_id=order["order_id"],
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)
        return {
            "order_id": order["order_id"],
            "status": order["status"],
            "approval_url": order["approval_url"],
            "amount": float(amount),
            "currency": currency,
            "payment": _serialize_subscription_payment(payment),
        }
    finally:
        db.close()


@router.post("/payments/paypal/capture-order")
def capture_paypal_order(
    payload: PayPalCaptureOrderRequest,
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
):
    db = _session_with_rls(user)
    try:
        provider = (
            db.query(PaymentProvider)
            .filter(PaymentProvider.provider_code == "PAYPAL")
            .first()
        )
        if provider is None or provider.is_active is False:
            raise HTTPException(status_code=503, detail="PayPal payment provider is not active")

        payment = (
            db.query(SubscriptionPayment)
            .filter(SubscriptionPayment.provider_id == provider.id)
            .filter(SubscriptionPayment.provider_transaction_id == payload.order_id)
            .first()
        )
        if payment is None and payload.subscription_id is not None:
            payment = (
                db.query(SubscriptionPayment)
                .filter(SubscriptionPayment.subscription_id == payload.subscription_id)
                .filter(SubscriptionPayment.provider_id == provider.id)
                .order_by(SubscriptionPayment.created_at.desc())
                .first()
            )
        if payment is None:
            raise HTTPException(status_code=404, detail="Pending PayPal order not found")

        subscription = db.query(Subscription).filter(Subscription.id == payment.subscription_id).first()
        if subscription is None:
            raise HTTPException(status_code=404, detail="Subscription not found for payment")
        if not _is_admin(user) and subscription.user_id != user.id:
            raise HTTPException(status_code=403, detail="Cannot capture another user's payment")

        if payment.payment_status == "SUCCESS":
            return {
                "captured": True,
                "already_processed": True,
                "payment": _serialize_subscription_payment(payment),
            }

        try:
            capture_result = capture_paypal_order_api(payload.order_id)
        except PayPalConfigurationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except PayPalAPIError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        if capture_result["status"] != "COMPLETED":
            raise HTTPException(status_code=409, detail="PayPal order is not completed")

        expected_amount_centavos = _amount_to_centavos(Decimal(str(payment.amount or 0)))
        received_amount_centavos = _amount_to_centavos(capture_result["amount"])
        expected_currency = (payment.currency or "").upper()
        received_currency = str(capture_result["currency"]).upper()
        if (
            received_amount_centavos != expected_amount_centavos
            or received_currency != expected_currency
        ):
            raise HTTPException(status_code=409, detail="Captured amount does not match")

        processed_at = datetime.now(timezone.utc)
        payment.provider_transaction_id = payload.order_id
        _mark_payment_success(
            db,
            payment=payment,
            provider=provider,
            payment_method="PayPal Capture",
            processed_at=processed_at,
            paid_at=processed_at,
        )

        db.add(
            PaymentWebhook(
                provider_id=provider.id,
                event_type="PAYPAL.CAPTURE.ORDER",
                payload={
                    "order_id": payload.order_id,
                    "capture_id": capture_result.get("capture_id"),
                },
                processed=True,
                processed_at=processed_at,
            )
        )
        db.commit()
        db.refresh(payment)
        return {
            "captured": True,
            "order_id": payload.order_id,
            "capture_id": capture_result.get("capture_id"),
            "payment": _serialize_subscription_payment(payment),
        }
    finally:
        db.close()


@router.post("/payments/paypal/webhook")
async def receive_paypal_webhook(request: Request):
    raw_payload = await request.body()
    verification_headers = {
        "PAYPAL-AUTH-ALGO": request.headers.get("PayPal-Auth-Algo", ""),
        "PAYPAL-CERT-URL": request.headers.get("PayPal-Cert-Url", ""),
        "PAYPAL-TRANSMISSION-ID": request.headers.get("PayPal-Transmission-Id", ""),
        "PAYPAL-TRANSMISSION-SIG": request.headers.get("PayPal-Transmission-Sig", ""),
        "PAYPAL-TRANSMISSION-TIME": request.headers.get("PayPal-Transmission-Time", ""),
    }

    try:
        verify_paypal_webhook_signature(raw_payload, verification_headers)
    except PayPalConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PayPalSignatureError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except PayPalAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    try:
        payload = json.loads(raw_payload)
        event_id = str(payload["id"])
        event_type = str(payload["event_type"])
        resource = payload["resource"]
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid PayPal webhook payload") from exc

    if not event_id:
        raise HTTPException(status_code=400, detail="Invalid PayPal event identifier")

    db = SessionLocal()
    try:
        provider = (
            db.query(PaymentProvider)
            .filter(PaymentProvider.provider_code == "PAYPAL")
            .first()
        )
        if provider is None or provider.is_active is False:
            raise HTTPException(status_code=503, detail="PayPal payment provider is not active")

        if event_type != "PAYMENT.CAPTURE.COMPLETED":
            db.add(
                PaymentWebhook(
                    provider_id=provider.id,
                    event_type=event_type,
                    payload=payload,
                    processed=False,
                )
            )
            db.commit()
            return {"received": True, "processed": False}

        related_ids = (
            resource.get("supplementary_data", {})
            .get("related_ids", {})
        )
        order_id = str(related_ids.get("order_id") or "").strip()
        capture_id = str(resource.get("id") or "").strip()
        custom_id = str(resource.get("custom_id") or "").strip()
        invoice_id = str(resource.get("invoice_id") or "").strip()

        amount_payload = resource.get("amount") or {}
        paid_currency = str(amount_payload.get("currency_code") or "").upper()
        try:
            paid_amount = Decimal(str(amount_payload.get("value") or "0"))
        except (ArithmeticError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid PayPal capture amount")

        payment = None
        if order_id:
            payment = (
                db.query(SubscriptionPayment)
                .filter(SubscriptionPayment.provider_id == provider.id)
                .filter(SubscriptionPayment.provider_transaction_id == order_id)
                .first()
            )
        if payment is None and custom_id:
            payment = (
                db.query(SubscriptionPayment)
                .filter(SubscriptionPayment.provider_id == provider.id)
                .filter(SubscriptionPayment.payment_reference == custom_id)
                .first()
            )
        if payment is None and invoice_id:
            payment = (
                db.query(SubscriptionPayment)
                .filter(SubscriptionPayment.provider_id == provider.id)
                .filter(SubscriptionPayment.invoice_no == invoice_id)
                .order_by(SubscriptionPayment.created_at.desc())
                .first()
            )
        if payment is None:
            raise HTTPException(status_code=404, detail="Pending PayPal payment not found")

        expected_amount_centavos = _amount_to_centavos(Decimal(str(payment.amount or 0)))
        expected_currency = (payment.currency or "").upper()
        paid_amount_centavos = _amount_to_centavos(paid_amount)
        if paid_amount_centavos != expected_amount_centavos or paid_currency != expected_currency:
            raise HTTPException(status_code=409, detail="Captured amount does not match")

        processed_at = datetime.now(timezone.utc)
        if order_id:
            payment.provider_transaction_id = order_id
        _mark_payment_success(
            db,
            payment=payment,
            provider=provider,
            payment_method="PayPal Webhook",
            processed_at=processed_at,
            paid_at=processed_at,
        )

        db.add(
            PaymentWebhook(
                provider_id=provider.id,
                event_type=event_type,
                payload=payload,
                processed=True,
                processed_at=processed_at,
            )
        )
        db.commit()
        return {
            "received": True,
            "processed": True,
            "order_id": order_id or None,
            "capture_id": capture_id or None,
        }
    finally:
        db.close()


@router.post("/payments")
def create_subscription_payment(
    payload: SubscriptionPaymentCreate,
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
):
    db = _session_with_rls(user)
    try:
        subscription = db.query(Subscription).filter(Subscription.id == payload.subscription_id).first()
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")
        if not _is_admin(user) and subscription.user_id != user.id:
            raise HTTPException(status_code=403, detail="Cannot pay for another user's subscription")

        payment_data = payload.model_dump()
        if not _is_admin(user):
            payment_data["payment_status"] = "PENDING"
            payment_data["paid_at"] = None
        row = SubscriptionPayment(**payment_data)
        if row.payment_status == "SUCCESS":
            _apply_successful_payment(db, row, subscription=subscription)
        db.add(row)
        db.commit()
        db.refresh(row)
        return _serialize_subscription_payment(row)
    finally:
        db.close()


@router.patch("/payments/{payment_id}")
def update_subscription_payment(
    payment_id: int,
    payload: SubscriptionPaymentUpdate,
    user: CurrentUser = Depends(require_roles("Admin")),
):
    db = _session_with_rls(user)
    try:
        row = db.query(SubscriptionPayment).filter(SubscriptionPayment.id == payment_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Payment not found")

        updates = payload.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(row, key, value)

        if row.payment_status == "SUCCESS":
            _apply_successful_payment(db, row)

        db.commit()
        db.refresh(row)
        return _serialize_subscription_payment(row)
    finally:
        db.close()


@router.get("/invoices")
def list_subscription_invoices(user: CurrentUser = Depends(require_roles("Admin", "Subscriber"))):
    db = _session_with_rls(user)
    try:
        query = db.query(SubscriptionInvoice).join(Subscription, Subscription.id == SubscriptionInvoice.subscription_id)
        if not _is_admin(user):
            query = query.filter(Subscription.user_id == user.id)
        rows = query.order_by(SubscriptionInvoice.created_at.desc()).all()
        return [
            {
                "id": item.id,
                "invoice_no": item.invoice_no,
                "subscription_id": item.subscription_id,
                "invoice_date": item.invoice_date,
                "due_date": item.due_date,
                "subtotal": float(item.subtotal) if item.subtotal is not None else None,
                "tax": float(item.tax) if item.tax is not None else None,
                "total": float(item.total) if item.total is not None else None,
                "status": item.status,
                "pdf_url": item.pdf_url,
                "created_at": item.created_at,
            }
            for item in rows
        ]
    finally:
        db.close()


@router.post("/invoices")
def create_subscription_invoice(
    payload: SubscriptionInvoiceCreate,
    user: CurrentUser = Depends(require_roles("Admin")),
):
    db = _session_with_rls(user)
    try:
        row = SubscriptionInvoice(**payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "id": row.id,
            "invoice_no": row.invoice_no,
            "subscription_id": row.subscription_id,
            "invoice_date": row.invoice_date,
            "due_date": row.due_date,
            "subtotal": float(row.subtotal) if row.subtotal is not None else None,
            "tax": float(row.tax) if row.tax is not None else None,
            "total": float(row.total) if row.total is not None else None,
            "status": row.status,
            "pdf_url": row.pdf_url,
            "created_at": row.created_at,
        }
    finally:
        db.close()


@router.get("/usage")
def list_subscription_usage(user: CurrentUser = Depends(require_roles("Admin", "Subscriber"))):
    db = _session_with_rls(user)
    try:
        query = db.query(SubscriptionUsage).join(Subscription, Subscription.id == SubscriptionUsage.subscription_id)
        if not _is_admin(user):
            query = query.filter(Subscription.user_id == user.id)
        rows = query.order_by(SubscriptionUsage.usage_date.desc(), SubscriptionUsage.created_at.desc()).all()
        return [
            {
                "id": item.id,
                "subscription_id": item.subscription_id,
                "usage_date": item.usage_date,
                "users_used": item.users_used,
                "vehicles_used": item.vehicles_used,
                "drivers_used": item.drivers_used,
                "storage_used_gb": float(item.storage_used_gb) if item.storage_used_gb is not None else None,
                "api_calls": item.api_calls,
                "ai_requests": item.ai_requests,
                "created_at": item.created_at,
            }
            for item in rows
        ]
    finally:
        db.close()


@router.post("/usage")
def create_subscription_usage(
    payload: SubscriptionUsageCreate,
    user: CurrentUser = Depends(require_roles("Admin")),
):
    db = _session_with_rls(user)
    try:
        row = SubscriptionUsage(**payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "id": row.id,
            "subscription_id": row.subscription_id,
            "usage_date": row.usage_date,
            "users_used": row.users_used,
            "vehicles_used": row.vehicles_used,
            "drivers_used": row.drivers_used,
            "storage_used_gb": float(row.storage_used_gb) if row.storage_used_gb is not None else None,
            "api_calls": row.api_calls,
            "ai_requests": row.ai_requests,
            "created_at": row.created_at,
        }
    finally:
        db.close()


@router.get("/events")
def list_subscription_events(user: CurrentUser = Depends(require_roles("Admin", "Subscriber"))):
    db = _session_with_rls(user)
    try:
        query = db.query(SubscriptionEvent).join(Subscription, Subscription.id == SubscriptionEvent.subscription_id)
        if not _is_admin(user):
            query = query.filter(Subscription.user_id == user.id)
        rows = query.order_by(SubscriptionEvent.created_at.desc()).all()
        return [
            {
                "id": item.id,
                "subscription_id": item.subscription_id,
                "event_type": item.event_type,
                "event_details": item.event_details or {},
                "created_by": item.created_by,
                "created_at": item.created_at,
            }
            for item in rows
        ]
    finally:
        db.close()


@router.post("/events")
def create_subscription_event(
    payload: SubscriptionEventCreate,
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
):
    db = _session_with_rls(user)
    try:
        subscription = db.query(Subscription).filter(Subscription.id == payload.subscription_id).first()
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")
        if not _is_admin(user) and subscription.user_id != user.id:
            raise HTTPException(status_code=403, detail="Cannot create event for another user's subscription")

        row = SubscriptionEvent(
            subscription_id=payload.subscription_id,
            event_type=payload.event_type,
            event_details=payload.event_details,
            created_by=user.id,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "id": row.id,
            "subscription_id": row.subscription_id,
            "event_type": row.event_type,
            "event_details": row.event_details or {},
            "created_by": row.created_by,
            "created_at": row.created_at,
        }
    finally:
        db.close()


@router.get("/webhooks")
def list_payment_webhooks(user: CurrentUser = Depends(require_roles("Admin"))):
    db = _session_with_rls(user)
    try:
        rows = db.query(PaymentWebhook).order_by(PaymentWebhook.created_at.desc()).all()
        return [
            {
                "id": item.id,
                "provider_id": item.provider_id,
                "event_type": item.event_type,
                "payload": item.payload or {},
                "processed": item.processed,
                "processed_at": item.processed_at,
                "created_at": item.created_at,
            }
            for item in rows
        ]
    finally:
        db.close()


@router.post("/webhooks")
def create_payment_webhook(
    payload: PaymentWebhookCreate,
    user: CurrentUser = Depends(require_roles("Admin")),
):
    db = _session_with_rls(user)
    try:
        row = PaymentWebhook(**payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "id": row.id,
            "provider_id": row.provider_id,
            "event_type": row.event_type,
            "payload": row.payload or {},
            "processed": row.processed,
            "processed_at": row.processed_at,
            "created_at": row.created_at,
        }
    finally:
        db.close()


@router.get("/features")
def list_features(user: CurrentUser = Depends(require_roles("Admin", "Subscriber"))):
    db = _session_with_rls(user)
    try:
        rows = db.query(Feature).order_by(Feature.feature_name.asc()).all()
        return [
            {
                "id": item.id,
                "feature_code": item.feature_code,
                "feature_name": item.feature_name,
                "description": item.description,
            }
            for item in rows
        ]
    finally:
        db.close()


@router.post("/features")
def create_feature(
    payload: FeatureCreate,
    user: CurrentUser = Depends(require_roles("Admin")),
):
    db = _session_with_rls(user)
    try:
        existing = db.query(Feature).filter(Feature.feature_code == payload.feature_code).first()
        if existing:
            raise HTTPException(status_code=409, detail="Feature code already exists")

        row = Feature(**payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "id": row.id,
            "feature_code": row.feature_code,
            "feature_name": row.feature_name,
            "description": row.description,
        }
    finally:
        db.close()


@router.get("/plans/{plan_id}/features")
def list_plan_features(plan_id: int, user: CurrentUser = Depends(require_roles("Admin", "Subscriber"))):
    db = _session_with_rls(user)
    try:
        rows = db.query(PlanFeature).filter(PlanFeature.plan_id == plan_id).all()
        feature_ids = [item.feature_id for item in rows]
        if not feature_ids:
            return []
        features = db.query(Feature).filter(Feature.id.in_(feature_ids)).all()
        return [
            {
                "id": item.id,
                "feature_code": item.feature_code,
                "feature_name": item.feature_name,
                "description": item.description,
            }
            for item in features
        ]
    finally:
        db.close()


@router.put("/plans/{plan_id}/features")
def assign_plan_features(
    plan_id: int,
    payload: PlanFeatureAssignRequest,
    user: CurrentUser = Depends(require_roles("Admin")),
):
    db = _session_with_rls(user)
    try:
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found")

        db.query(PlanFeature).filter(PlanFeature.plan_id == plan_id).delete()
        for feature_id in payload.feature_ids:
            feature = db.query(Feature).filter(Feature.id == feature_id).first()
            if not feature:
                raise HTTPException(status_code=404, detail=f"Feature {feature_id} not found")
            db.add(PlanFeature(plan_id=plan_id, feature_id=feature_id))

        db.commit()
        return {"message": "Plan features updated"}
    finally:
        db.close()
