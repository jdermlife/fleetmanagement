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

