from __future__ import annotations

import hashlib
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.database import SessionLocal, set_rls_context
from app.fastapi_auth import (
    CurrentUser,
    is_admin_username_override,
    require_authenticated_user,
    require_roles,
)
from app.models.permissions import Permission
from app.models.roles import Role, role_permissions, user_roles
from app.models.users import AuthSession, MfaBackupCode, User
from app.services.mfa_service import (
    build_otpauth_uri,
    generate_backup_codes,
    generate_totp_secret,
    hash_backup_code,
    verify_backup_code,
    verify_totp,
)
from app.services.security_bootstrap import seed_roles_and_permissions
from security.auth import SECRET_KEY, TokenError, create_token, decode_token, hash_password, verify_password

try:
    import jwt
except ImportError:  # pragma: no cover - handled in runtime checks
    jwt = None


router = APIRouter(prefix="/auth", tags=["security"])
admin_router = APIRouter(prefix="/admin", tags=["security-admin"])


class LoginRequest(BaseModel):
    username: str
    password: str
    mfa_code: str | None = None
    backup_code: str | None = None


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3)
    email: str
    password: str = Field(min_length=8)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class MfaVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class RevokeSessionRequest(BaseModel):
    session_id: int


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=3)
    email: str
    password: str = Field(min_length=8)
    is_active: bool = True
    account_status: str = "ACTIVE"
    first_name: str | None = None
    middle_name: str | None = None
    last_name: str | None = None
    mobile_no: str | None = None
    role_id: int | None = None
    subscription_id: int | None = None
    api_access: bool = False
    email_verified: bool = False
    roles: list[str] = Field(default_factory=list)


class UpdateUserRequest(BaseModel):
    email: str | None = None
    is_active: bool | None = None
    account_status: str | None = None
    first_name: str | None = None
    middle_name: str | None = None
    last_name: str | None = None
    mobile_no: str | None = None
    role_id: int | None = None
    subscription_id: int | None = None
    api_access: bool | None = None
    email_verified: bool | None = None


class AssignRolesRequest(BaseModel):
    roles: list[str]


class CreateRoleRequest(BaseModel):
    name: str = Field(min_length=2)
    description: str | None = None


class CreatePermissionRequest(BaseModel):
    name: str
    description: str | None = None
    resource: str
    action: str


class AssignPermissionsRequest(BaseModel):
    permissions: list[str]


REFRESH_TOKEN_EXPIRY_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRY_DAYS", "30"))
MFA_ISSUER = os.getenv("MFA_ISSUER", "QuantEdge")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _serialize_permission(permission: Permission) -> dict[str, object]:
    return {
        "id": permission.id,
        "name": permission.name,
        "description": permission.description,
        "resource": permission.resource,
        "action": permission.action,
    }


def _serialize_role(role: Role, *, include_permissions: bool = True) -> dict[str, object]:
    payload = {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "is_system": role.is_system,
    }
    if include_permissions:
        permissions = (
            db_permission
            for db_permission in role.permissions
        ) if hasattr(role, "permissions") else []
        payload["permissions"] = [_serialize_permission(permission) for permission in permissions]
    return payload


def _user_permissions(user: User, db: Session) -> list[str]:
    if is_admin_username_override(user.username):
        permission_rows = db.query(Permission.name).distinct().all()
        return sorted(row[0] for row in permission_rows)

    if not user.roles:
        return []
    role_ids = [role.id for role in user.roles]
    permission_rows = (
        db.query(Permission.name)
        .join(role_permissions, Permission.id == role_permissions.c.permission_id)
        .filter(role_permissions.c.role_id.in_(role_ids))
        .distinct()
        .all()
    )
    return sorted(row[0] for row in permission_rows)


def _serialize_user(user: User, db: Session) -> dict[str, object]:
    role_names = sorted(
        {role.name for role in user.roles}
        | ({user.role} if user.role else set())
        | ({user.role_ref.name} if getattr(user, "role_ref", None) and user.role_ref.name else set())
    )
    if is_admin_username_override(user.username):
        role_names = sorted(set(role_names) | {"admin"})

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active,
        "is_deleted": user.is_deleted,
        "account_status": user.account_status,
        "first_name": user.first_name,
        "middle_name": user.middle_name,
        "last_name": user.last_name,
        "mobile_no": user.mobile_no,
        "role_id": user.role_id,
        "subscription_id": user.subscription_id,
        "api_access": user.api_access,
        "email_verified": user.email_verified,
        "last_login_ip": user.last_login_ip,
        "last_login_device": user.last_login_device,
        "total_login_count": user.total_login_count,
        "mfa_enabled": user.mfa_enabled,
        "last_login_at": user.last_login_at,
        "role": "admin" if is_admin_username_override(user.username) else (role_names[0] if role_names else user.role),
        "roles": role_names,
        "permissions": _user_permissions(user, db),
        "created_at": user.created_at,
    }


