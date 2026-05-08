from __future__ import annotations

from enum import Enum
from functools import wraps
from typing import Any


class Permission(str, Enum):
    READ_VEHICLES = "read:vehicles"
    WRITE_VEHICLES = "write:vehicles"
    DELETE_VEHICLES = "delete:vehicles"
    READ_FUEL_LOGS = "read:fuel_logs"
    WRITE_FUEL_LOGS = "write:fuel_logs"
    DELETE_FUEL_LOGS = "delete:fuel_logs"
    READ_DRIVERS = "read:drivers"
    WRITE_DRIVERS = "write:drivers"
    DELETE_DRIVERS = "delete:drivers"
    READ_SCORECARDS = "read:scorecards"
    WRITE_SCORECARDS = "write:scorecards"
    READ_AUDIT_LOGS = "read:audit_logs"
    ADMIN_USERS = "admin:users"


class Role(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    DRIVER = "driver"
    VIEWER = "viewer"


ROLE_PERMISSIONS: dict[Role, list[Permission]] = {
    Role.ADMIN: [p for p in Permission],
    Role.MANAGER: [
        Permission.READ_VEHICLES,
        Permission.WRITE_VEHICLES,
        Permission.READ_FUEL_LOGS,
        Permission.WRITE_FUEL_LOGS,
        Permission.READ_DRIVERS,
        Permission.WRITE_DRIVERS,
        Permission.READ_SCORECARDS,
        Permission.WRITE_SCORECARDS,
        Permission.READ_AUDIT_LOGS,
    ],
    Role.DRIVER: [
        Permission.READ_VEHICLES,
        Permission.READ_FUEL_LOGS,
        Permission.READ_DRIVERS,
    ],
    Role.VIEWER: [
        Permission.READ_VEHICLES,
        Permission.READ_FUEL_LOGS,
    ],
}


def role_required(*required_roles: Role):
    def decorator(fn):
        @wraps(fn)
        def decorated(*args, **kwargs):
            from flask import request, jsonify
            
            if not hasattr(request, "current_user"):
                return jsonify({"error": "Authentication required"}), 401
            
            user_role = request.current_user.get("role")
            if user_role not in [r.value for r in required_roles]:
                return jsonify({"error": "Insufficient permissions"}), 403
            
            return fn(*args, **kwargs)
        return decorated
    return decorator


def permission_required(permission: Permission):
    def decorator(fn):
        @wraps(fn)
        def decorated(*args, **kwargs):
            from flask import request, jsonify
            
            if not hasattr(request, "current_user"):
                return jsonify({"error": "Authentication required"}), 401
            
            user_role = request.current_user.get("role")
            role = Role(user_role) if user_role in [r.value for r in Role] else None
            
            if role and permission not in ROLE_PERMISSIONS.get(role, []):
                return jsonify({"error": "Insufficient permissions"}), 403
            
            return fn(*args, **kwargs)
        return decorated
    return decorator


def has_permission(role: Role | str, permission: Permission) -> bool:
    role = Role(role) if isinstance(role, str) else role
    return permission in ROLE_PERMISSIONS.get(role, [])