from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.fastapi_auth import CurrentUser
from app.models.loan_application import LoanApplication
from app.services.build_profile_repository import upsert_build_profile_record


class FakeQuery:
    def __init__(self, session):
        self.session = session

    def filter(self, *_criteria):
        return self

    def first(self):
        return self.session.record


class FakeSession:
    def __init__(self):
        self.record = None

    def query(self, _model):
        return FakeQuery(self)

    def add(self, record):
        self.record = record


def test_profile_draft_creates_then_updates_same_loan_record():
    session = FakeSession()
    user = CurrentUser(id=7, username="owner", role="subscriber")
    profile = {
        "profileId": "PRO-001",
        "values": {
            "fullName": "Ana Cruz",
            "monthlyIncome": "50000",
            "productType": "Auto Loan",
        },
    }

    created_record, created = upsert_build_profile_record(
        session, user, profile, "PRO-001"
    )
    profile["values"]["monthlyIncome"] = "60000"
    updated_record, updated_created = upsert_build_profile_record(
        session, user, profile, "PRO-001"
    )

    assert created is True
    assert updated_created is False
    assert updated_record is created_record
    assert updated_record.application_no == "PRO-001"
    assert updated_record.created_by == 7
    assert updated_record.status == "Draft"
    assert updated_record.monthly_income == 60000
    assert updated_record.requirements["buildProfile"]["values"]["monthlyIncome"] == "60000"


def test_profile_draft_cannot_update_another_accounts_record():
    session = FakeSession()
    session.record = LoanApplication(
        application_no="PRO-001",
        created_by=8,
        requirements={},
    )
    profile = {"profileId": "PRO-001", "values": {}}

    with pytest.raises(HTTPException) as error:
        upsert_build_profile_record(
            session,
            CurrentUser(id=7, username="owner", role="subscriber"),
            profile,
            "PRO-001",
        )

    assert error.value.status_code == 403