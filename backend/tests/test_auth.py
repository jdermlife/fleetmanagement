from __future__ import annotations

import importlib
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app import fastapi_auth
from app.fastapi_auth import CurrentUser
from app.models.roles import Role
from app.models.autosave_draft import AutosaveDraft
from app.models.subscription import Subscription, SubscriptionPlan
from app.models.users import User
from app.routes import apple_auth as apple_auth_routes
from app.routes import subscriptions as subscriptions_routes
from app.routes import security as security_routes


class FakeQuery:
    def __init__(self, rows: list[object]):
        self._rows = rows

    def filter(self, *_criteria):
        return self

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return list(self._rows)

    def join(self, *_args, **_kwargs):
        return self

    def distinct(self):
        return self

    def order_by(self, *_args, **_kwargs):
        return self


class FakeSession:
    def __init__(self):
        self.rows_by_model: dict[type, list[object]] = {}

    def query(self, model):
        return FakeQuery(list(self.rows_by_model.get(model, [])))

    def add(self, row):
        bucket = self.rows_by_model.setdefault(type(row), [])
        if getattr(row, "id", None) is None:
            setattr(row, "id", len(bucket) + 1)
        bucket.append(row)

    def flush(self):
        return None

    def commit(self):
        return None

    def refresh(self, _row):
        return None

    def delete(self, row):
        self.rows_by_model.setdefault(type(row), []).remove(row)

    def close(self):
        return None


@pytest.fixture
def fake_db():
    session = FakeSession()
    session.rows_by_model[Role] = [
        Role(id=1, name="subscriber_borrower", description="Borrower role", is_system=True),
        Role(id=2, name="subscriber_lender", description="Lender role", is_system=True),
        Role(id=3, name="subscriber", description="Subscriber role", is_system=True),
    ]
    return session


@pytest.fixture
def app_client(monkeypatch, fake_db: FakeSession):
    monkeypatch.setenv("ENFORCE_AUTH", "true")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-fastapi-auth")
    monkeypatch.setenv("ENABLE_RATE_LIMIT", "false")

    import security.auth as auth_module

    auth_module = importlib.reload(auth_module)
    security_module = importlib.reload(security_routes)

    app = FastAPI()
    app.include_router(security_module.router, prefix="/api")
    app.dependency_overrides[security_module.get_db] = lambda: fake_db
    app.dependency_overrides[fastapi_auth.get_db] = lambda: fake_db

    with TestClient(app) as client:
        yield client, auth_module, fake_db

    app.dependency_overrides.clear()


@pytest.fixture
def apple_auth_client(monkeypatch, fake_db: FakeSession):
    monkeypatch.setenv("ENFORCE_AUTH", "true")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-fastapi-auth")
    monkeypatch.setenv("ENABLE_RATE_LIMIT", "false")

    import security.auth as auth_module

    auth_module = importlib.reload(auth_module)
    security_module = importlib.reload(security_routes)
    apple_auth_module = importlib.reload(apple_auth_routes)

    app = FastAPI()
    app.include_router(apple_auth_module.router)
    app.dependency_overrides[apple_auth_module.get_db] = lambda: fake_db

    with TestClient(app) as client:
        yield client, auth_module, fake_db, apple_auth_module

    app.dependency_overrides.clear()


@pytest.fixture
def subscriptions_client(monkeypatch, fake_db: FakeSession):
    monkeypatch.setenv("ENFORCE_AUTH", "true")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-fastapi-auth")
    monkeypatch.setenv("ENABLE_RATE_LIMIT", "false")

    import security.auth as auth_module

    auth_module = importlib.reload(auth_module)
    subscriptions_module = importlib.reload(subscriptions_routes)

    app = FastAPI()
    app.include_router(subscriptions_module.router, prefix="/api")
    monkeypatch.setattr(subscriptions_module, "SessionLocal", lambda: fake_db)
    app.dependency_overrides[subscriptions_module.require_authenticated_user] = lambda: CurrentUser(
        id=11,
        username="subscriber",
        role="subscriber_borrower",
    )

    with TestClient(app) as client:
        yield client, auth_module, fake_db

    app.dependency_overrides.clear()


