from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

from app.fastapi_auth import CurrentUser
from app.routes.loan_routes import enforce_loan_application_access


def _loan_record(created_by_user_id: int):
    return SimpleNamespace(created_by_user_id=created_by_user_id)


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
    foreign_record = _loan_record(created_by_user_id=100)

    with pytest.raises(HTTPException) as exc_info:
        enforce_loan_application_access(subscriber, foreign_record)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
