from __future__ import annotations

from datetime import date

import pytest
from fastapi import HTTPException

from app.fastapi_auth import CurrentUser
from app.models.subscription import Subscription, SubscriptionPayment, SubscriptionPlan
from app.models.users import User
from app.routes import subscriptions as subscription_routes
from app.schemas.subscription_schema import (
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
