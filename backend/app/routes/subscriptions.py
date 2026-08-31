from __future__ import annotations

from calendar import monthrange
import base64
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
import os
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal, set_rls_context
from app.fastapi_auth import CurrentUser, require_authenticated_user, require_roles
from app.models.subscription import (
    Feature,
    PaymentProvider,
    PaymentWebhook,
    PlanFeature,
    Subscription,
    SubscriptionBillingAgreement,
    SubscriptionEvent,
    SubscriptionInvoice,
    SubscriptionPayment,
    SubscriptionPlan,
    SubscriptionUsage,
    StoreProduct,
    StorePurchase,
)
from app.models.users import User
from app.schemas.subscription_schema import (
    AppleStoreNotificationRequest,
    FeatureCreate,
    FreeSubscriptionCreateRequest,
    PayPalCaptureOrderRequest,
    PayPalCreateOrderRequest,
    PaymentProviderCreate,
    PublicTrialPaymentRequest,
    PublicTrialPayPalCaptureOrderRequest,
    PublicTrialPayPalCreateOrderRequest,
    RecurringBillingStartRequest,
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
    StoreProductCreateRequest,
    StorePurchaseVerificationRequest,
)
from app.services.email_service import send_email
from app.services.account_access_service import configure_new_account_access, renew_account_access_after_payment
from app.services.paymongo import (
    PayMongoAPIError,
    PayMongoConfigurationError,
    PayMongoSignatureError,
    create_checkout_session,
    attach_subscription_payment_method as attach_paymongo_subscription_payment_method_api,
    create_customer as create_paymongo_customer_api,
    create_subscription as create_paymongo_subscription_api,
    verify_webhook_signature,
)
from app.services.paypal import (
    PayPalAPIError,
    PayPalConfigurationError,
    PayPalSignatureError,
    capture_order as capture_paypal_order_api,
    create_order as create_paypal_order_api,
    create_subscription as create_paypal_subscription_api,
    verify_webhook_signature as verify_paypal_webhook_signature,
)
from app.services.subscription_entitlement import evaluate_loan_record_create_entitlement
from app.services.store_billing import (
    decode_apple_signed_payload,
    StoreBillingConfigurationError,
    StorePurchaseVerificationError,
    verify_apple_transaction,
    verify_google_play_purchase,
    verify_google_pubsub_token,
    verify_store_purchase,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

PUBLIC_TRIAL_SINGLE_PLAN_CODE = os.getenv("PUBLIC_TRIAL_SINGLE_PLAN_CODE", "SINGLE_PROFILE").strip().upper()
PUBLIC_TRIAL_MULTIPLE_PLAN_CODE = os.getenv("PUBLIC_TRIAL_MULTIPLE_PLAN_CODE", "MULTIPLE_PROFILE").strip().upper()


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
    user: CurrentUser = Depends(require_authenticated_user),
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
            .filter(SubscriptionPlan.is_active.is_(True))
            .filter(SubscriptionPlan.is_public.is_(True))
            .order_by(SubscriptionPlan.display_order.asc(), SubscriptionPlan.plan_name.asc())
            .all()
        )

        return [_serialize_plan(item) for item in rows]

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


def _serialize_store_product(store_product: StoreProduct) -> dict:
    return {
        "id": store_product.id,
        "plan_id": store_product.plan_id,
        "platform": store_product.platform,
        "product_id": store_product.product_id,
        "base_plan_id": store_product.base_plan_id,
        "is_active": store_product.is_active,
    }


def _serialize_store_purchase(store_purchase: StorePurchase) -> dict:
    return {
        "id": store_purchase.id,
        "subscription_id": store_purchase.subscription_id,
        "platform": store_purchase.platform,
        "product_id": store_purchase.store_product.product_id,
        "transaction_id": store_purchase.transaction_id,
        "original_transaction_id": store_purchase.original_transaction_id,
        "status": store_purchase.status,
        "purchased_at": store_purchase.purchased_at,
        "expires_at": store_purchase.expires_at,
        "verified_at": store_purchase.verified_at,
        "payment": _serialize_subscription_payment(store_purchase.payment) if store_purchase.payment else None,
    }


def _store_purchase_grants_entitlement(status: str, expires_at: datetime | None) -> bool:
    if status in {"ACTIVE", "GRACE_PERIOD"}:
        return True
    return status == "CANCELLED" and expires_at is not None and expires_at > datetime.now(timezone.utc)


def _synchronize_store_purchase(db, purchase: StorePurchase, verified) -> None:
    purchase.transaction_id = verified.transaction_id
    purchase.original_transaction_id = verified.original_transaction_id
    purchase.purchase_token_hash = verified.purchase_token_hash
    purchase.status = verified.status
    purchase.purchased_at = verified.purchased_at
    purchase.expires_at = verified.expires_at
    purchase.verified_at = datetime.now(timezone.utc)
    subscription = purchase.subscription
    payment = purchase.payment
    grants_entitlement = _store_purchase_grants_entitlement(verified.status, verified.expires_at)
    if grants_entitlement:
        subscription.status = "ACTIVE"
        subscription.auto_renew = verified.status != "CANCELLED"
        if verified.expires_at is not None:
            subscription.next_billing_date = verified.expires_at.date()
        if payment is not None:
            payment.provider_transaction_id = verified.transaction_id
            if payment.payment_status != "SUCCESS":
                payment.payment_status = "SUCCESS"
                payment.paid_at = verified.purchased_at or datetime.now(timezone.utc)
                _apply_successful_payment(db, payment, subscription=subscription)
    else:
        subscription.auto_renew = False
        subscription.subscription_end = verified.expires_at.date() if verified.expires_at else date.today()
        subscription.status = "CANCELLED" if verified.status == "CANCELLED" else "EXPIRED"
        if payment is not None and verified.status in {"REVOKED", "REFUNDED"}:
            payment.payment_status = "REFUNDED"


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
        renew_account_access_after_payment(owning_user, paid_at)


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


