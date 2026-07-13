from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.fastapi_auth import CurrentUser, get_current_user, require_authenticated_user
from app.models.autosave_draft import AutosaveDraft
from app.routes.autosave_drafts import router


@pytest.fixture
def autosave_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    AutosaveDraft.__table__.create(bind=engine)
    testing_session = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )
    active_user = {
        "value": CurrentUser(id=1, username="owner.one", role="subscriber")
    }

    def override_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_authenticated_user] = lambda: active_user["value"]

    with TestClient(app) as client:
        yield client, active_user, testing_session

    engine.dispose()


def test_drafts_require_authentication():
    engine = create_engine("sqlite://")
    AutosaveDraft.__table__.create(bind=engine)
    testing_session = sessionmaker(bind=engine)

    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_db] = testing_session
    app.dependency_overrides[get_current_user] = lambda: None

    with TestClient(app) as client:
        response = client.get("/api/drafts/loan/new")

    assert response.status_code == 401
    engine.dispose()


def test_create_update_and_stale_revision_conflict(autosave_client):
    client, _active_user, _testing_session = autosave_client
    draft_url = "/api/drafts/loan-application/new"
    first_payload = {
        "borrower": {"name": "Ana", "income": 50000},
        "requirements": ["id", "payslip"],
    }

    created = client.put(
        draft_url,
        json={"payload": first_payload, "expected_revision": 0},
    )

    assert created.status_code == 200, created.text
    assert created.json()["payload"] == first_payload
    assert created.json()["revision"] == 1
    created_at = datetime.fromisoformat(created.json()["created_at"])
    expires_at = datetime.fromisoformat(created.json()["expires_at"])
    assert expires_at - created_at >= timedelta(days=29, hours=23)

    updated = client.put(
        draft_url,
        json={"payload": {"step": 2}, "expected_revision": 1},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["revision"] == 2
    assert updated.json()["payload"] == {"step": 2}

    stale = client.put(
        draft_url,
        json={"payload": {"step": "stale"}, "expected_revision": 1},
    )
    assert stale.status_code == 409
    assert stale.json()["detail"] == {
        "message": "Draft revision conflict",
        "expected_revision": 1,
        "current_revision": 2,
    }

    fetched = client.get(draft_url)
    assert fetched.status_code == 200
    assert fetched.json()["payload"] == {"step": 2}


def test_rejects_oversized_draft_payloads(autosave_client):
    client, _active_user, _testing_session = autosave_client

    response = client.put(
        "/api/drafts/loan-application/oversized",
        json={"payload": "x" * (2 * 1024 * 1024 + 1), "expected_revision": 0},
    )

    assert response.status_code == 422
    assert "2 MiB limit" in response.text


def test_drafts_are_owner_scoped_and_delete_is_idempotent(autosave_client):
    client, active_user, _testing_session = autosave_client
    draft_url = "/api/drafts/bill-reminder/default"

    owner_one_create = client.put(
        draft_url,
        json={"payload": {"billers": ["water"]}, "expected_revision": 0},
    )
    assert owner_one_create.status_code == 200

    active_user["value"] = CurrentUser(
        id=2,
        username="owner.two",
        role="subscriber",
    )
    assert client.get(draft_url).status_code == 404
    assert client.delete(draft_url).status_code == 204

    owner_two_create = client.put(
        draft_url,
        json={"payload": {"billers": ["power"]}, "expected_revision": 0},
    )
    assert owner_two_create.status_code == 200
    assert owner_two_create.json()["payload"] == {"billers": ["power"]}

    active_user["value"] = CurrentUser(
        id=1,
        username="owner.one",
        role="subscriber",
    )
    assert client.get(draft_url).json()["payload"] == {"billers": ["water"]}
    assert client.delete(draft_url).status_code == 204
    assert client.delete(draft_url).status_code == 204
    assert client.get(draft_url).status_code == 404


def test_expired_draft_is_removed_and_can_be_recreated(autosave_client):
    client, _active_user, testing_session = autosave_client
    draft_url = "/api/drafts/net-worth/current"
    assert client.put(
        draft_url,
        json={"payload": {"assets": 100}, "expected_revision": 0},
    ).status_code == 200

    with testing_session() as db:
        draft = db.query(AutosaveDraft).filter(AutosaveDraft.owner_id == 1).one()
        draft.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()

    assert client.get(draft_url).status_code == 404
    with testing_session() as db:
        assert db.query(AutosaveDraft).count() == 0

    recreated = client.put(
        draft_url,
        json={"payload": {"assets": 125}, "expected_revision": 0},
    )
    assert recreated.status_code == 200
    assert recreated.json()["revision"] == 1


def test_migration_uses_sqlite_compatible_json(monkeypatch):
    import migrate_autosave_drafts as migration

    engine = create_engine("sqlite://")
    monkeypatch.setattr(migration, "engine", engine)

    migration.run_migration()

    inspector = inspect(engine)
    columns = {column["name"]: column for column in inspector.get_columns("autosave_drafts")}
    assert "JSON" in str(columns["payload"]["type"]).upper()
    assert {
        "idx_autosave_drafts_owner_id",
        "idx_autosave_drafts_expires_at",
    }.issubset({index["name"] for index in inspector.get_indexes("autosave_drafts")})
    engine.dispose()


def test_audit_metadata_does_not_retain_draft_payload():
    from app.services.autosave_audit import (
        autosave_request_audit_metadata,
        autosave_response_audit_metadata,
        is_autosave_draft_path,
    )

    secret = "private-borrower-income-50000"
    request_metadata = autosave_request_audit_metadata(
        "/api/drafts/loan-application/new",
        (
            '{"payload":{"income":"'
            + secret
            + '"},"expected_revision":4}'
        ).encode(),
    )
    response_metadata = autosave_response_audit_metadata(
        {
            "payload": {"income": secret},
            "revision": 5,
            "updated_at": "2026-07-13T00:00:00Z",
        },
        200,
    )

    assert secret not in repr(request_metadata)
    assert secret not in repr(response_metadata)
    assert request_metadata["expected_revision"] == 4
    assert response_metadata["revision"] == 5
    assert is_autosave_draft_path("/api/drafts/loan-application/new") is True
    assert is_autosave_draft_path("/api/loans/1") is False
