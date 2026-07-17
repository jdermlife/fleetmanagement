from __future__ import annotations

from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models.subscription import Feature, Subscription, SubscriptionPayment, SubscriptionPlan
from app.models.users import User
from app.routes import subscriptions as subscription_routes
from app.routes.subscriptions import router as subscriptions_router
from security.auth import create_token


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

    def join(self, *_args, **_kwargs):
        return self

    def order_by(self, *_args, **_kwargs):
        return self

    def all(self):
        return list(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None

    def delete(self):
        deleted = len(self._rows)
        self._rows = []
        return deleted


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


@pytest.fixture
def client(fake_db):
    app = FastAPI()
    app.include_router(subscriptions_router, prefix="/api")
    return TestClient(app)


@pytest.fixture
def admin_headers():
    token = create_token(user_id=1, username="admin", role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def subscriber_headers():
    token = create_token(user_id=42, username="subscriber", role="SUBSCRIBER")
    return {"Authorization": f"Bearer {token}"}


def test_plans_create_and_list_smoke(client: TestClient, admin_headers):
    create_response = client.post(
        "/api/subscriptions/plans",
        headers=admin_headers,
        json={
            "plan_code": "BASIC",
            "plan_name": "Basic",
            "billing_cycle": "MONTHLY",
            "monthly_price": 999.0,
        },
    )
    assert create_response.status_code == 200

    list_response = client.get("/api/subscriptions/plans", headers=admin_headers)
    assert list_response.status_code == 200
    rows = list_response.json()
    assert len(rows) == 1
    assert rows[0]["plan_code"] == "BASIC"


def test_public_plans_endpoint_lists_only_active_public_plans_smoke(
    client: TestClient,
    fake_db: FakeSession,
):
    public_plan = SubscriptionPlan(
        id=1,
        plan_code="FREE",
        plan_name="Free",
        billing_cycle="MONTHLY",
        is_active=True,
        is_public=True,
        display_order=1,
    )
    private_plan = SubscriptionPlan(
        id=2,
        plan_code="PRIVATE",
        plan_name="Private",
        billing_cycle="MONTHLY",
        is_active=True,
        is_public=False,
        display_order=2,
    )
    inactive_plan = SubscriptionPlan(
        id=3,
        plan_code="OLD",
        plan_name="Old",
        billing_cycle="MONTHLY",
        is_active=False,
        is_public=True,
        display_order=3,
    )
    fake_db.rows_by_model[SubscriptionPlan] = [public_plan, private_plan, inactive_plan]

    response = client.get("/api/subscriptions/public-plans")

    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["plan_code"] == "FREE"


def test_subscriber_subscription_owner_scope_smoke(
    client: TestClient,
    fake_db: FakeSession,
    subscriber_headers,
):
    own_subscription = Subscription(
        id=1,
        subscription_no="SUB-OWN-001",
        user_id=42,
        plan_id=1,
        status="ACTIVE",
        subscription_start=date.today(),
    )
    foreign_subscription = Subscription(
        id=2,
        subscription_no="SUB-OTHER-001",
        user_id=99,
        plan_id=1,
        status="ACTIVE",
        subscription_start=date.today(),
    )
    fake_db.rows_by_model[Subscription] = [own_subscription, foreign_subscription]

    list_response = client.get("/api/subscriptions", headers=subscriber_headers)
    assert list_response.status_code == 200
    rows = list_response.json()
    assert len(rows) == 1
    assert rows[0]["subscription_no"] == "SUB-OWN-001"


def test_subscriber_can_fetch_own_subscription_me_smoke(
    client: TestClient,
    fake_db: FakeSession,
    subscriber_headers,
):
    own_subscription = Subscription(
        id=3,
        subscription_no="SUB-ME-001",
        user_id=42,
        plan_id=1,
        status="ACTIVE",
        subscription_start=date.today(),
    )
    foreign_subscription = Subscription(
        id=4,
        subscription_no="SUB-ME-OTHER",
        user_id=99,
        plan_id=1,
        status="ACTIVE",
        subscription_start=date.today(),
    )
    fake_db.rows_by_model[Subscription] = [foreign_subscription, own_subscription]

    response = client.get("/api/subscriptions/me", headers=subscriber_headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload is not None
    assert payload["subscription_no"] == "SUB-ME-001"


def test_subscriber_cannot_pay_foreign_subscription_smoke(
    client: TestClient,
    fake_db: FakeSession,
    subscriber_headers,
):
    foreign_subscription = Subscription(
        id=50,
        subscription_no="SUB-FOREIGN",
        user_id=999,
        plan_id=1,
        status="ACTIVE",
        subscription_start=date.today(),
    )
    fake_db.rows_by_model[Subscription] = [foreign_subscription]

    response = client.post(
        "/api/subscriptions/payments",
        headers=subscriber_headers,
        json={
            "payment_reference": "PAY-001",
            "subscription_id": 50,
            "payment_status": "PENDING",
        },
    )

    assert response.status_code == 403


def test_admin_can_confirm_subscription_payment_smoke(
    client: TestClient,
    fake_db: FakeSession,
    admin_headers,
):
    plan = SubscriptionPlan(
        id=1,
        plan_code="PRO",
        plan_name="Pro",
        billing_cycle="MONTHLY",
    )
    subscription = Subscription(
        id=5,
        subscription_no="SUB-PAY-001",
        user_id=88,
        plan_id=1,
        status="SUSPENDED",
        subscription_type="TRIAL",
        subscription_start=date.today(),
    )
    subscription.plan = plan
    payment = SubscriptionPayment(
        id=6,
        payment_reference="PAY-ADMIN-001",
        subscription_id=5,
        payment_status="PENDING",
    )
    payment.subscription = subscription
    user = User(
        id=88,
        username="subscriber88",
        email="subscriber88@example.com",
        password_hash="hash",
        role="subscriber",
    )

    fake_db.rows_by_model[SubscriptionPlan] = [plan]
    fake_db.rows_by_model[Subscription] = [subscription]
    fake_db.rows_by_model[SubscriptionPayment] = [payment]
    fake_db.rows_by_model[User] = [user]

    response = client.patch(
        "/api/subscriptions/payments/6",
        headers=admin_headers,
        json={"payment_status": "SUCCESS"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["payment_status"] == "SUCCESS"
    assert payload["paid_at"] is not None
    assert subscription.status == "ACTIVE"
    assert user.subscription_id == subscription.id


def test_feature_assign_and_list_smoke(client: TestClient, fake_db: FakeSession, admin_headers):
    plan = SubscriptionPlan(
        id=7,
        plan_code="PRO",
        plan_name="Pro",
        billing_cycle="MONTHLY",
    )
    feature = Feature(
        id=8,
        feature_code="AI_REPORTS",
        feature_name="AI Reports",
    )
    fake_db.rows_by_model[SubscriptionPlan] = [plan]
    fake_db.rows_by_model[Feature] = [feature]

    assign_response = client.put(
        "/api/subscriptions/plans/7/features",
        headers=admin_headers,
        json={"feature_ids": [8]},
    )
    assert assign_response.status_code == 200

    list_response = client.get("/api/subscriptions/plans/7/features", headers=admin_headers)
    assert list_response.status_code == 200
    assert isinstance(list_response.json(), list)


def test_admin_can_update_plan_amendment_fields_smoke(
    client: TestClient,
    fake_db: FakeSession,
    admin_headers,
):
    existing_plan = SubscriptionPlan(
        id=11,
        plan_code="STARTER",
        plan_name="Starter",
        billing_cycle="MONTHLY",
        trial_days=14,
        support_level="STANDARD",
        is_public=True,
    )
    fake_db.rows_by_model[SubscriptionPlan] = [existing_plan]

    response = client.patch(
        "/api/subscriptions/plans/11",
        headers=admin_headers,
        json={
            "trial_days": 21,
            "support_level": "PRIORITY",
            "is_public": False,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["trial_days"] == 21
    assert payload["support_level"] == "PRIORITY"
    assert payload["is_public"] is False


def test_subscriber_can_update_own_subscription_amendment_fields_smoke(
    client: TestClient,
    fake_db: FakeSession,
    subscriber_headers,
):
    own_subscription = Subscription(
        id=20,
        subscription_no="SUB-OWN-UPDATE",
        user_id=42,
        plan_id=1,
        status="ACTIVE",
        subscription_start=date.today(),
        subscription_type="TRIAL",
        renewal_count=0,
        current_users=1,
    )
    fake_db.rows_by_model[Subscription] = [own_subscription]

    response = client.patch(
        "/api/subscriptions/20",
        headers=subscriber_headers,
        json={
            "subscription_type": "PAID",
            "renewal_count": 3,
            "current_users": 4,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["subscription_type"] == "PAID"
    assert payload["renewal_count"] == 3
    assert payload["current_users"] == 4


def test_entitlement_endpoint_admin_allowed_smoke(client: TestClient, admin_headers):
    response = client.get(
        "/api/subscriptions/entitlement/loan-record-create",
        headers=admin_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["allowed"] is True
    assert payload["reason"] == "ROLE_NOT_BILLED"


def test_entitlement_endpoint_subscriber_no_active_subscription_smoke(
    client: TestClient,
    subscriber_headers,
):
    response = client.get(
        "/api/subscriptions/entitlement/loan-record-create",
        headers=subscriber_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["allowed"] is False
    assert payload["reason"] == "NO_ACTIVE_SUBSCRIPTION"