def _recurring_plan_id(provider_code: str, plan: SubscriptionPlan) -> str:
    environment_name = f"{provider_code}_PLAN_ID_{plan.plan_code.upper()}"
    plan_id = os.getenv(environment_name, "").strip()
    if not plan_id:
        raise HTTPException(status_code=503, detail=f"{environment_name} is not configured")
    return plan_id


def _start_recurring_billing_for_user(
    payload: RecurringBillingStartRequest,
    user: CurrentUser,
    provider_code: str,
):
    db = _session_with_rls(user)
    try:
        subscription = db.query(Subscription).filter(Subscription.id == payload.subscription_id).first()
        if subscription is None:
            raise HTTPException(status_code=404, detail="Subscription not found")
        if not _is_admin(user) and subscription.user_id != user.id:
            raise HTTPException(status_code=403, detail="Cannot bill another user's subscription")

        provider = db.query(PaymentProvider).filter(PaymentProvider.provider_code == provider_code).first()
        if provider is None or provider.is_active is False:
            raise HTTPException(status_code=503, detail=f"{provider_code} payment provider is not active")

        existing = (
            db.query(SubscriptionBillingAgreement)
            .filter(SubscriptionBillingAgreement.subscription_id == subscription.id)
            .filter(SubscriptionBillingAgreement.provider_id == provider.id)
            .filter(SubscriptionBillingAgreement.status.in_(["PENDING", "APPROVAL_PENDING", "AUTHORIZED", "ACTIVE"]))
            .first()
        )
        if existing is not None:
            return {
                "agreement_id": existing.provider_agreement_id,
                "status": existing.status,
                "approval_url": None,
                "first_charge_at": existing.first_charge_at,
                "subscription": _serialize_subscription(subscription),
                "reused": True,
            }

        plan = getattr(subscription, "plan", None)
        if plan is None:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()
        if plan is None:
            raise HTTPException(status_code=422, detail="Subscription plan is unavailable")
        provider_plan_id = _recurring_plan_id(provider_code, plan)
        owning_user = db.query(User).filter(User.id == subscription.user_id).first()
        if owning_user is None or not owning_user.email:
            raise HTTPException(status_code=422, detail="Subscriber email is required for recurring billing")

        now = datetime.now(timezone.utc)
        first_charge_at = now + timedelta(days=2) if provider_code == "PAYPAL" else now
        try:
            if provider_code == "PAYPAL":
                result = create_paypal_subscription_api(
                    plan_id=provider_plan_id,
                    custom_id=subscription.subscription_no,
                    start_time=first_charge_at,
                    subscriber_email=owning_user.email,
                    request_id=payload.request_id,
                )
                provider_customer_id = None
                agreement_status = "APPROVAL_PENDING"
            else:
                if not payload.payment_method_id:
                    raise HTTPException(status_code=422, detail="PayMongo card authorization is required")
                name_parts = (owning_user.username or "FILSCORE Subscriber").split(maxsplit=1)
                provider_customer_id = create_paymongo_customer_api(
                    first_name=name_parts[0],
                    last_name=name_parts[1] if len(name_parts) > 1 else "Subscriber",
                    email=owning_user.email,
                )
                result = create_paymongo_subscription_api(
                    customer_id=provider_customer_id,
                    plan_id=provider_plan_id,
                )
                payment_intent_id = result.get("payment_intent_id")
                if not payment_intent_id:
                    raise PayMongoAPIError("PayMongo did not return the first invoice payment intent")
                authorization = attach_paymongo_subscription_payment_method_api(
                    payment_intent_id=payment_intent_id,
                    payment_method_id=payload.payment_method_id,
                )
                result["approval_url"] = authorization.get("approval_url")
                result["payment_method_id"] = payload.payment_method_id
                agreement_status = "ACTIVE" if result["status"] == "active" else "PENDING"
        except (PayPalConfigurationError, PayMongoConfigurationError) as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except (PayPalAPIError, PayMongoAPIError) as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        agreement = SubscriptionBillingAgreement(
            subscription_id=subscription.id,
            provider_id=provider.id,
            provider_customer_id=provider_customer_id,
            provider_plan_id=provider_plan_id,
            provider_agreement_id=result["agreement_id"],
            provider_payment_method_id=result.get("payment_method_id"),
            status=agreement_status,
            first_charge_at=first_charge_at,
            next_charge_at=None,
        )
        subscription.payment_provider_id = provider.id
        subscription.auto_renew = True
        subscription.status = "TRIAL" if provider_code == "PAYPAL" else "PENDING"
        subscription.subscription_type = "PAID"
        subscription.trial_start = now.date()
        subscription.trial_end = first_charge_at.date()
        subscription.next_billing_date = first_charge_at.date()
        db.add(agreement)
        db.commit()
        db.refresh(agreement)
        return {
            "agreement_id": agreement.provider_agreement_id,
            "status": agreement.status,
            "approval_url": result.get("approval_url"),
            "payment_intent_id": result.get("payment_intent_id"),
            "invoice_id": result.get("invoice_id"),
            "first_charge_at": agreement.first_charge_at,
            "subscription": _serialize_subscription(subscription),
            "reused": False,
        }
    finally:
        db.close()


def _resolve_public_trial_plan(db, plan_key: str) -> SubscriptionPlan:
    normalized_key = plan_key.strip().lower()
    if normalized_key not in {"single", "multiple"}:
        raise HTTPException(status_code=422, detail="Invalid public subscription plan")

    target_price = Decimal("160.00") if normalized_key == "single" else Decimal("1600.00")
    target_plan_code = (
        PUBLIC_TRIAL_SINGLE_PLAN_CODE if normalized_key == "single" else PUBLIC_TRIAL_MULTIPLE_PLAN_CODE
    )

    plan = (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.plan_code == target_plan_code)
        .filter(SubscriptionPlan.is_active.is_(True))
        .first()
    )
    if plan is not None:
        return plan

    plan_rows = (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.is_active.is_(True))
        .filter(SubscriptionPlan.billing_cycle == "MONTHLY")
        .all()
    )
    for candidate in plan_rows:
        candidate_price = Decimal(str(candidate.monthly_price or 0)).quantize(Decimal("0.01"))
        if candidate_price == target_price:
            return candidate

    raise HTTPException(
        status_code=422,
        detail="Subscription plan configuration is missing for this payment option.",
    )


