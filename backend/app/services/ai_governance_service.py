import json
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.ai_governance import AIFeedback, AIRequest, AIResponse

MODEL_PRICING_PER_1K: dict[str, tuple[float, float]] = {
    "gpt-4.1": (0.01, 0.03),
    "gpt-4.1-mini": (0.0004, 0.0016),
    "whisper-1": (0.0, 0.0),
}


def _as_json(value: Any) -> str | None:
    if value is None:
        return None
    try:
        return json.dumps(value, default=str)
    except Exception:
        return str(value)


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = MODEL_PRICING_PER_1K.get(model, (0.0, 0.0))
    return ((input_tokens / 1000.0) * in_rate) + ((output_tokens / 1000.0) * out_rate)


def extract_usage(response: Any) -> tuple[int, int, int]:
    usage = getattr(response, "usage", None)
    if usage is None and isinstance(response, dict):
        usage = response.get("usage")

    if not usage:
        return 0, 0, 0

    if isinstance(usage, dict):
        input_tokens = int(usage.get("prompt_tokens", 0) or 0)
        output_tokens = int(usage.get("completion_tokens", 0) or 0)
        total_tokens = int(usage.get("total_tokens", 0) or 0)
    else:
        input_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        output_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        total_tokens = int(getattr(usage, "total_tokens", 0) or 0)

    if total_tokens == 0:
        total_tokens = input_tokens + output_tokens

    return input_tokens, output_tokens, total_tokens


def create_ai_request(
    db: Session,
    *,
    user_id: int | None,
    endpoint: str,
    prompt: str | None,
    model: str,
    request_metadata: dict[str, Any] | None = None,
) -> AIRequest:
    row = AIRequest(
        user_id=user_id,
        endpoint=endpoint,
        prompt=prompt,
        model=model,
        request_metadata=_as_json(request_metadata),
        status="started",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def finalize_ai_success(
    db: Session,
    *,
    request_id: int,
    user_id: int | None,
    model: str,
    response_text: str | None,
    response_json: dict[str, Any] | None,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
    latency_ms: int | None,
) -> AIResponse:
    cost = estimate_cost(model, input_tokens, output_tokens)

    request_row = db.query(AIRequest).filter(AIRequest.id == request_id).first()
    if request_row:
        request_row.status = "success"
        request_row.input_tokens = input_tokens
        request_row.output_tokens = output_tokens
        request_row.total_tokens = total_tokens
        request_row.cost = cost
        request_row.error_message = None

    response_row = AIResponse(
        request_id=request_id,
        user_id=user_id,
        model=model,
        response_text=response_text,
        response_json=_as_json(response_json),
        cost=cost,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        latency_ms=latency_ms,
    )

    db.add(response_row)
    db.commit()
    db.refresh(response_row)
    return response_row


def finalize_ai_failure(db: Session, *, request_id: int, error_message: str) -> None:
    request_row = db.query(AIRequest).filter(AIRequest.id == request_id).first()
    if request_row:
        request_row.status = "failed"
        request_row.error_message = error_message[:2000]
        db.commit()


def create_feedback(
    db: Session,
    *,
    user_id: int | None,
    request_id: int | None,
    response_id: int | None,
    rating: int,
    feedback_text: str | None,
) -> AIFeedback:
    row = AIFeedback(
        user_id=user_id,
        request_id=request_id,
        response_id=response_id,
        rating=rating,
        feedback_text=feedback_text,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def governance_stats(db: Session) -> dict[str, float | int]:
    total_requests = int(db.query(func.count(AIRequest.id)).scalar() or 0)
    successful_requests = int(db.query(func.count(AIRequest.id)).filter(AIRequest.status == "success").scalar() or 0)
    failed_requests = int(db.query(func.count(AIRequest.id)).filter(AIRequest.status == "failed").scalar() or 0)
    total_cost = float(db.query(func.coalesce(func.sum(AIRequest.cost), 0.0)).scalar() or 0.0)
    total_tokens = int(db.query(func.coalesce(func.sum(AIRequest.total_tokens), 0)).scalar() or 0)
    avg_latency_ms = float(db.query(func.coalesce(func.avg(AIResponse.latency_ms), 0.0)).scalar() or 0.0)

    return {
        "total_requests": total_requests,
        "successful_requests": successful_requests,
        "failed_requests": failed_requests,
        "total_cost": round(total_cost, 6),
        "total_tokens": total_tokens,
        "avg_latency_ms": round(avg_latency_ms, 2),
    }
