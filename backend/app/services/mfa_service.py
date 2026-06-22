import base64
import hashlib
import hmac
import os
import secrets
import struct
import time
from typing import Iterable


def generate_totp_secret() -> str:
    return base64.b32encode(os.urandom(20)).decode("utf-8").rstrip("=")


def _normalize_secret(secret: str) -> bytes:
    padding = "=" * ((8 - len(secret) % 8) % 8)
    return base64.b32decode((secret + padding).upper())


def _totp_at(secret: str, unix_time: int, period: int = 30, digits: int = 6) -> str:
    key = _normalize_secret(secret)
    counter = int(unix_time // period)
    message = struct.pack(">Q", counter)
    digest = hmac.new(key, message, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code_int = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(code_int % (10**digits)).zfill(digits)


def verify_totp(secret: str, code: str, *, window: int = 1, period: int = 30, digits: int = 6) -> bool:
    if not secret or not code or not code.isdigit():
        return False

    now = int(time.time())
    valid_codes = {
        _totp_at(secret, now + offset * period, period=period, digits=digits)
        for offset in range(-window, window + 1)
    }
    return hmac.compare_digest(code, next((c for c in valid_codes if c == code), ""))


def build_otpauth_uri(secret: str, username: str, issuer: str = "QuantEdge") -> str:
    safe_issuer = issuer.replace(" ", "%20")
    safe_username = username.replace(" ", "%20")
    return (
        f"otpauth://totp/{safe_issuer}:{safe_username}"
        f"?secret={secret}&issuer={safe_issuer}&algorithm=SHA1&digits=6&period=30"
    )


def generate_backup_codes(count: int = 10) -> list[str]:
    codes = []
    for _ in range(count):
        raw = secrets.token_hex(3).upper()
        codes.append(f"{raw[:3]}-{raw[3:]}")
    return codes


def hash_backup_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def verify_backup_code(provided: str, hashed_codes: Iterable[str]) -> str | None:
    candidate = hash_backup_code(provided)
    for hashed in hashed_codes:
        if hmac.compare_digest(candidate, hashed):
            return hashed
    return None