def _resolve_trial_payment_user(db, account_identifier: str) -> User:
    raw_identifier = account_identifier.strip()
    normalized_identifier = raw_identifier.lower()
    if not normalized_identifier:
        raise HTTPException(status_code=422, detail="Account identifier is required")

    user = (
        db.query(User)
        .filter((User.username == normalized_identifier) | (User.email == normalized_identifier))
        .first()
    )
    if user is None and raw_identifier != normalized_identifier:
        user = (
            db.query(User)
            .filter((User.username == raw_identifier) | (User.email == raw_identifier))
            .first()
        )
    if user is None:
        raise HTTPException(status_code=404, detail="Expired account not found")

    access_expired = (
        user.account_access_expires_at is not None
        and user.account_access_expires_at <= datetime.now(timezone.utc)
    )
    normalized_status = (user.account_status or "").upper()
    if normalized_status != "SUSPENDED" and not access_expired and user.is_active:
        raise HTTPException(status_code=409, detail="This account is not currently in expired-trial status")

    return user


def _ensure_public_trial_subscription(db, user: User, plan: SubscriptionPlan) -> Subscription:
    existing = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .filter(Subscription.plan_id == plan.id)
        .filter(Subscription.status.in_(["PENDING", "TRIAL", "ACTIVE", "SUSPENDED"]))
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if existing is not None:
        return existing

    subscription = Subscription(
        subscription_no=_build_subscription_no("SUB"),
        user_id=user.id,
        plan_id=plan.id,
        status="SUSPENDED",
        subscription_type="PAID",
        subscription_start=date.today(),
        auto_renew=True,
    )
    db.add(subscription)
    db.flush()
    return subscription


def _create_paymongo_checkout_for_user(
    payload: PayMongoCheckoutCreate,
    user: CurrentUser,
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


@router.get("/store-products")
def list_store_products(
    platform: str = Query(pattern="^(ANDROID|IOS)$"),
    user: CurrentUser = Depends(require_authenticated_user),
):
    db = _session_with_rls(user)
    try:
        rows = (
            db.query(StoreProduct)
            .filter(StoreProduct.platform == platform)
            .filter(StoreProduct.is_active.is_(True))
            .order_by(StoreProduct.id.asc())
            .all()
        )
        return [_serialize_store_product(row) for row in rows]
    finally:
        db.close()


@router.post("/store-products")
def create_store_product(
    payload: StoreProductCreateRequest,
    user: CurrentUser = Depends(require_roles("Admin")),
):
    db = _session_with_rls(user)
    try:
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == payload.plan_id).first()
        if plan is None:
            raise HTTPException(status_code=404, detail="Subscription plan not found")
        existing = (
            db.query(StoreProduct)
            .filter(StoreProduct.platform == payload.platform)
            .filter(StoreProduct.product_id == payload.product_id)
            .first()
        )
        if existing is not None:
            raise HTTPException(status_code=409, detail="Store product already exists")
        row = StoreProduct(**payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
        return _serialize_store_product(row)
    finally:
        db.close()


@router.post("/store-purchases/verify")
def verify_native_store_purchase(
    payload: StorePurchaseVerificationRequest,
    user: CurrentUser = Depends(require_authenticated_user),
):
    try:
        verified = verify_store_purchase(payload.platform, payload.verification_data)
    except StoreBillingConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except StorePurchaseVerificationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if verified.platform != payload.platform or verified.product_id != payload.product_id:
        raise HTTPException(status_code=422, detail="Verified store product does not match the request")

    db = _session_with_rls(user)
    try:
        existing_purchase = (
            db.query(StorePurchase)
            .filter(StorePurchase.platform == verified.platform)
            .filter(StorePurchase.transaction_id == verified.transaction_id)
            .first()
        )
        if existing_purchase is not None:
            if existing_purchase.user_id != user.id:
                raise HTTPException(status_code=409, detail="Store transaction is linked to another account")
            return _serialize_store_purchase(existing_purchase)

        store_product = (
            db.query(StoreProduct)
            .filter(StoreProduct.platform == verified.platform)
            .filter(StoreProduct.product_id == verified.product_id)
            .filter(StoreProduct.is_active.is_(True))
            .first()
        )
        if store_product is None:
            raise HTTPException(status_code=404, detail="Store product is not mapped to a subscription plan")
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == store_product.plan_id).first()
        if plan is None or plan.is_active is False:
            raise HTTPException(status_code=422, detail="Mapped subscription plan is unavailable")

        subscription_query = db.query(Subscription).filter(Subscription.user_id == user.id)
        if payload.subscription_id is not None:
            subscription = subscription_query.filter(Subscription.id == payload.subscription_id).first()
            if subscription is None:
                raise HTTPException(status_code=404, detail="Subscription not found")
            if subscription.plan_id != plan.id:
                raise HTTPException(status_code=422, detail="Subscription does not match the store product")
        else:
            subscription = (
                subscription_query
                .filter(Subscription.plan_id == plan.id)
                .filter(Subscription.status.in_(["PENDING", "TRIAL", "ACTIVE"]))
                .order_by(Subscription.created_at.desc())
                .first()
            )
        if subscription is None:
            subscription = Subscription(
                subscription_no=_build_subscription_no("STORE"),
                user_id=user.id,
                plan_id=plan.id,
                status="PENDING",
                subscription_type="PAID",
                subscription_start=date.today(),
                auto_renew=True,
            )
            db.add(subscription)
            db.flush()

        provider_code = "GOOGLE_PLAY" if verified.platform == "ANDROID" else "APPLE_APP_STORE"
        provider = db.query(PaymentProvider).filter(PaymentProvider.provider_code == provider_code).first()
        if provider is None:
            provider = PaymentProvider(
                provider_code=provider_code,
                provider_name="Google Play" if verified.platform == "ANDROID" else "Apple App Store",
                is_active=True,
            )
            db.add(provider)
            db.flush()
        if provider.is_active is False:
            raise HTTPException(status_code=503, detail=f"{provider.provider_name} is not active")

        activates_entitlement = _store_purchase_grants_entitlement(verified.status, verified.expires_at)
        payment = SubscriptionPayment(
            payment_reference=f"STORE-{uuid.uuid4().hex.upper()}",
            subscription_id=subscription.id,
            provider_id=provider.id,
            amount=_subscription_checkout_amount(plan),
            currency=plan.currency,
            payment_method=provider.provider_name,
            payment_status="SUCCESS" if activates_entitlement else ("PENDING" if verified.status == "PENDING" else "FAILED"),
            provider_transaction_id=verified.transaction_id,
            paid_at=verified.purchased_at if activates_entitlement else None,
        )
        db.add(payment)
        db.flush()
        purchase = StorePurchase(
            user_id=user.id,
            subscription_id=subscription.id,
            store_product_id=store_product.id,
            payment_id=payment.id,
            platform=verified.platform,
            transaction_id=verified.transaction_id,
            original_transaction_id=verified.original_transaction_id,
            purchase_token_hash=verified.purchase_token_hash,
            status=verified.status,
            purchased_at=verified.purchased_at,
            expires_at=verified.expires_at,
            verified_at=datetime.now(timezone.utc),
        )
        db.add(purchase)
        if activates_entitlement:
            subscription.payment_provider_id = provider.id
            _mark_payment_success(
                db,
                payment=payment,
                provider=provider,
                payment_method=provider.provider_name,
                processed_at=datetime.now(timezone.utc),
                paid_at=verified.purchased_at,
            )
            if verified.expires_at is not None:
                subscription.next_billing_date = verified.expires_at.date()
        db.commit()
        db.refresh(purchase)
        return _serialize_store_purchase(purchase)
    finally:
        db.close()


