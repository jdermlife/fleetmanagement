from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.fastapi_auth import CurrentUser, require_authenticated_user
from app.models.loan_application import LoanApplication  # noqa: F401
from app.models.profile_history import HistoryConfiguration, ProfileHistory
from app.models.users import User  # noqa: F401
from app.routes import profile_history
from app.schemas.profile_history_schema import HistoryCategory
from app.services.profile_history_service import cleanup_expired_profile_history


@pytest.fixture
def history_client(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    ProfileHistory.__table__.create(bind=engine)
    testing_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    active_user = {"value": CurrentUser(id=7, username="profile.owner", role="Subscriber")}
    applications = {
        "APP-001": SimpleNamespace(id=101, application_no="APP-001", created_by=7),
        "APP-002": SimpleNamespace(id=102, application_no="APP-002", created_by=8),
    }

    def get_application(_db, application_no):
        application = applications.get(application_no)
        if application is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
        return application

    def enforce_access(user, application):
        if user.role.lower() != "admin" and application.created_by != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    monkeypatch.setattr(profile_history, "get_loan_application_or_404", get_application)
    monkeypatch.setattr(profile_history, "enforce_loan_application_access", enforce_access)

    def override_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(profile_history.router, prefix="/api")
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_authenticated_user] = lambda: active_user["value"]

    with TestClient(app) as client:
        yield client, active_user

    engine.dispose()


def test_create_retrieve_and_filter_profile_history(history_client):
    client, _active_user = history_client
    categories = [category.value for category in HistoryCategory]

    for index, category in enumerate(categories, start=1):
        response = client.post(
            "/api/profiles/APP-001/history",
            json={
                "category": category,
                "observed_at": f"2026-07-{index:02d}T12:00:00Z",
                "payload": {"category": category, "score": index},
            },
        )
        assert response.status_code == 201, response.text
        assert response.json()["application_no"] == "APP-001"

    listed = client.get("/api/profiles/APP-001/history?limit=20")
    assert listed.status_code == 200
    assert listed.json()["total"] == len(categories)
    assert listed.json()["items"][0]["category"] == categories[-1]

    filtered = client.get(
        "/api/profiles/APP-001/history",
        params={
            "category": "financial_health_score",
            "date_from": "2026-07-01T00:00:00Z",
            "date_to": "2026-07-31T23:59:59Z",
        },
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1
    history_id = filtered.json()["items"][0]["id"]

    detail = client.get(f"/api/profiles/APP-001/history/{history_id}")
    assert detail.status_code == 200
    assert detail.json()["payload"]["category"] == "financial_health_score"


def test_history_rejects_unknown_category_and_cross_profile_access(history_client):
    client, _active_user = history_client
    invalid = client.post(
        "/api/profiles/APP-001/history",
        json={
            "category": "unknown",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "payload": {},
        },
    )
    assert invalid.status_code == 422

    assert client.get("/api/profiles/APP-002/history").status_code == 403
    assert client.get("/api/profiles/PRO-LOCAL/history").status_code == 404


def test_financial_health_history_allows_one_snapshot_per_month(history_client):
    client, _active_user = history_client
    first = client.post(
        "/api/profiles/APP-001/history",
        json={
            "category": "financial_health_score",
            "observed_at": "2026-08-31T23:59:59Z",
            "payload": {"score": 842},
        },
    )
    duplicate = client.post(
        "/api/profiles/APP-001/history",
        json={
            "category": "financial_health_score",
            "observed_at": "2026-08-01T00:00:00Z",
            "payload": {"score": 850},
        },
    )
    future = client.post(
        "/api/profiles/APP-001/history",
        json={
            "category": "financial_health_score",
            "observed_at": "2099-01-31T23:59:59Z",
            "payload": {"score": 900},
        },
    )

    assert first.status_code == 201
    assert duplicate.status_code == 409
    assert future.status_code == 422


def test_migration_seeds_retention_and_cleanup_respects_category_months(monkeypatch):
    import migrate_profile_history as migration

    engine = create_engine("sqlite://")
    monkeypatch.setattr(migration, "engine", engine)
    migration.run_migration()

    inspector = inspect(engine)
    assert {
        "history_configuration",
        "profile_history",
        "profile_monthly_snapshots",
    }.issubset(inspector.get_table_names())

    testing_session = sessionmaker(bind=engine)
    with testing_session() as db:
        configurations = db.execute(select(HistoryConfiguration)).scalars().all()
        assert len(configurations) == len(HistoryCategory)
        assert {configuration.retention_months for configuration in configurations} == {24}

        db.add_all([
            ProfileHistory(
                owner_id=7,
                loan_application_id=101,
                category=HistoryCategory.BUDGET_SNAPSHOT.value,
                observed_at=datetime(2024, 6, 30, tzinfo=timezone.utc),
                payload={"period": "expired"},
                created_by=7,
            ),
            ProfileHistory(
                owner_id=7,
                loan_application_id=101,
                category=HistoryCategory.BUDGET_SNAPSHOT.value,
                observed_at=datetime(2024, 8, 1, tzinfo=timezone.utc),
                payload={"period": "retained"},
                created_by=7,
            ),
        ])
        db.commit()

        deleted = cleanup_expired_profile_history(
            db,
            now=datetime(2026, 7, 31, tzinfo=timezone.utc),
        )
        remaining = db.query(ProfileHistory).all()

        assert deleted == 1
        assert [snapshot.payload["period"] for snapshot in remaining] == ["retained"]

    engine.dispose()


def test_history_audit_metadata_does_not_retain_financial_payloads():
    from app.services.profile_history_audit import (
        is_profile_history_path,
        profile_history_request_audit_metadata,
        profile_history_response_audit_metadata,
    )

    secret = "private-net-worth-1500000"
    request_metadata = profile_history_request_audit_metadata(
        "/api/profiles/APP-001/history",
        (
            '{"category":"net_worth_snapshot","observed_at":"2026-07-31T00:00:00Z",'
            f'"payload":{{"net_worth":"{secret}"}}}}'
        ).encode(),
    )
    response_metadata = profile_history_response_audit_metadata(
        {
            "items": [{"payload": {"net_worth": secret}}],
            "total": 1,
        },
        200,
    )

    assert secret not in repr(request_metadata)
    assert secret not in repr(response_metadata)
    assert request_metadata["category"] == "net_worth_snapshot"
    assert response_metadata["returned_count"] == 1
    assert is_profile_history_path("/api/profiles/APP-001/history/9") is True