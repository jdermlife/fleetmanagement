"""
Integration test for QuantScores compute endpoint.

Tests the complete flow:
1. POST to /api/loan-applications/compute-quant-scores
2. Verify response contains correct quant_scores summary
3. Verify scores are persisted to database
4. GET /api/loan-applications/{app_no} and verify persisted scores

NOTE: These tests assume the database is initialized with the full schema.
Use with actual database, not test fixtures, due to complex foreign key relationships.
"""

import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from sqlalchemy.orm import Session
from uuid import uuid4

from app.database import SessionLocal
from app.routes.loan_routes import router as loan_router
from app.models.loan_application import LoanApplication
from security.auth import create_token


@pytest.fixture
def client():
    """Create a test FastAPI app with loan router (without database fixtures)."""
    app = FastAPI()
    app.include_router(loan_router, prefix="/api")
    return TestClient(app)


@pytest.fixture
def subscriber_headers():
    token = create_token(user_id=1001, username="subscriber_test", role="SUBSCRIBER")
    return {"Authorization": f"Bearer {token}"}


def get_test_payload():
    """Return a valid LoanApplicationCreate payload with all required fields."""
    return {
        "application_no": f"APP-TEST-{uuid4().hex[:8].upper()}",
        "status": "DRAFT",
        "product_type": "Auto Loan",
        "borrower_name": "Test Borrower",
        "email": "test@example.com",
        "phone": "555-1234",
        "gov_id": "123456789",
        "address": "123 Main St, Test City, TC 12345",
        "monthly_income": 10000.0,
        "other_income": 0.0,
        "debt_obligations": 2000.0,
        "loan_amount": 450000.0,
        "term_months": 36,
        "interest_rate": 12.5,
        "purpose": "HOME",
        "vehicle_info": "N/A",
        "appraised_value": 500000.0,
        "committee_remarks": "Automated test",
        "executive_approval": False,
        "dti": 0.2,
        "dsr": 0.35,
        "ltv": 0.9,
        "scorecard_total": 0,
        "ai_probability": 0.0,
        "requirements": {
            "applicantPersonal": {
                "maritalStatus": "Single",
                "numberOfDependents": 0,
            },
            "bankingRelationships": {
                "currentBalance": 150000,
                "accountNumber": "001",
                "creditCardNumber": "CC-1",
                "creditLimit": 200000,
                "outstandingBalance": 40000,
                "memberSince": "2020-01-01",
                "loanLender": "Bank A",
            },
            "supportingDocuments": {
                "utilityBill": True,
                "bankStatements": True,
            },
            "enhancedDueDiligence": {
                "numberOfActiveLoans": 1,
            },
            "employmentInformation": {
                "employmentStatus": "Locally Employed",
                "totalYearsWorking": "5",
                "dateHired": "2020-01-01",
                "monthlyLivingExpenses": 25000,
            },
            "addressInformation": {
                "lengthOfStay": "5 years",
            },
            "collateralAssetDetails": {
                "brand": "Toyota",
                "year": "2026",
                "assetType": "Passenger vehicle",
                "appraisedValue": 1800000,
            },
            "productInformation": {
                "autoSellingPrice": 1800000,
                "autoVehicleClassification": "Passenger vehicle",
                "autoYearModel": "2026",
            },
        },
    }


def test_compute_quant_scores_returns_200_with_summary(client, subscriber_headers):
    """Test POST endpoint returns 200 with complete quant_scores summary."""
    response = client.post(
        "/api/loan-applications/compute-quant-scores",
        json=get_test_payload(),
        headers=subscriber_headers,
    )

    if response.status_code != 200:
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.json()}")

    assert response.status_code == 200
    data = response.json()

    # Verify response structure
    assert "message" in data
    assert "application_no" in data
    assert "quant_scores" in data

    # Verify quant_scores summary contains all required fields
    summary = data["quant_scores"]
    assert "creditScore" in summary
    assert "fraudScore" in summary
    assert "socialScore" in summary
    assert "psychometricScore" in summary
    assert "relationshipScore" in summary
    assert "profitabilityScore" in summary
    assert "overallScore" in summary
    assert "compositeScore" in summary
    assert "finalGrade" in summary
    assert "finalRating" in summary
    assert "decision" in summary

    # Verify types and ranges
    assert isinstance(summary["creditScore"], (int, float))
    assert isinstance(summary["fraudScore"], (int, float))
    assert isinstance(summary["overallScore"], (int, float))
    assert isinstance(summary["compositeScore"], (int, float))
    assert isinstance(summary["finalGrade"], str)
    assert isinstance(summary["finalRating"], str)
    assert summary["finalGrade"] in ["A++", "A+", "A", "B+", "B", "C+", "C", "D", "F"]
    assert summary["decision"] in ["APPROVE", "REVIEW", "DECLINE"]


def test_compute_quant_scores_persists_to_database(client, subscriber_headers):
    """Test that computed scores are persisted to database.
    
    SKIPPED: Requires active database connection with initialized schema.
    Run manually against staging/production database for full validation.
    """
    pytest.skip("Database persistence requires active PostgreSQL connection")


def test_get_loan_retrieves_persisted_scores(client, subscriber_headers):
    """Test that GET endpoint retrieves the persisted scores.
    
    SKIPPED: Requires active database connection with initialized schema.
    Run manually against staging/production database for full validation.
    """
    pytest.skip("Database retrieval requires active PostgreSQL connection")


def test_compute_quant_scores_deterministic_values(client, subscriber_headers):
    """Test that product-aware scoring returns the expected deterministic summary."""
    response = client.post(
        "/api/loan-applications/compute-quant-scores",
        json=get_test_payload(),
        headers=subscriber_headers,
    )

    assert response.status_code == 200
    summary = response.json()["quant_scores"]

    assert summary["creditScore"] == 89
    assert summary["fraudScore"] == 76
    assert summary["socialScore"] == 72
    assert summary["psychometricScore"] == 81
    assert summary["relationshipScore"] == 88
    assert summary["profitabilityScore"] == 79
    assert summary["overallScore"] == 85
    assert summary["compositeScore"] == 850
    assert summary["finalGrade"] == "A"
    assert summary["finalRating"] == "Excellent"
    assert summary["decision"] == "APPROVE"


def test_compute_quant_scores_missing_required_fields(client, subscriber_headers):
    """Test that endpoint handles missing required fields gracefully."""
    invalid_payload = {
        "borrower_name": "Test User",
        # Missing required fields like application_no, status, etc.
    }
    response = client.post(
        "/api/loan-applications/compute-quant-scores",
        json=invalid_payload,
        headers=subscriber_headers,
    )

    # Should return 422 (validation error) 
    assert response.status_code == 422


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
