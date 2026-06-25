from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(BigInteger, primary_key=True, index=True)
    plan_code = Column(String(50), nullable=False, unique=True, index=True)
    plan_name = Column(String(100), nullable=False)
    description = Column(Text)
    billing_cycle = Column(String(20), nullable=False)
    monthly_price = Column(Numeric(12, 2))
    yearly_price = Column(Numeric(12, 2))
    currency = Column(String(10), nullable=False, default="PHP")
    max_users = Column(Integer)
    max_vehicles = Column(Integer)
    max_drivers = Column(Integer)
    max_storage_gb = Column(Integer)
    ai_enabled = Column(Boolean, nullable=False, default=True)
    api_enabled = Column(Boolean, nullable=False, default=True)
    reporting_enabled = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "billing_cycle IN ('MONTHLY','QUARTERLY','YEARLY')",
            name="ck_subscription_plans_billing_cycle",
        ),
    )

    subscriptions = relationship("Subscription", back_populates="plan", lazy="selectin")
    plan_features = relationship("PlanFeature", back_populates="plan", cascade="all, delete-orphan")


class PaymentProvider(Base):
    __tablename__ = "payment_providers"

    id = Column(BigInteger, primary_key=True, index=True)
    provider_code = Column(String(50), unique=True, index=True)
    provider_name = Column(String(100))
    api_endpoint = Column(Text)
    webhook_url = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    subscriptions = relationship("Subscription", back_populates="payment_provider", lazy="selectin")
    payments = relationship("SubscriptionPayment", back_populates="provider", lazy="selectin")
    webhooks = relationship("PaymentWebhook", back_populates="provider", lazy="selectin")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(BigInteger, primary_key=True, index=True)
    subscription_no = Column(String(50), nullable=False, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    plan_id = Column(BigInteger, ForeignKey("subscription_plans.id"), nullable=False, index=True)
    status = Column(String(30), nullable=False)
    trial_start = Column(Date)
    trial_end = Column(Date)
    subscription_start = Column(Date, nullable=False)
    subscription_end = Column(Date)
    auto_renew = Column(Boolean, nullable=False, default=True)
    payment_provider_id = Column(BigInteger, ForeignKey("payment_providers.id"), index=True)
    next_billing_date = Column(Date)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "status IN ('TRIAL','ACTIVE','SUSPENDED','EXPIRED','CANCELLED')",
            name="ck_subscriptions_status",
        ),
    )

    plan = relationship("SubscriptionPlan", back_populates="subscriptions", lazy="selectin")
    payment_provider = relationship("PaymentProvider", back_populates="subscriptions", lazy="selectin")
    payments = relationship("SubscriptionPayment", back_populates="subscription", cascade="all, delete-orphan")
    invoices = relationship("SubscriptionInvoice", back_populates="subscription", cascade="all, delete-orphan")
    usage_entries = relationship("SubscriptionUsage", back_populates="subscription", cascade="all, delete-orphan")
    events = relationship("SubscriptionEvent", back_populates="subscription", cascade="all, delete-orphan")


class SubscriptionPayment(Base):
    __tablename__ = "subscription_payments"

    id = Column(BigInteger, primary_key=True, index=True)
    payment_reference = Column(String(100), unique=True, index=True)
    subscription_id = Column(BigInteger, ForeignKey("subscriptions.id"), index=True)
    provider_id = Column(BigInteger, ForeignKey("payment_providers.id"), index=True)
    invoice_no = Column(String(50))
    amount = Column(Numeric(12, 2))
    currency = Column(String(10))
    payment_method = Column(String(50))
    payment_status = Column(String(30))
    provider_transaction_id = Column(String(255))
    paid_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "payment_status IN ('PENDING','SUCCESS','FAILED','REFUNDED')",
            name="ck_subscription_payments_status",
        ),
    )

    subscription = relationship("Subscription", back_populates="payments", lazy="selectin")
    provider = relationship("PaymentProvider", back_populates="payments", lazy="selectin")


class SubscriptionInvoice(Base):
    __tablename__ = "subscription_invoices"

    id = Column(BigInteger, primary_key=True, index=True)
    invoice_no = Column(String(50), unique=True, index=True)
    subscription_id = Column(BigInteger, ForeignKey("subscriptions.id"), index=True)
    invoice_date = Column(Date)
    due_date = Column(Date)
    subtotal = Column(Numeric(12, 2))
    tax = Column(Numeric(12, 2))
    total = Column(Numeric(12, 2))
    status = Column(String(30))
    pdf_url = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    subscription = relationship("Subscription", back_populates="invoices", lazy="selectin")


class SubscriptionUsage(Base):
    __tablename__ = "subscription_usage"

    id = Column(BigInteger, primary_key=True, index=True)
    subscription_id = Column(BigInteger, ForeignKey("subscriptions.id"), index=True)
    usage_date = Column(Date)
    users_used = Column(Integer)
    vehicles_used = Column(Integer)
    drivers_used = Column(Integer)
    storage_used_gb = Column(Numeric(10, 2))
    api_calls = Column(Integer)
    ai_requests = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    subscription = relationship("Subscription", back_populates="usage_entries", lazy="selectin")


class SubscriptionEvent(Base):
    __tablename__ = "subscription_events"

    id = Column(BigInteger, primary_key=True, index=True)
    subscription_id = Column(BigInteger, ForeignKey("subscriptions.id"), index=True)
    event_type = Column(String(50))
    event_details = Column(JSONB)
    created_by = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    subscription = relationship("Subscription", back_populates="events", lazy="selectin")


class PaymentWebhook(Base):
    __tablename__ = "payment_webhooks"

    id = Column(BigInteger, primary_key=True, index=True)
    provider_id = Column(BigInteger, ForeignKey("payment_providers.id"), index=True)
    event_type = Column(String(100))
    payload = Column(JSONB)
    processed = Column(Boolean, nullable=False, default=False)
    processed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    provider = relationship("PaymentProvider", back_populates="webhooks", lazy="selectin")


class Feature(Base):
    __tablename__ = "features"

    id = Column(BigInteger, primary_key=True, index=True)
    feature_code = Column(String(100), unique=True, index=True)
    feature_name = Column(String(200))
    description = Column(Text)

    plans = relationship("PlanFeature", back_populates="feature", cascade="all, delete-orphan")


class PlanFeature(Base):
    __tablename__ = "plan_features"

    plan_id = Column(BigInteger, ForeignKey("subscription_plans.id"), primary_key=True)
    feature_id = Column(BigInteger, ForeignKey("features.id"), primary_key=True)

    __table_args__ = (
        UniqueConstraint("plan_id", "feature_id", name="uq_plan_features_plan_feature"),
    )

    plan = relationship("SubscriptionPlan", back_populates="plan_features", lazy="selectin")
    feature = relationship("Feature", back_populates="plans", lazy="selectin")
