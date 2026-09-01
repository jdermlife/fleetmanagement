from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, JsonValue


class ProfileMonthlySnapshotUpsert(BaseModel):
    profile_data: dict[str, JsonValue]
    source_profile_id: str | None = Field(default=None, max_length=128)
    source_application_no: str | None = Field(default=None, max_length=255)
    financial_health_score: float | None = None
    credit_health_score: float | None = None
    net_worth_positioning_score: float | None = None
    budget_tracking_score: float | None = None
    loan_monitoring_score: float | None = None
    bill_reminder_score: float | None = None
    financial_health_summary: dict[str, JsonValue] | None = None
    credit_health_summary: dict[str, JsonValue] | None = None
    net_worth_summary: dict[str, JsonValue] | None = None
    budget_tracking_summary: dict[str, JsonValue] | None = None
    loan_monitoring_summary: dict[str, JsonValue] | None = None
    bill_reminder_summary: dict[str, JsonValue] | None = None


class ProfileMonthlySnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    snapshot_month: date
    financial_health_score: float | None
    credit_health_score: float | None
    net_worth_positioning_score: float | None
    budget_tracking_score: float | None
    loan_monitoring_score: float | None
    bill_reminder_score: float | None
    financial_health_summary: dict[str, JsonValue] | None
    credit_health_summary: dict[str, JsonValue] | None
    net_worth_summary: dict[str, JsonValue] | None
    budget_tracking_summary: dict[str, JsonValue] | None
    loan_monitoring_summary: dict[str, JsonValue] | None
    bill_reminder_summary: dict[str, JsonValue] | None
    profile_data: dict[str, JsonValue]
    source_profile_id: str | None
    source_loan_application_id: int | None
    created_at: datetime
    updated_at: datetime


class ProfileMonthlySnapshotListResponse(BaseModel):
    items: list[ProfileMonthlySnapshotResponse]
    total: int = Field(ge=0)