@router.post("/store-notifications/apple")
def receive_apple_store_notification(payload: AppleStoreNotificationRequest):
    try:
        notification = decode_apple_signed_payload(payload.signedPayload)
        event_id = str(notification.get("notificationUUID") or "").strip()
        event_type = str(notification.get("notificationType") or "UNKNOWN")
        event_subtype = str(notification.get("subtype") or "")
        data = notification.get("data")
        if not event_id or not isinstance(data, dict):
            raise StorePurchaseVerificationError("Apple notification is incomplete")
        expected_bundle_id = os.getenv("APPLE_BUNDLE_ID", "com.quantech.filscore").strip()
        expected_environment = os.getenv("APPLE_STORE_ENVIRONMENT", "Production").strip().lower()
        if str(data.get("bundleId") or "") != expected_bundle_id:
            raise StorePurchaseVerificationError("Apple notification belongs to another application")
        if str(data.get("environment") or "").lower() != expected_environment:
            raise StorePurchaseVerificationError("Apple notification environment does not match")
        signed_transaction = str(data.get("signedTransactionInfo") or "")
        verified = verify_apple_transaction(signed_transaction)
    except StoreBillingConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except StorePurchaseVerificationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    db = SessionLocal()
    try:
        provider = db.query(PaymentProvider).filter(PaymentProvider.provider_code == "APPLE_APP_STORE").first()
        if provider is None:
            raise HTTPException(status_code=503, detail="Apple App Store provider is not configured")
        duplicate = (
            db.query(PaymentWebhook)
            .filter(PaymentWebhook.provider_id == provider.id)
            .filter(PaymentWebhook.provider_event_id == event_id)
            .first()
        )
        if duplicate is not None:
            return {"received": True, "duplicate": True}
        purchase = (
            db.query(StorePurchase)
            .filter(StorePurchase.platform == "IOS")
            .filter(
                (StorePurchase.transaction_id == verified.transaction_id)
                | (StorePurchase.original_transaction_id == verified.original_transaction_id)
            )
            .first()
        )
        processed = purchase is not None
        if purchase is not None:
            _synchronize_store_purchase(db, purchase, verified)
            if event_type == "DID_CHANGE_RENEWAL_STATUS" and event_subtype == "AUTO_RENEW_DISABLED":
                purchase.subscription.auto_renew = False
        db.add(PaymentWebhook(
            provider_id=provider.id,
            provider_event_id=event_id,
            event_type=event_type,
            payload=notification,
            processed=processed,
            processed_at=datetime.now(timezone.utc) if processed else None,
        ))
        db.commit()
        return {"received": True, "processed": processed}
    finally:
        db.close()


