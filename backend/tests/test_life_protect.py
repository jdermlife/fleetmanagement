import asyncio

import pytest
from pydantic import ValidationError

from app.routes import life_protect


def assessment_values() -> dict[str, str]:
    return {
        "privacyConsent": "yes",
        "emailDeliveryConsent": "yes",
        "email": "applicant@example.com",
        "fullName": "Test Applicant",
        "birthDate": "1990-01-01",
        "assessmentDate": "2026-10-06",
        "cityOfBirth": "Manila",
        "contactNumber": "+63 900 000 0000",
        "permanentAddress": "Test Address",
        "height": "5.7",
        "weight": "70",
        "hospitalized": "No",
        "healthCondition": "None declared",
        "futurePriority": "Worry-Free Retirement Fund",
        "goalAmount": "1,000,000 - 5,000,000",
        "allocatedBudget": "5,000 - 10,000",
        "growthPeriod": "10 years and above",
        "healthConcern": "Losing my income because of disability",
        "hasInsurance": "No",
        "incomeSource": "Employed",
        "occupation": "Analyst",
        "businessType": "",
        "employerName": "Test Employer",
        "businessAddress": "",
        "monthlyIncome": "100000",
        "monthlyExpenses": "50000",
        "netWorth": "2000000",
        "fatherName": "Test Father",
        "fatherAge": "65",
        "fatherHealth": "Good",
        "motherName": "Test Mother",
        "motherAge": "63",
        "motherHealth": "Good",
        "siblings": "One sibling, age 30, good health",
        "spouse": "Not applicable",
        "children": "Not applicable",
        "beneficiary1": "Direct family beneficiary details",
        "beneficiary2": "Not applicable",
        "governmentIdType": "Passport",
        "governmentIdNumber": "TEST-123",
        "additionalAnswer": "No additional information",
    }


def test_email_pre_assessment_sends_complete_plain_text_body(monkeypatch) -> None:
    for name, value in {
        "SMTP_SERVER": "smtp.example.com",
        "SMTP_PORT": "587",
        "SMTP_USERNAME": "mailer@example.com",
        "SMTP_PASSWORD": "secret",
    }.items():
        monkeypatch.setenv(name, value)

    deliveries: list[tuple[str, str, str]] = []
    monkeypatch.setattr(
        life_protect,
        "send_email",
        lambda recipient, subject, body: deliveries.append((recipient, subject, body)),
    )
    payload = life_protect.LifeProtectEmailRequest(
        recipient_email="advisor@example.com",
        assessment=assessment_values(),
    )

    result = asyncio.run(life_protect.email_pre_assessment(payload))

    assert result == {"message": "Pre-assessment emailed to advisor@example.com"}
    recipient, subject, body = deliveries[0]
    assert recipient == "advisor@example.com"
    assert subject == "FILSCORE Life Protect Pre-assessment - Test Applicant"
    assert "Applicant email: applicant@example.com" in body
    assert "Government ID number: TEST-123" in body
    assert "Other information: No additional information" in body


def test_assessment_requires_email_delivery_consent() -> None:
    values = assessment_values()
    values["emailDeliveryConsent"] = ""

    with pytest.raises(ValidationError):
        life_protect.LifeProtectAssessment(**values)


def test_assessment_rejects_unknown_fields() -> None:
    values = assessment_values()
    values["unexpected"] = "not allowed"

    with pytest.raises(ValidationError):
        life_protect.LifeProtectAssessment(**values)
