from __future__ import annotations

import hashlib
import hmac
import os
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

try:
    import jwt
except ImportError:
    jwt = None


SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET") or os.urandom(32).hex()
TOKEN_EXPIRY_HOURS = int(os.getenv("TOKEN_EXPIRY_HOURS", "24"))


class TokenError(Exception):
    pass


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    iterations = 100_000
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations, dklen=32)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash or not password:
        return False
    
    parts = stored_hash.split("$")
    if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
        return False
    
    try:
        iterations = int(parts[1])
        salt = bytes.fromhex(parts[2])
        expected = parts[3]
        computed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations, dklen=32)
        return hmac.compare_digest(computed.hex(), expected)
    except (ValueError, TypeError):
        return False


@dataclass
class TokenPayload:
    sub: int
    username: str
    role: str
    exp: float


def create_token(user_id: int, username: str, role: str, expires_in_hours: int = TOKEN_EXPIRY_HOURS) -> str:
    if jwt is None:
        raise RuntimeError("PyJWT is required for token creation. Install with: pip install PyJWT")
    
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=expires_in_hours),
        "jti": os.urandom(16).hex(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> TokenPayload:
    if jwt is None:
        raise RuntimeError("PyJWT is required for token decoding. Install with: pip install PyJWT")
    
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return TokenPayload(
            sub=data["sub"],
            username=data["username"],
            role=data["role"],
            exp=data["exp"],
        )
    except jwt.ExpiredSignatureError:
        raise TokenError("Token has expired")
    except jwt.InvalidTokenError:
        raise TokenError("Invalid token")


def token_required(fn):
    from functools import wraps
    from flask import request, jsonify
    
    @wraps(fn)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        
        token = auth_header[7:]
        try:
            payload = decode_token(token)
        except TokenError:
            return jsonify({"error": "Invalid or expired token"}), 401
        except RuntimeError:
            return jsonify({"error": "Authentication not configured"}), 500
        
        request.current_user = {
            "id": payload.sub,
            "username": payload.username,
            "role": payload.role,
        }
        return fn(*args, **kwargs)
    
    return decorated