@router.post("/store-notifications/google")
async def receive_google_store_notification(request: Request):
    try:
        verify_google_pubsub_token(request.headers.get("Authorization"))
        envelope = await request.json()
        message = envelope["message"]
        event_id = str(message["messageId"])
        notification = json.loads(base64.b64decode(message["data"]))
        subscription_notification = notification["subscriptionNotification"]
        purchase_token = str(subscription_notification["purchaseToken"])
        verified = verify_google_play_purchase(purchase_token)
    except StoreBillingConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (KeyError, TypeError, ValueError, json.JSONDecodeError, StorePurchaseVerificationError) as exc:
        raise HTTPException(status_code=401, detail="Invalid Google Play notification") from exc

    db = SessionLocal()
    try:
        provider = db.query(PaymentProvider).filter(PaymentProvider.provider_code == "GOOGLE_PLAY").first()
        if provider is None:
            raise HTTPException(status_code=503, detail="Google Play provider is not configured")
        duplicate = (
            db.query(PaymentWebhook)
            .filter(PaymentWebhook.provider_id == provider.id)
            .filter(PaymentWebhook.provider_event_id == event_id)
            .first()
        )
        if duplicate is not None:
            return {"received": True, "duplicate": True}
        token_hash = hashlib.sha256(purchase_token.encode("utf-8")).hexdigest()
        purchase = (
            db.query(StorePurchase)
            .filter(StorePurchase.platform == "ANDROID")
            .filter(
                (StorePurchase.purchase_token_hash == token_hash)
                | (StorePurchase.original_transaction_id == verified.original_transaction_id)
            )
            .first()
        )
        processed = purchase is not None
        if purchase is not None:
            _synchronize_store_purchase(db, purchase, verified)
        db.add(PaymentWebhook(
            provider_id=provider.id,
            provider_event_id=event_id,
            event_type=str(subscription_notification.get("notificationType") or "UNKNOWN"),
            payload=notification,
            processed=processed,
            processed_at=datetime.now(timezone.utc) if processed else None,
        ))
        db.commit()
        return {"received": True, "processed": processed}
    finally:
        db.close()


def _commit_paypal_webhook(db, webhook: PaymentWebhook) -> PaymentWebhook | None:
    db.add(webhook)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        duplicate = (
            db.query(PaymentWebhook)
            .filter(PaymentWebhook.provider_id == webhook.provider_id)
            .filter(PaymentWebhook.provider_event_id == webhook.provider_event_id)
            .first()
        )
        if duplicate is None:
            raise
        return duplicate
    return None


def _process_recurring_webhook(
    db,
    *,
    provider: PaymentProvider,
    provider_code: str,
    event_id: str,
    event_type: str,
    resource: dict,
    payload: dict,
) -> bool:
    resource_attributes = resource.get("attributes") or {}
    agreement_id = str(resource.get("id") or "")
    if provider_code == "PAYPAL" and event_type.startswith("PAYMENT.SALE."):
        agreement_id = str(resource.get("billing_agreement_id") or "")
    if provider_code == "PAYMONGO" and event_type.startswith("subscription.invoice."):
        agreement_id = str(resource_attributes.get("resource_id") or "")

    recurring_event = event_type.startswith("BILLING.SUBSCRIPTION.") or event_type.startswith("PAYMENT.SALE.")
    recurring_event = recurring_event or event_type.startswith("subscription.")
    if not recurring_event or not agreement_id:
        return False

    agreement = (
        db.query(SubscriptionBillingAgreement)
        .filter(SubscriptionBillingAgreement.provider_id == provider.id)
        .filter(SubscriptionBillingAgreement.provider_agreement_id == agreement_id)
        .first()
    )
    if agreement is None:
        return False
    subscription = db.query(Subscription).filter(Subscription.id == agreement.subscription_id).first()
    if subscription is None:
        raise HTTPException(status_code=404, detail="Subscription not found for recurring agreement")

    processed_at = datetime.now(timezone.utc)
    success_event = event_type in {"PAYMENT.SALE.COMPLETED", "subscription.invoice.paid"}
    failure_event = event_type in {"BILLING.SUBSCRIPTION.PAYMENT.FAILED", "subscription.invoice.payment_failed"}
    if success_event:
        if provider_code == "PAYPAL":
            amount = Decimal(str((resource.get("amount") or {}).get("total") or "0"))
            currency = str((resource.get("amount") or {}).get("currency") or "PHP").upper()
            transaction_id = str(resource.get("id") or event_id)
        else:
            amount = Decimal(str(resource_attributes.get("amount") or 0)) / 100
            currency = str(resource_attributes.get("currency") or "PHP").upper()
            transaction_id = str(resource.get("id") or event_id)
        payment = (
            db.query(SubscriptionPayment)
            .filter(SubscriptionPayment.provider_id == provider.id)
            .filter(SubscriptionPayment.provider_transaction_id == transaction_id)
            .first()
        )
        if payment is None:
            plan = getattr(subscription, "plan", None)
            if plan is None:
                plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()
            billing_period_start = processed_at.date()
            next_billing_date = _calculate_next_billing_date(plan, billing_period_start)
            payment = SubscriptionPayment(
                payment_reference=f"REC-{event_id}"[:100],
                subscription_id=subscription.id,
                provider_id=provider.id,
                invoice_no=f"INV-{event_id}"[:50],
                amount=amount,
                currency=currency,
                payment_method=f"{provider_code} Recurring",
                payment_status="PENDING",
                provider_transaction_id=transaction_id,
                idempotency_key=event_id,
                billing_period_start=billing_period_start,
                billing_period_end=(next_billing_date - timedelta(days=1)) if next_billing_date else None,
            )
            db.add(payment)
        _mark_payment_success(
            db,
            payment=payment,
            provider=provider,
            payment_method=f"{provider_code} Recurring",
            processed_at=processed_at,
        )
        agreement.status = "ACTIVE"
        agreement.authorized_at = agreement.authorized_at or processed_at
        agreement.consecutive_failures = 0
        agreement.last_error_code = None
        if subscription.next_billing_date:
            agreement.next_charge_at = datetime.combine(
                subscription.next_billing_date,
                datetime.min.time(),
                tzinfo=timezone.utc,
            )
    elif failure_event:
        agreement.status = "PAST_DUE"
        agreement.consecutive_failures += 1
        agreement.last_error_code = event_type[:100]
        subscription.grace_period_end = (processed_at + timedelta(days=3)).date()
    elif event_type in {"BILLING.SUBSCRIPTION.ACTIVATED", "subscription.activated"}:
        agreement.status = "AUTHORIZED"
        agreement.authorized_at = processed_at
    elif event_type in {"BILLING.SUBSCRIPTION.SUSPENDED", "subscription.unpaid"}:
        agreement.status = "SUSPENDED"
        subscription.status = "SUSPENDED"
    elif event_type in {"BILLING.SUBSCRIPTION.CANCELLED", "subscription.cancelled"}:
        agreement.status = "CANCELLED"
        agreement.cancelled_at = processed_at
        subscription.status = "CANCELLED"
        subscription.auto_renew = False
        subscription.cancelled_at = processed_at
    elif event_type == "BILLING.SUBSCRIPTION.EXPIRED":
        agreement.status = "EXPIRED"
        subscription.status = "EXPIRED"
        subscription.auto_renew = False
    elif event_type in {"PAYMENT.SALE.REFUNDED", "PAYMENT.SALE.REVERSED"}:
        agreement.status = "PAST_DUE"
        agreement.last_error_code = event_type[:100]
        subscription.status = "SUSPENDED"
    elif event_type in {"subscription.past_due", "subscription.updated", "BILLING.SUBSCRIPTION.UPDATED"}:
        provider_status = str(resource_attributes.get("status") or resource.get("status") or "").lower()
        if provider_status == "active":
            agreement.status = "ACTIVE"
        elif provider_status == "past_due":
            agreement.status = "PAST_DUE"
        elif provider_status in {"unpaid", "suspended"}:
            agreement.status = "SUSPENDED"
            subscription.status = "SUSPENDED"
        elif provider_status in {"cancelled", "canceled"}:
            agreement.status = "CANCELLED"
            agreement.cancelled_at = processed_at
            subscription.status = "CANCELLED"
            subscription.auto_renew = False
            subscription.cancelled_at = processed_at

    next_billing = resource_attributes.get("next_billing_schedule")
    if next_billing:
        try:
            agreement.next_charge_at = datetime.fromisoformat(str(next_billing)).replace(tzinfo=timezone.utc)
            subscription.next_billing_date = agreement.next_charge_at.date()
        except ValueError:
            pass

    duplicate = _commit_paypal_webhook(
        db,
        PaymentWebhook(
            provider_id=provider.id,
            provider_event_id=event_id,
            event_type=event_type,
            payload=payload,
            processed=True,
            processed_at=processed_at,
        ),
    )
    return duplicate is None or bool(duplicate.processed)


