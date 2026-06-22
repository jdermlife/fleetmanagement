import json
import os
from datetime import datetime, timedelta, timezone
from string import Template
from typing import Any

import requests
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models.notification import (
    Notification,
    NotificationChannel,
    NotificationDeliveryAttempt,
    NotificationDeadLetter,
    NotificationPreference,
    NotificationPriority,
    NotificationStatus,
    NotificationTemplate,
)
from app.services.email_service import send_email


SMS_PROVIDER = os.getenv("SMS_PROVIDER", "mock").lower()
WEBHOOK_TIMEOUT_SECONDS = float(os.getenv("WEBHOOK_TIMEOUT_SECONDS", "5"))
MAX_NOTIFICATION_ATTEMPTS = int(os.getenv("NOTIFICATION_MAX_ATTEMPTS", "5"))
NOTIFICATION_RETRY_BASE_SECONDS = int(os.getenv("NOTIFICATION_RETRY_BASE_SECONDS", "30"))


def _serialize_payload(payload: dict[str, Any] | None) -> str | None:
    if payload is None:
        return None
    return json.dumps(payload, default=str)


def _render_text(template: str | None, context: dict[str, Any]) -> str | None:
    if template is None:
        return None

    try:
        return Template(template).safe_substitute(**context)
    except Exception:
        return template


def _get_or_create_preference(db: Session, user_id: int, event_type: str) -> NotificationPreference:
    pref = db.query(NotificationPreference).filter(
        and_(
            NotificationPreference.user_id == user_id,
            NotificationPreference.event_type == event_type,
        )
    ).first()

    if pref:
        return pref

    pref = NotificationPreference(user_id=user_id, event_type=event_type)
    db.add(pref)
    db.flush()
    return pref


def queue_notification(
    db: Session,
    *,
    user_id: int,
    event_type: str,
    channel: NotificationChannel,
    title: str,
    message: str,
    priority: NotificationPriority = NotificationPriority.NORMAL,
    payload: dict[str, Any] | None = None,
    destination: str | None = None,
    source_table: str | None = None,
    source_record_id: str | None = None,
    created_by: str | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        event_type=event_type,
        channel=channel,
        priority=priority,
        title=title,
        message=message,
        payload=_serialize_payload(payload),
        status=NotificationStatus.QUEUED,
        attempts_count=0,
        max_attempts=MAX_NOTIFICATION_ATTEMPTS,
        next_attempt_at=datetime.now(timezone.utc),
        dead_lettered_at=None,
        dead_letter_reason=None,
        destination=destination,
        source_table=source_table,
        source_record_id=source_record_id,
        created_by=created_by,
    )
    db.add(notification)
    return notification


def queue_event_notifications(
    db: Session,
    *,
    event_type: str,
    recipients: list[dict[str, Any]],
    context: dict[str, Any],
    fallback_title: str,
    fallback_message: str,
    priority: NotificationPriority = NotificationPriority.NORMAL,
    source_table: str | None = None,
    source_record_id: str | None = None,
    created_by: str | None = None,
) -> list[Notification]:
    templates = db.query(NotificationTemplate).filter(
        and_(
            NotificationTemplate.event_type == event_type,
            NotificationTemplate.is_active == True,
        )
    ).all()

    notifications: list[Notification] = []

    for recipient in recipients:
        user_id = int(recipient["user_id"])
        pref = _get_or_create_preference(db, user_id, event_type)

        enabled_channels: set[NotificationChannel] = set()
        if pref.in_app_enabled:
            enabled_channels.add(NotificationChannel.IN_APP)
        if pref.email_enabled:
            enabled_channels.add(NotificationChannel.EMAIL)
        if pref.sms_enabled:
            enabled_channels.add(NotificationChannel.SMS)
        if pref.webhook_enabled:
            enabled_channels.add(NotificationChannel.WEBHOOK)

        template_by_channel = {template.channel: template for template in templates}

        for channel in enabled_channels:
            selected_template = template_by_channel.get(channel)

            title = _render_text(selected_template.subject_template if selected_template else fallback_title, context) or fallback_title
            message = _render_text(selected_template.body_template if selected_template else fallback_message, context) or fallback_message

            destination = None
            if channel == NotificationChannel.EMAIL:
                destination = recipient.get("email")
                if not destination:
                    continue
            elif channel == NotificationChannel.SMS:
                destination = recipient.get("phone")
                if not destination:
                    continue
            elif channel == NotificationChannel.WEBHOOK:
                destination = pref.webhook_url or recipient.get("webhook_url")
                if not destination:
                    continue

            notifications.append(
                queue_notification(
                    db,
                    user_id=user_id,
                    event_type=event_type,
                    channel=channel,
                    title=title,
                    message=message,
                    priority=priority,
                    payload=context,
                    destination=destination,
                    source_table=source_table,
                    source_record_id=source_record_id,
                    created_by=created_by,
                )
            )

    db.commit()
    return notifications


