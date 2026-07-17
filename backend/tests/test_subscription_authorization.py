from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.fastapi_auth import CurrentUser
from app.models.subscription import PaymentProvider, Subscription, SubscriptionPayment, SubscriptionPlan
from app.models.users import User
from app.routes import subscriptions as subscription_routes
from app.schemas.subscription_schema import (
    PayMongoCheckoutCreate,
    PayPalCaptureOrderRequest,
    PayPalCreateOrderRequest,
    SubscriptionCreate,
    SubscriptionEventCreate,
    SubscriptionPaymentCreate,
    SubscriptionPaymentUpdate,
)


class FakeQuery:
    def __init__(self, rows: list[object]):
        self._rows = rows

    def _extract(self, criterion) -> tuple[str | None, object | None]:
        left = getattr(criterion, "left", None)
        right = getattr(criterion, "right", None)
        key = getattr(left, "key", None)
        value = getattr(right, "value", None)
        if value is None and right is not None:
            value = getattr(right, "effective_value", None)
        return key, value

    def filter(self, *criteria):
        for criterion in criteria:
            key, value = self._extract(criterion)
            if key is None:
                continue
            self._rows = [row for row in self._rows if getattr(row, key, None) == value]
        return self

    def order_by(self, *_args, **_kwargs):
        return self

    def with_for_update(self):
        return self

    def join(self, *_args, **_kwargs):
        return self

    def all(self):
        return list(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None


class FakeSession:
    def __init__(self):
        self.rows_by_model: dict[type, list[object]] = {}

    def query(self, model):
        return FakeQuery(list(self.rows_by_model.get(model, [])))

    def add(self, row):
        model = type(row)
        bucket = self.rows_by_model.setdefault(model, [])
        if getattr(row, "id", None) is None:
            setattr(row, "id", len(bucket) + 1)
        bucket.append(row)

    def commit(self):
        return None

    def refresh(self, _row):
        return None

    def close(self):
        return None


@pytest.fixture
def fake_db(monkeypatch):
    session = FakeSession()
    monkeypatch.setattr(subscription_routes, "SessionLocal", lambda: session)
    return session


def test_subscriber_create_subscription_uses_current_user(fake_db):
    subscriber = CurrentUser(id=42, username="subscriber", role="SUBSCRIBER")
    payload = SubscriptionCreate(
        subscription_no="SUB-TEST-001",
        user_id=999,
        plan_id=1,
        status="ACTIVE",
        subscription_start=date.today(),
    )

    result = subscription_routes.create_subscription(payload=payload, user=subscriber)

    assert result["user_id"] == 42
    assert len(fake_db.rows_by_model.get(Subscription, [])) == 1


def test_admin_create_subscription_can_set_target_user(fake_db):
    admin = CurrentUser(id=1, username="admin", role="ADMIN")
    payload = SubscriptionCreate(
        subscription_no="SUB-TEST-002",
        user_id=777,
        plan_id=1,
        status="ACTIVE",
        subscription_start=date.today(),
    )

    result = subscription_routes.create_subscription(payload=payload, user=admin)

    assert result["user_id"] == 777


def test_subscriber_list_subscriptions_is_owner_scoped(fake_db):
    own_row = Subscription(
        id=1,
        subscription_no="SUB-OWN",
        user_id=42,
        plan_id=1,
        status="ACTIVE",
        subscription_start=date.today(),
    )
    foreign_row = Subscription(
        id=2,
        subscription_no="SUB-OTHER",
        user_id=99,
        plan_id=1,
        status="ACTIVE",
        subscription_start=date.today(),
    )
    fake_db.rows_by_model[Subscription] = [own_row, foreign_row]

    subscriber = CurrentUser(id=42, username="subscriber", role="SUBSCRIBER")
    rows = subscription_routes.list_subscriptions(user=subscriber, status=None)

    assert len(rows) == 1
    assert rows[0]["subscription_no"] == "SUB-OWN"


def test_subscriber_cannot_create_payment_for_foreign_subscription(fake_db):
    foreign_subscription = Subscription(
        id=10,
        subscription_no="SUB-FOREIGN",
        user_id=500,
        plan_id=1,
        status="ACTIVE",
        subscription_start=date.today(),
    )
    fake_db.rows_by_model[Subscription] = [foreign_subscription]

    payload = SubscriptionPaymentCreate(
        payment_reference="PAY-TEST-001",
        subscription_id=10,
        payment_status="PENDING",
    )
    subscriber = CurrentUser(id=42, username="subscriber", role="SUBSCRIBER")

    with pytest.raises(HTTPException) as exc_info:
        subscription_routes.create_subscription_payment(payload=payload, user=subscriber)

    assert exc_info.value.status_code == 403


def test_subscriber_cannot_start_checkout_for_foreign_subscription(fake_db):
    foreign_subscription = Subscription(
        id=11,
        subscription_no="SUB-FOREIGN-CHECKOUT",
        user_id=500,
        plan_id=1,
        status="ACTIVE",
        subscription_start=date.today(),
    )
    fake_db.rows_by_model[Subscription] = [foreign_subscription]

    with pytest.raises(HTTPException) as exc_info:
        subscription_routes.create_paymongo_checkout(
            payload=PayMongoCheckoutCreate(subscription_id=11),
            user=CurrentUser(id=42, username="subscriber", role="SUBSCRIBER"),
        )

    assert exc_info.value.status_code == 403


def test_subscriber_payment_creation_is_forced_to_pending(fake_db):
    own_subscription = Subscription(
        id=12,
        subscription_no="SUB-OWN-PAY",
        user_id=42,
        plan_id=1,
        status="SUSPENDED",
        subscription_start=date.today(),
    )
    fake_db.rows_by_model[Subscription] = [own_subscription]

    payload = SubscriptionPaymentCreate(
        payment_reference="PAY-SELF-APPROVE",
        subscription_id=12,
        payment_status="SUCCESS",
    )
    subscriber = CurrentUser(id=42, username="subscriber", role="SUBSCRIBER")

    result = subscription_routes.create_subscription_payment(payload=payload, user=subscriber)

    assert result["payment_status"] == "PENDING"
    assert result["paid_at"] is None


def test_subscriber_checkout_uses_server_plan_amount(fake_db, monkeypatch):
    plan = SubscriptionPlan(
        id=1,
        plan_code="PRO",
        plan_name="Pro",
        billing_cycle="MONTHLY",
        monthly_price=999,
        currency="PHP",
    )
    subscription = Subscription(
        id=13,
        subscription_no="SUB-CHECKOUT",
        user_id=42,
        plan_id=1,
        status="SUSPENDED",
        subscription_start=date.today(),
    )
    subscription.plan = plan
    provider = PaymentProvider(
        id=5,
        provider_code="PAYMONGO",
        provider_name="PayMongo",
        is_active=True,
    )
    user_row = User(
        id=42,
        username="subscriber",
        email="subscriber@example.com",
        password_hash="hash",
        role="subscriber",
    )
    fake_db.rows_by_model[Subscription] = [subscription]
    fake_db.rows_by_model[SubscriptionPlan] = [plan]
    fake_db.rows_by_model[PaymentProvider] = [provider]
    fake_db.rows_by_model[User] = [user_row]
    captured: dict[str, object] = {}

    def fake_checkout(**kwargs):
        captured.update(kwargs)
        return {
            "checkout_id": "cs_test_checkout",
            "checkout_url": "https://checkout.paymongo.com/cs_test_checkout",
        }

    monkeypatch.setattr(subscription_routes, "create_checkout_session", fake_checkout)

    result = subscription_routes.create_paymongo_checkout(
        payload=PayMongoCheckoutCreate(subscription_id=13),
        user=CurrentUser(id=42, username="subscriber", role="SUBSCRIBER"),
    )

    assert captured["amount_centavos"] == 99_900
    assert result["amount"] == 999.0
    assert result["payment"]["payment_status"] == "PENDING"
    assert result["payment"]["provider_transaction_id"] == "cs_test_checkout"


def test_paypal_capture_requires_exact_stored_order_id(fake_db, monkeypatch):
    subscription = Subscription(
        id=14,
        subscription_no="SUB-PAYPAL-EXACT",
        user_id=42,
        plan_id=1,
        status="SUSPENDED",
        subscription_start=date.today(),
    )
    provider = PaymentProvider(
        id=6,
        provider_code="PAYPAL",
        provider_name="PayPal",
        is_active=True,
    )
    payment = SubscriptionPayment(
        id=40,
        payment_reference="PP-EXACT",
        subscription_id=subscription.id,
        provider_id=provider.id,
        payment_status="PENDING",
        provider_transaction_id="ORDER-STORED",
    )
    fake_db.rows_by_model[Subscription] = [subscription]
    fake_db.rows_by_model[PaymentProvider] = [provider]
    fake_db.rows_by_model[SubscriptionPayment] = [payment]
    monkeypatch.setattr(
        subscription_routes,
        "capture_paypal_order_api",
        lambda *_args, **_kwargs: pytest.fail("mismatched order must not be captured"),
    )

    with pytest.raises(HTTPException) as exc_info:
        subscription_routes.capture_paypal_order(
            payload=PayPalCaptureOrderRequest(
                order_id="ORDER-NOT-STORED",
                subscription_id=subscription.id,
            ),
            user=CurrentUser(id=42, username="subscriber", role="SUBSCRIBER"),
        )

    assert exc_info.value.status_code == 404


def test_paypal_create_reuses_pending_order_for_same_request_id(fake_db, monkeypatch):
    plan = SubscriptionPlan(
        id=1,
        plan_code="PRO",
        plan_name="Pro",
        billing_cycle="MONTHLY",
        monthly_price=999,
        currency="PHP",
    )
    subscription = Subscription(
        id=18,
        subscription_no="SUB-PAYPAL-CREATE",
        user_id=42,
        plan_id=plan.id,
        status="SUSPENDED",
        subscription_start=date.today(),
    )
    subscription.plan = plan
    provider = PaymentProvider(
        id=6,
        provider_code="PAYPAL",
        provider_name="PayPal",
        is_active=True,
    )
    fake_db.rows_by_model[SubscriptionPlan] = [plan]
    fake_db.rows_by_model[Subscription] = [subscription]
    fake_db.rows_by_model[PaymentProvider] = [provider]
    calls: list[dict[str, object]] = []

    def fake_create(**kwargs):
        calls.append(kwargs)
        return {
            "order_id": "ORDER-CREATE-001",
            "status": "CREATED",
            "approval_url": "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-CREATE-001",
        }

    monkeypatch.setattr(subscription_routes, "create_paypal_order_api", fake_create)
    payload = PayPalCreateOrderRequest(
        subscription_id=subscription.id,
        request_id="checkout-request-001",
    )
    user = CurrentUser(id=42, username="subscriber", role="SUBSCRIBER")

    first = subscription_routes.create_paypal_order(payload=payload, user=user)
    second = subscription_routes.create_paypal_order(payload=payload, user=user)

    assert len(calls) == 1
    assert calls[0]["request_id"] == "checkout-request-001"
    assert first["order_id"] == "ORDER-CREATE-001"
    assert first["reused"] is False
    assert second["order_id"] == "ORDER-CREATE-001"
    assert second["reused"] is True
    assert len(fake_db.rows_by_model[SubscriptionPayment]) == 1


def test_paypal_capture_enforces_payment_ownership(fake_db, monkeypatch):
    subscription = Subscription(
        id=15,
        subscription_no="SUB-PAYPAL-FOREIGN",
        user_id=99,
        plan_id=1,
        status="SUSPENDED",
        subscription_start=date.today(),
    )
    provider = PaymentProvider(
        id=6,
        provider_code="PAYPAL",
        provider_name="PayPal",
        is_active=True,
    )
    payment = SubscriptionPayment(
        id=41,
        payment_reference="PP-FOREIGN",
        subscription_id=subscription.id,
        provider_id=provider.id,
        payment_status="PENDING",
        provider_transaction_id="ORDER-FOREIGN",
    )
    fake_db.rows_by_model[Subscription] = [subscription]
    fake_db.rows_by_model[PaymentProvider] = [provider]
    fake_db.rows_by_model[SubscriptionPayment] = [payment]
    monkeypatch.setattr(
        subscription_routes,
        "capture_paypal_order_api",
        lambda *_args, **_kwargs: pytest.fail("foreign order must not be captured"),
    )

    with pytest.raises(HTTPException) as exc_info:
        subscription_routes.capture_paypal_order(
            payload=PayPalCaptureOrderRequest(order_id="ORDER-FOREIGN"),
            user=CurrentUser(id=42, username="subscriber", role="SUBSCRIBER"),
        )

    assert exc_info.value.status_code == 403


@pytest.mark.parametrize("payment_status", ["FAILED", "REFUNDED"])
def test_paypal_capture_rejects_non_pending_terminal_states(
    fake_db,
    monkeypatch,
    payment_status,
):
    subscription = Subscription(
        id=16,
        subscription_no="SUB-PAYPAL-TERMINAL",
        user_id=42,
        plan_id=1,
        status="SUSPENDED",
        subscription_start=date.today(),
    )
    provider = PaymentProvider(
        id=6,
        provider_code="PAYPAL",
        provider_name="PayPal",
        is_active=True,
    )
    payment = SubscriptionPayment(
        id=42,
        payment_reference="PP-TERMINAL",
        subscription_id=subscription.id,
        provider_id=provider.id,
        payment_status=payment_status,
        provider_transaction_id="ORDER-TERMINAL",
    )
    fake_db.rows_by_model[Subscription] = [subscription]
    fake_db.rows_by_model[PaymentProvider] = [provider]
    fake_db.rows_by_model[SubscriptionPayment] = [payment]
    monkeypatch.setattr(
        subscription_routes,
        "capture_paypal_order_api",
        lambda *_args, **_kwargs: pytest.fail("terminal payment must not be captured"),
    )

    with pytest.raises(HTTPException) as exc_info:
        subscription_routes.capture_paypal_order(
            payload=PayPalCaptureOrderRequest(order_id="ORDER-TERMINAL"),
            user=CurrentUser(id=42, username="subscriber", role="SUBSCRIBER"),
        )

    assert exc_info.value.status_code == 409


def test_paypal_capture_pending_order_uses_stable_request_id(fake_db, monkeypatch):
    plan = SubscriptionPlan(
        id=1,
        plan_code="PRO",
        plan_name="Pro",
        billing_cycle="MONTHLY",
    )
    subscription = Subscription(
        id=17,
        subscription_no="SUB-PAYPAL-CAPTURE",
        user_id=42,
        plan_id=plan.id,
        status="SUSPENDED",
        subscription_start=date.today(),
    )
    subscription.plan = plan
    provider = PaymentProvider(
        id=6,
        provider_code="PAYPAL",
        provider_name="PayPal",
        is_active=True,
    )
    payment = SubscriptionPayment(
        id=43,
        payment_reference="PP-CAPTURE-001",
        subscription_id=subscription.id,
        provider_id=provider.id,
        invoice_no=subscription.subscription_no,
        amount=999,
        currency="PHP",
        payment_status="PENDING",
        provider_transaction_id="ORDER-CAPTURE",
    )
    payment.subscription = subscription
    fake_db.rows_by_model[SubscriptionPlan] = [plan]
    fake_db.rows_by_model[Subscription] = [subscription]
    fake_db.rows_by_model[PaymentProvider] = [provider]
    fake_db.rows_by_model[SubscriptionPayment] = [payment]
    captured: dict[str, object] = {}

    def fake_capture(order_id, **kwargs):
        captured["order_id"] = order_id
        captured.update(kwargs)
        return {
            "status": "COMPLETED",
            "capture_id": "CAPTURE-001",
            "amount": Decimal("999.00"),
            "currency": "PHP",
        }

    monkeypatch.setattr(subscription_routes, "capture_paypal_order_api", fake_capture)

    result = subscription_routes.capture_paypal_order(
        payload=PayPalCaptureOrderRequest(
            order_id="ORDER-CAPTURE",
            subscription_id=subscription.id,
        ),
        user=CurrentUser(id=42, username="subscriber", role="SUBSCRIBER"),
    )

    assert captured == {
        "order_id": "ORDER-CAPTURE",
        "request_id": "C-PP-CAPTURE-001",
    }
    assert result["captured"] is True
    assert payment.payment_status == "SUCCESS"


def test_admin_can_confirm_payment_and_activate_subscription(fake_db):
    plan = SubscriptionPlan(
        id=1,
        plan_code="PRO",
        plan_name="Pro",
        billing_cycle="MONTHLY",
    )
    subscription = Subscription(
        id=21,
        subscription_no="SUB-UPGRADE-001",
        user_id=77,
        plan_id=1,
        status="SUSPENDED",
        subscription_type="TRIAL",
        subscription_start=date.today(),
    )
    subscription.plan = plan
    payment = SubscriptionPayment(
        id=31,
        payment_reference="PAY-CONFIRM-001",
        subscription_id=21,
        payment_status="PENDING",
    )
    payment.subscription = subscription
    user = User(
        id=77,
        username="owner",
        email="owner@example.com",
        password_hash="hash",
        role="subscriber",
    )

    fake_db.rows_by_model[SubscriptionPlan] = [plan]
    fake_db.rows_by_model[Subscription] = [subscription]
    fake_db.rows_by_model[SubscriptionPayment] = [payment]
    fake_db.rows_by_model[User] = [user]

    admin = CurrentUser(id=1, username="admin", role="ADMIN")
    payload = SubscriptionPaymentUpdate(payment_status="SUCCESS")

    result = subscription_routes.update_subscription_payment(payment_id=31, payload=payload, user=admin)

    assert result["payment_status"] == "SUCCESS"
    assert result["paid_at"] is not None
    assert subscription.status == "ACTIVE"
    assert subscription.subscription_type == "PAID"
    assert subscription.last_payment_date is not None
    assert subscription.next_billing_date is not None
    assert user.subscription_id == subscription.id


def test_subscriber_cannot_create_event_for_foreign_subscription(fake_db):
    foreign_subscription = Subscription(
        id=11,
        subscription_no="SUB-FOREIGN-EVENT",
        user_id=500,
        plan_id=1,
        status="ACTIVE",
        subscription_start=date.today(),
    )
    fake_db.rows_by_model[Subscription] = [foreign_subscription]

    payload = SubscriptionEventCreate(
        subscription_id=11,
        event_type="RENEWAL",
        event_details={"source": "test"},
    )
    subscriber = CurrentUser(id=42, username="subscriber", role="SUBSCRIBER")

    with pytest.raises(HTTPException) as exc_info:
        subscription_routes.create_subscription_event(payload=payload, user=subscriber)

    assert exc_info.value.status_code == 403


def test_admin_update_status_raises_not_found_when_missing(fake_db):
    admin = CurrentUser(id=1, username="admin", role="ADMIN")

    with pytest.raises(HTTPException) as exc_info:
        subscription_routes.update_subscription_status(subscription_id=404, status="ACTIVE", user=admin)

    assert exc_info.value.status_code == 404
