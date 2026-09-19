from __future__ import annotations

import pytest
from fastapi import HTTPException
from types import SimpleNamespace

from app.fastapi_auth import CurrentUser
from app.models.loan_application import (
    AIRecommendation,
    CollateralScore,
    CreditBureauReport,
    CreditScore,
    FraudScore,
    LoanApplication,
    OverallScore,
    ProfitabilityScore,
    PsychometricScore,
    RelationshipScore,
    SocialScore,
)
from app.routes.loan_routes import serialize_loan_application_fields
from app.schemas.loan_schema import LoanApplicationCreate
from app.services import build_profile_repository
from app.services.build_profile_repository import (
    compute_and_persist_build_profile_scores,
    upsert_build_profile_record,
)


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


class ScoreQuery:
    def __init__(self, session, model):
        self.session = session
        self.model = model

    def filter(self, *_criteria):
        return self

    def order_by(self, *_criteria):
        return self

    def first(self):
        return self.session.score_records.get(self.model)


class ScoreSession:
    def __init__(self):
        self.score_records = {}
        self.flush_count = 0

    def flush(self):
        self.flush_count += 1

    def query(self, model):
        return ScoreQuery(self, model)

    def add(self, record):
        self.score_records[type(record)] = record


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


def test_loan_serialization_includes_creator_identity():
    record = LoanApplication(application_no="PRO-001", created_by=7)
    record.creator_user = SimpleNamespace(
        username="jorge.creator",
        email="jorge@example.com",
    )

    serialized = serialize_loan_application_fields(record)

    assert serialized["created_by_username"] == "jorge.creator"
    assert serialized["created_by_email"] == "jorge@example.com"


def test_profile_fields_are_mapped_to_columns_and_api_schema():
    session = FakeSession()
    user = CurrentUser(id=7, username="owner", role="subscriber")
    profile = {
        "profileId": "PRO-002",
        "psychometricAssessment": {"q01": "4", "q02": "3"},
        "values": {
            "fullName": "Ana Cruz",
            "dateOfBirth": "1990-05-14",
            "gender": "Female",
            "employmentStatus": "Regular",
            "spouseFullName": "Rene Cruz",
            "creditCardIssuer": "Bank A",
        },
    }

    record, _ = upsert_build_profile_record(session, user, profile, "PRO-002")
    serialized = serialize_loan_application_fields(record)

    assert "date_of_birth" in LoanApplication.__table__.columns
    assert "date_of_birth" in LoanApplicationCreate.model_fields
    assert str(record.date_of_birth) == "1990-05-14"
    assert record.gender == "Female"
    assert record.employment_status == "Regular"
    assert record.spouse_name == "Rene Cruz"
    assert record.credit_card_issuer == "Bank A"
    assert record.requirements["spouseInformation"]["fullName"] == "Rene Cruz"
    assert record.requirements["psychometricAssessment"] == {"q01": "4", "q02": "3"}
    assert serialized["date_of_birth"].isoformat() == "1990-05-14"


def test_profile_scores_are_computed_and_upserted(monkeypatch):
    score_package = {
        "quant_scores": {"overallScore": 812.4},
        "credit_scores": {"total_credit_score": 801.0},
        "fraud_scores": {"overall_fraud_score": 95.0},
        "social_scores": {"overall_social_score": 78.0},
        "psychometric_scores": {"overall_psychometric_score": 84.0},
        "credit_bureau_reports": {"bureau_score": 790.0},
        "collateral_scores": {"overall_collateral_score": 88.0},
        "profitability_scores": {"profitability_score": 73.0},
        "relationship_scores": {"relationship_score": 69.0},
        "ai_recommendations": {"recommendation": "APPROVE"},
        "overall_scores": {"final_score": 812.4, "final_decision": "APPROVE"},
    }
    calls = []
    monkeypatch.setattr(
        build_profile_repository,
        "compute_quant_score_package",
        lambda record: calls.append(record) or score_package,
    )
    session = ScoreSession()
    record = LoanApplication(id=42, application_no="PRO-003")

    result = compute_and_persist_build_profile_scores(session, record)
    compute_and_persist_build_profile_scores(session, record)

    expected_models = {
        CreditScore,
        FraudScore,
        SocialScore,
        PsychometricScore,
        CreditBureauReport,
        CollateralScore,
        ProfitabilityScore,
        RelationshipScore,
        AIRecommendation,
        OverallScore,
    }
    assert calls == [record, record]
    assert session.flush_count == 2
    assert set(session.score_records) == expected_models
    assert len(session.score_records) == len(expected_models)
    assert session.score_records[CreditScore].total_credit_score == 801.0
    assert session.score_records[OverallScore].final_decision == "APPROVE"
    assert record.scorecard_total == 812
    assert record.ai_probability == 812.4
    assert result == score_package["quant_scores"]