from datetime import date, datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.fastapi_auth import CurrentUser, require_authenticated_user
from app.jobs.monthly_profile_snapshot import completed_month_ends, run_monthly_profile_snapshots
from app.models.loan_application import LoanApplication  # noqa: F401
from app.models.profile_history import ProfileHistory
from app.models.profile_monthly_snapshot import ProfileMonthlySnapshot
from app.models.users import User
from app.routes.profile_monthly_snapshots import router


@compiles(JSONB, "sqlite")
def compile_jsonb_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


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


def test_scheduler_creates_three_completed_months_without_manual_save():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in (User.__table__, LoanApplication.__table__, ProfileHistory.__table__, ProfileMonthlySnapshot.__table__):
        table.create(bind=engine)
    testing_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    with testing_session() as db:
        db.add(User(
            id=11,
            username="automatic.owner",
            email="automatic@example.com",
            password_hash="not-used",
            role="Subscriber",
            created_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
        ))
        db.add(ProfileHistory(
            owner_id=11,
            category="financial_health_score",
            snapshot_month=date(2026, 8, 1),
            observed_at=datetime(2026, 8, 31, 23, 59, tzinfo=timezone.utc),
            payload={"score": 812, "band": "healthy"},
            created_by=11,
        ))
        db.commit()

    assert completed_month_ends(date(2026, 10, 17)) == [
        date(2026, 9, 30),
        date(2026, 8, 31),
        date(2026, 7, 31),
    ]
    assert run_monthly_profile_snapshots(
        as_of=date(2026, 10, 17),
        session_factory=testing_session,
    ) == 3

    with testing_session() as db:
        snapshots = db.scalars(
            select(ProfileMonthlySnapshot).order_by(ProfileMonthlySnapshot.snapshot_month)
        ).all()
        assert [snapshot.snapshot_month for snapshot in snapshots] == [
            date(2026, 7, 1),
            date(2026, 8, 1),
            date(2026, 9, 1),
        ]
        assert snapshots[0].financial_health_score is None
        assert float(snapshots[1].financial_health_score) == 812
        assert float(snapshots[2].financial_health_score) == 812
        assert snapshots[2].source_profile_id == "ACCOUNT-11"
        assert snapshots[2].profile_data["automatic_snapshot"] == {
            "cutoff": "2026-09-30",
            "source": "scheduled_month_end",
        }

    assert run_monthly_profile_snapshots(
        as_of=date(2026, 10, 17),
        session_factory=testing_session,
    ) == 0

    engine.dispose()