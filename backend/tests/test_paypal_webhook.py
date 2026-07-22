from __future__ import annotations

from datetime import date
from decimal import Decimal
import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models.subscription import (
    PaymentProvider,
    PaymentWebhook,
    Subscription,
    SubscriptionInvoice,
    SubscriptionPayment,
    SubscriptionPlan,
)
from app.models.users import User
from app.routes import subscriptions as subscription_routes
from app.routes.paypal import router as paypal_router
from app.routes.subscriptions import router as subscriptions_router


class FakeQuery:
    def __init__(self, rows: list[object]):
        self._rows = rows

    def filter(self, *criteria):
        for criterion in criteria:
            left = getattr(criterion, "left", None)
            right = getattr(criterion, "right", None)
            key = getattr(left, "key", None)
            value = getattr(right, "value", None)
            if value is None and right is not None:
                value = getattr(right, "effective_value", None)
            if key is not None:
                self._rows = [row for row in self._rows if getattr(row, key, None) == value]
        return self

    def order_by(self, *_args, **_kwargs):
        return self

    def with_for_update(self):
        return self

    def first(self):
        return self._rows[0] if self._rows else None


class FakeSession:
    def __init__(self):
        self.rows_by_model: dict[type, list[object]] = {}

    def query(self, model):
        return FakeQuery(list(self.rows_by_model.get(model, [])))

    def add(self, row):
        bucket = self.rows_by_model.setdefault(type(row), [])
        if getattr(row, "id", None) is None:
            row.id = len(bucket) + 1
        bucket.append(row)

    def commit(self):
        return None

    def refresh(self, _row):
        return None

    def close(self):
        return None


def test_verified_paypal_webhook_activates_subscription(monkeypatch):
    fake_db = FakeSession()

    provider = PaymentProvider(
        id=7,
        provider_code="PAYPAL",
        provider_name="PayPal",
        is_active=True,
    )
    plan = SubscriptionPlan(
        id=1,
        plan_code="PRO",
        plan_name="Pro",
        billing_cycle="MONTHLY",
    )
    subscription = Subscription(
        id=10,
        subscription_no="SUB-PAYPAL-WEBHOOK",
        user_id=42,
        plan_id=1,
        status="SUSPENDED",
        subscription_type="TRIAL",
        subscription_start=date.today(),
    )
    subscription.plan = plan
    payment = SubscriptionPayment(
        id=20,
        payment_reference="PP-WEBHOOK",
        subscription_id=10,
        provider_id=7,
        amount=Decimal("999.00"),
        currency="PHP",
        payment_status="PENDING",
        provider_transaction_id="ORDER-123",
    )
    payment.subscription = subscription
    user = User(
        id=42,
        username="subscriber",
        email="subscriber@example.com",
        password_hash="hash",
        role="subscriber",
    )
    fake_db.rows_by_model = {
        PaymentProvider: [provider],
        SubscriptionPlan: [plan],
        Subscription: [subscription],
        SubscriptionPayment: [payment],
        User: [user],
    }

    monkeypatch.setattr(subscription_routes, "SessionLocal", lambda: fake_db)
    monkeypatch.setattr(
        subscription_routes,
        "verify_paypal_webhook_signature",
        lambda _raw_payload, _headers: None,
    )

    app = FastAPI()
    app.include_router(subscriptions_router, prefix="/api")
    app.include_router(paypal_router, prefix="/api")
    client = TestClient(app)

    payload = {
        "id": "WH-EVT-1",
        "event_type": "PAYMENT.CAPTURE.COMPLETED",
        "resource": {
            "id": "CAPTURE-123",
            "custom_id": "PP-WEBHOOK",
            "invoice_id": "SUB-PAYPAL-WEBHOOK",
            "amount": {"currency_code": "PHP", "value": "999.00"},
            "supplementary_data": {
                "related_ids": {
                    "order_id": "ORDER-123"
                }
            },
        },
    }

    response = client.post(
        "/api/subscriptions/payments/paypal/webhook",
        content=json.dumps(payload),
        headers={
            "Content-Type": "application/json",
            "PayPal-Auth-Algo": "SHA256withRSA",
            "PayPal-Cert-Url": "https://api-m.paypal.com/certs/test.pem",
            "PayPal-Transmission-Id": "trans-1",
            "PayPal-Transmission-Sig": "sig",
            "PayPal-Transmission-Time": "2026-07-15T12:00:00Z",
        },
    )

    assert response.status_code == 200
    assert response.json()["received"] is True
    assert response.json()["processed"] is True

    assert payment.payment_status == "SUCCESS"
    assert payment.payment_method == "PayPal Webhook"
    assert subscription.status == "ACTIVE"
    assert subscription.payment_provider_id == provider.id
    assert user.subscription_id == subscription.id
    assert user.account_access_expires_at is not None

    assert len(fake_db.rows_by_model[PaymentWebhook]) == 1
    assert fake_db.rows_by_model[PaymentWebhook][0].processed is True
    assert fake_db.rows_by_model[PaymentWebhook][0].provider_event_id == "WH-EVT-1"
    assert len(fake_db.rows_by_model[SubscriptionInvoice]) == 1

    duplicate_response = client.post(
        "/api/paypal/webhook",
        content=json.dumps(payload),
        headers={
            "Content-Type": "application/json",
            "PayPal-Auth-Algo": "SHA256withRSA",
            "PayPal-Cert-Url": "https://api-m.paypal.com/certs/test.pem",
            "PayPal-Transmission-Id": "trans-1",
            "PayPal-Transmission-Sig": "sig",
            "PayPal-Transmission-Time": "2026-07-15T12:00:00Z",
        },
    )

    assert duplicate_response.status_code == 200
    assert duplicate_response.json() == {
        "received": True,
        "processed": True,
        "duplicate": True,
    }
    assert len(fake_db.rows_by_model[PaymentWebhook]) == 1
    assert len(fake_db.rows_by_model[SubscriptionInvoice]) == 1


