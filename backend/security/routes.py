from __future__ import annotations

import os
from contextlib import closing
from datetime import datetime, timezone

try:
    from .auth import hash_password, verify_password, create_token, decode_token, TokenError
    from .rbac import Role
    from ..app.models import get_connection, row_to_user
except ImportError:
    from security.auth import hash_password, verify_password, create_token, decode_token, TokenError
    from security.rbac import Role
    from app.models import get_connection, row_to_user


def register_auth_routes(app):
    from flask import request, jsonify
    
    @app.post("/auth/login")
    def login():
        from .account_lockout import is_account_locked, increment_failed_attempts, reset_failed_attempts, get_lockout_remaining_seconds
        
        data = request.get_json(silent=True) or {}
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", ""))
        
        if not username or not password:
            return jsonify({"error": "Username and password are required."}), 400
        
        config = app.config.get("DATABASE_CONFIG")
        with closing(get_connection(config)) as connection:
            user = connection.execute(
                "SELECT id, username, email, password_hash, role, is_active, locked_until, failed_login_attempts FROM users WHERE username = ? OR email = ?",
                (username, username)
            ).fetchone()
            
            if not user:
                return jsonify({"error": "Invalid credentials."}), 401
            
            # Check account lockout
            if is_account_locked(user):
                remaining = get_lockout_remaining_seconds(user)
                return jsonify({
                    "error": f"Account is locked. Try again in {remaining} seconds.",
                    "code": "account_locked"
                }), 423
            
            if not user["is_active"]:
                return jsonify({"error": "Account is disabled."}), 401
            
            if not verify_password(password, user["password_hash"]):
                # Increment failed attempts on wrong password
                with connection:
                    increment_failed_attempts(connection, user["id"])
                return jsonify({"error": "Invalid credentials."}), 401
            
            # Successful login - reset failed attempts and update last login
            with connection:
                reset_failed_attempts(connection, user["id"])
                connection.execute(
                    "UPDATE users SET last_login_at = ? WHERE id = ?",
                    (datetime.now(timezone.utc).isoformat(), user["id"])
                )
            
            token = create_token(
                user_id=user["id"],
                username=user["username"],
                role=user["role"]
            )
            
            return jsonify({
                "token": token,
                "user": row_to_user(user),
            })

    @app.post("/auth/logout")
    def logout():
        return jsonify({"status": "logged out"})

    @app.get("/auth/me")
    def get_current_user():
        try:
            from flask import g
            from security.auth import token_required
            
            @token_required
            def decorated():
                return jsonify({"user": g.get("current_user", {})})
            return decorated()
        except Exception:
            from flask import request, jsonify
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return jsonify({"error": "Authentication required."}), 401
            return jsonify({"error": "Invalid token."}), 401

    @app.post("/auth/register")
    def register():
        data = request.get_json(silent=True) or {}
        username = str(data.get("username", "")).strip()
        email = str(data.get("email", "")).strip()
        password = str(data.get("password", ""))
        
        if not username or not email or not password:
            return jsonify({"error": "Username, email, and password are required."}), 400
        
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters."}), 400
        
        config = app.config.get("DATABASE_CONFIG")
        password_hash = hash_password(password)
        
        try:
            with closing(get_connection(config)) as connection:
                with connection:
                    row = connection.execute(
                        "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
                        (username, email, password_hash, Role.VIEWER.value)
                    ).fetchone()
                    
                    user = connection.execute(
                        "SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE id = ?",
                        (row["id"],)
                    ).fetchone()
                    
            return jsonify(row_to_user(user)), 201
        except Exception as e:
            if "UNIQUE constraint" in str(e) or "duplicate key" in str(e):
                return jsonify({"error": "Username or email already exists."}), 409
            raise

    @app.post("/auth/refresh")
    def refresh_token():
        from flask import request, jsonify
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Invalid token."}), 401
        
        token = auth_header[7:]
        try:
            from security.auth import decode_token, create_token
            payload = decode_token(token)
            new_token = create_token(payload.sub, payload.username, payload.role)
            return jsonify({"token": new_token})
        except TokenError:
            return jsonify({"error": "Invalid or expired token."}), 401

    @app.post("/auth/password-reset-request")
    def password_reset_request():
        """Request a password reset token (email would be sent in production)."""
        from .password_reset import create_password_reset_request
        
        data = request.get_json(silent=True) or {}
        email_or_username = str(data.get("email_or_username", "")).strip()
        
        if not email_or_username:
            return jsonify({"error": "Email or username is required."}), 400
        
        config = app.config.get("DATABASE_CONFIG")
        with closing(get_connection(config)) as connection:
            user = connection.execute(
                "SELECT id, username, email FROM users WHERE email = ? OR username = ?",
                (email_or_username, email_or_username)
            ).fetchone()
            
            if not user:
                # Don't reveal if user exists (security best practice)
                return jsonify({"message": "If the account exists, a reset link will be sent to the registered email."}), 200
            
            # Generate reset token
            with connection:
                reset_token = create_password_reset_request(connection, user["id"])
            
            # In production, send email with reset link containing token
            # For now, return token in response (development only - use env flag in production)
            if os.getenv("ENVIRONMENT") == "development":
                return jsonify({
                    "message": "Password reset token generated",
                    "reset_token": reset_token,  # Only in development!
                    "user_id": user["id"]
                }), 200
            
            return jsonify({"message": "If the account exists, a reset link will be sent to the registered email."}), 200

    @app.post("/auth/password-reset-confirm")
    def password_reset_confirm():
        """Confirm password reset with token and new password."""
        from .password_reset import validate_reset_token, reset_password
        
        data = request.get_json(silent=True) or {}
        user_id = data.get("user_id")
        reset_token = str(data.get("reset_token", "")).strip()
        new_password = str(data.get("new_password", ""))
        
        if not user_id or not reset_token or not new_password:
            return jsonify({"error": "User ID, reset token, and new password are required."}), 400
        
        if len(new_password) < 8:
            return jsonify({"error": "Password must be at least 8 characters."}), 400
        
        config = app.config.get("DATABASE_CONFIG")
        with closing(get_connection(config)) as connection:
            # Validate reset token
            if not validate_reset_token(connection, user_id, reset_token):
                return jsonify({"error": "Invalid or expired reset token."}), 401
            
            # Hash new password and reset
            new_password_hash = hash_password(new_password)
            with connection:
                if reset_password(connection, user_id, new_password_hash):
                    # Also unlock account if locked
                    from .account_lockout import unlock_account
                    unlock_account(connection, user_id)
            
            return jsonify({"message": "Password has been reset successfully."}), 200

    @app.post("/auth/password-change")
    def password_change():
        """Change password for authenticated user (requires current password)."""
        from flask import g
        from .auth import token_required
        
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication required."}), 401
        
        token = auth_header[7:]
        try:
            payload = decode_token(token)
        except TokenError:
            return jsonify({"error": "Invalid or expired token."}), 401
        
        data = request.get_json(silent=True) or {}
        current_password = str(data.get("current_password", ""))
        new_password = str(data.get("new_password", ""))
        
        if not current_password or not new_password:
            return jsonify({"error": "Current password and new password are required."}), 400
        
        if len(new_password) < 8:
            return jsonify({"error": "New password must be at least 8 characters."}), 400
        
        if current_password == new_password:
            return jsonify({"error": "New password must be different from current password."}), 400
        
        config = app.config.get("DATABASE_CONFIG")
        with closing(get_connection(config)) as connection:
            user = connection.execute(
                "SELECT id, password_hash FROM users WHERE id = ?",
                (payload.sub,)
            ).fetchone()
            
            if not user:
                return jsonify({"error": "User not found."}), 404
            
            # Verify current password
            if not verify_password(current_password, user["password_hash"]):
                return jsonify({"error": "Current password is incorrect."}), 401
            
            # Update to new password
            new_password_hash = hash_password(new_password)
            with connection:
                connection.execute(
                    "UPDATE users SET password_hash = ? WHERE id = ?",
                    (new_password_hash, payload.sub)
                )
            
            return jsonify({"message": "Password has been changed successfully."}), 200

    @app.post("/auth/unlock-account")
    def unlock_account_endpoint():
        """Admin endpoint to unlock a user account."""
        from flask import g
        from .account_lockout import unlock_account as unlock_user
        
        # Check if requester is admin
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication required."}), 401
        
        token = auth_header[7:]
        try:
            payload = decode_token(token)
            if payload.role != Role.ADMIN.value:
                return jsonify({"error": "Only admins can unlock accounts."}), 403
        except TokenError:
            return jsonify({"error": "Invalid or expired token."}), 401
        
        data = request.get_json(silent=True) or {}
        target_user_id = data.get("user_id")
        
        if not target_user_id:
            return jsonify({"error": "User ID is required."}), 400
        
        config = app.config.get("DATABASE_CONFIG")
        with closing(get_connection(config)) as connection:
            user = connection.execute(
                "SELECT id FROM users WHERE id = ?",
                (target_user_id,)
            ).fetchone()
            
            if not user:
                return jsonify({"error": "User not found."}), 404
            
            with connection:
                unlock_user(connection, target_user_id)
            
            return jsonify({"message": "Account has been unlocked."}), 200