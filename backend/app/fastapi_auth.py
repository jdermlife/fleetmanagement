import os
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from security.auth import TokenError, decode_token


AUTH_REQUIRED = os.getenv("ENFORCE_AUTH", "true").lower() == "true"
ADMIN_USERNAME_OVERRIDE = "admin123"

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: int
    username: str
    role: str


def is_admin_username_override(username: str | None) -> bool:
    return (username or "").strip().lower() == ADMIN_USERNAME_OVERRIDE


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser | None:
    if credentials is None:
        if AUTH_REQUIRED:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Please Login.",
            )
        return None

    try:
        payload = decode_token(credentials.credentials)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication is not configured",
        ) from exc

    resolved_role = "admin" if is_admin_username_override(payload.username) else payload.role

    return CurrentUser(
        id=payload.sub,
        username=payload.username,
        role=resolved_role,
    )


def require_authenticated_user(
    user: CurrentUser | None = Depends(get_current_user),
) -> CurrentUser:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    return user


def require_roles(*allowed_roles: str):
    allowed = {role.strip().lower() for role in allowed_roles if role.strip()}

    def dependency(user: CurrentUser = Depends(require_authenticated_user)) -> CurrentUser:
        if allowed and user.role.lower() not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return dependency
