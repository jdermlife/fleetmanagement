from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import secrets
import struct
from contextlib import closing
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from typing import Callable
from urllib.parse import quote

from flask import Flask, current_app, g, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from .models import (
        get_connection,
        init_db,
        row_to_audit_log,
        row_to_fuel_log,
        row_to_mfa_recovery_request,
        row_to_user,
        row_to_vehicle,
    )
except ImportError:
    from models import (
        get_connection,
        init_db,
        row_to_audit_log,
        row_to_fuel_log,
        row_to_mfa_recovery_request,
        row_to_user,
        row_to_vehicle,
    )


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATABASE_PATH = BASE_DIR / "fms.db"
ROLE_ORDER = {"viewer": 1, "manager": 2, "admin": 3}
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]{3,32}$")


def create_app(test_config: dict[str, object] | None = None) -> Flask:
    app = Flask(__name__)
    CORS(app)
    app.config.from_mapping(
        DATABASE_PATH=str(DEFAULT_DATABASE_PATH),
        TOKEN_TTL_HOURS=int(os.getenv("FMS_TOKEN_TTL_HOURS", "12")),
        MFA_ISSUER=os.getenv("FMS_MFA_ISSUER", "Fleet Management System"),
        BOOTSTRAP_ADMIN_USERNAME=os.getenv("FMS_ADMIN_USERNAME", "").strip() or None,
        BOOTSTRAP_ADMIN_PASSWORD=os.getenv("FMS_ADMIN_PASSWORD", "").strip() or None,
        BOOTSTRAP_ADMIN_ROLE=(os.getenv("FMS_ADMIN_ROLE", "admin").strip() or "admin").lower(),
    )

    if test_config:
        app.config.update(test_config)

    init_db(app.config["DATABASE_PATH"])
    _seed_admin_from_config(app)

    def require_auth(minimum_role: str):
        def decorator(view: Callable):
            @wraps(view)
            def wrapped(*args, **kwargs):
                token = _extract_bearer_token()
                if not token:
                    return jsonify({"error": "Authentication is required."}), 401

                user_row, token_hash = _load_authenticated_user(current_app, token)
                if not user_row:
                    return jsonify({"error": "Your session is invalid or has expired."}), 401

                current_user = row_to_user(user_row)
                if ROLE_ORDER[str(current_user["role"])] < ROLE_ORDER[minimum_role]:
                    return jsonify({"error": "You do not have permission to perform that action."}), 403

                g.current_user = current_user
                g.current_token_hash = token_hash
                return view(*args, **kwargs)

            return wrapped

        return decorator

    @app.get("/health")
    def health_check():
        return jsonify({"status": "ok"})

    @app.get("/auth/bootstrap-status")
    def bootstrap_status():
        return jsonify({"requiresBootstrap": _count_users(app) == 0})

    @app.post("/auth/bootstrap")
    def bootstrap_admin():
        if _count_users(app) > 0:
            return jsonify({"error": "Bootstrap has already been completed."}), 409

        data = _get_json_payload()
        validation_error = _validate_user_payload(data, allow_missing_role=True)
        if validation_error:
            return jsonify({"error": validation_error}), 400

        username = str(data["username"]).strip()
        password = str(data["password"])
        role = "admin"

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            with connection:
                cursor = connection.execute(
                    """
                    INSERT INTO users (username, password_hash, role, is_active)
                    VALUES (?, ?, ?, 1)
                    """,
                    (username, generate_password_hash(password), role),
                )
                user_row = connection.execute(
                    """
                    SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                    FROM users
                    WHERE id = ?
                    """,
                    (cursor.lastrowid,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=user_row["id"],
                    action="auth.bootstrap",
                    entity_type="user",
                    entity_id=user_row["id"],
                    details=f"Bootstrapped initial admin account {username}.",
                )
                token = _issue_token(connection, user_row["id"], app.config["TOKEN_TTL_HOURS"])

        return jsonify({"token": token, "user": row_to_user(user_row)}), 201

    @app.post("/auth/mfa/recovery-request")
    def create_mfa_recovery_request():
        if _count_users(app) == 0:
            return jsonify({"error": "Bootstrap an admin account before requesting MFA recovery."}), 409

        data = _get_json_payload()
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", ""))
        reason = str(data.get("reason", "")).strip()

        if not username or not password:
            return jsonify({"error": "Username and password are required."}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            user_row = connection.execute(
                """
                SELECT id, username, password_hash, role, is_active, mfa_secret, mfa_enabled,
                       deactivated_at, created_at
                FROM users
                WHERE username = ?
                """,
                (username,),
            ).fetchone()
            if not user_row or not check_password_hash(user_row["password_hash"], password):
                return jsonify({"error": "Invalid username or password."}), 401
            if not user_row["is_active"]:
                return jsonify({"error": "This account has been deactivated. Contact an administrator."}), 403
            if not user_row["mfa_enabled"]:
                return jsonify({"error": "MFA is not enabled for this account."}), 400

            existing_request = connection.execute(
                """
                SELECT id
                FROM mfa_recovery_requests
                WHERE user_id = ?
                  AND status = 'pending'
                """,
                (user_row["id"],),
            ).fetchone()
            if existing_request:
                return jsonify({"error": "A recovery request is already pending for this account."}), 409

            with connection:
                cursor = connection.execute(
                    """
                    INSERT INTO mfa_recovery_requests (user_id, reason, status)
                    VALUES (?, ?, 'pending')
                    """,
                    (user_row["id"], reason),
                )
                recovery_request = connection.execute(
                    """
                    SELECT mfa_recovery_requests.id, mfa_recovery_requests.user_id, mfa_recovery_requests.reason,
                           mfa_recovery_requests.status, mfa_recovery_requests.requested_at,
                           mfa_recovery_requests.processed_at, users.username, users.role,
                           approver.username AS processed_by_username
                    FROM mfa_recovery_requests
                    JOIN users ON users.id = mfa_recovery_requests.user_id
                    LEFT JOIN users AS approver ON approver.id = mfa_recovery_requests.processed_by_user_id
                    WHERE mfa_recovery_requests.id = ?
                    """,
                    (cursor.lastrowid,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=user_row["id"],
                    action="auth.mfa-recovery-request",
                    entity_type="user",
                    entity_id=user_row["id"],
                    details=f"Created MFA recovery request for {username}.",
                )

        return jsonify(row_to_mfa_recovery_request(recovery_request)), 201

    @app.post("/auth/login")
    def login():
        if _count_users(app) == 0:
            return jsonify({"error": "Bootstrap an admin account before signing in."}), 409

        data = _get_json_payload()
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", ""))
        otp_code = str(data.get("otpCode", "")).strip()
        backup_code = str(data.get("backupCode", "")).strip()
        if not username or not password:
            return jsonify({"error": "Username and password are required."}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            user_row = connection.execute(
                """
                SELECT id, username, password_hash, role, is_active, mfa_secret, mfa_enabled,
                       deactivated_at, created_at
                FROM users
                WHERE username = ?
                """,
                (username,),
            ).fetchone()
            if not user_row:
                return jsonify({"error": "Invalid username or password."}), 401

            if not user_row["is_active"]:
                return jsonify({"error": "This account has been deactivated. Contact an administrator."}), 403

            if not check_password_hash(user_row["password_hash"], password):
                return jsonify({"error": "Invalid username or password."}), 401

            if user_row["mfa_enabled"]:
                if not otp_code and not backup_code:
                    return jsonify({"error": "MFA code required.", "mfaRequired": True}), 401

            with connection:
                used_backup_code = False
                if user_row["mfa_enabled"]:
                    if otp_code:
                        if not _verify_totp_code(user_row["mfa_secret"], otp_code):
                            return jsonify({"error": "Invalid MFA code.", "mfaRequired": True}), 401
                    elif backup_code:
                        if not _consume_backup_code(connection, user_row["id"], backup_code):
                            return jsonify({"error": "Invalid backup code.", "mfaRequired": True}), 401
                        used_backup_code = True

                token = _issue_token(connection, user_row["id"], app.config["TOKEN_TTL_HOURS"])
                _log_audit_event(
                    connection,
                    actor_user_id=user_row["id"],
                    action="auth.backup-code-login" if used_backup_code else "auth.login",
                    entity_type="session",
                    details=(
                        f"Signed in as {username} using a backup recovery code."
                        if used_backup_code
                        else f"Signed in as {username}."
                    ),
                )

        return jsonify({"token": token, "user": row_to_user(user_row)})

    @app.post("/auth/change-password")
    @require_auth("viewer")
    def change_password():
        data = _get_json_payload()
        current_password = str(data.get("currentPassword", ""))
        new_password = str(data.get("newPassword", ""))

        if not current_password:
            return jsonify({"error": "Current password is required."}), 400

        password_error = _validate_password(new_password)
        if password_error:
            return jsonify({"error": password_error}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            user_row = connection.execute(
                """
                SELECT id, username, password_hash, role, is_active, mfa_secret, mfa_enabled,
                       deactivated_at, created_at
                FROM users
                WHERE id = ?
                """,
                (g.current_user["id"],),
            ).fetchone()
            if not user_row or not check_password_hash(user_row["password_hash"], current_password):
                return jsonify({"error": "Current password is incorrect."}), 400

            with connection:
                connection.execute(
                    """
                    UPDATE users
                    SET password_hash = ?
                    WHERE id = ?
                    """,
                    (generate_password_hash(new_password), g.current_user["id"]),
                )
                _revoke_all_tokens_for_user(connection, g.current_user["id"])
                token = _issue_token(connection, g.current_user["id"], app.config["TOKEN_TTL_HOURS"])
                updated_user = connection.execute(
                    """
                    SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                    FROM users
                    WHERE id = ?
                    """,
                    (g.current_user["id"],),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="auth.change-password",
                    entity_type="user",
                    entity_id=g.current_user["id"],
                    details=f"Changed password for {g.current_user['username']}.",
                )

        return jsonify({"token": token, "user": row_to_user(updated_user)})

    @app.post("/auth/logout")
    @require_auth("viewer")
    def logout():
        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            with connection:
                connection.execute(
                    """
                    UPDATE auth_tokens
                    SET revoked_at = ?
                    WHERE token_hash = ?
                    """,
                    (_utcnow_iso(), g.current_token_hash),
                )
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="auth.logout",
                    entity_type="session",
                    details=f"Signed out {g.current_user['username']}.",
                )

        return jsonify({"status": "signed-out"})

    @app.get("/auth/me")
    @require_auth("viewer")
    def auth_me():
        return jsonify(g.current_user)

    @app.post("/auth/mfa/setup")
    @require_auth("viewer")
    def setup_mfa():
        data = _get_json_payload()
        current_password = str(data.get("currentPassword", ""))
        if not current_password:
            return jsonify({"error": "Current password is required."}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            user_row = connection.execute(
                """
                SELECT id, username, password_hash, role, is_active, mfa_secret, mfa_enabled,
                       deactivated_at, created_at
                FROM users
                WHERE id = ?
                """,
                (g.current_user["id"],),
            ).fetchone()
            if not user_row or not check_password_hash(user_row["password_hash"], current_password):
                return jsonify({"error": "Current password is incorrect."}), 400

            secret = _generate_totp_secret()
            with connection:
                connection.execute(
                    """
                    UPDATE users
                    SET mfa_secret = ?, mfa_enabled = 0
                    WHERE id = ?
                    """,
                    (secret, g.current_user["id"]),
                )
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="auth.mfa-setup",
                    entity_type="user",
                    entity_id=g.current_user["id"],
                    details=f"Prepared MFA enrollment for {g.current_user['username']}.",
                )

        return jsonify(
            {
                "secret": secret,
                "otpauthUrl": _build_otpauth_uri(
                    secret=secret,
                    username=g.current_user["username"],
                    issuer=app.config["MFA_ISSUER"],
                ),
            }
        )

    @app.post("/auth/mfa/confirm")
    @require_auth("viewer")
    def confirm_mfa():
        data = _get_json_payload()
        otp_code = str(data.get("otpCode", "")).strip()

        if not _is_valid_otp_code(otp_code):
            return jsonify({"error": "A valid 6-digit MFA code is required."}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            user_row = connection.execute(
                """
                SELECT id, username, role, is_active, mfa_secret, mfa_enabled, deactivated_at, created_at
                FROM users
                WHERE id = ?
                """,
                (g.current_user["id"],),
            ).fetchone()
            if not user_row or not user_row["mfa_secret"]:
                return jsonify({"error": "Start MFA setup before confirming it."}), 400
            if not _verify_totp_code(user_row["mfa_secret"], otp_code):
                return jsonify({"error": "Invalid MFA code."}), 400

            with connection:
                connection.execute(
                    """
                    UPDATE users
                    SET mfa_enabled = 1
                    WHERE id = ?
                    """,
                    (g.current_user["id"],),
                )
                updated_user = connection.execute(
                    """
                    SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                    FROM users
                    WHERE id = ?
                    """,
                    (g.current_user["id"],),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="auth.mfa-enable",
                    entity_type="user",
                    entity_id=g.current_user["id"],
                    details=f"Enabled MFA for {g.current_user['username']}.",
                )
                backup_codes = _replace_backup_codes(connection, g.current_user["id"])

        return jsonify({"user": row_to_user(updated_user), "backupCodes": backup_codes})

    @app.post("/auth/mfa/backup-codes/regenerate")
    @require_auth("viewer")
    def regenerate_backup_codes():
        data = _get_json_payload()
        current_password = str(data.get("currentPassword", ""))
        otp_code = str(data.get("otpCode", "")).strip()

        if not current_password:
            return jsonify({"error": "Current password is required."}), 400
        if not _is_valid_otp_code(otp_code):
            return jsonify({"error": "A valid 6-digit MFA code is required."}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            user_row = connection.execute(
                """
                SELECT id, username, password_hash, role, is_active, mfa_secret, mfa_enabled,
                       deactivated_at, created_at
                FROM users
                WHERE id = ?
                """,
                (g.current_user["id"],),
            ).fetchone()
            if not user_row or not check_password_hash(user_row["password_hash"], current_password):
                return jsonify({"error": "Current password is incorrect."}), 400
            if not user_row["mfa_enabled"] or not user_row["mfa_secret"]:
                return jsonify({"error": "MFA must be enabled before regenerating backup codes."}), 400
            if not _verify_totp_code(user_row["mfa_secret"], otp_code):
                return jsonify({"error": "Invalid MFA code."}), 400

            with connection:
                backup_codes = _replace_backup_codes(connection, g.current_user["id"])
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="auth.backup-codes-regenerate",
                    entity_type="user",
                    entity_id=g.current_user["id"],
                    details=f"Regenerated MFA backup codes for {g.current_user['username']}.",
                )

        return jsonify({"backupCodes": backup_codes})

    @app.post("/auth/mfa/disable")
    @require_auth("viewer")
    def disable_mfa():
        data = _get_json_payload()
        current_password = str(data.get("currentPassword", ""))
        otp_code = str(data.get("otpCode", "")).strip()

        if not current_password:
            return jsonify({"error": "Current password is required."}), 400
        if not _is_valid_otp_code(otp_code):
            return jsonify({"error": "A valid 6-digit MFA code is required."}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            user_row = connection.execute(
                """
                SELECT id, username, password_hash, role, is_active, mfa_secret, mfa_enabled,
                       deactivated_at, created_at
                FROM users
                WHERE id = ?
                """,
                (g.current_user["id"],),
            ).fetchone()
            if not user_row or not check_password_hash(user_row["password_hash"], current_password):
                return jsonify({"error": "Current password is incorrect."}), 400
            if not user_row["mfa_enabled"] or not user_row["mfa_secret"]:
                return jsonify({"error": "MFA is not enabled for this account."}), 400
            if not _verify_totp_code(user_row["mfa_secret"], otp_code):
                return jsonify({"error": "Invalid MFA code."}), 400

            with connection:
                connection.execute(
                    """
                    UPDATE users
                    SET mfa_secret = NULL, mfa_enabled = 0
                    WHERE id = ?
                    """,
                    (g.current_user["id"],),
                )
                updated_user = connection.execute(
                    """
                    SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                    FROM users
                    WHERE id = ?
                    """,
                    (g.current_user["id"],),
                ).fetchone()
                _delete_backup_codes(connection, g.current_user["id"])
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="auth.mfa-disable",
                    entity_type="user",
                    entity_id=g.current_user["id"],
                    details=f"Disabled MFA for {g.current_user['username']}.",
                )

        return jsonify({"user": row_to_user(updated_user)})

    @app.get("/users")
    @require_auth("admin")
    def list_users():
        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            users = connection.execute(
                """
                SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                FROM users
                ORDER BY username ASC
                """
            ).fetchall()
        return jsonify([row_to_user(user) for user in users])

    @app.post("/users")
    @require_auth("admin")
    def create_user():
        data = _get_json_payload()
        validation_error = _validate_user_payload(data, allow_missing_role=False)
        if validation_error:
            return jsonify({"error": validation_error}), 400

        username = str(data["username"]).strip()
        password = str(data["password"])
        role = str(data["role"]).strip().lower()

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            existing_user = connection.execute(
                "SELECT id FROM users WHERE username = ?",
                (username,),
            ).fetchone()
            if existing_user:
                return jsonify({"error": "That username is already in use."}), 409

            with connection:
                cursor = connection.execute(
                    """
                    INSERT INTO users (username, password_hash, role, is_active)
                    VALUES (?, ?, ?, 1)
                    """,
                    (username, generate_password_hash(password), role),
                )
                created_user = connection.execute(
                    """
                    SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                    FROM users
                    WHERE id = ?
                    """,
                    (cursor.lastrowid,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="user.create",
                    entity_type="user",
                    entity_id=created_user["id"],
                    details=f"Created user {username} with role {role}.",
                )

        return jsonify(row_to_user(created_user)), 201

    @app.post("/users/<int:user_id>/reset-password")
    @require_auth("admin")
    def reset_user_password(user_id: int):
        data = _get_json_payload()
        new_password = str(data.get("newPassword", ""))

        password_error = _validate_password(new_password)
        if password_error:
            return jsonify({"error": password_error}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            target_user = connection.execute(
                """
                SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                FROM users
                WHERE id = ?
                """,
                (user_id,),
            ).fetchone()
            if not target_user:
                return jsonify({"error": "User not found."}), 404

            with connection:
                connection.execute(
                    """
                    UPDATE users
                    SET password_hash = ?
                    WHERE id = ?
                    """,
                    (generate_password_hash(new_password), user_id),
                )
                _revoke_all_tokens_for_user(connection, user_id)
                updated_user = connection.execute(
                    """
                    SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                    FROM users
                    WHERE id = ?
                    """,
                    (user_id,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="user.reset-password",
                    entity_type="user",
                    entity_id=user_id,
                    details=f"Reset password for {target_user['username']}.",
                )

        return jsonify(row_to_user(updated_user))

    @app.post("/users/<int:user_id>/deactivate")
    @require_auth("admin")
    def deactivate_user(user_id: int):
        if user_id == g.current_user["id"]:
            return jsonify({"error": "You cannot deactivate your own account."}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            target_user = connection.execute(
                """
                SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                FROM users
                WHERE id = ?
                """,
                (user_id,),
            ).fetchone()
            if not target_user:
                return jsonify({"error": "User not found."}), 404
            if not target_user["is_active"]:
                return jsonify({"error": "That user is already inactive."}), 409

            with connection:
                connection.execute(
                    """
                    UPDATE users
                    SET is_active = 0, deactivated_at = ?
                    WHERE id = ?
                    """,
                    (_utcnow_iso(), user_id),
                )
                _revoke_all_tokens_for_user(connection, user_id)
                updated_user = connection.execute(
                    """
                    SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                    FROM users
                    WHERE id = ?
                    """,
                    (user_id,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="user.deactivate",
                    entity_type="user",
                    entity_id=user_id,
                    details=f"Deactivated account {target_user['username']}.",
                )

        return jsonify(row_to_user(updated_user))

    @app.post("/users/<int:user_id>/reactivate")
    @require_auth("admin")
    def reactivate_user(user_id: int):
        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            target_user = connection.execute(
                """
                SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                FROM users
                WHERE id = ?
                """,
                (user_id,),
            ).fetchone()
            if not target_user:
                return jsonify({"error": "User not found."}), 404
            if target_user["is_active"]:
                return jsonify({"error": "That user is already active."}), 409

            with connection:
                connection.execute(
                    """
                    UPDATE users
                    SET is_active = 1, deactivated_at = NULL
                    WHERE id = ?
                    """,
                    (user_id,),
                )
                updated_user = connection.execute(
                    """
                    SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                    FROM users
                    WHERE id = ?
                    """,
                    (user_id,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="user.reactivate",
                    entity_type="user",
                    entity_id=user_id,
                    details=f"Reactivated account {target_user['username']}.",
                )

        return jsonify(row_to_user(updated_user))

    @app.post("/users/<int:user_id>/mfa/recover")
    @require_auth("admin")
    def recover_user_mfa(user_id: int):
        if user_id == g.current_user["id"]:
            return jsonify({"error": "Use the account security panel to manage your own MFA."}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            target_user = connection.execute(
                """
                SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                FROM users
                WHERE id = ?
                """,
                (user_id,),
            ).fetchone()
            if not target_user:
                return jsonify({"error": "User not found."}), 404
            if not target_user["mfa_enabled"]:
                return jsonify({"error": "That user does not have MFA enabled."}), 409

            with connection:
                connection.execute(
                    """
                    UPDATE users
                    SET mfa_secret = NULL, mfa_enabled = 0
                    WHERE id = ?
                    """,
                    (user_id,),
                )
                _delete_backup_codes(connection, user_id)
                _revoke_all_tokens_for_user(connection, user_id)
                updated_user = connection.execute(
                    """
                    SELECT id, username, role, is_active, mfa_enabled, deactivated_at, created_at
                    FROM users
                    WHERE id = ?
                    """,
                    (user_id,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="user.mfa-recover",
                    entity_type="user",
                    entity_id=user_id,
                    details=f"Cleared MFA and backup codes for {target_user['username']}.",
                )

        return jsonify(row_to_user(updated_user))

    @app.get("/users/mfa-recovery-requests")
    @require_auth("admin")
    def list_mfa_recovery_requests():
        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            recovery_requests = connection.execute(
                """
                SELECT mfa_recovery_requests.id, mfa_recovery_requests.user_id, mfa_recovery_requests.reason,
                       mfa_recovery_requests.status, mfa_recovery_requests.requested_at,
                       mfa_recovery_requests.processed_at, users.username, users.role,
                       approver.username AS processed_by_username
                FROM mfa_recovery_requests
                JOIN users ON users.id = mfa_recovery_requests.user_id
                LEFT JOIN users AS approver ON approver.id = mfa_recovery_requests.processed_by_user_id
                ORDER BY CASE WHEN mfa_recovery_requests.status = 'pending' THEN 0 ELSE 1 END,
                         mfa_recovery_requests.id DESC
                """
            ).fetchall()
        return jsonify([row_to_mfa_recovery_request(request_row) for request_row in recovery_requests])

    @app.post("/users/mfa-recovery-requests/<int:request_id>/approve")
    @require_auth("admin")
    def approve_mfa_recovery_request(request_id: int):
        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            recovery_request = connection.execute(
                """
                SELECT mfa_recovery_requests.id, mfa_recovery_requests.user_id, mfa_recovery_requests.reason,
                       mfa_recovery_requests.status, mfa_recovery_requests.requested_at,
                       mfa_recovery_requests.processed_at, users.username, users.role,
                       approver.username AS processed_by_username
                FROM mfa_recovery_requests
                JOIN users ON users.id = mfa_recovery_requests.user_id
                LEFT JOIN users AS approver ON approver.id = mfa_recovery_requests.processed_by_user_id
                WHERE mfa_recovery_requests.id = ?
                """,
                (request_id,),
            ).fetchone()
            if not recovery_request:
                return jsonify({"error": "Recovery request not found."}), 404
            if recovery_request["status"] != "pending":
                return jsonify({"error": "That recovery request has already been processed."}), 409

            with connection:
                connection.execute(
                    """
                    UPDATE users
                    SET mfa_secret = NULL, mfa_enabled = 0
                    WHERE id = ?
                    """,
                    (recovery_request["user_id"],),
                )
                _delete_backup_codes(connection, recovery_request["user_id"])
                _revoke_all_tokens_for_user(connection, recovery_request["user_id"])
                connection.execute(
                    """
                    UPDATE mfa_recovery_requests
                    SET status = 'approved', processed_at = ?, processed_by_user_id = ?
                    WHERE id = ?
                    """,
                    (_utcnow_iso(), g.current_user["id"], request_id),
                )
                updated_request = connection.execute(
                    """
                    SELECT mfa_recovery_requests.id, mfa_recovery_requests.user_id, mfa_recovery_requests.reason,
                           mfa_recovery_requests.status, mfa_recovery_requests.requested_at,
                           mfa_recovery_requests.processed_at, users.username, users.role,
                           approver.username AS processed_by_username
                    FROM mfa_recovery_requests
                    JOIN users ON users.id = mfa_recovery_requests.user_id
                    LEFT JOIN users AS approver ON approver.id = mfa_recovery_requests.processed_by_user_id
                    WHERE mfa_recovery_requests.id = ?
                    """,
                    (request_id,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="user.mfa-recovery-approve",
                    entity_type="user",
                    entity_id=recovery_request["user_id"],
                    details=f"Approved MFA recovery request for {recovery_request['username']}.",
                )

        return jsonify(row_to_mfa_recovery_request(updated_request))

    @app.post("/users/mfa-recovery-requests/<int:request_id>/reject")
    @require_auth("admin")
    def reject_mfa_recovery_request(request_id: int):
        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            recovery_request = connection.execute(
                """
                SELECT mfa_recovery_requests.id, mfa_recovery_requests.user_id, mfa_recovery_requests.reason,
                       mfa_recovery_requests.status, mfa_recovery_requests.requested_at,
                       mfa_recovery_requests.processed_at, users.username, users.role,
                       approver.username AS processed_by_username
                FROM mfa_recovery_requests
                JOIN users ON users.id = mfa_recovery_requests.user_id
                LEFT JOIN users AS approver ON approver.id = mfa_recovery_requests.processed_by_user_id
                WHERE mfa_recovery_requests.id = ?
                """,
                (request_id,),
            ).fetchone()
            if not recovery_request:
                return jsonify({"error": "Recovery request not found."}), 404
            if recovery_request["status"] != "pending":
                return jsonify({"error": "That recovery request has already been processed."}), 409

            with connection:
                connection.execute(
                    """
                    UPDATE mfa_recovery_requests
                    SET status = 'rejected', processed_at = ?, processed_by_user_id = ?
                    WHERE id = ?
                    """,
                    (_utcnow_iso(), g.current_user["id"], request_id),
                )
                updated_request = connection.execute(
                    """
                    SELECT mfa_recovery_requests.id, mfa_recovery_requests.user_id, mfa_recovery_requests.reason,
                           mfa_recovery_requests.status, mfa_recovery_requests.requested_at,
                           mfa_recovery_requests.processed_at, users.username, users.role,
                           approver.username AS processed_by_username
                    FROM mfa_recovery_requests
                    JOIN users ON users.id = mfa_recovery_requests.user_id
                    LEFT JOIN users AS approver ON approver.id = mfa_recovery_requests.processed_by_user_id
                    WHERE mfa_recovery_requests.id = ?
                    """,
                    (request_id,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="user.mfa-recovery-reject",
                    entity_type="user",
                    entity_id=recovery_request["user_id"],
                    details=f"Rejected MFA recovery request for {recovery_request['username']}.",
                )

        return jsonify(row_to_mfa_recovery_request(updated_request))

    @app.get("/audit-logs")
    @require_auth("admin")
    def list_audit_logs():
        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            audit_logs = connection.execute(
                """
                SELECT audit_logs.id, audit_logs.action, audit_logs.entity_type, audit_logs.entity_id,
                       audit_logs.details, audit_logs.created_at,
                       users.username AS actor_username, users.role AS actor_role
                FROM audit_logs
                LEFT JOIN users ON users.id = audit_logs.actor_user_id
                ORDER BY audit_logs.id DESC
                LIMIT 50
                """
            ).fetchall()
        return jsonify([row_to_audit_log(log) for log in audit_logs])

    @app.get("/vehicles")
    @require_auth("viewer")
    def get_vehicles():
        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            vehicles = connection.execute(
                """
                SELECT id, make, model, year, created_at, updated_at
                FROM vehicles
                ORDER BY year DESC, make ASC, model ASC
                """
            ).fetchall()
        return jsonify([row_to_vehicle(vehicle) for vehicle in vehicles])

    @app.post("/vehicles")
    @require_auth("manager")
    def create_vehicle():
        data = _get_json_payload()
        vehicle_data, error = _parse_vehicle_payload(data)
        if error:
            return jsonify({"error": error}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            with connection:
                cursor = connection.execute(
                    """
                    INSERT INTO vehicles (make, model, year, updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        vehicle_data["make"],
                        vehicle_data["model"],
                        vehicle_data["year"],
                        _utcnow_iso(),
                    ),
                )
                vehicle = connection.execute(
                    """
                    SELECT id, make, model, year, created_at, updated_at
                    FROM vehicles
                    WHERE id = ?
                    """,
                    (cursor.lastrowid,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="vehicle.create",
                    entity_type="vehicle",
                    entity_id=vehicle["id"],
                    details=f"Created vehicle {vehicle['make']} {vehicle['model']} ({vehicle['year']}).",
                )

        return jsonify(row_to_vehicle(vehicle)), 201

    @app.put("/vehicles/<int:vehicle_id>")
    @require_auth("manager")
    def update_vehicle(vehicle_id: int):
        data = _get_json_payload()
        vehicle_data, error = _parse_vehicle_payload(data)
        if error:
            return jsonify({"error": error}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            existing_vehicle = connection.execute(
                "SELECT id FROM vehicles WHERE id = ?",
                (vehicle_id,),
            ).fetchone()
            if not existing_vehicle:
                return jsonify({"error": "Vehicle not found."}), 404

            with connection:
                connection.execute(
                    """
                    UPDATE vehicles
                    SET make = ?, model = ?, year = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        vehicle_data["make"],
                        vehicle_data["model"],
                        vehicle_data["year"],
                        _utcnow_iso(),
                        vehicle_id,
                    ),
                )
                vehicle = connection.execute(
                    """
                    SELECT id, make, model, year, created_at, updated_at
                    FROM vehicles
                    WHERE id = ?
                    """,
                    (vehicle_id,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="vehicle.update",
                    entity_type="vehicle",
                    entity_id=vehicle_id,
                    details=f"Updated vehicle {vehicle['make']} {vehicle['model']} ({vehicle['year']}).",
                )

        return jsonify(row_to_vehicle(vehicle))

    @app.delete("/vehicles/<int:vehicle_id>")
    @require_auth("manager")
    def delete_vehicle(vehicle_id: int):
        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            vehicle = connection.execute(
                """
                SELECT id, make, model, year, created_at, updated_at
                FROM vehicles
                WHERE id = ?
                """,
                (vehicle_id,),
            ).fetchone()
            if not vehicle:
                return jsonify({"error": "Vehicle not found."}), 404

            with connection:
                connection.execute("DELETE FROM vehicles WHERE id = ?", (vehicle_id,))
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="vehicle.delete",
                    entity_type="vehicle",
                    entity_id=vehicle_id,
                    details=f"Deleted vehicle {vehicle['make']} {vehicle['model']} ({vehicle['year']}).",
                )

        return jsonify({"status": "deleted"})

    @app.get("/fuel-logs")
    @require_auth("viewer")
    def get_fuel_logs():
        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            logs = connection.execute(
                """
                SELECT id, date, vehicle, fuel_card, liters, amount, notes,
                       theft_suspected, abnormal_refill, created_at, updated_at
                FROM fuel_logs
                ORDER BY date DESC, id DESC
                """
            ).fetchall()
        return jsonify([row_to_fuel_log(log) for log in logs])

    @app.post("/fuel-logs")
    @require_auth("manager")
    def create_fuel_log():
        data = _get_json_payload()
        fuel_log_data, error = _parse_fuel_log_payload(data)
        if error:
            return jsonify({"error": error}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            with connection:
                cursor = connection.execute(
                    """
                    INSERT INTO fuel_logs (
                        date, vehicle, fuel_card, liters, amount, notes,
                        theft_suspected, abnormal_refill, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        fuel_log_data["date"],
                        fuel_log_data["vehicle"],
                        fuel_log_data["fuel_card"],
                        fuel_log_data["liters"],
                        fuel_log_data["amount"],
                        fuel_log_data["notes"],
                        int(fuel_log_data["theft_suspected"]),
                        int(fuel_log_data["abnormal_refill"]),
                        _utcnow_iso(),
                    ),
                )
                fuel_log = connection.execute(
                    """
                    SELECT id, date, vehicle, fuel_card, liters, amount, notes,
                           theft_suspected, abnormal_refill, created_at, updated_at
                    FROM fuel_logs
                    WHERE id = ?
                    """,
                    (cursor.lastrowid,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="fuel-log.create",
                    entity_type="fuel-log",
                    entity_id=fuel_log["id"],
                    details=f"Created fuel log for {fuel_log['vehicle']} on {fuel_log['date']}.",
                )

        return jsonify(row_to_fuel_log(fuel_log)), 201

    @app.put("/fuel-logs/<int:fuel_log_id>")
    @require_auth("manager")
    def update_fuel_log(fuel_log_id: int):
        data = _get_json_payload()
        fuel_log_data, error = _parse_fuel_log_payload(data)
        if error:
            return jsonify({"error": error}), 400

        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            existing_log = connection.execute(
                "SELECT id FROM fuel_logs WHERE id = ?",
                (fuel_log_id,),
            ).fetchone()
            if not existing_log:
                return jsonify({"error": "Fuel log not found."}), 404

            with connection:
                connection.execute(
                    """
                    UPDATE fuel_logs
                    SET date = ?, vehicle = ?, fuel_card = ?, liters = ?, amount = ?,
                        notes = ?, theft_suspected = ?, abnormal_refill = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        fuel_log_data["date"],
                        fuel_log_data["vehicle"],
                        fuel_log_data["fuel_card"],
                        fuel_log_data["liters"],
                        fuel_log_data["amount"],
                        fuel_log_data["notes"],
                        int(fuel_log_data["theft_suspected"]),
                        int(fuel_log_data["abnormal_refill"]),
                        _utcnow_iso(),
                        fuel_log_id,
                    ),
                )
                fuel_log = connection.execute(
                    """
                    SELECT id, date, vehicle, fuel_card, liters, amount, notes,
                           theft_suspected, abnormal_refill, created_at, updated_at
                    FROM fuel_logs
                    WHERE id = ?
                    """,
                    (fuel_log_id,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="fuel-log.update",
                    entity_type="fuel-log",
                    entity_id=fuel_log_id,
                    details=f"Updated fuel log for {fuel_log['vehicle']} on {fuel_log['date']}.",
                )

        return jsonify(row_to_fuel_log(fuel_log))

    @app.delete("/fuel-logs/<int:fuel_log_id>")
    @require_auth("manager")
    def delete_fuel_log(fuel_log_id: int):
        with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
            fuel_log = connection.execute(
                """
                SELECT id, date, vehicle, fuel_card, liters, amount, notes,
                       theft_suspected, abnormal_refill, created_at, updated_at
                FROM fuel_logs
                WHERE id = ?
                """,
                (fuel_log_id,),
            ).fetchone()
            if not fuel_log:
                return jsonify({"error": "Fuel log not found."}), 404

            with connection:
                connection.execute("DELETE FROM fuel_logs WHERE id = ?", (fuel_log_id,))
                _log_audit_event(
                    connection,
                    actor_user_id=g.current_user["id"],
                    action="fuel-log.delete",
                    entity_type="fuel-log",
                    entity_id=fuel_log_id,
                    details=f"Deleted fuel log for {fuel_log['vehicle']} on {fuel_log['date']}.",
                )

        return jsonify({"status": "deleted"})

    @app.post("/credit-score")
    @require_auth("viewer")
    def calculate_credit_score():
        data = _get_json_payload()

        try:
            income = float(data.get("income", 0))
            debt = float(data.get("debt", 0))
        except (TypeError, ValueError):
            return jsonify({"error": "Income and debt must be numeric."}), 400

        score = max(0, min(1000, (income - debt) / 10))
        return jsonify({"score": round(score, 2)})

    return app


def _seed_admin_from_config(app: Flask) -> None:
    username = app.config.get("BOOTSTRAP_ADMIN_USERNAME")
    password = app.config.get("BOOTSTRAP_ADMIN_PASSWORD")
    role = str(app.config.get("BOOTSTRAP_ADMIN_ROLE", "admin")).lower()

    if not username or not password or role not in ROLE_ORDER:
        return

    with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
        user_count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if user_count:
            return

        with connection:
            cursor = connection.execute(
                """
                INSERT INTO users (username, password_hash, role, is_active)
                VALUES (?, ?, ?, 1)
                """,
                (username, generate_password_hash(password), role),
            )
            _log_audit_event(
                connection,
                actor_user_id=cursor.lastrowid,
                action="auth.seed-admin",
                entity_type="user",
                entity_id=cursor.lastrowid,
                details=f"Seeded initial admin account {username} from environment configuration.",
            )


def _count_users(app: Flask) -> int:
    with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
        return connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]


def _get_json_payload() -> dict[str, object]:
    payload = request.get_json(silent=True)
    if isinstance(payload, dict):
        return payload
    return {}


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _issue_token(connection, user_id: int, token_ttl_hours: int) -> str:
    token = secrets.token_urlsafe(32)
    created_at = _utcnow_iso()
    expires_at = (
        datetime.now(timezone.utc) + timedelta(hours=int(token_ttl_hours))
    ).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    connection.execute(
        """
        INSERT INTO auth_tokens (user_id, token_hash, created_at, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, _hash_token(token), created_at, expires_at),
    )
    return token


def _extract_bearer_token() -> str | None:
    authorization_header = request.headers.get("Authorization", "")
    if not authorization_header.startswith("Bearer "):
        return None
    token = authorization_header.replace("Bearer ", "", 1).strip()
    return token or None


def _load_authenticated_user(app: Flask, token: str):
    token_hash = _hash_token(token)
    with closing(get_connection(app.config["DATABASE_PATH"])) as connection:
        user_row = connection.execute(
            """
            SELECT users.id, users.username, users.role, users.is_active, users.mfa_enabled,
                   users.deactivated_at, users.created_at, auth_tokens.expires_at
            FROM auth_tokens
            JOIN users ON users.id = auth_tokens.user_id
            WHERE auth_tokens.token_hash = ?
              AND auth_tokens.revoked_at IS NULL
            """,
            (token_hash,),
        ).fetchone()

    if not user_row:
        return None, token_hash

    if not user_row["is_active"]:
        return None, token_hash

    if user_row["expires_at"] <= _utcnow_iso():
        return None, token_hash

    return user_row, token_hash


def _validate_username(username: str) -> str | None:
    if not USERNAME_PATTERN.match(username):
        return "Username must be 3-32 characters and use letters, numbers, dots, dashes, or underscores."
    return None


def _validate_password(password: str) -> str | None:
    if len(password) < 10:
        return "Password must be at least 10 characters long."
    return None


def _validate_user_payload(data: dict[str, object], *, allow_missing_role: bool) -> str | None:
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    role = str(data.get("role", "viewer")).strip().lower()

    username_error = _validate_username(username)
    if username_error:
        return username_error

    password_error = _validate_password(password)
    if password_error:
        return password_error

    if not allow_missing_role and role not in ROLE_ORDER:
        return "Role must be one of: admin, manager, viewer."

    return None


def _parse_vehicle_payload(data: dict[str, object]) -> tuple[dict[str, object], str | None]:
    make = str(data.get("make", "")).strip()
    model = str(data.get("model", "")).strip()
    year_value = data.get("year")

    if not make or not model:
        return {}, "Make and model are required."

    try:
        year = int(year_value)
    except (TypeError, ValueError):
        return {}, "Year must be a valid number."

    current_year = datetime.now(timezone.utc).year + 1
    if year < 1900 or year > current_year:
        return {}, f"Year must be between 1900 and {current_year}."

    return {"make": make, "model": model, "year": year}, None


def _parse_fuel_log_payload(data: dict[str, object]) -> tuple[dict[str, object], str | None]:
    entry_date = str(data.get("date", "")).strip()
    vehicle = str(data.get("vehicle", "")).strip()
    fuel_card = str(data.get("fuelCard", "")).strip()
    notes = str(data.get("notes", "")).strip()

    try:
        datetime.strptime(entry_date, "%Y-%m-%d")
    except ValueError:
        return {}, "Date must use YYYY-MM-DD format."

    if not vehicle or not fuel_card:
        return {}, "Vehicle and fuel card are required."

    try:
        liters = float(data.get("liters", 0))
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return {}, "Liters and amount must be numeric."

    if liters <= 0:
        return {}, "Liters must be greater than zero."

    if amount < 0:
        return {}, "Amount cannot be negative."

    return {
        "date": entry_date,
        "vehicle": vehicle,
        "fuel_card": fuel_card,
        "liters": liters,
        "amount": amount,
        "notes": notes,
        "theft_suspected": bool(data.get("theftSuspected", False)),
        "abnormal_refill": bool(data.get("abnormalRefill", False)),
    }, None


def _log_audit_event(
    connection,
    *,
    actor_user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    details: str = "",
) -> None:
    connection.execute(
        """
        INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, ?, ?, ?)
        """,
        (actor_user_id, action, entity_type, entity_id, details),
    )


def _revoke_all_tokens_for_user(connection, user_id: int) -> None:
    connection.execute(
        """
        UPDATE auth_tokens
        SET revoked_at = COALESCE(revoked_at, ?)
        WHERE user_id = ?
        """,
        (_utcnow_iso(), user_id),
    )


def _replace_backup_codes(connection, user_id: int, *, count: int = 8) -> list[str]:
    _delete_backup_codes(connection, user_id)
    backup_codes = [_generate_backup_code() for _ in range(count)]
    connection.executemany(
        """
        INSERT INTO mfa_backup_codes (user_id, code_hash)
        VALUES (?, ?)
        """,
        [(user_id, _hash_backup_code(code)) for code in backup_codes],
    )
    return backup_codes


def _delete_backup_codes(connection, user_id: int) -> None:
    connection.execute("DELETE FROM mfa_backup_codes WHERE user_id = ?", (user_id,))


def _consume_backup_code(connection, user_id: int, backup_code: str) -> bool:
    normalized_code = _normalize_backup_code(backup_code)
    if not normalized_code:
        return False

    backup_code_row = connection.execute(
        """
        SELECT id
        FROM mfa_backup_codes
        WHERE user_id = ?
          AND code_hash = ?
          AND used_at IS NULL
        """,
        (user_id, _hash_backup_code(normalized_code)),
    ).fetchone()
    if not backup_code_row:
        return False

    connection.execute(
        """
        UPDATE mfa_backup_codes
        SET used_at = ?
        WHERE id = ?
        """,
        (_utcnow_iso(), backup_code_row["id"]),
    )
    return True


def _generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _build_otpauth_uri(*, secret: str, username: str, issuer: str) -> str:
    label = quote(f"{issuer}:{username}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}"


def _is_valid_otp_code(code: str) -> bool:
    return bool(re.fullmatch(r"\d{6}", code))


def _verify_totp_code(secret: str | None, code: str, *, allowed_drift: int = 1) -> bool:
    if not secret or not _is_valid_otp_code(code):
        return False

    current_time = int(datetime.now(timezone.utc).timestamp())
    for step_offset in range(-allowed_drift, allowed_drift + 1):
        if _generate_totp_code(secret, current_time + step_offset * 30) == code:
            return True
    return False


def _generate_totp_code(secret: str, unix_time: int) -> str:
    normalized_secret = _normalize_base32_secret(secret)
    counter = unix_time // 30
    counter_bytes = struct.pack(">Q", counter)
    digest = hmac.new(normalized_secret, counter_bytes, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    truncated_hash = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{truncated_hash % 1_000_000:06d}"


def _normalize_base32_secret(secret: str) -> bytes:
    padding = "=" * ((8 - len(secret) % 8) % 8)
    return base64.b32decode(f"{secret}{padding}", casefold=True)


def _generate_backup_code() -> str:
    raw_code = secrets.token_hex(4).upper()
    return f"{raw_code[:4]}-{raw_code[4:]}"


def _normalize_backup_code(backup_code: str) -> str | None:
    normalized = backup_code.replace("-", "").strip().upper()
    if not re.fullmatch(r"[A-F0-9]{8}", normalized):
        return None
    return normalized


def _hash_backup_code(backup_code: str) -> str:
    normalized = _normalize_backup_code(backup_code)
    if normalized is None:
        return ""
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
