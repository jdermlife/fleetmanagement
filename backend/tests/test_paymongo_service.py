from __future__ import annotations

import pytest

from app.services import paymongo


class FakeResponse:
    ok = True

    @staticmethod
    def json():
        return {
            "data": {
                "id": "cs_service_test",
                "attributes": {
                    "checkout_url": "https://checkout.paymongo.com/cs_service_test",
                },
            }
        }


def test_checkout_session_keeps_secret_server_side_and_uses_centavos(monkeypatch):
    monkeypatch.setenv("PAYMONGO_SECRET_KEY", "sk_test_server_secret")
    monkeypatch.setenv("PAYMONGO_SUCCESS_URL", "https://example.com/subscription-payment?checkout=success")
    monkeypatch.setenv("PAYMONGO_CANCEL_URL", "https://example.com/subscription-payment?checkout=cancelled")
    monkeypatch.setenv("PAYMONGO_PAYMENT_METHODS", "card,gcash,paymaya")
    captured: dict[str, object] = {}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return FakeResponse()

    monkeypatch.setattr(paymongo.requests, "post", fake_post)

    result = paymongo.create_checkout_session(
        amount_centavos=99_900,
        currency="PHP",
        description="Pro subscription payment",
        item_name="Pro subscription",
        reference_number="PM-SERVICE-TEST",
        customer_name="Subscriber",
        customer_email="subscriber@example.com",
    )

    attributes = captured["json"]["data"]["attributes"]
    assert captured["url"] == "https://api.paymongo.com/v1/checkout_sessions"
    assert captured["auth"] == ("sk_test_server_secret", "")
    assert attributes["line_items"][0]["amount"] == 99_900
    assert attributes["payment_method_types"] == ["card", "gcash", "paymaya"]
    assert attributes["metadata"] == {"payment_reference": "PM-SERVICE-TEST"}
    assert "sk_test_server_secret" not in str(captured["json"])
    assert result["checkout_url"].startswith("https://checkout.paymongo.com/")


def test_checkout_session_rejects_untrusted_redirect_host(monkeypatch):
    monkeypatch.setenv("PAYMONGO_SECRET_KEY", "sk_test_server_secret")
    monkeypatch.setenv("PAYMONGO_SUCCESS_URL", "https://example.com/success")
    monkeypatch.setenv("PAYMONGO_CANCEL_URL", "https://example.com/cancel")

    class UnsafeResponse(FakeResponse):
        @staticmethod
        def json():
            return {
                "data": {
                    "id": "cs_unsafe",
                    "attributes": {"checkout_url": "https://attacker.example/checkout"},
                }
            }

    monkeypatch.setattr(paymongo.requests, "post", lambda *_args, **_kwargs: UnsafeResponse())

    with pytest.raises(paymongo.PayMongoAPIError, match="unexpected checkout host"):
        paymongo.create_checkout_session(
            amount_centavos=100,
            currency="PHP",
            description="Test",
            item_name="Test",
            reference_number="PM-UNSAFE",
        )
