from __future__ import annotations

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
        data = request.get_json(silent=True) or {}
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", ""))
        
        if not username or not password:
            return jsonify({"error": "Username and password are required."}), 400
        
        config = app.config.get("DATABASE_CONFIG")
        with closing(get_connection(config)) as connection:
            user = connection.execute(
                "SELECT id, username, email, password_hash, role, is_active FROM users WHERE username = ? OR email = ?",
                (username, username)
            ).fetchone()
            
            if not user:
                return jsonify({"error": "Invalid credentials."}), 401
            
            if not user["is_active"]:
                return jsonify({"error": "Account is disabled."}), 401
            
            if not verify_password(password, user["password_hash"]):
                return jsonify({"error": "Invalid credentials."}), 401
            
            with connection:
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