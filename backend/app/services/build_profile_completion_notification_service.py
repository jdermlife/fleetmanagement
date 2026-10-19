from __future__ import annotations

import logging
import math
import os
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.users import User
from app.services.email_service import send_email


logger = logging.getLogger(__name__)

DEFAULT_RECIPIENT = "JDioneda@gmail.com"
COMPLETION_THRESHOLD = 90.0


def _recipient() -> str:
    return os.getenv("BUILD_PROFILE_COMPLETION_NOTIFICATION_RECIPIENT", "").strip() or DEFAULT_RECIPIENT


def notify_build_profile_completion(
    user_id: int,
    db: Session,
    *,
    completion_percent: object,
    profile_id: str,
) -> datetime | None:
    try:
        completion = float(completion_percent)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(completion) or completion < COMPLETION_THRESHOLD:
        return None

    user = db.get(User, user_id)
    if user is None or user.build_profile_90_notification_sent_at is not None:
        return None

    body = "\n".join(
        (
            "A FILSCORE account has completed at least 90% of the Build Profile form.",
            "",
            f"User ID: {user.id}",
            f"Username: {user.username}",
            f"Email: {user.email}",
            f"Profile ID: {profile_id or 'Not provided'}",
            f"Build Profile completion: {completion:.0f}%",
        )
    )

    try:
        send_email(_recipient(), "FILSCORE - Build Profile reached 90%", body)
        sent_at = datetime.now(timezone.utc)
        user.build_profile_90_notification_sent_at = sent_at
        db.commit()
        db.refresh(user)
        return sent_at
    except Exception:  # noqa: BLE001
        db.rollback()
        user.build_profile_90_notification_sent_at = None
        logger.exception(
            "Failed to send Build Profile completion notification for user_id=%s",
            user.id,
        )
        return None