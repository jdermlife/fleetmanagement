from __future__ import annotations

import os
import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.concurrency import run_in_threadpool

from app.fastapi_auth import require_roles
from app.services.email_service import send_email


router = APIRouter(prefix="/life-protect", tags=["Life Protect"])

_EMAIL_PATTERN = re.compile(
    r"^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?"
    r"(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$",
    re.IGNORECASE,
)


class LifeProtectAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    privacyConsent: str = Field(min_length=1, max_length=3)
    emailDeliveryConsent: str = Field(min_length=1, max_length=3)
    email: str = Field(min_length=3, max_length=254)
    fullName: str = Field(min_length=1, max_length=160)
    birthDate: str = Field(min_length=1, max_length=20)
    assessmentDate: str = Field(min_length=1, max_length=20)
    cityOfBirth: str = Field(min_length=1, max_length=120)
    contactNumber: str = Field(min_length=1, max_length=40)
    permanentAddress: str = Field(min_length=1, max_length=500)
    height: str = Field(min_length=1, max_length=20)
    weight: str = Field(min_length=1, max_length=20)
    hospitalized: str = Field(min_length=1, max_length=10)
    healthCondition: str = Field(min_length=1, max_length=2000)
    futurePriority: str = Field(min_length=1, max_length=160)
    goalAmount: str = Field(min_length=1, max_length=80)
    allocatedBudget: str = Field(min_length=1, max_length=80)
    growthPeriod: str = Field(min_length=1, max_length=80)
    healthConcern: str = Field(min_length=1, max_length=500)
    hasInsurance: str = Field(min_length=1, max_length=10)
    incomeSource: str = Field(min_length=1, max_length=80)
    occupation: str = Field(min_length=1, max_length=160)
    businessType: str = Field(default="", max_length=160)
    employerName: str = Field(default="", max_length=200)
    businessAddress: str = Field(default="", max_length=500)
    monthlyIncome: str = Field(min_length=1, max_length=40)
    monthlyExpenses: str = Field(min_length=1, max_length=40)
    netWorth: str = Field(min_length=1, max_length=40)
    fatherName: str = Field(min_length=1, max_length=160)
    fatherAge: str = Field(min_length=1, max_length=10)
    fatherHealth: str = Field(min_length=1, max_length=500)
    motherName: str = Field(min_length=1, max_length=160)
    motherAge: str = Field(min_length=1, max_length=10)
    motherHealth: str = Field(min_length=1, max_length=500)
    siblings: str = Field(min_length=1, max_length=3000)
    spouse: str = Field(min_length=1, max_length=2000)
    children: str = Field(min_length=1, max_length=3000)
    beneficiary1: str = Field(min_length=1, max_length=2000)
    beneficiary2: str = Field(min_length=1, max_length=2000)
    governmentIdType: str = Field(min_length=1, max_length=120)
    governmentIdNumber: str = Field(min_length=1, max_length=160)
    additionalAnswer: str = Field(min_length=1, max_length=3000)

    @field_validator("privacyConsent", "emailDeliveryConsent")
    @classmethod
    def validate_consent(cls, value: str) -> str:
        if value.lower() != "yes":
            raise ValueError("Consent is required")
        return "yes"

    @field_validator("email")
    @classmethod
    def validate_applicant_email(cls, value: str) -> str:
        return _validate_email(value)


class LifeProtectEmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    recipient_email: str = Field(min_length=3, max_length=254)
    assessment: LifeProtectAssessment

    @field_validator("recipient_email")
    @classmethod
    def validate_recipient_email(cls, value: str) -> str:
        return _validate_email(value)


def _validate_email(value: str) -> str:
    if "\r" in value or "\n" in value or not _EMAIL_PATTERN.fullmatch(value):
        raise ValueError("Enter a valid email address")
    return value


