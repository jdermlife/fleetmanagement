from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.notification import (
    NEW_USER_ADMIN_NOTIFICATION_EVENT,
    Notification,
    NotificationChannel,
    NotificationPriority,
    NotificationStatus,
)
from app.models.users import User
from app.services.email_service import send_email


logger = logging.getLogger(__name__)

DEFAULT_ADMIN_RECIPIENTS = (
    "jdioneda@gmail.com",
    "jdioneda@quantech.international",
)
NEW_USER_ADMIN_NOTIFICATION_DELAY = timedelta(hours=3)


def _admin_recipients() -> tuple[str, ...]:
    configured = os.getenv("NEW_USER_ADMIN_NOTIFICATION_RECIPIENTS", "")
    recipients = tuple(item.strip() for item in configured.split(",") if item.strip())
    return recipients or DEFAULT_ADMIN_RECIPIENTS


def _notification_body(user: User, created_at: datetime) -> str:
    return "\n".join(
        (
            "A new FILSCORE user account has been created.",
            "",
            f"User ID: {user.id}",
            f"Username: {user.username}",
            f"Email: {user.email}",
            f"Role: {user.role}",
            f"Account created: {created_at.isoformat()}",
        )
    )


def queue_admin_notification_for_new_user(user: User, db: Session) -> Notification:
    created_at = user.created_at or datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    recipients = _admin_recipients()
    notification = Notification(
        user_id=user.id,
        event_type=NEW_USER_ADMIN_NOTIFICATION_EVENT,
        channel=NotificationChannel.EMAIL,
        priority=NotificationPriority.NORMAL,
        title="FILSCORE - New user created",
        message=_notification_body(user, created_at),
        payload=json.dumps({"recipients": recipients}),
        status=NotificationStatus.QUEUED,
        attempts_count=0,
        next_attempt_at=created_at + NEW_USER_ADMIN_NOTIFICATION_DELAY,
        destination=", ".join(recipients),
        source_table="users",
        source_record_id=str(user.id),
        created_by="apple-registration",
    )
    db.add(notification)
    return notification


def notify_admins_of_new_user(user: User, db: Session) -> datetime | None:
    recipients = _admin_recipients()
    created_at = user.created_at or datetime.now(timezone.utc)

    try:
        send_email(recipients, "FILSCORE - New user created", _notification_body(user, created_at))
        sent_at = datetime.now(timezone.utc)
        user.admin_user_notification_sent_at = sent_at
        db.commit()
        db.refresh(user)
        return sent_at
    except Exception:  # noqa: BLE001
        rollback = getattr(db, "rollback", None)
        if callable(rollback):
            rollback()
        user.admin_user_notification_sent_at = None
        logger.exception(
            "Failed to send new-user admin notification for user_id=%s",
            user.id,
        )
        return None