def _log_attempt(
    db: Session,
    *,
    notification_id: int,
    attempt_no: int,
    status: NotificationStatus,
    response: str | None,
    error_message: str | None,
) -> None:
    db.add(
        NotificationDeliveryAttempt(
            notification_id=notification_id,
            attempt_no=attempt_no,
            status=status,
            response=response,
            error_message=error_message,
        )
    )


def _send_sms(destination: str, message: str) -> str:
    if SMS_PROVIDER == "mock":
        return f"mock_sms_sent:{destination}"

    raise RuntimeError("SMS provider not configured")


def _send_webhook(destination: str, payload: dict[str, Any]) -> str:
    response = requests.post(destination, json=payload, timeout=WEBHOOK_TIMEOUT_SECONDS)
    if response.status_code >= 400:
        raise RuntimeError(f"Webhook failed with status {response.status_code}")
    return response.text[:1000]


def dispatch_queued_notifications(db: Session, limit: int = 100) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    queued = db.query(Notification).filter(
        and_(
            Notification.status.in_([NotificationStatus.QUEUED, NotificationStatus.FAILED]),
            Notification.dead_lettered_at.is_(None),
            Notification.attempts_count < Notification.max_attempts,
            or_(Notification.next_attempt_at.is_(None), Notification.next_attempt_at <= now),
        )
    ).order_by(Notification.priority.desc(), Notification.id.asc()).limit(limit).all()

    processed = 0
    sent = 0
    failed = 0

    for notification in queued:
        processed += 1
        attempt_no = db.query(func.count(NotificationDeliveryAttempt.id)).filter(
            NotificationDeliveryAttempt.notification_id == notification.id
        ).scalar() or 0
        attempt_no = int(attempt_no) + 1
        notification.attempts_count = int(notification.attempts_count or 0) + 1

        try:
            if notification.channel == NotificationChannel.IN_APP:
                response_text = "in_app_queued"
            elif notification.channel == NotificationChannel.EMAIL:
                if not notification.destination:
                    raise RuntimeError("Missing email destination")
                send_email(notification.destination, notification.title, notification.message)
                response_text = "email_sent"
            elif notification.channel == NotificationChannel.SMS:
                if not notification.destination:
                    raise RuntimeError("Missing phone destination")
                response_text = _send_sms(notification.destination, notification.message)
            elif notification.channel == NotificationChannel.WEBHOOK:
                if not notification.destination:
                    raise RuntimeError("Missing webhook destination")
                payload = {
                    "id": notification.id,
                    "event_type": notification.event_type,
                    "title": notification.title,
                    "message": notification.message,
                    "payload": json.loads(notification.payload) if notification.payload else {},
                }
                response_text = _send_webhook(notification.destination, payload)
            else:
                raise RuntimeError(f"Unsupported channel {notification.channel}")

            notification.status = NotificationStatus.SENT
            notification.sent_at = datetime.now(timezone.utc)
            notification.error_message = None
            sent += 1

            _log_attempt(
                db,
                notification_id=notification.id,
                attempt_no=attempt_no,
                status=NotificationStatus.SENT,
                response=response_text,
                error_message=None,
            )
        except Exception as exc:
            error_message = str(exc)
            notification.error_message = error_message
            failed += 1

            if int(notification.attempts_count or 0) >= int(notification.max_attempts or MAX_NOTIFICATION_ATTEMPTS):
                notification.status = NotificationStatus.CANCELLED
                notification.dead_lettered_at = datetime.now(timezone.utc)
                notification.dead_letter_reason = error_message

                existing_dead_letter = db.query(NotificationDeadLetter).filter(
                    NotificationDeadLetter.notification_id == notification.id
                ).first()
                if not existing_dead_letter:
                    db.add(
                        NotificationDeadLetter(
                            notification_id=notification.id,
                            event_type=notification.event_type,
                            channel=notification.channel,
                            destination=notification.destination,
                            final_error=error_message,
                            attempts_count=int(notification.attempts_count or 0),
                            payload_snapshot=notification.payload,
                        )
                    )
            else:
                notification.status = NotificationStatus.FAILED
                backoff_seconds = NOTIFICATION_RETRY_BASE_SECONDS * (2 ** max(0, attempt_no - 1))
                notification.next_attempt_at = datetime.now(timezone.utc).replace(microsecond=0)
                notification.next_attempt_at = notification.next_attempt_at + timedelta(seconds=backoff_seconds)

            _log_attempt(
                db,
                notification_id=notification.id,
                attempt_no=attempt_no,
                status=NotificationStatus.FAILED,
                response=None,
                error_message=error_message,
            )

    db.commit()
    return {"processed": processed, "sent": sent, "failed": failed}


