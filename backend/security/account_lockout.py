from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone


# Configuration
MAX_FAILED_ATTEMPTS = int(os.getenv("MAX_FAILED_LOGIN_ATTEMPTS", "5"))
LOCKOUT_DURATION_MINUTES = int(os.getenv("ACCOUNT_LOCKOUT_DURATION_MINUTES", "15"))


def lock_account(connection, user_id: int) -> None:
    """Lock user account after max failed attempts."""
    try:
        locked_until = (
            datetime.now(timezone.utc)
            + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        ).isoformat()
        connection.execute(
            "UPDATE users SET locked_until = ? WHERE id = ?",
            (locked_until, user_id),
        )
    except Exception:
        pass


def unlock_account(connection, user_id: int) -> None:
    """Unlock user account (admin override or token-based)."""
    try:
        connection.execute(
            "UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = ?",
            (user_id,),
        )
    except Exception:
        pass


def is_account_locked(user: dict) -> bool:
    """Check if account is currently locked."""
    if not user or not user.get("locked_until"):
        return False
    
    try:
        locked_until = datetime.fromisoformat(user["locked_until"])
        now = datetime.now(timezone.utc)
        # Handle timezone-naive datetimes
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        return now < locked_until
    except (ValueError, TypeError):
        return False


def get_lockout_remaining_seconds(user: dict) -> int:
    """Get remaining lockout time in seconds."""
    if not user or not user.get("locked_until"):
        return 0
    
    try:
        locked_until = datetime.fromisoformat(user["locked_until"])
        now = datetime.now(timezone.utc)
        # Handle timezone-naive datetimes
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        remaining = (locked_until - now).total_seconds()
        return max(0, int(remaining))
    except (ValueError, TypeError):
        return 0


def increment_failed_attempts(connection, user_id: int) -> int:
    """Increment failed login attempts and return new count."""
    try:
        # First get current count
        result = connection.execute(
            "SELECT failed_login_attempts FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        
        current = result["failed_login_attempts"] if result else 0
        new_count = current + 1
        
        # Update
        connection.execute(
            "UPDATE users SET failed_login_attempts = ? WHERE id = ?",
            (new_count, user_id),
        )
        
        # Lock if exceeded max
        if new_count >= MAX_FAILED_ATTEMPTS:
            lock_account(connection, user_id)
        
        return new_count
    except Exception:
        return 0


def reset_failed_attempts(connection, user_id: int) -> None:
    """Reset failed attempts counter after successful login."""
    try:
        connection.execute(
            "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
            (user_id,),
        )
    except Exception:
        pass
