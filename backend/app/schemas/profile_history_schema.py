import json
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, JsonValue, field_validator


MAX_HISTORY_PAYLOAD_BYTES = 2 * 1024 * 1024


class HistoryCategory(str, Enum):
    BUDGET_SNAPSHOT = "budget_snapshot"
    NET_WORTH_SNAPSHOT = "net_worth_snapshot"
    WEALTH_BUILDING_SCORE = "wealth_building_score"
    FINANCIAL_HEALTH_SCORE = "financial_health_score"
    CREDIT_HEALTH_SCORE = "credit_health_score"
    BILL_PAYMENT = "bill_payment"
    LOAN_MONITORING = "loan_monitoring"
    GOAL_TRACKING = "goal_tracking"
    AI_RECOMMENDATION = "ai_recommendation"
    CERTIFICATION = "certification"
    RISK_ASSESSMENT = "risk_assessment"


class ProfileHistoryCreate(BaseModel):
    category: HistoryCategory
    observed_at: datetime
    payload: JsonValue

    @field_validator("payload")
    @classmethod
    def limit_payload_size(cls, value: JsonValue) -> JsonValue:
        encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(encoded) > MAX_HISTORY_PAYLOAD_BYTES:
            raise ValueError("History payload exceeds the 2 MiB limit")
        return value


class ProfileHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_no: str
    category: HistoryCategory
    observed_at: datetime
    payload: JsonValue
    created_at: datetime


class ProfileHistoryListResponse(BaseModel):
    items: list[ProfileHistoryResponse]
    total: int = Field(ge=0)