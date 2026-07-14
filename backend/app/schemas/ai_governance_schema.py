from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AIFeedbackRequest(BaseModel):
    request_id: int | None = None
    response_id: int | None = None
    rating: int = Field(..., ge=1, le=5)
    feedback_text: str | None = None


class AIFeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int | None
    response_id: int | None
    user_id: int | None
    rating: int
    feedback_text: str | None
    created_at: datetime


class AIGovernanceStatsResponse(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    total_cost: float
    total_tokens: int
    avg_latency_ms: float


class AIRequestAuditResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    endpoint: str
    prompt: str | None
    model: str
    cost: float
    input_tokens: int
    output_tokens: int
    total_tokens: int
    status: str
    error_message: str | None
    created_at: datetime


class AIResponseAuditResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int
    user_id: int | None
    model: str
    cost: float
    input_tokens: int
    output_tokens: int
    total_tokens: int
    latency_ms: int | None
    created_at: datetime


class CreditAdvisorRequest(BaseModel):
    product_type: str | None = None
    monthly_income: float | None = None
    debt_obligations: float | None = None
    loan_amount: float | None = None
    appraised_value: float | None = None
    dti: float | None = None
    dsr: float | None = None
    ltv: float | None = None
    final_score: float | None = None
    final_decision: str | None = None
    borrower_notes: str | None = None


class CreditAdvisorResponse(BaseModel):
    provider: str
    model: str
    advice: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    latency_ms: int


class CreditCardRiskCheckRequest(BaseModel):
    card_issuer: str
    card_number_bin: str = Field(..., min_length=6, max_length=8)
    card_number_last4: str = Field(..., min_length=4, max_length=4)
    card_number_length: int = Field(..., ge=13, le=19)
    luhn_valid: bool
    issuer_from_number: str | None = None
    issuer_matches_prefix: bool | None = None


class CreditCardRiskCheckResponse(BaseModel):
    provider: str
    model: str
    risk_level: str
    summary: str
    recommended_action: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    latency_ms: int

