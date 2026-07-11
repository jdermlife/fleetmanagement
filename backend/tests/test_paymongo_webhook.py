from __future__ import annotations

from datetime import date
import hashlib
import hmac
import json
import time

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models.subscription import (
    PaymentProvider,
    PaymentWebhook,
    Subscription,
    SubscriptionPayment,
    SubscriptionPlan,
)
from app.models.users import User
from app.routes import subscriptions as subscription_routes
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

    def close(self):
        return None


def _signed_payload(payload: dict, secret: str, timestamp: int) -> tuple[bytes, str]:
    raw_payload = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    digest = hmac.new(
        secret.encode("utf-8"),
        str(timestamp).encode("utf-8") + b"." + raw_payload,
        hashlib.sha256,
    ).hexdigest()
    return raw_payload, f"t={timestamp},te={digest},li="


def _paid_checkout_payload() -> dict:
    return {
        "data": {
            "id": "evt_checkout_paid",
            "type": "event",
            "attributes": {
                "type": "checkout_session.payment.paid",
                "livemode": False,
                "data": {
                    "id": "cs_checkout_paid",
                    "type": "checkout_session",
                    "attributes": {
                        "payments": [
                            {
                                "id": "pay_checkout_paid",
                                "type": "payment",
                                "attributes": {
                                    "amount": 99_900,
                                    "currency": "PHP",
                                    "paid_at": 1_750_000_000,
                                    "source": {"type": "gcash"},
                                    "status": "paid",
                                },
                            }
                        ]
                    },
                },
            },
        }
    }


def test_verified_paymongo_webhook_activates_subscription(monkeypatch):
    fake_db = FakeSession()
    provider = PaymentProvider(
        id=5,
        provider_code="PAYMONGO",
        provider_name="PayMongo",
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
        subscription_no="SUB-WEBHOOK",
        user_id=42,
        plan_id=1,
        status="SUSPENDED",
        subscription_type="TRIAL",
        subscription_start=date.today(),
    )
    subscription.plan = plan
    payment = SubscriptionPayment(
        id=20,
        payment_reference="PM-WEBHOOK",
        subscription_id=10,
        provider_id=5,
        amount=999,
        currency="PHP",
        payment_status="PENDING",
        provider_transaction_id="cs_checkout_paid",
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
    monkeypatch.setenv("PAYMONGO_WEBHOOK_SECRET", "webhook-test-secret")

    app = FastAPI()
    app.include_router(subscriptions_router, prefix="/api")
    client = TestClient(app)
    timestamp = int(time.time())
    raw_payload, signature = _signed_payload(
        _paid_checkout_payload(),
        "webhook-test-secret",
        timestamp,
    )

    response = client.post(
        "/api/subscriptions/payments/paymongo/webhook",
        content=raw_payload,
        headers={
            "Content-Type": "application/json",
            "Paymongo-Signature": signature,
        },
    )

    assert response.status_code == 200
    assert response.json() == {"received": True, "processed": True}
    assert payment.payment_status == "SUCCESS"
    assert payment.payment_method == "gcash"
    assert subscription.status == "ACTIVE"
    assert subscription.payment_provider_id == provider.id
    assert user.subscription_id == subscription.id
    assert len(fake_db.rows_by_model[PaymentWebhook]) == 1
    assert fake_db.rows_by_model[PaymentWebhook][0].processed is True

    duplicate_response = client.post(
        "/api/subscriptions/payments/paymongo/webhook",
        content=raw_payload,
        headers={
            "Content-Type": "application/json",
            "Paymongo-Signature": signature,
        },
    )
    assert duplicate_response.status_code == 200
    assert payment.payment_status == "SUCCESS"


def test_paymongo_webhook_rejects_invalid_signature(monkeypatch):
    monkeypatch.setenv("PAYMONGO_WEBHOOK_SECRET", "webhook-test-secret")
    app = FastAPI()
    app.include_router(subscriptions_router, prefix="/api")
    client = TestClient(app)

    response = client.post(
        "/api/subscriptions/payments/paymongo/webhook",
        content=json.dumps(_paid_checkout_payload()),
        headers={
            "Content-Type": "application/json",
            "Paymongo-Signature": f"t={int(time.time())},te=invalid,li=",
        },
    )

    assert response.status_code == 401


def test_paymongo_webhook_rejects_amount_mismatch(monkeypatch):
    fake_db = FakeSession()
    provider = PaymentProvider(
        id=5,
        provider_code="PAYMONGO",
        provider_name="PayMongo",
        is_active=True,
    )
    payment = SubscriptionPayment(
        id=20,
        payment_reference="PM-AMOUNT-MISMATCH",
        subscription_id=10,
        provider_id=5,
        amount=1000,
        currency="PHP",
        payment_status="PENDING",
        provider_transaction_id="cs_checkout_paid",
    )
    fake_db.rows_by_model = {
        PaymentProvider: [provider],
        SubscriptionPayment: [payment],
    }
    monkeypatch.setattr(subscription_routes, "SessionLocal", lambda: fake_db)
    monkeypatch.setenv("PAYMONGO_WEBHOOK_SECRET", "webhook-test-secret")
    app = FastAPI()
    app.include_router(subscriptions_router, prefix="/api")
    client = TestClient(app)
    timestamp = int(time.time())
    raw_payload, signature = _signed_payload(
        _paid_checkout_payload(),
        "webhook-test-secret",
        timestamp,
    )

    response = client.post(
        "/api/subscriptions/payments/paymongo/webhook",
        content=raw_payload,
        headers={
            "Content-Type": "application/json",
            "Paymongo-Signature": signature,
        },
    )

    assert response.status_code == 409
    assert payment.payment_status == "PENDING"


def test_paymongo_webhook_rejects_stale_signature(monkeypatch):
    monkeypatch.setenv("PAYMONGO_WEBHOOK_SECRET", "webhook-test-secret")
    app = FastAPI()
    app.include_router(subscriptions_router, prefix="/api")
    client = TestClient(app)
    stale_timestamp = int(time.time()) - 301
    raw_payload, signature = _signed_payload(
        _paid_checkout_payload(),
        "webhook-test-secret",
        stale_timestamp,
    )

    response = client.post(
        "/api/subscriptions/payments/paymongo/webhook",
        content=raw_payload,
        headers={
            "Content-Type": "application/json",
            "Paymongo-Signature": signature,
        },
    )

    assert response.status_code == 401
