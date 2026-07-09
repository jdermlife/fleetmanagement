from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

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
from app.schemas.subscription_schema import (
    FeatureCreate,
    PaymentProviderCreate,
    PaymentWebhookCreate,
    PlanFeatureAssignRequest,
    SubscriptionCreate,
    SubscriptionEventCreate,
    SubscriptionInvoiceCreate,
    SubscriptionPaymentCreate,
    SubscriptionPlanCreate,
    SubscriptionPlanUpdate,
    SubscriptionUpdate,
    SubscriptionUsageCreate,
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
            .filter(SubscriptionPlan.is_active.is_(True), SubscriptionPlan.is_public.is_(True))
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


@router.get("/plans")
def list_plans(user: CurrentUser = Depends(require_roles("Admin", "Subscriber"))):
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
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
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


@router.post("")
def create_subscription(
    payload: SubscriptionCreate,
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
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
def list_subscription_payments(user: CurrentUser = Depends(require_roles("Admin", "Subscriber"))):
    db = _session_with_rls(user)
    try:
        query = db.query(SubscriptionPayment).join(Subscription, Subscription.id == SubscriptionPayment.subscription_id)
        if not _is_admin(user):
            query = query.filter(Subscription.user_id == user.id)
        rows = query.order_by(SubscriptionPayment.created_at.desc()).all()
        return [
            {
                "id": item.id,
                "payment_reference": item.payment_reference,
                "subscription_id": item.subscription_id,
                "provider_id": item.provider_id,
                "invoice_no": item.invoice_no,
                "amount": float(item.amount) if item.amount is not None else None,
                "currency": item.currency,
                "payment_method": item.payment_method,
                "payment_status": item.payment_status,
                "provider_transaction_id": item.provider_transaction_id,
                "paid_at": item.paid_at,
                "created_at": item.created_at,
            }
            for item in rows
        ]
    finally:
        db.close()


@router.post("/payments")
def create_subscription_payment(
    payload: SubscriptionPaymentCreate,
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
):
    db = _session_with_rls(user)
    try:
        subscription = db.query(Subscription).filter(Subscription.id == payload.subscription_id).first()
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")
        if not _is_admin(user) and subscription.user_id != user.id:
            raise HTTPException(status_code=403, detail="Cannot pay for another user's subscription")

        row = SubscriptionPayment(**payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "id": row.id,
            "payment_reference": row.payment_reference,
            "subscription_id": row.subscription_id,
            "provider_id": row.provider_id,
            "invoice_no": row.invoice_no,
            "amount": float(row.amount) if row.amount is not None else None,
            "currency": row.currency,
            "payment_method": row.payment_method,
            "payment_status": row.payment_status,
            "provider_transaction_id": row.provider_transaction_id,
            "paid_at": row.paid_at,
            "created_at": row.created_at,
        }
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