@router.get("/plans")
def list_plans(
    user: CurrentUser = Depends(require_roles("Admin")),
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
    user: CurrentUser = Depends(require_roles("Admin")),
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
    user: CurrentUser = Depends(require_authenticated_user),
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
    user: CurrentUser = Depends(require_authenticated_user),
):
    db = _session_with_rls(user)
    try:
        target_user_id = payload.user_id if _is_admin(user) and payload.user_id else user.id

        existing_free = (
            db.query(Subscription)
            .filter(Subscription.user_id == target_user_id)
            .filter(Subscription.subscription_type == "FREE")
            .order_by(Subscription.created_at.desc())
            .first()
        )
        if existing_free is not None:
            if existing_free.status == "PENDING":
                trial_start = date.today()
                existing_free.status = "TRIAL"
                existing_free.trial_start = trial_start
                existing_free.trial_end = trial_start + timedelta(days=2)
                existing_free.subscription_start = trial_start
                existing_free.auto_renew = False
                account = db.query(User).filter(User.id == target_user_id).first()
                if account is not None:
                    account.subscription_id = existing_free.id
                    configure_new_account_access(account)
                db.commit()
                db.refresh(existing_free)
            return _serialize_subscription(existing_free)

        existing_entitlement = (
            db.query(Subscription)
            .filter(Subscription.user_id == target_user_id)
            .filter(Subscription.status.in_(["TRIAL", "ACTIVE"]))
            .order_by(Subscription.created_at.desc())
            .first()
        )
        if existing_entitlement is not None:
            return _serialize_subscription(existing_entitlement)

        free_plan = _find_default_free_plan(db)
        if free_plan is None:
            raise HTTPException(status_code=422, detail="No subscription plans are configured")

        trial_start = date.today()
        row = Subscription(
            subscription_no=_build_subscription_no("FREE"),
            user_id=target_user_id,
            plan_id=free_plan.id,
            status="TRIAL",
            subscription_type="FREE",
            trial_start=trial_start,
            trial_end=trial_start + timedelta(days=2),
            subscription_start=trial_start,
            auto_renew=False,
        )
        db.add(row)
        db.flush()
        account = db.query(User).filter(User.id == target_user_id).first()
        if account is not None:
            account.subscription_id = row.id
            configure_new_account_access(account)
        db.commit()
        db.refresh(row)
        return _serialize_subscription(row)
    finally:
        db.close()


@router.post("/create-checkout")
def create_checkout_for_plan(
    payload: SubscriptionCheckoutCreateRequest,
    user: CurrentUser = Depends(require_authenticated_user),
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
    user: CurrentUser = Depends(require_authenticated_user),
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
    user: CurrentUser = Depends(require_roles("Admin")),
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
def list_payment_providers(user: CurrentUser = Depends(require_roles("Admin"))):
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
    user: CurrentUser = Depends(require_authenticated_user),
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
    user: CurrentUser = Depends(require_roles("Admin")),
):
    return _create_paymongo_checkout_for_user(payload=payload, user=user)


@router.post("/payments/paymongo/subscription")
def create_paymongo_recurring_subscription(
    payload: RecurringBillingStartRequest,
    user: CurrentUser = Depends(require_authenticated_user),
):
    return _start_recurring_billing_for_user(payload, user, "PAYMONGO")


