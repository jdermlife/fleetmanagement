from __future__ import annotations

from fastapi import APIRouter, Header, Request

from app.routes.subscriptions import receive_paymongo_webhook

router = APIRouter(prefix="/paymongo", tags=["paymongo"])


@router.post("/webhook")
async def paymongo_webhook(
    request: Request,
    paymongo_signature: str | None = Header(default=None, alias="Paymongo-Signature"),
):
    return await receive_paymongo_webhook(request=request, paymongo_signature=paymongo_signature)
