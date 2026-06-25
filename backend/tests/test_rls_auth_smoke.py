from __future__ import annotations

from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routes.security import router as security_router


def test_register_login_me_with_forced_rls():
    app = FastAPI()
    app.include_router(security_router, prefix="/api")
    client = TestClient(app)

    suffix = uuid4().hex[:8]
    username = f"rls_user_{suffix}"
    email = f"rls_{suffix}@example.com"
    password = "StrongPass123!"

    register_response = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
        },
    )
    assert register_response.status_code in (200, 201), register_response.text

    login_response = client.post(
        "/api/auth/login",
        json={
            "username": username,
            "password": password,
        },
    )
    assert login_response.status_code == 200, login_response.text

    login_data = login_response.json()
    access_token = login_data.get("access_token")
    assert isinstance(access_token, str) and access_token

    me_response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 200, me_response.text

    me_data = me_response.json()
    assert me_data["user"]["username"] == username
    assert me_data["user"]["email"] == email