def _create_refresh_token(user: User) -> tuple[str, str, datetime, str]:
    if jwt is None:
        raise RuntimeError("PyJWT is required for refresh token creation")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=REFRESH_TOKEN_EXPIRY_DAYS)
    jti = uuid4().hex
    payload = {
        "sub": user.id,
        "username": user.username,
        "role": user.role,
        "token_type": "refresh",
        "iat": now,
        "exp": expires_at,
        "jti": jti,
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    hashed_token = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return token, hashed_token, expires_at, jti


def _verify_refresh_token(token: str) -> dict[str, object]:
    if jwt is None:
        raise HTTPException(status_code=500, detail="PyJWT dependency missing")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token") from exc

    if payload.get("token_type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    return payload


def _ensure_role_assignments(user: User, db: Session, role_names: list[str]) -> None:
    resolved_roles = []
    for role_name in role_names:
        role = db.query(Role).filter(Role.name == role_name).first()
        if role is None:
            raise HTTPException(status_code=404, detail=f"Role '{role_name}' not found")
        resolved_roles.append(role)

    user.roles = resolved_roles
    if resolved_roles:
        user.role = resolved_roles[0].name


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    set_rls_context(db, None, "admin")
    existing = (
        db.query(User)
        .filter((User.username == request.username) | (User.email == request.email))
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Username or email already exists")

    user = User(
        username=request.username,
        email=request.email,
        password_hash=hash_password(request.password),
        role="SUBSCRIBER",
        is_active=True,
        account_status="ACTIVE",
        email_verified=False,
    )
    db.add(user)
    db.flush()

    default_role = db.query(Role).filter(Role.name == "read_only_user").first()
    if default_role:
        user.roles = [default_role]

    db.commit()
    db.refresh(user)
    return {"user": _serialize_user(user, db)}


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    set_rls_context(db, None, "admin")
    user = (
        db.query(User)
        .filter((User.username == payload.username) | (User.email == payload.username))
        .first()
    )

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        user.last_failed_login = datetime.now(timezone.utc)
        if user.failed_login_attempts >= int(os.getenv("MAX_FAILED_LOGINS", "5")):
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    if user.is_deleted:
        raise HTTPException(status_code=403, detail="Account is deleted")

    if user.account_status and user.account_status.upper() != "ACTIVE":
        raise HTTPException(status_code=403, detail=f"Account status is {user.account_status}")

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=423, detail="Account is locked")

    if user.mfa_enabled:
        mfa_ok = False
        if payload.mfa_code and user.mfa_secret:
            mfa_ok = verify_totp(user.mfa_secret, payload.mfa_code)

        if not mfa_ok and payload.backup_code:
            active_codes = [code for code in user.mfa_backup_codes if code.used_at is None]
            match = verify_backup_code(payload.backup_code, [code.code_hash for code in active_codes])
            if match:
                code_row = next(code for code in active_codes if code.code_hash == match)
                code_row.used_at = datetime.now(timezone.utc)
                mfa_ok = True

        if not mfa_ok:
            raise HTTPException(status_code=401, detail="MFA required or invalid MFA code")

    access_token = create_token(user.id, user.username, user.role)
    refresh_token, refresh_hash, refresh_exp, refresh_jti = _create_refresh_token(user)

    session = AuthSession(
        user_id=user.id,
        refresh_token_hash=refresh_hash,
        jti=refresh_jti,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
        expires_at=refresh_exp,
    )
    db.add(session)

    user.last_login_at = datetime.now(timezone.utc)
    user.failed_login_attempts = 0
    user.locked_until = None
    user.total_login_count = (user.total_login_count or 0) + 1
    user.last_login_ip = request.client.host if request.client else None
    user.last_login_device = request.headers.get("User-Agent")

    db.commit()
    db.refresh(user)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": _serialize_user(user, db),
    }


@router.post("/refresh")
def refresh_tokens(payload: TokenRefreshRequest, db: Session = Depends(get_db)):
    set_rls_context(db, None, "admin")
    token_payload = _verify_refresh_token(payload.refresh_token)
    refresh_hash = hashlib.sha256(payload.refresh_token.encode("utf-8")).hexdigest()

    session = (
        db.query(AuthSession)
        .filter(
            and_(
                AuthSession.refresh_token_hash == refresh_hash,
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > datetime.now(timezone.utc),
            )
        )
        .first()
    )

    if session is None:
        raise HTTPException(status_code=401, detail="Refresh session is invalid or revoked")

    user = db.query(User).filter(User.id == int(token_payload["sub"])).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User is not active")

    session.revoked_at = datetime.now(timezone.utc)

    access_token = create_token(user.id, user.username, user.role)
    refresh_token, new_hash, new_exp, new_jti = _create_refresh_token(user)
    db.add(
        AuthSession(
            user_id=user.id,
            refresh_token_hash=new_hash,
            jti=new_jti,
            ip_address=session.ip_address,
            user_agent=session.user_agent,
            expires_at=new_exp,
        )
    )
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/logout")
def logout(
    payload: TokenRefreshRequest,
    _: CurrentUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    refresh_hash = hashlib.sha256(payload.refresh_token.encode("utf-8")).hexdigest()
    session = db.query(AuthSession).filter(AuthSession.refresh_token_hash == refresh_hash).first()
    if session and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        db.commit()
    return {"message": "Logged out"}


@router.get("/me")
def get_me(user: CurrentUser = Depends(require_authenticated_user), db: Session = Depends(get_db)):
    set_rls_context(db, user.id, user.role)
    db_user = db.query(User).filter(User.id == user.id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": _serialize_user(db_user, db)}


@router.post("/password/change")
def change_password(
    payload: ChangePasswordRequest,
    user: CurrentUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    db_user = db.query(User).filter(User.id == user.id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.current_password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    db_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed"}


@router.post("/mfa/setup")
def setup_mfa(
    user: CurrentUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    db_user = db.query(User).filter(User.id == user.id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    secret = generate_totp_secret()
    db_user.mfa_secret = secret
    db_user.mfa_enabled = False

    db.query(MfaBackupCode).filter(MfaBackupCode.user_id == db_user.id).delete()
    backup_codes = generate_backup_codes()
    for code in backup_codes:
        db.add(MfaBackupCode(user_id=db_user.id, code_hash=hash_backup_code(code)))

    db.commit()

    return {
        "secret": secret,
        "otpauth_uri": build_otpauth_uri(secret, db_user.username, issuer=MFA_ISSUER),
        "backup_codes": backup_codes,
    }


@router.post("/mfa/verify")
def verify_mfa_setup(
    payload: MfaVerifyRequest,
    user: CurrentUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    db_user = db.query(User).filter(User.id == user.id).first()
    if db_user is None or not db_user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA setup has not been initialized")

    if not verify_totp(db_user.mfa_secret, payload.code):
        raise HTTPException(status_code=401, detail="Invalid MFA code")

    db_user.mfa_enabled = True
    db.commit()
    return {"message": "MFA enabled"}


@router.post("/mfa/disable")
def disable_mfa(
    payload: MfaVerifyRequest,
    user: CurrentUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    db_user = db.query(User).filter(User.id == user.id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if db_user.mfa_enabled and db_user.mfa_secret and not verify_totp(db_user.mfa_secret, payload.code):
        raise HTTPException(status_code=401, detail="Invalid MFA code")

    db_user.mfa_enabled = False
    db_user.mfa_secret = None
    db.query(MfaBackupCode).filter(MfaBackupCode.user_id == db_user.id).delete()
    db.commit()
    return {"message": "MFA disabled"}


@router.get("/sessions")
def list_sessions(
    user: CurrentUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(AuthSession)
        .filter(AuthSession.user_id == user.id)
        .order_by(AuthSession.created_at.desc())
        .all()
    )
    return {
        "sessions": [
            {
                "id": session.id,
                "ip_address": session.ip_address,
                "user_agent": session.user_agent,
                "created_at": session.created_at,
                "last_seen_at": session.last_seen_at,
                "expires_at": session.expires_at,
                "revoked_at": session.revoked_at,
            }
            for session in sessions
        ]
    }


@router.post("/sessions/revoke")
def revoke_session(
    payload: RevokeSessionRequest,
    user: CurrentUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(AuthSession)
        .filter(and_(AuthSession.id == payload.session_id, AuthSession.user_id == user.id))
        .first()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    session.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Session revoked"}


@admin_router.get("/users")
def admin_list_users(
    current_user: CurrentUser = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    set_rls_context(db, current_user.id, current_user.role)
    users = db.query(User).order_by(User.created_at.desc()).all()
    return {"users": [_serialize_user(user, db) for user in users]}


@admin_router.post("/users", status_code=status.HTTP_201_CREATED)
def admin_create_user(
    payload: CreateUserRequest,
    current_user: CurrentUser = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    set_rls_context(db, current_user.id, current_user.role)
    existing = (
        db.query(User)
        .filter((User.username == payload.username) | (User.email == payload.email))
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Username or email already exists")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        is_active=payload.is_active,
        account_status=payload.account_status,
        first_name=payload.first_name,
        middle_name=payload.middle_name,
        last_name=payload.last_name,
        mobile_no=payload.mobile_no,
        role_id=payload.role_id,
        subscription_id=payload.subscription_id,
        api_access=payload.api_access,
        email_verified=payload.email_verified,
        role="read_only_user",
    )
    db.add(user)
    db.flush()

    if payload.role_id is not None:
        db_role = db.query(Role).filter(Role.id == payload.role_id).first()
        if db_role is None:
            raise HTTPException(status_code=404, detail="Role not found")
        user.role = db_role.name

    if payload.roles:
        _ensure_role_assignments(user, db, payload.roles)

    db.commit()
    db.refresh(user)
    return {"user": _serialize_user(user, db)}


@admin_router.patch("/users/{user_id}")
def admin_update_user(
    user_id: int,
    payload: UpdateUserRequest,
    current_user: CurrentUser = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    set_rls_context(db, current_user.id, current_user.role)
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email is not None:
        user.email = payload.email
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.account_status is not None:
        user.account_status = payload.account_status
    if payload.first_name is not None:
        user.first_name = payload.first_name
    if payload.middle_name is not None:
        user.middle_name = payload.middle_name
    if payload.last_name is not None:
        user.last_name = payload.last_name
    if payload.mobile_no is not None:
        user.mobile_no = payload.mobile_no
    if payload.role_id is not None:
        db_role = db.query(Role).filter(Role.id == payload.role_id).first()
        if db_role is None:
            raise HTTPException(status_code=404, detail="Role not found")
        user.role_id = payload.role_id
        user.role = db_role.name
    if payload.subscription_id is not None:
        user.subscription_id = payload.subscription_id
    if payload.api_access is not None:
        user.api_access = payload.api_access
    if payload.email_verified is not None:
        user.email_verified = payload.email_verified

    db.commit()
    db.refresh(user)
    return {"user": _serialize_user(user, db)}


@admin_router.put("/users/{user_id}/roles")
def admin_assign_roles(
    user_id: int,
    payload: AssignRolesRequest,
    current_user: CurrentUser = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    set_rls_context(db, current_user.id, current_user.role)
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    _ensure_role_assignments(user, db, payload.roles)
    db.commit()
    db.refresh(user)
    return {"user": _serialize_user(user, db)}


@admin_router.get("/roles")
def admin_list_roles(
    _: CurrentUser = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    roles = db.query(Role).order_by(Role.name.asc()).all()
    result = []
    for role in roles:
        permissions = (
            db.query(Permission)
            .join(role_permissions, Permission.id == role_permissions.c.permission_id)
            .filter(role_permissions.c.role_id == role.id)
            .all()
        )
        result.append(
            {
                "id": role.id,
                "name": role.name,
                "description": role.description,
                "is_system": role.is_system,
                "permissions": [_serialize_permission(permission) for permission in permissions],
            }
        )
    return {"roles": result}


@admin_router.post("/roles", status_code=status.HTTP_201_CREATED)
def admin_create_role(
    payload: CreateRoleRequest,
    _: CurrentUser = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    existing = db.query(Role).filter(Role.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Role already exists")

    role = Role(name=payload.name, description=payload.description, is_system=False)
    db.add(role)
    db.commit()
    db.refresh(role)
    return {"role": {"id": role.id, "name": role.name, "description": role.description}}


@admin_router.put("/roles/{role_id}/permissions")
def admin_assign_permissions(
    role_id: int,
    payload: AssignPermissionsRequest,
    _: CurrentUser = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")

    permissions = db.query(Permission).filter(Permission.name.in_(payload.permissions)).all()
    resolved = {permission.name: permission for permission in permissions}

    missing = [name for name in payload.permissions if name not in resolved]
    if missing:
        raise HTTPException(status_code=404, detail=f"Permissions not found: {', '.join(missing)}")

    db.execute(role_permissions.delete().where(role_permissions.c.role_id == role.id))
    for permission in permissions:
        db.execute(
            role_permissions.insert().values(
                role_id=role.id,
                permission_id=permission.id,
            )
        )

    db.commit()
    return {"message": "Permissions assigned"}


@admin_router.get("/permissions")
def admin_list_permissions(
    _: CurrentUser = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    permissions = db.query(Permission).order_by(Permission.name.asc()).all()
    return {"permissions": [_serialize_permission(permission) for permission in permissions]}


@admin_router.post("/permissions", status_code=status.HTTP_201_CREATED)
def admin_create_permission(
    payload: CreatePermissionRequest,
    _: CurrentUser = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    existing = db.query(Permission).filter(Permission.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Permission already exists")

    permission = Permission(
        name=payload.name,
        description=payload.description,
        resource=payload.resource,
        action=payload.action,
    )
    db.add(permission)
    db.commit()
    db.refresh(permission)
    return {"permission": _serialize_permission(permission)}


@admin_router.post("/security/bootstrap")
def bootstrap_security(
    _: CurrentUser = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    seed_roles_and_permissions(db)
    return {"message": "Security roles and permissions synchronized"}
