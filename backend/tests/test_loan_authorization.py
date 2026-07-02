from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

from app.fastapi_auth import CurrentUser
from app.routes.loan_routes import (
    enforce_loan_application_access,
    enforce_loan_permission,
    enforce_loan_status_transition_permission,
)
from security.rbac import Permission as RBACPermission


def _loan_record(created_by: int):
    return SimpleNamespace(created_by=created_by)


def test_admin_can_access_any_record():
    admin = CurrentUser(id=1, username="admin", role="ADMIN")
    target_record = _loan_record(created_by_user_id=999)

    enforce_loan_application_access(admin, target_record)


def test_subscriber_can_access_own_record():
    subscriber = CurrentUser(id=42, username="subscriber", role="SUBSCRIBER")
    own_record = _loan_record(created_by_user_id=42)

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


def test_subscriber_lender_cannot_transition_to_approved_without_permission():
    lender = CurrentUser(id=8, username="lender", role="SUBSCRIBER_LENDER")

    with pytest.raises(HTTPException) as exc_info:
        enforce_loan_status_transition_permission(lender, "Approved")

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


def test_subscriber_borrower_cannot_transition_to_released_without_permission():
    borrower = CurrentUser(id=7, username="borrower", role="SUBSCRIBER_BORROWER")

    with pytest.raises(HTTPException) as exc_info:
        enforce_loan_status_transition_permission(borrower, "Released")

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


def test_admin_can_transition_to_approved_and_released():
    admin = CurrentUser(id=1, username="admin", role="ADMIN")

    enforce_loan_status_transition_permission(admin, "Approved")
    enforce_loan_status_transition_permission(admin, "Released")
