from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException

from app.database import SessionLocal
from app.fastapi_auth import CurrentUser, require_authenticated_user
from app.schemas.ai_governance_schema import PageAssistantRequest, PageAssistantResponse
from app.services.ai_governance_service import (
    create_ai_request,
    finalize_ai_failure,
    finalize_ai_success,
)
from app.services.page_assistant_service import (
    AI_DISCLAIMER,
    answer_page_assistant,
)
from app.services.ai_provider import OpenAIQuotaExhaustedError


router = APIRouter()


def _answer(payload: PageAssistantRequest, current_user: CurrentUser | None) -> PageAssistantResponse:
    authenticated = current_user is not None
    governance_db = None
    request_log = None

    try:
        result = answer_page_assistant(
            message=payload.message,
            page_path=payload.page_path,
            history=payload.history,
            authenticated=authenticated,
            role=current_user.role if current_user else None,
        )

        governance_logging_enabled = os.getenv("AI_GOVERNANCE_LOGGING_ENABLED", "true").lower() == "true"
        if result.provider_result is not None and governance_logging_enabled:
            try:
                governance_db = SessionLocal()
                request_log = create_ai_request(
                    governance_db,
                    user_id=current_user.id if current_user else None,
                    endpoint="/ai/page-assistant" if authenticated else "/ai/page-assistant/public",
                    prompt=None,
                    model=os.getenv("AI_PROVIDER_MODE", "openai"),
                    request_metadata={
                        "feature": "page_assistant",
                        "authenticated": authenticated,
                        "refused": result.refused,
                    },
                )
                provider = result.provider_result
                finalize_ai_success(
                    governance_db,
                    request_id=request_log.id,
                    user_id=current_user.id if current_user else None,
                    model=f"{provider.provider}:{provider.model}",
                    response_text=None,
                    response_json={"refused": result.refused},
                    input_tokens=provider.input_tokens,
                    output_tokens=provider.output_tokens,
                    total_tokens=provider.total_tokens,
                    latency_ms=provider.latency_ms,
                )
            except Exception:
                # Assistant availability must not depend on optional governance logging.
                pass

        return PageAssistantResponse(
            answer=result.answer,
            refused=result.refused,
            disclaimer=AI_DISCLAIMER,
        )
    except OpenAIQuotaExhaustedError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "openai_quota_exhausted",
                "message": "OpenAI usage is exhausted; the local assistant fallback may be used.",
            },
        ) from exc
    except Exception as exc:
        if governance_db is not None and request_log is not None:
            try:
                finalize_ai_failure(governance_db, request_id=request_log.id, error_message=str(exc))
            except Exception:
                pass
        raise HTTPException(
            status_code=503,
            detail="The assistant is temporarily unavailable. Please try again in a few moments.",
        ) from exc
    finally:
        if governance_db is not None:
            governance_db.close()


@router.post("/ai/page-assistant/public", response_model=PageAssistantResponse)
async def public_page_assistant(payload: PageAssistantRequest):
    return _answer(payload, None)


@router.post("/ai/page-assistant", response_model=PageAssistantResponse)
async def authenticated_page_assistant(
    payload: PageAssistantRequest,
    current_user: CurrentUser = Depends(require_authenticated_user),
):
    return _answer(payload, current_user)
