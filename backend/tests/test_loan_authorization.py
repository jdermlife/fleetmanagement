from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

from app.fastapi_auth import CurrentUser
from app.routes import loan_routes
from app.routes.loan_routes import (
    build_scorecard_snapshot,
    create_loan_scorecard_snapshot,
    enforce_loan_application_access,
    enforce_loan_permission,
    enforce_loan_status_transition_permission,
)
from app.schemas.loan_schema import LoanScorecardSnapshotCreate
from security.rbac import Permission as RBACPermission


def _loan_record(created_by: int):
    return SimpleNamespace(created_by=created_by)


def test_admin_can_access_any_record():
    admin = CurrentUser(id=1, username="admin", role="ADMIN")
    target_record = _loan_record(created_by=999)

    enforce_loan_application_access(admin, target_record)


def test_subscriber_can_access_own_record():
    subscriber = CurrentUser(id=42, username="subscriber", role="SUBSCRIBER")
    own_record = _loan_record(created_by=42)

    enforce_loan_application_access(subscriber, own_record)


def test_subscriber_cannot_access_other_users_record():
    subscriber = CurrentUser(id=42, username="subscriber", role="SUBSCRIBER")
    foreign_record = _loan_record(created_by=100)

    with pytest.raises(HTTPException) as exc_info:
        enforce_loan_application_access(subscriber, foreign_record)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


def test_subscriber_borrower_can_access_own_record():
    borrower = CurrentUser(id=7, username="borrower", role="SUBSCRIBER_BORROWER")
    own_record = _loan_record(created_by=7)

    enforce_loan_application_access(borrower, own_record)


def test_subscriber_borrower_cannot_export_loans():
    borrower = CurrentUser(id=7, username="borrower", role="SUBSCRIBER_BORROWER")

    with pytest.raises(HTTPException) as exc_info:
        enforce_loan_permission(
            borrower,
            RBACPermission.EXPORT_LOANS,
            "You do not have permission to export loan applications",
        )

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


def test_subscriber_lender_can_export_loans():
    lender = CurrentUser(id=8, username="lender", role="SUBSCRIBER_LENDER")

    enforce_loan_permission(
        lender,
        RBACPermission.EXPORT_LOANS,
        "You do not have permission to export loan applications",
    )


def test_non_admin_cannot_transition_to_approved():
    approver = CurrentUser(id=8, username="approver", role="APPROVER")

    with pytest.raises(HTTPException) as exc_info:
        enforce_loan_status_transition_permission(approver, "Approved")

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


def test_non_admin_cannot_transition_to_released():
    credit_manager = CurrentUser(id=7, username="manager", role="CREDIT_MANAGER")

    with pytest.raises(HTTPException) as exc_info:
        enforce_loan_status_transition_permission(credit_manager, "Released")

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


def test_admin_can_transition_to_approved_and_released():
    admin = CurrentUser(id=1, username="admin", role="ADMIN")

    enforce_loan_status_transition_permission(admin, "Approved")
    enforce_loan_status_transition_permission(admin, "Released")


def test_scorecard_snapshot_uses_stored_status_and_latest_score(monkeypatch):
    older_score = SimpleNamespace(
        id=1,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        final_score=75,
        final_grade="B",
        final_rating="Good",
        final_decision="Review",
    )
    latest_score = SimpleNamespace(
        id=2,
        created_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
        final_score=88,
        final_grade="A",
        final_rating="Excellent",
        final_decision="Approve",
    )
    record = SimpleNamespace(id=42, status="Approved", overall_scores=[older_score, latest_score])
    monkeypatch.setattr(
        loan_routes,
        "serialize_loan_application",
        lambda stored_record: {"application_no": "LN-42", "status": stored_record.status},
    )

    snapshot = build_scorecard_snapshot(record, date(2026, 2, 15), finalized_by=7)

    assert snapshot.loan_application_id == 42
    assert snapshot.finalized_by == 7
    assert snapshot.final_status == "APPROVED"
    assert snapshot.overall_score == 88
    assert snapshot.grade == "A"
    assert snapshot.rating == "Excellent"
    assert snapshot.decision == "Approve"
    assert snapshot.scorecard_payload == {"application_no": "LN-42", "status": "Approved"}


def test_scorecard_snapshot_rejects_future_date_before_database_access():
    user = CurrentUser(id=1, username="admin", role="ADMIN")
    payload = LoanScorecardSnapshotCreate(snapshot_date=date.today() + timedelta(days=1))

    with pytest.raises(HTTPException) as exc_info:
        create_loan_scorecard_snapshot("LN-42", payload, user)

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert exc_info.value.detail == "Snapshot date cannot be in the future"
