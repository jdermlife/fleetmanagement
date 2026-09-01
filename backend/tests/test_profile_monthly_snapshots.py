from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.fastapi_auth import CurrentUser, require_authenticated_user
from app.models.loan_application import LoanApplication  # noqa: F401
from app.models.profile_monthly_snapshot import ProfileMonthlySnapshot
from app.models.users import User  # noqa: F401
from app.routes.profile_monthly_snapshots import router


def test_monthly_scores_can_be_saved_updated_and_retrieved():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    ProfileMonthlySnapshot.__table__.create(bind=engine)
    testing_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_authenticated_user] = lambda: CurrentUser(
        id=7,
        username="profile.owner",
        role="Subscriber",
    )

    payload = {
        "profile_data": {"profile_id": "P-7"},
        "source_profile_id": "P-7",
        "financial_health_score": 842,
        "credit_health_score": 81,
        "net_worth_positioning_score": 76,
        "budget_tracking_score": 73,
        "loan_monitoring_score": 88,
        "bill_reminder_score": 95,
        "financial_health_summary": {"band": "healthy"},
    }

    with TestClient(app) as client:
        created = client.put("/api/profile-monthly-snapshots/2026-08-19", json=payload)
        assert created.status_code == 200, created.text
        assert created.json()["snapshot_month"] == "2026-08-01"
        assert created.json()["financial_health_score"] == 842

        payload["financial_health_score"] = 850
        updated = client.put("/api/profile-monthly-snapshots/2026-08-01", json=payload)
        assert updated.status_code == 200, updated.text
        assert updated.json()["id"] == created.json()["id"]
        assert updated.json()["financial_health_score"] == 850

        detail = client.get("/api/profile-monthly-snapshots/2026-08-31")
        assert detail.status_code == 200
        assert detail.json()["credit_health_score"] == 81
        assert detail.json()["financial_health_summary"] == {"band": "healthy"}

        listed = client.get("/api/profile-monthly-snapshots")
        assert listed.status_code == 200
        assert listed.json()["total"] == 1
        assert len(listed.json()["items"]) == 1

    engine.dispose()