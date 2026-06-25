from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class SubscriptionPlanCreate(BaseModel):
    plan_code: str
    plan_name: str
    description: str | None = None
    billing_cycle: str
    monthly_price: float | None = None
    yearly_price: float | None = None
    currency: str = "PHP"
    max_users: int | None = None
    max_vehicles: int | None = None
    max_drivers: int | None = None
    max_storage_gb: int | None = None
    ai_enabled: bool = True
    api_enabled: bool = True
    reporting_enabled: bool = True
    is_active: bool = True


class SubscriptionCreate(BaseModel):
    subscription_no: str
    plan_id: int
    status: str
    trial_start: date | None = None
    trial_end: date | None = None
    subscription_start: date
    subscription_end: date | None = None
    auto_renew: bool = True
    payment_provider_id: int | None = None
    next_billing_date: date | None = None
    remarks: str | None = None
    user_id: int | None = None


class PaymentProviderCreate(BaseModel):
    provider_code: str
    provider_name: str
    api_endpoint: str | None = None
    webhook_url: str | None = None
    is_active: bool = True


class SubscriptionPaymentCreate(BaseModel):
    payment_reference: str
    subscription_id: int
    provider_id: int | None = None
    invoice_no: str | None = None
    amount: float | None = None
    currency: str | None = None
    payment_method: str | None = None
    payment_status: str
    provider_transaction_id: str | None = None
    paid_at: datetime | None = None


class SubscriptionInvoiceCreate(BaseModel):
    invoice_no: str
    subscription_id: int
    invoice_date: date | None = None
    due_date: date | None = None
    subtotal: float | None = None
    tax: float | None = None
    total: float | None = None
    status: str | None = None
    pdf_url: str | None = None


class SubscriptionUsageCreate(BaseModel):
    subscription_id: int
    usage_date: date | None = None
    users_used: int | None = None
    vehicles_used: int | None = None
    drivers_used: int | None = None
    storage_used_gb: float | None = None
    api_calls: int | None = None
    ai_requests: int | None = None


class SubscriptionEventCreate(BaseModel):
    subscription_id: int
    event_type: str
    event_details: dict[str, Any] = Field(default_factory=dict)


class PaymentWebhookCreate(BaseModel):
    provider_id: int
    event_type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    processed: bool = False
    processed_at: datetime | None = None


class FeatureCreate(BaseModel):
    feature_code: str
    feature_name: str
    description: str | None = None


class PlanFeatureAssignRequest(BaseModel):
    feature_ids: list[int] = Field(default_factory=list)
