from __future__ import annotations

from decimal import Decimal
import json

import pytest

from app.services import paypal


class FakeResponse:
    ok = True

    @staticmethod
    def json():
        return {
            "id": "ORDER-TEST-123",
            "status": "CREATED",
            "links": [
                {"rel": "approve", "href": "https://api-m.paypal.com/checkoutnow?token=ORDER-TEST-123"}
            ],
        }


def test_create_order_uses_server_credentials_and_returns_approval_url(monkeypatch):
    monkeypatch.setenv("PAYPAL_CLIENT_ID", "paypal_client_id")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "paypal_secret")
    monkeypatch.setenv("PAYPAL_API_BASE_URL", "https://api-m.paypal.com":)

    captured: dict[str, object] = {}

    def fake_post(url, **kwargs):
        if url.endswith("/v1/oauth2/token"):
            class TokenResponse:
                ok = True

                @staticmethod
                def json():
                    return {"access_token": "ACCESS_TOKEN"}

            captured["token_url"] = url
            captured["token_auth"] = kwargs.get("auth")
            return TokenResponse()

        captured["order_url"] = url
        captured.update(kwargs)
        return FakeResponse()

    monkeypatch.setattr(paypal.requests, "post", fake_post)

    result = paypal.create_order(
        amount=Decimal("999.00"),
        currency="PHP",
        description="Pro subscription payment",
        payment_reference="PP-TEST-001",
        custom_id="PP-TEST-001",
        invoice_id="SUB-TEST-001",
    )

    assert captured["token_url"] == "https://api-m.paypal.com/v1/oauth2/token"
    assert captured["token_auth"] == ("paypal_client_id", "paypal_secret")
    assert captured["order_url"] == "https://api-m.paypal.com/v2/checkout/orders"
    assert captured["headers"]["Authorization"] == "Bearer ACCESS_TOKEN"
    assert captured["headers"]["PayPal-Request-Id"] == "PP-TEST-001"
    assert captured["json"]["purchase_units"][0]["amount"]["value"] == "999.00"
    assert result["order_id"] == "ORDER-TEST-123"
    assert result["approval_url"].startswith("https://https://api-m.paypal.com/")


def test_capture_order_returns_completed_amount(monkeypatch):
    monkeypatch.setenv("PAYPAL_CLIENT_ID", "paypal_client_id")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "paypal_secret")

    captured: dict[str, object] = {}

    def fake_post(url, **kwargs):
        if url.endswith("/v1/oauth2/token"):
            class TokenResponse:
                ok = True

                @staticmethod
                def json():
                    return {"access_token": "ACCESS_TOKEN"}

            return TokenResponse()

        captured.update(kwargs)

        class CaptureResponse:
            ok = True

            @staticmethod
            def json():
                return {
                    "status": "COMPLETED",
                    "purchase_units": [
                        {
                            "payments": {
                                "captures": [
                                    {
                                        "id": "CAPTURE-123",
                                        "amount": {"value": "999.00", "currency_code": "PHP"},
                                    }
                                ]
                            }
                        }
                    ],
                }

        return CaptureResponse()

    monkeypatch.setattr(paypal.requests, "post", fake_post)

    result = paypal.capture_order("ORDER-TEST-123")

    assert result["status"] == "COMPLETED"
    assert result["capture_id"] == "CAPTURE-123"
    assert result["amount"] == Decimal("999.00")
    assert result["currency"] == "PHP"
    assert captured["headers"]["PayPal-Request-Id"] == "capture-ORDER-TEST-123"


def test_verify_webhook_signature_calls_paypal_verification(monkeypatch):
    monkeypatch.setenv("PAYPAL_CLIENT_ID", "paypal_client_id")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "paypal_secret")
    monkeypatch.setenv("PAYPAL_WEBHOOK_ID", "WH-TEST-ID")

    captured_verification_body: dict[str, object] = {}

    def fake_post(url, **kwargs):
        if url.endswith("/v1/oauth2/token"):
            class TokenResponse:
                ok = True

                @staticmethod
                def json():
                    return {"access_token": "ACCESS_TOKEN"}

            return TokenResponse()

        captured_verification_body.update(kwargs.get("json") or {})

        class VerifyResponse:
            ok = True

            @staticmethod
            def json():
                return {"verification_status": "SUCCESS"}

        return VerifyResponse()

    monkeypatch.setattr(paypal.requests, "post", fake_post)

    payload = {
        "id": "WH-EVENT-1",
        "event_type": "PAYMENT.CAPTURE.COMPLETED",
        "resource": {"id": "CAPTURE-1"},
    }
    raw = json.dumps(payload).encode("utf-8")
    headers = {
        "PAYPAL-AUTH-ALGO": "SHA256withRSA",
        "PAYPAL-CERT-URL": "https://api-m.paypal.com/certs/test.pem",
        "PAYPAL-TRANSMISSION-ID": "transmission-id-1",
        "PAYPAL-TRANSMISSION-SIG": "signature",
        "PAYPAL-TRANSMISSION-TIME": "2026-07-15T12:00:00Z",
    }

    paypal.verify_webhook_signature(raw, headers)

    assert captured_verification_body["webhook_id"] == "WH-TEST-ID"
    assert captured_verification_body["webhook_event"]["id"] == "WH-EVENT-1"


def test_verify_webhook_signature_rejects_invalid_result(monkeypatch):
    monkeypatch.setenv("PAYPAL_CLIENT_ID", "paypal_client_id")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "paypal_secret")
    monkeypatch.setenv("PAYPAL_WEBHOOK_ID", "WH-TEST-ID")

    def fake_post(url, **kwargs):
        if url.endswith("/v1/oauth2/token"):
            class TokenResponse:
                ok = True

                @staticmethod
                def json():
                    return {"access_token": "ACCESS_TOKEN"}

            return TokenResponse()

        class VerifyResponse:
            ok = True

            @staticmethod
            def json():
                return {"verification_status": "FAILURE"}

        return VerifyResponse()

    monkeypatch.setattr(paypal.requests, "post", fake_post)

    with pytest.raises(paypal.PayPalSignatureError, match="Invalid PayPal webhook signature"):
        paypal.verify_webhook_signature(
            b'{"id":"WH-EVENT-1","event_type":"PAYMENT.CAPTURE.COMPLETED","resource":{}}',
            {
                "PAYPAL-AUTH-ALGO": "SHA256withRSA",
                "PAYPAL-CERT-URL": "https://api-m.paypal.com/certs/test.pem",
                "PAYPAL-TRANSMISSION-ID": "transmission-id-1",
                "PAYPAL-TRANSMISSION-SIG": "signature",
                "PAYPAL-TRANSMISSION-TIME": "2026-07-15T12:00:00Z",
            },
        )