@router.post("/public/payments/paymongo/checkout")
def create_public_trial_paymongo_checkout(payload: PublicTrialPaymentRequest):
    db = SessionLocal()
    try:
        user = _resolve_trial_payment_user(db, payload.account_identifier)
        plan = _resolve_public_trial_plan(db, payload.plan)
        subscription = _ensure_public_trial_subscription(db, user, plan)
        db.commit()
        db.refresh(subscription)
        current_user = CurrentUser(id=user.id, username=user.username, role=user.role)
        return _create_paymongo_checkout_for_user(
            payload=PayMongoCheckoutCreate(
                subscription_id=subscription.id,
                invoice_no=subscription.subscription_no,
            ),
            user=current_user,
        )
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

        existing_webhook = (
            db.query(PaymentWebhook)
            .filter(PaymentWebhook.provider_id == provider.id)
            .filter(PaymentWebhook.provider_event_id == event_id)
            .first()
        )
        if existing_webhook is not None:
            return {"received": True, "processed": bool(existing_webhook.processed), "duplicate": True}

        event_resource = event_attributes.get("data") or {}
        if _process_recurring_webhook(
            db,
            provider=provider,
            provider_code="PAYMONGO",
            event_id=event_id,
            event_type=event_type,
            resource=event_resource,
            payload=payload,
        ):
            return {"received": True, "processed": True}

        if event_type != "checkout_session.payment.paid":
            db.add(
                PaymentWebhook(
                    provider_id=provider.id,
                    provider_event_id=event_id,
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


def _create_paypal_order_for_user(
    payload: PayPalCreateOrderRequest,
    user: CurrentUser,
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

        payment_reference = (
            f"PP-{payload.request_id}"
            if payload.request_id
            else f"PP-{uuid.uuid4().hex.upper()}"[:35]
        )
        if payload.request_id:
            existing_payment = (
                db.query(SubscriptionPayment)
                .filter(SubscriptionPayment.provider_id == provider.id)
                .filter(SubscriptionPayment.payment_reference == payment_reference)
                .first()
            )
            if existing_payment is not None:
                if existing_payment.subscription_id != subscription.id:
                    raise HTTPException(status_code=409, detail="PayPal request ID is already in use")
                if existing_payment.payment_status not in {"PENDING", "SUCCESS"}:
                    raise HTTPException(status_code=409, detail="PayPal request cannot be retried")
                if not existing_payment.provider_transaction_id:
                    raise HTTPException(status_code=409, detail="PayPal order is unavailable")
                return {
                    "order_id": existing_payment.provider_transaction_id,
                    "status": (
                        "COMPLETED"
                        if existing_payment.payment_status == "SUCCESS"
                        else "CREATED"
                    ),
                    "approval_url": None,
                    "amount": float(existing_payment.amount or 0),
                    "currency": existing_payment.currency,
                    "payment": _serialize_subscription_payment(existing_payment),
                    "reused": True,
                }

        plan = getattr(subscription, "plan", None)
        if plan is None:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()
        if plan is None:
            raise HTTPException(status_code=422, detail="Subscription plan is unavailable")

        amount = _subscription_checkout_amount(plan)
        if amount <= 0:
            raise HTTPException(status_code=422, detail="Subscription plan has no payable amount")

        currency = (plan.currency or "PHP").upper()

        try:
            order = create_paypal_order_api(
                amount=amount,
                currency=currency,
                description=f"{plan.plan_name} subscription payment",
                payment_reference=payment_reference,
                custom_id=payment_reference,
                invoice_id=payload.invoice_no or subscription.subscription_no,
                request_id=payload.request_id or payment_reference,
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
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if not payload.request_id:
                raise
            payment = (
                db.query(SubscriptionPayment)
                .filter(SubscriptionPayment.provider_id == provider.id)
                .filter(SubscriptionPayment.payment_reference == payment_reference)
                .first()
            )
            if payment is None or payment.subscription_id != subscription.id:
                raise
        else:
            db.refresh(payment)
        return {
            "order_id": payment.provider_transaction_id,
            "status": (
                order["status"]
                if payment.provider_transaction_id == order["order_id"]
                else "CREATED"
            ),
            "approval_url": (
                order["approval_url"]
                if payment.provider_transaction_id == order["order_id"]
                else None
            ),
            "amount": float(payment.amount or 0),
            "currency": payment.currency,
            "payment": _serialize_subscription_payment(payment),
            "reused": payment.provider_transaction_id != order["order_id"],
        }
    finally:
        db.close()


@router.post(
    "/payments/paypal/create-order",
    deprecated=True,
    include_in_schema=False,
)
def create_paypal_order(
    payload: PayPalCreateOrderRequest,
    user: CurrentUser = Depends(require_authenticated_user),
):
    return _create_paypal_order_for_user(payload=payload, user=user)


@router.post("/public/payments/paypal/create-order")
def create_public_trial_paypal_order(payload: PublicTrialPayPalCreateOrderRequest):
    db = SessionLocal()
    try:
        user = _resolve_trial_payment_user(db, payload.account_identifier)
        plan = _resolve_public_trial_plan(db, payload.plan)
        subscription = _ensure_public_trial_subscription(db, user, plan)
        db.commit()
        db.refresh(subscription)
        current_user = CurrentUser(id=user.id, username=user.username, role=user.role)
        return _create_paypal_order_for_user(
            payload=PayPalCreateOrderRequest(
                subscription_id=subscription.id,
                invoice_no=subscription.subscription_no,
                request_id=payload.request_id,
            ),
            user=current_user,
        )
    finally:
        db.close()


def _capture_paypal_order_for_user(
    payload: PayPalCaptureOrderRequest,
    user: CurrentUser,
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
            .with_for_update()
            .first()
        )
        if payment is None:
            raise HTTPException(status_code=404, detail="Pending PayPal order not found")

        subscription = db.query(Subscription).filter(Subscription.id == payment.subscription_id).first()
        if subscription is None:
            raise HTTPException(status_code=404, detail="Subscription not found for payment")
        if not _is_admin(user) and subscription.user_id != user.id:
            raise HTTPException(status_code=403, detail="Cannot capture another user's payment")
        if payload.subscription_id is not None and payment.subscription_id != payload.subscription_id:
            raise HTTPException(status_code=409, detail="PayPal order does not match subscription")

        if payment.payment_status == "SUCCESS":
            return {
                "captured": True,
                "already_processed": True,
                "payment": _serialize_subscription_payment(payment),
            }
        if payment.payment_status != "PENDING":
            raise HTTPException(status_code=409, detail="PayPal payment is not pending")

        try:
            capture_result = capture_paypal_order_api(
                payload.order_id,
                request_id=f"C-{payment.payment_reference or payload.order_id}",
            )
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


@router.post(
    "/payments/paypal/capture-order",
    deprecated=True,
    include_in_schema=False,
)
def capture_paypal_order(
    payload: PayPalCaptureOrderRequest,
    user: CurrentUser = Depends(require_authenticated_user),
):
    return _capture_paypal_order_for_user(payload=payload, user=user)


@router.post("/public/payments/paypal/capture-order")
def capture_public_trial_paypal_order(payload: PublicTrialPayPalCaptureOrderRequest):
    db = SessionLocal()
    try:
        user = _resolve_trial_payment_user(db, payload.account_identifier)
        plan = _resolve_public_trial_plan(db, payload.plan)
        subscription = _ensure_public_trial_subscription(db, user, plan)
        db.commit()
        db.refresh(subscription)
        current_user = CurrentUser(id=user.id, username=user.username, role=user.role)
        return _capture_paypal_order_for_user(
            payload=PayPalCaptureOrderRequest(
                order_id=payload.order_id,
                subscription_id=subscription.id,
            ),
            user=current_user,
        )
    finally:
        db.close()


async def _receive_paypal_webhook(request: Request):
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
        event_id = str(payload["id"] or "").strip()
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

        existing_webhook = (
            db.query(PaymentWebhook)
            .filter(PaymentWebhook.provider_id == provider.id)
            .filter(PaymentWebhook.provider_event_id == event_id)
            .first()
        )
        if existing_webhook is not None:
            return {
                "received": True,
                "processed": bool(existing_webhook.processed),
                "duplicate": True,
            }

        if _process_recurring_webhook(
            db,
            provider=provider,
            provider_code="PAYPAL",
            event_id=event_id,
            event_type=event_type,
            resource=resource,
            payload=payload,
        ):
            return {"received": True, "processed": True}

        if event_type != "PAYMENT.CAPTURE.COMPLETED":
            duplicate = _commit_paypal_webhook(
                db,
                PaymentWebhook(
                    provider_id=provider.id,
                    provider_event_id=event_id,
                    event_type=event_type,
                    payload=payload,
                    processed=False,
                ),
            )
            if duplicate is not None:
                return {
                    "received": True,
                    "processed": bool(duplicate.processed),
                    "duplicate": True,
                }
            return {"received": True, "processed": False}

        related_ids = (
            resource.get("supplementary_data", {})
            .get("related_ids", {})
        )
        order_id = str(related_ids.get("order_id") or "").strip()
        capture_id = str(resource.get("id") or "").strip()
        if not order_id:
            raise HTTPException(status_code=400, detail="PayPal order identifier is required")

        amount_payload = resource.get("amount") or {}
        paid_currency = str(amount_payload.get("currency_code") or "").upper()
        try:
            paid_amount = Decimal(str(amount_payload.get("value") or "0"))
        except (ArithmeticError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid PayPal capture amount")

        payment = (
            db.query(SubscriptionPayment)
            .filter(SubscriptionPayment.provider_id == provider.id)
            .filter(SubscriptionPayment.provider_transaction_id == order_id)
            .with_for_update()
            .first()
        )
        if payment is None:
            raise HTTPException(status_code=404, detail="Pending PayPal payment not found")
        if payment.payment_status not in {"PENDING", "SUCCESS"}:
            raise HTTPException(status_code=409, detail="PayPal payment cannot be completed")

        expected_amount_centavos = _amount_to_centavos(Decimal(str(payment.amount or 0)))
        expected_currency = (payment.currency or "").upper()
        paid_amount_centavos = _amount_to_centavos(paid_amount)
        if paid_amount_centavos != expected_amount_centavos or paid_currency != expected_currency:
            raise HTTPException(status_code=409, detail="Captured amount does not match")

        processed_at = datetime.now(timezone.utc)
        _mark_payment_success(
            db,
            payment=payment,
            provider=provider,
            payment_method="PayPal Webhook",
            processed_at=processed_at,
            paid_at=processed_at,
        )

        duplicate = _commit_paypal_webhook(
            db,
            PaymentWebhook(
                provider_id=provider.id,
                provider_event_id=event_id,
                event_type=event_type,
                payload=payload,
                processed=True,
                processed_at=processed_at,
            ),
        )
        if duplicate is not None:
            return {
                "received": True,
                "processed": bool(duplicate.processed),
                "duplicate": True,
            }
        return {
            "received": True,
            "processed": True,
            "order_id": order_id or None,
            "capture_id": capture_id or None,
        }
    finally:
        db.close()


@router.post(
    "/payments/paypal/webhook",
    deprecated=True,
    include_in_schema=False,
)
async def receive_paypal_webhook(request: Request):
    return await _receive_paypal_webhook(request=request)


@router.post("/payments")
def create_subscription_payment(
    payload: SubscriptionPaymentCreate,
    user: CurrentUser = Depends(require_roles("Admin")),
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
def list_subscription_invoices(user: CurrentUser = Depends(require_roles("Admin"))):
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
def list_subscription_usage(user: CurrentUser = Depends(require_roles("Admin"))):
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
def list_subscription_events(user: CurrentUser = Depends(require_roles("Admin"))):
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
    user: CurrentUser = Depends(require_roles("Admin")),
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
def list_features(user: CurrentUser = Depends(require_roles("Admin"))):
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
def list_plan_features(plan_id: int, user: CurrentUser = Depends(require_roles("Admin"))):
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
