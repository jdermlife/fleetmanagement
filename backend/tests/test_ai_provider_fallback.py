import pytest

from app.services import ai_provider
from app.services.ai_provider import AITextResult, OpenAIQuotaExhaustedError


class ProviderError(Exception):
    def __init__(self, body):
        super().__init__(str(body))
        self.body = body


def _result(provider: str) -> AITextResult:
    return AITextResult(
        provider=provider,
        model=f"{provider}-model",
        content="Safe answer",
        input_tokens=4,
        output_tokens=2,
        total_tokens=6,
        latency_ms=1,
    )


@pytest.mark.parametrize(
    "code",
    [
        "credit_balance_exhausted",
        "organization_spend_limit_exceeded",
        "project_spend_limit_exceeded",
        "insufficient_quota",
    ],
)
def test_hybrid_falls_back_to_ollama_for_confirmed_quota_exhaustion(monkeypatch, code):
    monkeypatch.setenv("AI_PROVIDER_MODE", "hybrid")
    monkeypatch.setenv("AI_HYBRID_PRIMARY", "openai")
    monkeypatch.setenv("AI_HYBRID_FALLBACK_POLICY", "quota_only")
    monkeypatch.setattr(
        ai_provider,
        "_call_openai",
        lambda **_kwargs: (_ for _ in ()).throw(
            ProviderError({"error": {"code": code, "message": "quota unavailable"}})
        ),
    )
    monkeypatch.setattr(ai_provider, "_call_ollama", lambda **_kwargs: _result("ollama"))

    result = ai_provider.generate_text_with_fallback(
        user_prompt="question",
        system_prompt="rules",
    )

    assert result.provider == "ollama"


def test_hybrid_does_not_fall_back_for_temporary_rate_limit(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER_MODE", "hybrid")
    monkeypatch.setenv("AI_HYBRID_PRIMARY", "openai")
    monkeypatch.setenv("AI_HYBRID_FALLBACK_POLICY", "quota_only")
    ollama_call = lambda **_kwargs: (_ for _ in ()).throw(AssertionError("unexpected fallback"))
    monkeypatch.setattr(
        ai_provider,
        "_call_openai",
        lambda **_kwargs: (_ for _ in ()).throw(
            ProviderError({"error": {"code": "rate_limit_exceeded", "message": "too many requests"}})
        ),
    )
    monkeypatch.setattr(ai_provider, "_call_ollama", ollama_call)

    with pytest.raises(ProviderError):
        ai_provider.generate_text_with_fallback(
            user_prompt="question",
            system_prompt="rules",
        )


def test_openai_mode_translates_quota_error_for_the_distributed_fallback(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER_MODE", "openai")
    monkeypatch.setattr(
        ai_provider,
        "_call_openai",
        lambda **_kwargs: (_ for _ in ()).throw(
            ProviderError({"code": "credit_balance_exhausted", "message": "credits exhausted"})
        ),
    )

    with pytest.raises(OpenAIQuotaExhaustedError):
        ai_provider.generate_text_with_fallback(
            user_prompt="question",
            system_prompt="rules",
        )


def test_any_error_policy_preserves_optional_outage_fallback(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER_MODE", "hybrid")
    monkeypatch.setenv("AI_HYBRID_PRIMARY", "openai")
    monkeypatch.setenv("AI_HYBRID_FALLBACK_POLICY", "any_error")
    monkeypatch.setattr(
        ai_provider,
        "_call_openai",
        lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("network unavailable")),
    )
    monkeypatch.setattr(ai_provider, "_call_ollama", lambda **_kwargs: _result("ollama"))

    result = ai_provider.generate_text_with_fallback(
        user_prompt="question",
        system_prompt="rules",
    )

    assert result.provider == "ollama"


def test_ollama_keeps_system_instructions_separate_and_limits_output(monkeypatch):
    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "response": "Use the sign-in form.",
                "prompt_eval_count": 10,
                "eval_count": 5,
                "total_duration": 2_000_000,
            }

    class FakeClient:
        def __init__(self, *, timeout):
            captured["timeout"] = timeout

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def post(self, url, *, json):
            captured["url"] = url
            captured["payload"] = json
            return FakeResponse()

    monkeypatch.setenv("OLLAMA_TIMEOUT_SECONDS", "105")
    monkeypatch.setenv("OLLAMA_KEEP_ALIVE", "30m")
    monkeypatch.setenv("OLLAMA_MAX_OUTPUT_TOKENS", "220")
    monkeypatch.setattr(ai_provider.httpx, "Client", FakeClient)

    result = ai_provider._call_ollama(
        user_prompt="How do I sign in?",
        system_prompt="Never disclose protected details.",
        model_name="llama3.2:3b",
        base_url="http://127.0.0.1:11434",
    )

    assert result.content == "Use the sign-in form."
    assert captured["timeout"] == 105.0
    assert captured["url"] == "http://127.0.0.1:11434/api/generate"
    assert captured["payload"] == {
        "model": "llama3.2:3b",
        "prompt": "How do I sign in?",
        "system": "Never disclose protected details.",
        "stream": False,
        "keep_alive": "30m",
        "options": {"temperature": 0.1, "num_predict": 220},
    }
