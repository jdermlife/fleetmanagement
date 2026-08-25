from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import set_rls_context
from app.routes.security import (
    AppleTokenLoginRequest,
    _login_with_apple_claims,
    _verify_apple_id_token,
    get_db,
)


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
    normalized_payload = AppleTokenLoginRequest(
        id_token=payload.identity_token,
        subscriber_type=payload.subscriber_type,
        lender_data_sharing_consent=payload.lender_data_sharing_consent,
    )
    return _login_with_apple_claims(token_data, normalized_payload, request, db)