from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import set_rls_context
from app.models.users import User
from app.routes.security import (
    _build_login_payload,
    _ensure_default_role,
    _enforce_login_access_policy,
    _generate_unique_username,
    _resolve_registration_role,
    _username_from_google_email,
    _verify_apple_id_token,
    get_db,
)
from app.services.account_access_service import configure_new_account_access
from security.auth import hash_password


router = APIRouter(prefix="/auth")


class AppleTokenRequest(BaseModel):
    identity_token: str = Field(min_length=10)
    subscriber_type: Literal["borrower", "lender"] | None = None
    lender_data_sharing_consent: bool | None = None


@router.post("/apple-token")
def login_with_apple_identity_token(
    payload: AppleTokenRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    set_rls_context(db, None, "admin")
    token_data = _verify_apple_id_token(payload.identity_token)

    email = str(token_data.get("email") or "").strip().lower()
    subject = str(token_data.get("sub") or "").strip()
    email_verified_claim = token_data.get("email_verified")
    email_verified = email_verified_claim in {True, "true", "1", 1}

    if not subject:
        raise HTTPException(status_code=401, detail="Invalid Apple token subject")

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Apple account email is required. Share email on first Apple sign-in.",
        )

    if not email_verified:
        raise HTTPException(status_code=401, detail="Apple account email is missing or unverified")

    user = db.query(User).filter(User.email == email).first()

    if user is None:
        if payload.subscriber_type is None:
            raise HTTPException(
                status_code=400,
                detail="Select borrower or lender for first-time Apple sign-in",
            )
        if payload.lender_data_sharing_consent is None:
            raise HTTPException(
                status_code=400,
                detail="Select data-sharing preference for first-time Apple sign-in",
            )

        role_name = _resolve_registration_role(payload.subscriber_type)
        requested_username = _username_from_google_email(email)
        unique_username = _generate_unique_username(db, requested_username)

        user = User(
            username=unique_username,
            email=email,
            password_hash=hash_password(f"apple_oauth_{uuid4().hex}"),
            role=role_name,
            is_active=True,
            account_status="ACTIVE",
            email_verified=True,
            email_verified_at=datetime.now(timezone.utc),
            lender_data_sharing_consent=payload.lender_data_sharing_consent,
            lender_data_sharing_consent_recorded_at=datetime.now(timezone.utc),
        )
        configure_new_account_access(user)
        db.add(user)
        db.flush()
        _ensure_default_role(user, db, role_name)
        db.commit()
        db.refresh(user)

    _enforce_login_access_policy(user, db)

    if not user.email_verified:
        user.email_verified = True
        user.email_verified_at = user.email_verified_at or datetime.now(timezone.utc)

    return _build_login_payload(user, request, db)