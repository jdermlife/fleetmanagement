from enum import Enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)

from app.database import Base


class NotificationChannel(str, Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    WEBHOOK = "webhook"


class NotificationStatus(str, Enum):
    QUEUED = "queued"
    SENT = "sent"
    FAILED = "failed"
    READ = "read"
    CANCELLED = "cancelled"


class NotificationPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True)
    event_type = Column(String(120), nullable=False)
    channel = Column(SQLEnum(NotificationChannel), nullable=False)
    subject_template = Column(String(255), nullable=True)
    body_template = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("idx_notification_templates_event_channel", "event_type", "channel"),
    )


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    event_type = Column(String(120), nullable=False)
    in_app_enabled = Column(Boolean, default=True, nullable=False)
    email_enabled = Column(Boolean, default=False, nullable=False)
    sms_enabled = Column(Boolean, default=False, nullable=False)
    webhook_enabled = Column(Boolean, default=False, nullable=False)
    webhook_url = Column(String(500), nullable=True)
    quiet_hours_start = Column(String(5), nullable=True)
    quiet_hours_end = Column(String(5), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "event_type", name="uq_notification_pref_user_event"),
        Index("idx_notification_preferences_user", "user_id"),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    event_type = Column(String(120), nullable=False)
    channel = Column(SQLEnum(NotificationChannel), nullable=False)
    priority = Column(SQLEnum(NotificationPriority), default=NotificationPriority.NORMAL, nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    payload = Column(Text, nullable=True)
    status = Column(SQLEnum(NotificationStatus), default=NotificationStatus.QUEUED, nullable=False)
    error_message = Column(Text, nullable=True)
    attempts_count = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=5, nullable=False)
    next_attempt_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    dead_lettered_at = Column(DateTime(timezone=True), nullable=True)
    dead_letter_reason = Column(Text, nullable=True)
    destination = Column(String(500), nullable=True)
    source_table = Column(String(120), nullable=True)
    source_record_id = Column(String(120), nullable=True)
    created_by = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_notifications_user_created", "user_id", "created_at"),
        Index("idx_notifications_status", "status"),
        Index("idx_notifications_next_attempt", "next_attempt_at"),
        Index("idx_notifications_event", "event_type"),
        Index("idx_notifications_source", "source_table", "source_record_id"),
    )


class NotificationDeliveryAttempt(Base):
    __tablename__ = "notification_delivery_attempts"

    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(Integer, nullable=False)
    attempt_no = Column(Integer, nullable=False)
    status = Column(SQLEnum(NotificationStatus), nullable=False)
    response = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_notification_attempts_notification", "notification_id", "attempt_no"),
    )


class NotificationDeadLetter(Base):
    __tablename__ = "notification_dead_letters"

    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(Integer, nullable=False, unique=True)
    event_type = Column(String(120), nullable=False)
    channel = Column(SQLEnum(NotificationChannel), nullable=False)
    destination = Column(String(500), nullable=True)
    final_error = Column(Text, nullable=False)
    attempts_count = Column(Integer, nullable=False)
    payload_snapshot = Column(Text, nullable=True)
    dead_lettered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_notification_dead_letters_notification", "notification_id"),
        Index("idx_notification_dead_letters_created", "dead_lettered_at"),
    )
