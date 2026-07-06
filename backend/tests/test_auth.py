from __future__ import annotations

import importlib

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models.roles import Role
from app.models.users import User
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
    assert len(fake_db.rows_by_model[User]) == 1


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

    assert response.status_code == 200
    assert "disabled" in response.json()["message"].lower()
    assert user.is_active is False
    assert user.is_deleted is True