def test_register_endpoint_exists(app_client):
    client, _auth_module, fake_db = app_client

    response = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "password123",
            "subscriber_type": "borrower",
            "lender_data_sharing_consent": False,
        },
    )

    assert response.status_code == 201
    assert response.json()["user"]["username"] == "testuser"
    assert response.json()["access_token"]
    assert response.json()["refresh_token"]
    assert response.json()["user"]["account_access_expires_at"] is not None
    assert len(fake_db.rows_by_model[User]) == 1


def test_register_requires_turnstile_when_configured(app_client, monkeypatch):
    client, _auth_module, fake_db = app_client
    monkeypatch.setenv("TURNSTILE_SECRET_KEY", "turnstile-test-secret")
    monkeypatch.setenv("TURNSTILE_REQUIRED", "true")

    response = client.post(
        "/api/auth/register",
        json={
            "username": "blocked-user",
            "email": "blocked@example.com",
            "password": "password123",
            "subscriber_type": "borrower",
            "lender_data_sharing_consent": False,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Complete the security verification before continuing"
    assert fake_db.rows_by_model.get(User, []) == []


def test_password_reset_verifies_turnstile_before_sending_email(app_client, monkeypatch):
    client, auth_module, fake_db = app_client
    monkeypatch.setenv("TURNSTILE_SECRET_KEY", "turnstile-test-secret")
    monkeypatch.setenv("TURNSTILE_REQUIRED", "true")
    monkeypatch.setenv("SMTP_SERVER", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USERNAME", "mailer@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "smtp-password")
    user = User(
        id=7,
        username="reset-user",
        email="reset@example.com",
        password_hash=auth_module.hash_password("password123"),
        role="subscriber_borrower",
        is_active=True,
        is_deleted=False,
        account_status="ACTIVE",
        mfa_enabled=False,
    )
    fake_db.rows_by_model[User] = [user]
    events = []

    class TurnstileResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"success": True}

    def verify_turnstile(url, *, data, timeout):
        events.append("turnstile")
        assert url == security_routes.TURNSTILE_VERIFY_URL
        assert data["response"] == "verified-token"
        assert timeout == 5
        return TurnstileResponse()

    def send_reset_email(*_args, **_kwargs):
        events.append("email")

    monkeypatch.setattr(security_routes.requests, "post", verify_turnstile)
    monkeypatch.setattr(security_routes, "send_email", send_reset_email)

    response = client.post(
        "/api/auth/password-reset-request",
        json={
            "email_or_username": "reset@example.com",
            "turnstile_token": "verified-token",
        },
    )

    assert response.status_code == 200
    assert events == ["turnstile", "email"]


def test_login_endpoint_exists(app_client):
    client, auth_module, fake_db = app_client

    user = User(
        id=1,
        username="loginuser",
        email="login@example.com",
        password_hash=auth_module.hash_password("password123"),
        role="subscriber_borrower",
        is_active=True,
        is_deleted=False,
        account_status="ACTIVE",
        mfa_enabled=False,
    )
    fake_db.rows_by_model[User] = [user]

    response = client.post(
        "/api/auth/login",
        json={"username": "loginuser", "password": "password123"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "access_token" in payload
    assert "refresh_token" in payload


def test_login_reports_missing_account_after_verification(app_client):
    client, _auth_module, _fake_db = app_client

    response = client.post(
        "/api/auth/login",
        json={"username": "missing@example.com", "password": "password123"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Account not found. Continue to registration."


def test_login_keeps_wrong_password_as_invalid_credentials(app_client):
    client, auth_module, fake_db = app_client
    user = User(
        id=12,
        username="existinguser",
        email="existing@example.com",
        password_hash=auth_module.hash_password("correct-password"),
        role="subscriber_borrower",
        is_active=True,
        is_deleted=False,
        account_status="ACTIVE",
        mfa_enabled=False,
    )
    fake_db.rows_by_model[User] = [user]

    response = client.post(
        "/api/auth/login",
        json={"username": "existing@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_login_does_not_call_turnstile(app_client, monkeypatch):
    client, auth_module, fake_db = app_client
    monkeypatch.setenv("TURNSTILE_SECRET_KEY", "turnstile-test-secret")
    monkeypatch.setenv("TURNSTILE_REQUIRED", "true")
    user = User(
        id=2,
        username="captchauser",
        email="captcha@example.com",
        password_hash=auth_module.hash_password("password123"),
        role="subscriber_borrower",
        is_active=True,
        is_deleted=False,
        account_status="ACTIVE",
        mfa_enabled=False,
    )
    fake_db.rows_by_model[User] = [user]

    turnstile_request = pytest.fail
    monkeypatch.setattr(security_routes.requests, "post", turnstile_request)
    response = client.post(
        "/api/auth/login",
        json={
            "username": "captchauser",
            "password": "password123",
        },
    )

    assert response.status_code == 200


def test_login_deactivates_expired_unpaid_account(app_client):
    client, auth_module, fake_db = app_client

    user = User(
        id=11,
        username="expireduser",
        email="expired@example.com",
        password_hash=auth_module.hash_password("password123"),
        role="subscriber_borrower",
        is_active=True,
        is_deleted=False,
        account_status="ACTIVE",
        mfa_enabled=False,
        account_access_expires_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    fake_db.rows_by_model[User] = [user]

    response = client.post(
        "/api/auth/login",
        json={"username": "expireduser", "password": "password123"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "Free trial and 24-hour payment grace period expired due to non-payment. "
        "Complete payment to reactivate access."
    )
    assert user.is_active is False
    assert user.account_status == "SUSPENDED"


def test_apple_callback_route_accepts_apples_form_post_without_exposing_tokens(app_client):
    client, _auth_module, _fake_db = app_client

    response = client.post(
        "/api/auth/apple/callback",
        data={
            "code": "apple-authorization-code",
            "id_token": "apple-identity-token",
            "state": "apple-state",
        },
    )

    assert response.status_code == 200
    assert "Authentication completed successfully" in response.text
    assert "apple-identity-token" not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_apple_callback_route_has_a_readiness_page(app_client):
    client, _auth_module, _fake_db = app_client

    response = client.get("/api/auth/apple/callback")

    assert response.status_code == 200
    assert "callback is ready" in response.text


def test_create_free_subscription_allows_authenticated_subscriber(subscriptions_client):
    client, _auth_module, fake_db = subscriptions_client

    fake_db.rows_by_model[SubscriptionPlan] = [
        SubscriptionPlan(
            id=1,
            plan_code="FREE",
            plan_name="Free",
            billing_cycle="MONTHLY",
            is_active=True,
            is_public=True,
        )
    ]
    fake_db.rows_by_model[Subscription] = []

    response = client.post(
        "/api/subscriptions/create-free",
        json={"user_id": 11},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == 11
    assert payload["subscription_type"] == "FREE"


def test_apple_callback_route_rejects_non_form_payloads(app_client):
    client, _auth_module, _fake_db = app_client

    response = client.post(
        "/api/auth/apple/callback",
        json={"id_token": "not-form-encoded"},
    )

    assert response.status_code == 415


def test_apple_id_token_verifier_accepts_a_valid_rs256_token(monkeypatch):
    from cryptography.hazmat.primitives.asymmetric import rsa

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    key_id = "apple-test-key"
    public_jwk = security_routes.jwt.algorithms.RSAAlgorithm.to_jwk(
        private_key.public_key(),
        as_dict=True,
    )
    public_jwk["kid"] = key_id
    now = datetime.now(timezone.utc)
    identity_token = security_routes.jwt.encode(
        {
            "iss": security_routes.APPLE_OAUTH_ISSUER,
            "aud": "com.quantech.filscore.web",
            "sub": "apple-user-123",
            "email": "apple-user@example.com",
            "email_verified": True,
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        private_key,
        algorithm="RS256",
        headers={"kid": key_id},
    )

    monkeypatch.setattr(
        security_routes,
        "_load_apple_sign_in_keys",
        lambda: [public_jwk],
    )
    monkeypatch.setattr(
        security_routes,
        "APPLE_OAUTH_CLIENT_ID",
        "com.quantech.filscore.web",
    )

    decoded = security_routes._verify_apple_id_token(identity_token)

    assert decoded["sub"] == "apple-user-123"
    assert decoded["email"] == "apple-user@example.com"


def test_apple_id_token_verifier_reports_service_id_mismatch(monkeypatch):
    from cryptography.hazmat.primitives.asymmetric import rsa

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    key_id = "apple-test-key"
    public_jwk = security_routes.jwt.algorithms.RSAAlgorithm.to_jwk(
        private_key.public_key(),
        as_dict=True,
    )
    public_jwk["kid"] = key_id
    now = datetime.now(timezone.utc)
    identity_token = security_routes.jwt.encode(
        {
            "iss": security_routes.APPLE_OAUTH_ISSUER,
            "aud": "different.apple.service-id",
            "sub": "apple-user-123",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        private_key,
        algorithm="RS256",
        headers={"kid": key_id},
    )

    monkeypatch.setattr(
        security_routes,
        "_load_apple_sign_in_keys",
        lambda: [public_jwk],
    )
    monkeypatch.setattr(
        security_routes,
        "APPLE_OAUTH_CLIENT_ID",
        "com.quantech.filscore.web",
    )

    with pytest.raises(HTTPException) as error:
        security_routes._verify_apple_id_token(identity_token)

    assert error.value.status_code == 401
    assert "different Service ID" in error.value.detail


def test_delete_account_endpoint_disables_authenticated_user(app_client):
    client, auth_module, fake_db = app_client

    user = User(
        id=7,
        username="deleteuser",
        email="delete@example.com",
        password_hash=auth_module.hash_password("password123"),
        role="subscriber_borrower",
        is_active=True,
        is_deleted=False,
        account_status="ACTIVE",
        mfa_enabled=False,
    )
    fake_db.rows_by_model[User] = [user]

    token = auth_module.create_token(7, "deleteuser", "subscriber_borrower", expires_in_hours=1)

    response = client.post(
        "/api/auth/delete-account",
        json={"current_password": "password123"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert "disabled" in response.json()["message"].lower()
    assert user.is_active is False
    assert user.is_deleted is True


def test_delete_account_endpoint_removes_data_but_retains_account(app_client):
    client, auth_module, fake_db = app_client

    user = User(
        id=8,
        username="retainuser",
        email="retain@example.com",
        password_hash=auth_module.hash_password("password123"),
        role="subscriber_borrower",
        is_active=True,
        is_deleted=False,
        account_status="ACTIVE",
        first_name="Retain",
        mobile_no="09171234567",
        profile_photo="profile-data",
        lender_data_sharing_consent=True,
        mfa_enabled=False,
    )
    draft = AutosaveDraft(
        id=1,
        owner_id=user.id,
        scope="profile",
        entity_key="current",
        payload={"income": 1000},
        revision=1,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    fake_db.rows_by_model[User] = [user]
    fake_db.rows_by_model[AutosaveDraft] = [draft]

    token = auth_module.create_token(8, "retainuser", "subscriber_borrower", expires_in_hours=1)
    response = client.post(
        "/api/auth/delete-account",
        json={"current_password": "password123", "deletion_mode": "data_only"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert "data deleted" in response.json()["message"].lower()
    assert user.is_active is True
    assert user.is_deleted is False
    assert user.account_status == "ACTIVE"
    assert user.first_name is None
    assert user.mobile_no is None
    assert user.profile_photo is None
    assert fake_db.rows_by_model[AutosaveDraft] == []


def test_apple_token_endpoint_creates_user_on_first_sign_in(apple_auth_client, monkeypatch):
    client, _auth_module, fake_db, apple_auth_module = apple_auth_client

    monkeypatch.setattr(
        apple_auth_module,
        "_verify_apple_id_token",
        lambda _token: {
            "email": "new-apple-user@example.com",
            "sub": "apple-sub-123",
            "email_verified": True,
        },
    )
    monkeypatch.setattr(
        apple_auth_module,
        "_build_login_payload",
        lambda user, _request, _db: {
            "access_token": "test-access-token",
            "refresh_token": "test-refresh-token",
            "token_type": "bearer",
            "user": {"id": user.id, "email": user.email, "role": user.role},
        },
    )

    response = client.post(
        "/auth/apple-token",
        json={
            "identity_token": "apple-token-value",
            "subscriber_type": "borrower",
            "lender_data_sharing_consent": False,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["access_token"] == "test-access-token"
    assert payload["user"]["email"] == "new-apple-user@example.com"

    users = fake_db.rows_by_model.get(User, [])
    assert len(users) == 1
    assert users[0].email == "new-apple-user@example.com"
    assert users[0].role == "subscriber_borrower"


def test_apple_token_endpoint_requires_identity_token(apple_auth_client):
    client, _auth_module, _fake_db, _apple_auth_module = apple_auth_client

    response = client.post(
        "/auth/apple-token",
        json={
            "id_token": "wrong-field",
            "subscriber_type": "borrower",
            "lender_data_sharing_consent": False,
        },
    )

    assert response.status_code == 422
