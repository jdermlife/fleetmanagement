from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.fastapi_auth import CurrentUser, require_roles
from app.routes.subscriptions import (
    _capture_paypal_order_for_user,
    _create_paypal_order_for_user,
    _receive_paypal_webhook,
)
from app.schemas.subscription_schema import (
    PayPalCaptureOrderRequest,
    PayPalCreateOrderRequest,
)

router = APIRouter(prefix="/paypal", tags=["paypal"])


@router.post("/create-order")
def paypal_create_order(
    payload: PayPalCreateOrderRequest,
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
):
    return _create_paypal_order_for_user(payload=payload, user=user)


@router.post("/capture-order")
def paypal_capture_order(
    payload: PayPalCaptureOrderRequest,
    user: CurrentUser = Depends(
        require_roles("Admin", "Subscriber", "subscriber_borrower", "subscriber_lender")
    ),
):
    return _capture_paypal_order_for_user(payload=payload, user=user)


@router.post("/webhook")
async def paypal_webhook(request: Request):
    return await _receive_paypal_webhook(request=request)
