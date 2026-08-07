from __future__ import annotations

import os
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import httpx
from openai import OpenAI


@dataclass
class AITextResult:
    provider: str
    model: str
    content: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    latency_ms: int


_openai_client: OpenAI | None = None

OPENAI_QUOTA_ERROR_CODES = {
    "billing_hard_limit_reached",
    "credit_balance_exhausted",
    "insufficient_quota",
    "organization_spend_limit_exceeded",
    "project_spend_limit_exceeded",
}


class OpenAIQuotaExhaustedError(RuntimeError):
    """Raised only when OpenAI reports an exhausted credit or spend quota."""


def _normalize_mode(value: str | None) -> str:
    mode = (value or "openai").strip().lower()
    if mode not in {"openai", "ollama", "hybrid"}:
        return "openai"
    return mode


def _get_openai_client() -> OpenAI:
    global _openai_client

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    if _openai_client is None:
        _openai_client = OpenAI(api_key=api_key)

    return _openai_client


def _openai_error_details(exc: Exception) -> tuple[str, str, str]:
    body: Any = getattr(exc, "body", None)
    if isinstance(body, Mapping):
        nested_error = body.get("error")
        details = nested_error if isinstance(nested_error, Mapping) else body
    else:
        details = {}

    code = str(details.get("code") or getattr(exc, "code", "") or "").strip().lower()
    error_type = str(details.get("type") or getattr(exc, "type", "") or "").strip().lower()
    message = str(details.get("message") or str(exc) or "").strip().lower()
    return code, error_type, message


def is_openai_quota_exhausted(exc: Exception) -> bool:
    code, error_type, message = _openai_error_details(exc)
    if code in OPENAI_QUOTA_ERROR_CODES or error_type == "insufficient_quota":
        return True

    quota_phrases = (
        "credit balance is exhausted",
        "exceeded your current quota",
        "insufficient quota",
        "organization spend limit",
        "project spend limit",
        "billing hard limit",
    )
    return any(phrase in message for phrase in quota_phrases)


def _build_text_prompt(system_prompt: str, user_prompt: str) -> str:
    return f"SYSTEM:\n{system_prompt}\n\nUSER:\n{user_prompt}"


def _call_openai(
    *,
    user_prompt: str,
    system_prompt: str,
    model_name: str,
) -> AITextResult:
    started_at = time.perf_counter()
    response = _get_openai_client().chat.completions.create(
        model=model_name,
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    content = response.choices[0].message.content or ""
    input_tokens = int(getattr(response.usage, "prompt_tokens", 0) or 0)
    output_tokens = int(getattr(response.usage, "completion_tokens", 0) or 0)
    total_tokens = int(getattr(response.usage, "total_tokens", 0) or (input_tokens + output_tokens))
    latency_ms = int((time.perf_counter() - started_at) * 1000)

    return AITextResult(
        provider="openai",
        model=model_name,
        content=content,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        latency_ms=latency_ms,
    )


def _call_openai_with_quota_detection(
    *,
    user_prompt: str,
    system_prompt: str,
    model_name: str,
) -> AITextResult:
    try:
        return _call_openai(
            user_prompt=user_prompt,
            system_prompt=system_prompt,
            model_name=model_name,
        )
    except Exception as exc:
        if is_openai_quota_exhausted(exc):
            raise OpenAIQuotaExhaustedError(
                "OpenAI credits or the configured spend limit are exhausted."
            ) from exc
        raise


def _call_ollama(
    *,
    user_prompt: str,
    system_prompt: str,
    model_name: str,
    base_url: str,
) -> AITextResult:
    started_at = time.perf_counter()
    timeout_seconds = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "105"))
    payload = {
        "model": model_name,
        "prompt": _build_text_prompt(system_prompt, user_prompt),
        "stream": False,
        "keep_alive": os.getenv("OLLAMA_KEEP_ALIVE", "30m"),
        "options": {
            "temperature": 0.2,
        },
    }

    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.post(f"{base_url.rstrip('/')}/api/generate", json=payload)
        response.raise_for_status()
        data = response.json()

    content = str(data.get("response", "")).strip()
    input_tokens = int(data.get("prompt_eval_count") or 0)
    output_tokens = int(data.get("eval_count") or 0)
    total_tokens = input_tokens + output_tokens

    latency_ms_from_api = int((data.get("total_duration") or 0) / 1_000_000)
    elapsed_latency_ms = int((time.perf_counter() - started_at) * 1000)

    return AITextResult(
        provider="ollama",
        model=model_name,
        content=content,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        latency_ms=latency_ms_from_api if latency_ms_from_api > 0 else elapsed_latency_ms,
    )


def generate_text_with_fallback(
    *,
    user_prompt: str,
    system_prompt: str,
    openai_model: str = "gpt-4.1-mini",
    ollama_model: str = "llama3.2:3b",
) -> AITextResult:
    provider_mode = _normalize_mode(os.getenv("AI_PROVIDER_MODE"))
    hybrid_primary = (os.getenv("AI_HYBRID_PRIMARY", "openai") or "openai").strip().lower()
    fallback_policy = (os.getenv("AI_HYBRID_FALLBACK_POLICY", "quota_only") or "quota_only").strip().lower()
    if fallback_policy not in {"quota_only", "any_error"}:
        fallback_policy = "quota_only"
    ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()

    if provider_mode == "openai":
        return _call_openai_with_quota_detection(
            user_prompt=user_prompt,
            system_prompt=system_prompt,
            model_name=openai_model,
        )

    if provider_mode == "ollama":
        return _call_ollama(
            user_prompt=user_prompt,
            system_prompt=system_prompt,
            model_name=ollama_model,
            base_url=ollama_base_url,
        )

    if hybrid_primary == "ollama":
        first_provider = "ollama"
        second_provider = "openai"
    else:
        first_provider = "openai"
        second_provider = "ollama"

    first_error: Exception | None = None

    for provider in (first_provider, second_provider):
        try:
            if provider == "openai":
                return _call_openai_with_quota_detection(
                    user_prompt=user_prompt,
                    system_prompt=system_prompt,
                    model_name=openai_model,
                )

            return _call_ollama(
                user_prompt=user_prompt,
                system_prompt=system_prompt,
                model_name=ollama_model,
                base_url=ollama_base_url,
            )
        except Exception as exc:
            if first_error is None:
                first_error = exc

                should_fallback = (
                    provider == "ollama"
                    or fallback_policy == "any_error"
                    or isinstance(exc, OpenAIQuotaExhaustedError)
                )
                if not should_fallback:
                    raise

    if first_error:
        raise first_error

    raise RuntimeError("Unable to generate AI response from configured providers.")
