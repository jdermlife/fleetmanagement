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
    trial_days: int = 30
    display_order: int = 1
    is_public: bool = True
    is_custom_pricing: bool = False
    max_ai_requests_per_month: int = 1000
    max_api_calls_per_month: int = 10000
    max_documents: int = 1000
    max_reports: int = 500
    max_meetings: int = 500
    max_storage_files: int = 10000
    storage_unit: str = "GB"
    support_level: str = "STANDARD"
    sla_hours: int = 48
    color_code: str | None = None
    icon_name: str | None = None
    free_record_limit_lifetime: int = 0
    free_days_from_start: int = 0
    minimum_monthly_fee: float = 0
    per_record_fee: float = 0
    role_code: str | None = None
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
    subscription_type: str = "TRIAL"
    payment_provider_id: int | None = None
    next_billing_date: date | None = None
    cancellation_reason: str | None = None
    cancelled_at: datetime | None = None
    cancelled_by: int | None = None
    grace_period_end: date | None = None
    renewal_count: int = 0
    last_payment_date: date | None = None
    next_invoice_date: date | None = None
    current_users: int = 1
    current_vehicles: int = 0
    current_drivers: int = 0
    current_storage_gb: float = 0
    current_ai_requests: int = 0
    current_api_calls: int = 0
    tenant_id: int | None = None
    created_by: int | None = None
    updated_by: int | None = None
    deleted_by: int | None = None
    deleted_at: datetime | None = None
    is_deleted: bool = False
    remarks: str | None = None
    user_id: int | None = None


class SubscriptionPlanUpdate(BaseModel):
    plan_code: str | None = None
    plan_name: str | None = None
    description: str | None = None
    billing_cycle: str | None = None
    monthly_price: float | None = None
    yearly_price: float | None = None
    currency: str | None = None
    max_users: int | None = None
    max_vehicles: int | None = None
    max_drivers: int | None = None
    max_storage_gb: int | None = None
    trial_days: int | None = None
    display_order: int | None = None
    is_public: bool | None = None
    is_custom_pricing: bool | None = None
    max_ai_requests_per_month: int | None = None
    max_api_calls_per_month: int | None = None
    max_documents: int | None = None
    max_reports: int | None = None
    max_meetings: int | None = None
    max_storage_files: int | None = None
    storage_unit: str | None = None
    support_level: str | None = None
    sla_hours: int | None = None
    color_code: str | None = None
    icon_name: str | None = None
    free_record_limit_lifetime: int | None = None
    free_days_from_start: int | None = None
    minimum_monthly_fee: float | None = None
    per_record_fee: float | None = None
    role_code: str | None = None
    ai_enabled: bool | None = None
    api_enabled: bool | None = None
    reporting_enabled: bool | None = None
    is_active: bool | None = None


class SubscriptionUpdate(BaseModel):
    plan_id: int | None = None
    status: str | None = None
    subscription_type: str | None = None
    trial_start: date | None = None
    trial_end: date | None = None
    subscription_start: date | None = None
    subscription_end: date | None = None
    auto_renew: bool | None = None
    payment_provider_id: int | None = None
    next_billing_date: date | None = None
    cancellation_reason: str | None = None
    cancelled_at: datetime | None = None
    cancelled_by: int | None = None
    grace_period_end: date | None = None
    renewal_count: int | None = None
    last_payment_date: date | None = None
    next_invoice_date: date | None = None
    current_users: int | None = None
    current_vehicles: int | None = None
    current_drivers: int | None = None
    current_storage_gb: float | None = None
    current_ai_requests: int | None = None
    current_api_calls: int | None = None
    tenant_id: int | None = None
    created_by: int | None = None
    updated_by: int | None = None
    deleted_by: int | None = None
    deleted_at: datetime | None = None
    is_deleted: bool | None = None
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
