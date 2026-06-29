from __future__ import annotations

from enum import Enum
from functools import wraps
from typing import Any


class Permission(str, Enum):
    # Loan Management
    READ_LOANS = "read:loans"
    CREATE_LOANS = "create:loans"
    EDIT_LOANS = "edit:loans"
    APPROVE_LOANS = "approve:loans"
    FINAL_APPROVE_LOANS = "final_approve:loans"
    EXPORT_LOANS = "export:loans"
    
    # Borrower Management
    READ_BORROWERS = "read:borrowers"
    CREATE_BORROWERS = "create:borrowers"
    EDIT_BORROWERS = "edit:borrowers"
    
    # Scoring & Analytics
    READ_SCORECARDS = "read:scorecards"
    WRITE_SCORECARDS = "write:scorecards"
    READ_ANALYTICS = "read:analytics"
    
    # Fleet Management
    READ_VEHICLES = "read:vehicles"
    WRITE_VEHICLES = "write:vehicles"
    DELETE_VEHICLES = "delete:vehicles"
    READ_FUEL_LOGS = "read:fuel_logs"
    WRITE_FUEL_LOGS = "write:fuel_logs"
    DELETE_FUEL_LOGS = "delete:fuel_logs"
    READ_DRIVERS = "read:drivers"
    WRITE_DRIVERS = "write:drivers"
    DELETE_DRIVERS = "delete:drivers"
    
    # Audit & System
    READ_AUDIT_LOGS = "read:audit_logs"
    ADMIN_USERS = "admin:users"
    MANAGE_SYSTEM = "manage:system"


class Role(str, Enum):
    ADMIN = "admin"
    SUBSCRIBER = "subscriber"
    LOAN_OFFICER = "loan_officer"
    CREDIT_ANALYST = "credit_analyst"
    CREDIT_MANAGER = "credit_manager"
    APPROVER = "approver"
    OPERATIONS = "operations"
    AUDITOR = "auditor"
    READ_ONLY_USER = "read_only_user"


ROLE_PERMISSIONS: dict[Role, list[Permission]] = {
    # Admin: Full access to everything
    Role.ADMIN: [p for p in Permission],

    # Subscriber: Can originate and manage their own loan applications.
    Role.SUBSCRIBER: [
        Permission.READ_LOANS,
        Permission.CREATE_LOANS,
        Permission.EDIT_LOANS,
        Permission.EXPORT_LOANS,
        Permission.READ_BORROWERS,
        Permission.CREATE_BORROWERS,
        Permission.EDIT_BORROWERS,
        Permission.READ_SCORECARDS,
        Permission.READ_ANALYTICS,
    ],
    
    # Loan Officer: Create loans, manage borrowers, view scorecards
    Role.LOAN_OFFICER: [
        Permission.READ_LOANS,
        Permission.CREATE_LOANS,
        Permission.EDIT_LOANS,
        Permission.READ_BORROWERS,
        Permission.CREATE_BORROWERS,
        Permission.EDIT_BORROWERS,
        Permission.READ_SCORECARDS,
        Permission.READ_ANALYTICS,
    ],
    
    # Credit Analyst: Score loans, view analytics, read-only most data
    Role.CREDIT_ANALYST: [
        Permission.READ_LOANS,
        Permission.EDIT_LOANS,
        Permission.READ_BORROWERS,
        Permission.READ_SCORECARDS,
        Permission.WRITE_SCORECARDS,
        Permission.READ_ANALYTICS,
        Permission.READ_VEHICLES,
        Permission.READ_DRIVERS,
    ],
    
    # Credit Manager: Approve loans, manage loan officers
    Role.CREDIT_MANAGER: [
        Permission.READ_LOANS,
        Permission.CREATE_LOANS,
        Permission.EDIT_LOANS,
        Permission.APPROVE_LOANS,
        Permission.READ_BORROWERS,
        Permission.CREATE_BORROWERS,
        Permission.EDIT_BORROWERS,
        Permission.READ_SCORECARDS,
        Permission.WRITE_SCORECARDS,
        Permission.READ_ANALYTICS,
        Permission.READ_AUDIT_LOGS,
    ],
    
    # Approver: Final sign-off on loans (high-value or final stage)
    Role.APPROVER: [
        Permission.READ_LOANS,
        Permission.APPROVE_LOANS,
        Permission.FINAL_APPROVE_LOANS,
        Permission.READ_BORROWERS,
        Permission.READ_SCORECARDS,
        Permission.READ_ANALYTICS,
        Permission.READ_AUDIT_LOGS,
    ],
    
    # Operations: Fleet management (vehicles, drivers, fuel, maintenance)
    Role.OPERATIONS: [
        Permission.READ_VEHICLES,
        Permission.WRITE_VEHICLES,
        Permission.DELETE_VEHICLES,
        Permission.READ_FUEL_LOGS,
        Permission.WRITE_FUEL_LOGS,
        Permission.DELETE_FUEL_LOGS,
        Permission.READ_DRIVERS,
        Permission.WRITE_DRIVERS,
        Permission.DELETE_DRIVERS,
        Permission.READ_LOANS,
    ],
    
    # Auditor: Read-only access to everything, full audit logs
    Role.AUDITOR: [
        Permission.READ_LOANS,
        Permission.READ_BORROWERS,
        Permission.READ_SCORECARDS,
        Permission.READ_ANALYTICS,
        Permission.READ_VEHICLES,
        Permission.READ_FUEL_LOGS,
        Permission.READ_DRIVERS,
        Permission.READ_AUDIT_LOGS,
    ],
    
    # Read-Only User: Dashboard views and basic read-only access
    Role.READ_ONLY_USER: [
        Permission.READ_LOANS,
        Permission.READ_BORROWERS,
        Permission.READ_ANALYTICS,
        Permission.READ_VEHICLES,
        Permission.READ_DRIVERS,
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
