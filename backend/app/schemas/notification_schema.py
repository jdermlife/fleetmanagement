from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.notification import NotificationChannel, NotificationPriority, NotificationStatus


class NotificationTemplateCreate(BaseModel):
    name: str
    event_type: str
    channel: NotificationChannel
    subject_template: str | None = None
    body_template: str
    is_active: bool = True


class NotificationTemplateUpdate(BaseModel):
    subject_template: str | None = None
    body_template: str | None = None
    is_active: bool | None = None


class NotificationTemplateResponse(BaseModel):
    id: int
    name: str
    event_type: str
    channel: NotificationChannel
    subject_template: str | None
    body_template: str
    is_active: bool
    created_by: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationPreferenceUpdate(BaseModel):
    in_app_enabled: bool = True
    email_enabled: bool = False
    sms_enabled: bool = False
    webhook_enabled: bool = False
    webhook_url: str | None = None
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None


class NotificationPreferenceResponse(BaseModel):
    id: int
    user_id: int
    event_type: str
    in_app_enabled: bool
    email_enabled: bool
    sms_enabled: bool
    webhook_enabled: bool
    webhook_url: str | None
    quiet_hours_start: str | None
    quiet_hours_end: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationSendRecipient(BaseModel):
    user_id: int
    email: str | None = None
    phone: str | None = None
    webhook_url: str | None = None


class NotificationSendRequest(BaseModel):
    event_type: str
    title: str
    message: str
    recipients: list[NotificationSendRecipient]
    channels: list[NotificationChannel] = Field(default_factory=lambda: [NotificationChannel.IN_APP])
    priority: NotificationPriority = NotificationPriority.NORMAL
    payload: dict[str, Any] | None = None
    source_table: str | None = None
    source_record_id: str | None = None


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    event_type: str
    channel: NotificationChannel
    priority: NotificationPriority
    title: str
    message: str
    payload: str | None
    status: NotificationStatus
    error_message: str | None
    attempts_count: int
    max_attempts: int
    next_attempt_at: datetime | None
    dead_lettered_at: datetime | None
    dead_letter_reason: str | None
    destination: str | None
    source_table: str | None
    source_record_id: str | None
    created_by: str | None
    created_at: datetime
    sent_at: datetime | None
    read_at: datetime | None

    class Config:
        from_attributes = True


class NotificationDispatchResponse(BaseModel):
    processed: int
    sent: int
    failed: int


class NotificationReadResponse(BaseModel):
    success: bool
    notification_id: int
    read_at: datetime


class NotificationUnreadCountResponse(BaseModel):
    user_id: int
    unread_count: int


class NotificationDeadLetterResponse(BaseModel):
    id: int
    notification_id: int
    event_type: str
    channel: NotificationChannel
    destination: str | None
    final_error: str
    attempts_count: int
    payload_snapshot: str | None
    dead_lettered_at: datetime

    class Config:
        from_attributes = True