_ASSESSMENT_SECTIONS = (
    (
        "CONSENT",
        (
            ("Data privacy consent", "privacyConsent"),
            ("Email delivery consent", "emailDeliveryConsent"),
        ),
    ),
    (
        "PERSONAL INFORMATION",
        (
            ("Applicant email", "email"),
            ("Full name", "fullName"),
            ("Birth date", "birthDate"),
            ("Assessment date", "assessmentDate"),
            ("City of birth", "cityOfBirth"),
            ("Contact number", "contactNumber"),
            ("Permanent address", "permanentAddress"),
            ("Height (ft)", "height"),
            ("Weight (kg)", "weight"),
        ),
    ),
    (
        "HEALTH AND PROTECTION PRIORITIES",
        (
            ("Hospitalized or admitted within 5 years", "hospitalized"),
            ("Health condition", "healthCondition"),
            ("Future priority", "futurePriority"),
            ("Financial goal amount", "goalAmount"),
            ("Allocated budget", "allocatedBudget"),
            ("Growth period", "growthPeriod"),
            ("Primary health-security concern", "healthConcern"),
            ("Insurance currently in force", "hasInsurance"),
        ),
    ),
    (
        "FINANCIAL CAPACITY",
        (
            ("Source of income", "incomeSource"),
            ("Occupation", "occupation"),
            ("Type of business", "businessType"),
            ("Employer", "employerName"),
            ("Business address", "businessAddress"),
            ("Estimated monthly income", "monthlyIncome"),
            ("Estimated monthly expenses", "monthlyExpenses"),
            ("Estimated net worth", "netWorth"),
        ),
    ),
    (
        "FAMILY AND BENEFICIARIES",
        (
            ("Father", "fatherName"),
            ("Father age", "fatherAge"),
            ("Father health condition", "fatherHealth"),
            ("Mother", "motherName"),
            ("Mother age", "motherAge"),
            ("Mother health condition", "motherHealth"),
            ("Siblings", "siblings"),
            ("Spouse", "spouse"),
            ("Children", "children"),
            ("Beneficiary 1", "beneficiary1"),
            ("Beneficiary 2", "beneficiary2"),
            ("Government ID type", "governmentIdType"),
            ("Government ID number", "governmentIdNumber"),
            ("Other information", "additionalAnswer"),
        ),
    ),
)


def format_life_protect_email(assessment: LifeProtectAssessment) -> str:
    lines = [
        "FILSCORE LIFE PROTECT",
        "Financial Planning & Need Analysis - Pre-assessment",
        "",
        "This message contains personal and sensitive personal information supplied with explicit email-delivery consent.",
    ]
    for section_title, fields in _ASSESSMENT_SECTIONS:
        lines.extend(("", section_title, "-" * len(section_title)))
        for label, field_name in fields:
            value = getattr(assessment, field_name)
            lines.append(f"{label}: {value or 'Not provided'}")
    return "\n".join(lines)


def _smtp_is_configured() -> bool:
    return all(
        os.getenv(name)
        for name in ("SMTP_SERVER", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD")
    )


@router.post(
    "/pre-assessment/email",
    dependencies=[
        Depends(
            require_roles(
                "Admin",
                "Manager",
                "Subscriber",
                "subscriber_lender",
                "subscriber_borrower",
                "borrower",
            )
        )
    ],
)
async def email_pre_assessment(payload: LifeProtectEmailRequest) -> dict[str, str]:
    if not _smtp_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email delivery is not configured",
        )

    subject_name = " ".join(payload.assessment.fullName.splitlines()).strip()
    subject = f"FILSCORE Life Protect Pre-assessment - {subject_name}"
    body = format_life_protect_email(payload.assessment)

    try:
        await run_in_threadpool(
            send_email,
            payload.recipient_email,
            subject,
            body,
            sender_name="FILSCORE FINANCIAL HEALTH",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email delivery failed. Please try again later.",
        ) from exc

    return {"message": f"Pre-assessment emailed to {payload.recipient_email}"}
