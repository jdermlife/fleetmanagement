from __future__ import annotations

import json
import logging
import os
from contextlib import closing
from datetime import datetime, timezone
from functools import wraps
from typing import Any

try:
    from ..models import get_connection, resolve_database_config
except ImportError:
    from app.models import get_connection, resolve_database_config


AUDIT_LOG_LEVEL = os.getenv("AUDIT_LOG_LEVEL", "INFO")

audit_logger = logging.getLogger("fleet.audit")
audit_logger.setLevel(getattr(logging, AUDIT_LOG_LEVEL))

if not audit_logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    ))
    audit_logger.addHandler(handler)


class AuditLogger:
    def __init__(self, config: Any = None):
        self.config = config
    
    def log(self, action: str, entity_type: str, entity_id: int | None = None,
            details: str = "", user_id: int | None = None, ip_address: str | None = None) -> None:
        audit_logger.info(json.dumps({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "details": details,
            "user_id": user_id,
            "ip_address": ip_address,
        }))
        
        if self.config:
            try:
                with closing(get_connection(self.config)) as conn:
                    conn.execute(
                        "INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)",
                        (user_id, action, entity_type, entity_id, details)
                    )
            except Exception as e:
                audit_logger.error(f"Failed to write audit log to database: {e}")
    
    def log_request(self, request, action: str, entity_type: str, entity_id: int | None = None, details: str = "") -> None:
        ip = request.headers.get("X-Forwarded-For", request.remote_addr)
        user_id = getattr(request, "current_user", {}).get("id")
        self.log(action, entity_type, entity_id, details, user_id, ip)


audit_logger_singleton: AuditLogger | None = None


def get_audit_logger() -> AuditLogger:
    global audit_logger_singleton
    return audit_logger_singleton or AuditLogger()


def audit_decorator(action: str, entity_type: str):
    def decorator(fn):
        @wraps(fn)
        def decorated(*args, **kwargs):
            from flask import request, g
            from contextlib import closing
            
            logger = get_audit_logger()
            result = fn(*args, **kwargs)
            
            entity_id = None
            if hasattr(result, "get_json"):
                try:
                    data = result.get_json()
                    if isinstance(data, dict) and "id" in data:
                        entity_id = data["id"]
                except Exception:
                    pass
            
            details = f"{action} performed on {entity_type}"
            logger.log_request(request, action, entity_type, entity_id, details)
            
            return result
        return decorated
    return decorator