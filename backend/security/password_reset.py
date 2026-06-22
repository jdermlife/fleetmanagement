from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone


# Configuration
PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRY_MINUTES", "30"))


def generate_reset_token() -> str:
    """Generate a secure random token for password reset."""
    return secrets.token_urlsafe(32)


def hash_reset_token(token: str) -> str:
    """Hash reset token for storage (similar to passwords)."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_password_reset_request(connection, user_id: int) -> str:
    """Create a password reset token for user."""
    token = generate_reset_token()
    hashed_token = hash_reset_token(token)
    
    expires_at = (
        datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRY_MINUTES)
    ).isoformat()
    
    try:
        connection.execute(
            "UPDATE users SET password_reset_token = ?, password_reset_token_expires = ? WHERE id = ?",
            (hashed_token, expires_at, user_id),
        )
    except Exception:
        pass
    
    return token


def validate_reset_token(connection, user_id: int, token: str) -> bool:
    """Validate that reset token matches and hasn't expired."""
    try:
        user = connection.execute(
            "SELECT password_reset_token, password_reset_token_expires FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        
        if not user or not user.get("password_reset_token"):
            return False
        
        # Check expiry
        expires_at = datetime.fromisoformat(user["password_reset_token_expires"])
        now = datetime.now(timezone.utc)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if now > expires_at:
            return False
        
        # Check token
        hashed_provided = hash_reset_token(token)
        return hashed_provided == user["password_reset_token"]
    except Exception:
        return False


def reset_password(connection, user_id: int, new_password_hash: str) -> bool:
    """Reset password and clear reset token."""
    try:
        from .auth import hash_password
        
        connection.execute(
            "UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_token_expires = NULL WHERE id = ?",
            (new_password_hash, user_id),
        )
        return True
    except Exception:
        return False


def clear_reset_token(connection, user_id: int) -> None:
    """Clear any pending reset tokens for user."""
    try:
        connection.execute(
            "UPDATE users SET password_reset_token = NULL, password_reset_token_expires = NULL WHERE id = ?",
            (user_id,),
        )
    except Exception:
        pass
