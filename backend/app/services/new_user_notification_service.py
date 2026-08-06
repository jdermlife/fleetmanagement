from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.users import User
from app.services.email_service import send_email


logger = logging.getLogger(__name__)

DEFAULT_ADMIN_RECIPIENTS = (
    "jdioneda@gmail.com",
    "jdioneda@quantech.international",
)


def _admin_recipients() -> tuple[str, ...]:
    configured = os.getenv("NEW_USER_ADMIN_NOTIFICATION_RECIPIENTS", "")
    recipients = tuple(item.strip() for item in configured.split(",") if item.strip())
    return recipients or DEFAULT_ADMIN_RECIPIENTS


def notify_admins_of_new_user(user: User, db: Session) -> datetime | None:
    recipients = _admin_recipients()
    created_at = user.created_at or datetime.now(timezone.utc)
    body = "\n".join(
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

    try:
        send_email(recipients, "FILSCORE - New user created", body)
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