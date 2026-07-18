from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class CreditScorePayload(BaseModel):
    character_score: float | None = None
    capacity_score: float | None = None
    capital_score: float | None = None
    collateral_score: float | None = None
    conditions_score: float | None = None
    bureau_score: float | None = None
    internal_score: float | None = None
    total_credit_score: float | None = None
    credit_grade: str | None = None
    model_version: str | None = None


class FraudScorePayload(BaseModel):
    identity_score: float | None = None
    document_score: float | None = None
    geo_location_score: float | None = None
    device_score: float | None = None
    duplicate_application_score: float | None = None
    overall_fraud_score: float | None = None
    fraud_risk_level: str | None = None
    fraud_flags: dict[str, Any] = Field(default_factory=dict)


class SocialScorePayload(BaseModel):
    residence_stability_score: float | None = None
    employment_stability_score: float | None = None
    family_stability_score: float | None = None
    education_score: float | None = None
    banking_relationship_score: float | None = None
    overall_social_score: float | None = None


class PsychometricScorePayload(BaseModel):
    discipline_score: float | None = None
    planning_score: float | None = None
    responsibility_score: float | None = None
    honesty_score: float | None = None
    resilience_score: float | None = None
    overall_psychometric_score: float | None = None
    questionnaire_answers: dict[str, Any] = Field(default_factory=dict)


class CreditBureauReportPayload(BaseModel):
    bureau_name: str | None = None
    bureau_score: float | None = None
    total_loans: int | None = None
    active_loans: int | None = None
    closed_loans: int | None = None
    delinquent_accounts: int | None = None
    defaulted_accounts: int | None = None
    outstanding_balance: float | None = None
    report_json: dict[str, Any] = Field(default_factory=dict)
    report_date: datetime | None = None


class CollateralScorePayload(BaseModel):
    ltv_score: float | None = None
    asset_quality_score: float | None = None
    marketability_score: float | None = None
    insurance_score: float | None = None
    overall_collateral_score: float | None = None


class ProfitabilityScorePayload(BaseModel):
    projected_interest_income: float | None = None
    fee_income: float | None = None
    expected_loss: float | None = None
    operating_cost: float | None = None
    funding_cost: float | None = None
    projected_profit: float | None = None
    profitability_score: float | None = None


class RelationshipScorePayload(BaseModel):
    customer_since: date | None = None
    number_of_accounts: int | None = None
    deposit_balance: float | None = None
    prior_loans: int | None = None
    relationship_score: float | None = None


class AIRecommendationPayload(BaseModel):
    recommendation: str | None = None
    confidence_score: float | None = None
    explanation: str | None = None
    suggested_amount: float | None = None
    ai_model: str | None = None


class OverallScorePayload(BaseModel):
    credit_score: float | None = None
    fraud_score: float | None = None
    social_score: float | None = None
    psychometric_score: float | None = None
    collateral_score: float | None = None
    profitability_score: float | None = None
    relationship_score: float | None = None
    final_score: float | None = None
    composite_score: float | None = None
    final_grade: str | None = None
    final_rating: str | None = None
    final_decision: str | None = None


class DecisionAuditTrailPayload(BaseModel):
    previous_status: str | None = None
    new_status: str | None = None
    remarks: str | None = None
    changed_by: str | None = None
    changed_at: datetime | None = None


class LoanApplicationCreate(BaseModel):
    application_no: str
    status: str
    product_type: str

    borrower_name: str
    email: str
    phone: str
    gov_id: str
    address: str

    monthly_income: float
    other_income: float
    debt_obligations: float

    loan_amount: float
    term_months: int
    interest_rate: float
    purpose: str

    vehicle_info: str
    appraised_value: float

    committee_remarks: str
    executive_approval: bool

    dti: float
    dsr: float
    ltv: float

    scorecard_total: int
    ai_probability: float

    requirements: dict[str, Any] = Field(default_factory=dict)

    credit_scores: CreditScorePayload = Field(default_factory=CreditScorePayload)
    fraud_scores: FraudScorePayload = Field(default_factory=FraudScorePayload)
    social_scores: SocialScorePayload = Field(default_factory=SocialScorePayload)
    psychometric_scores: PsychometricScorePayload = Field(
        default_factory=PsychometricScorePayload
    )
    credit_bureau_reports: CreditBureauReportPayload = Field(
        default_factory=CreditBureauReportPayload
    )
    collateral_scores: CollateralScorePayload = Field(
        default_factory=CollateralScorePayload
    )
    profitability_scores: ProfitabilityScorePayload = Field(
        default_factory=ProfitabilityScorePayload
    )
    relationship_scores: RelationshipScorePayload = Field(
        default_factory=RelationshipScorePayload
    )
    ai_recommendations: AIRecommendationPayload = Field(
        default_factory=AIRecommendationPayload
    )
    overall_scores: OverallScorePayload = Field(default_factory=OverallScorePayload)
    decision_audit_trail: list[DecisionAuditTrailPayload] = Field(default_factory=list)