def get_user_notifications(db: Session, user_id: int, limit: int = 50, offset: int = 0) -> list[Notification]:
    return db.query(Notification).filter(
        Notification.user_id == user_id
    ).order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()


def mark_notification_read(db: Session, notification_id: int, user_id: int) -> Notification | None:
    notification = db.query(Notification).filter(
        and_(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    ).first()

    if not notification:
        return None

    notification.status = NotificationStatus.READ
    notification.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notification)
    return notification


def mark_all_notifications_read(db: Session, user_id: int) -> int:
    notifications = db.query(Notification).filter(
        and_(
            Notification.user_id == user_id,
            Notification.status.in_([NotificationStatus.QUEUED, NotificationStatus.SENT]),
        )
    ).all()

    now = datetime.now(timezone.utc)
    for notification in notifications:
        notification.status = NotificationStatus.READ
        notification.read_at = now

    db.commit()
    return len(notifications)


def unread_count(db: Session, user_id: int) -> int:
    return int(
        db.query(func.count(Notification.id)).filter(
            and_(
                Notification.user_id == user_id,
                Notification.status.in_([NotificationStatus.QUEUED, NotificationStatus.SENT]),
            )
        ).scalar()
        or 0
    )


def list_dead_letters(db: Session, limit: int = 100, offset: int = 0) -> list[NotificationDeadLetter]:
    return db.query(NotificationDeadLetter).order_by(
        NotificationDeadLetter.dead_lettered_at.desc()
    ).offset(offset).limit(limit).all()


def requeue_dead_letter(db: Session, dead_letter_id: int) -> Notification | None:
    dead_letter = db.query(NotificationDeadLetter).filter(
        NotificationDeadLetter.id == dead_letter_id
    ).first()
    if not dead_letter:
        return None

    notification = db.query(Notification).filter(
        Notification.id == dead_letter.notification_id
    ).first()
    if not notification:
        return None

    notification.status = NotificationStatus.QUEUED
    notification.error_message = None
    notification.attempts_count = 0
    notification.next_attempt_at = datetime.now(timezone.utc)
    notification.dead_lettered_at = None
    notification.dead_letter_reason = None

    db.delete(dead_letter)
    db.commit()
    db.refresh(notification)
    return notification