def test_paypal_routes_expose_canonical_api_and_hide_legacy_compatibility_paths():
    app = FastAPI()
    app.include_router(subscriptions_router, prefix="/api")
    app.include_router(paypal_router, prefix="/api")

    paths = app.openapi()["paths"]

    assert "/api/paypal/create-order" in paths
    assert "/api/paypal/capture-order" in paths
    assert "/api/paypal/webhook" in paths
    assert "/api/subscriptions/payments/paypal/create-order" not in paths
    assert "/api/subscriptions/payments/paypal/capture-order" not in paths
    assert "/api/subscriptions/payments/paypal/webhook" not in paths


def test_paypal_webhook_does_not_fall_back_to_custom_or_invoice_ids(monkeypatch):
    fake_db = FakeSession()
    provider = PaymentProvider(
        id=7,
        provider_code="PAYPAL",
        provider_name="PayPal",
        is_active=True,
    )
    payment = SubscriptionPayment(
        id=20,
        payment_reference="PP-WEBHOOK",
        subscription_id=10,
        provider_id=7,
        invoice_no="SUB-PAYPAL-WEBHOOK",
        amount=Decimal("999.00"),
        currency="PHP",
        payment_status="PENDING",
        provider_transaction_id="ORDER-STORED",
    )
    fake_db.rows_by_model = {
        PaymentProvider: [provider],
        SubscriptionPayment: [payment],
    }
    monkeypatch.setattr(subscription_routes, "SessionLocal", lambda: fake_db)
    monkeypatch.setattr(
        subscription_routes,
        "verify_paypal_webhook_signature",
        lambda _raw_payload, _headers: None,
    )
    app = FastAPI()
    app.include_router(subscriptions_router, prefix="/api")
    client = TestClient(app)
    payload = {
        "id": "WH-EVT-STRICT",
        "event_type": "PAYMENT.CAPTURE.COMPLETED",
        "resource": {
            "id": "CAPTURE-STRICT",
            "custom_id": "PP-WEBHOOK",
            "invoice_id": "SUB-PAYPAL-WEBHOOK",
            "amount": {"currency_code": "PHP", "value": "999.00"},
            "supplementary_data": {
                "related_ids": {"order_id": "ORDER-NOT-STORED"}
            },
        },
    }

    response = client.post(
        "/api/paypal/webhook",
        content=json.dumps(payload),
        headers={
            "Content-Type": "application/json",
            "PayPal-Auth-Algo": "SHA256withRSA",
            "PayPal-Cert-Url": "https://api-m.paypal.com/certs/test.pem",
            "PayPal-Transmission-Id": "trans-strict",
            "PayPal-Transmission-Sig": "sig",
            "PayPal-Transmission-Time": "2026-07-15T12:00:00Z",
        },
    )

    assert response.status_code == 404
    assert payment.payment_status == "PENDING"
    assert fake_db.rows_by_model.get(PaymentWebhook, []) == []


def test_paypal_webhook_rejects_amount_mismatch(monkeypatch):
    fake_db = FakeSession()

    provider = PaymentProvider(
        id=7,
        provider_code="PAYPAL",
        provider_name="PayPal",
        is_active=True,
    )
    payment = SubscriptionPayment(
        id=20,
        payment_reference="PP-WEBHOOK",
        subscription_id=10,
        provider_id=7,
        amount=Decimal("1000.00"),
        currency="PHP",
        payment_status="PENDING",
        provider_transaction_id="ORDER-123",
    )
    fake_db.rows_by_model = {
        PaymentProvider: [provider],
        SubscriptionPayment: [payment],
    }

    monkeypatch.setattr(subscription_routes, "SessionLocal", lambda: fake_db)
    monkeypatch.setattr(
        subscription_routes,
        "verify_paypal_webhook_signature",
        lambda _raw_payload, _headers: None,
    )

    app = FastAPI()
    app.include_router(subscriptions_router, prefix="/api")
    client = TestClient(app)

    payload = {
        "id": "WH-EVT-1",
        "event_type": "PAYMENT.CAPTURE.COMPLETED",
        "resource": {
            "id": "CAPTURE-123",
            "amount": {"currency_code": "PHP", "value": "999.00"},
            "supplementary_data": {
                "related_ids": {
                    "order_id": "ORDER-123"
                }
            },
        },
    }

    response = client.post(
        "/api/subscriptions/payments/paypal/webhook",
        content=json.dumps(payload),
        headers={
            "Content-Type": "application/json",
            "PayPal-Auth-Algo": "SHA256withRSA",
            "PayPal-Cert-Url": "https://api-m.paypal.com/certs/test.pem",
            "PayPal-Transmission-Id": "trans-1",
            "PayPal-Transmission-Sig": "sig",
            "PayPal-Transmission-Time": "2026-07-15T12:00:00Z",
        },
    )

    assert response.status_code == 409
    assert payment.payment_status == "PENDING"
