from __future__ import annotations

import hashlib
import json
import os
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from urllib.parse import urlparse

import requests


class PayPalConfigurationError(RuntimeError):
    pass


class PayPalAPIError(RuntimeError):
    pass


class PayPalSignatureError(ValueError):
    pass


def _required_environment_value(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise PayPalConfigurationError(f"{name} is not configured")
    return value


def _paypal_api_base_url() -> str:
    api_base_url = os.getenv("PAYPAL_API_BASE_URL", "https://api-m.sandbox.paypal.com").rstrip("/")
    parsed_api_url = urlparse(api_base_url)
    if parsed_api_url.scheme != "https" or not parsed_api_url.hostname:
        raise PayPalConfigurationError("PAYPAL_API_BASE_URL must be an absolute HTTPS URL")
    if (
        os.getenv("ENVIRONMENT", "development").lower() == "production"
        and parsed_api_url.hostname != "api-m.paypal.com"
    ):
        raise PayPalConfigurationError("PAYPAL_API_BASE_URL must use api-m.paypal.com in production")
    return api_base_url


def _timeout_seconds() -> float:
    return float(os.getenv("PAYPAL_TIMEOUT_SECONDS", "15"))


def _amount_to_paypal_string(amount: Decimal) -> str:
    return str(amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _paypal_request_id(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("PayPal request ID is required")
    if len(normalized) <= 38:
        return normalized
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:38]


def _get_access_token() -> tuple[str, str]:
    client_id = _required_environment_value("PAYPAL_CLIENT_ID")
    client_secret = _required_environment_value("PAYPAL_CLIENT_SECRET")
    api_base_url = _paypal_api_base_url()

    try:
        response = requests.post(
            f"{api_base_url}/v1/oauth2/token",
            auth=(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            headers={"Accept": "application/json", "Accept-Language": "en_US"},
            timeout=_timeout_seconds(),
        )
    except requests.RequestException as exc:
        raise PayPalAPIError("PayPal authentication is temporarily unavailable") from exc

    if not response.ok:
        detail = "PayPal authentication failed"
        try:
            payload = response.json()
            if isinstance(payload, dict) and payload.get("error_description"):
                detail = str(payload["error_description"])
        except ValueError:
            pass
        raise PayPalAPIError(detail)

    try:
        token = str(response.json()["access_token"])
    except (KeyError, TypeError, ValueError) as exc:
        raise PayPalAPIError("PayPal returned an invalid auth response") from exc

    return token, api_base_url


def create_order(
    *,
    amount: Decimal,
    currency: str,
    description: str,
    payment_reference: str,
    custom_id: str,
    invoice_id: str | None = None,
    request_id: str | None = None,
) -> dict[str, Any]:
    if amount <= 0:
        raise ValueError("Order amount must be greater than zero")

    token, api_base_url = _get_access_token()
    normalized_currency = (currency or "PHP").upper()
    print("===== PAYPAL DEBUG =====")
    print("API URL:", api_base_url)
    print("Currency:", normalized_currency)
    print("Invoice:", invoice_id)
    print("Reference:", payment_reference)
    print("========================")
    purchase_unit: dict[str, Any] = {
        "reference_id": payment_reference,
        "description": description[:127],
        "custom_id": custom_id,
        "amount": {
            "currency_code": normalized_currency,
            "value": _amount_to_paypal_string(amount),
        },
    }
    if invoice_id:
        purchase_unit["invoice_id"] = invoice_id[:127]

    payload = {
        "intent": "CAPTURE",
        "purchase_units": [purchase_unit],
        "application_context": {
            "shipping_preference": "NO_SHIPPING",
            "user_action": "PAY_NOW",
        },
    }

    try:
        response = requests.post(
            f"{api_base_url}/v2/checkout/orders",
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "PayPal-Request-Id": _paypal_request_id(request_id or payment_reference),
            },
            timeout=_timeout_seconds(),
        )
    except requests.RequestException as exc:
        raise PayPalAPIError("PayPal create order is temporarily unavailable") from exc

    if not response.ok:
        detail = "PayPal rejected order creation"
        try:
            body = response.json()
            if isinstance(body, dict):
                details = body.get("details")
                if isinstance(details, list) and details and isinstance(details[0], dict):
                    issue = details[0].get("issue")
                    if issue:
                        detail = str(issue)
                elif body.get("message"):
                    detail = str(body["message"])
        except ValueError:
            pass
        raise PayPalAPIError(detail)

    try:
        order_payload = response.json()
        order_id = str(order_payload["id"])
        status = str(order_payload.get("status") or "CREATED")
        links = order_payload.get("links") or []
    except (KeyError, TypeError, ValueError) as exc:
        raise PayPalAPIError("PayPal returned an invalid order response") from exc

    approval_url = None
    for item in links:
        if isinstance(item, dict) and item.get("rel") == "approve" and item.get("href"):
            approval_url = str(item["href"])
            break

    return {
        "order_id": order_id,
        "status": status,
        "approval_url": approval_url,
        "raw": order_payload,
    }


def capture_order(order_id: str, *, request_id: str | None = None) -> dict[str, Any]:
    if not order_id or len(order_id.strip()) < 3:
        raise ValueError("order_id is required")

    token, api_base_url = _get_access_token()

    try:
        response = requests.post(
            f"{api_base_url}/v2/checkout/orders/{order_id}/capture",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "PayPal-Request-Id": _paypal_request_id(request_id or f"capture-{order_id}"),
            },
            timeout=_timeout_seconds(),
        )
    except requests.RequestException as exc:
        raise PayPalAPIError("PayPal capture order is temporarily unavailable") from exc

    if not response.ok:
        detail = "PayPal rejected order capture"
        try:
            body = response.json()
            if isinstance(body, dict):
                details = body.get("details")
                if isinstance(details, list) and details and isinstance(details[0], dict):
                    issue = details[0].get("issue")
                    if issue:
                        detail = str(issue)
                elif body.get("message"):
                    detail = str(body["message"])
        except ValueError:
            pass
        raise PayPalAPIError(detail)

    try:
        capture_payload = response.json()
        status = str(capture_payload.get("status") or "")
        purchase_units = capture_payload.get("purchase_units") or []
        first_purchase_unit = purchase_units[0]
        payments = first_purchase_unit.get("payments") or {}
        captures = payments.get("captures") or []
        first_capture = captures[0]
        capture_id = str(first_capture.get("id") or "")
        amount_payload = first_capture.get("amount") or {}
        amount_value = Decimal(str(amount_payload.get("value") or "0"))
        currency = str(amount_payload.get("currency_code") or "").upper()
    except (IndexError, KeyError, TypeError, ValueError) as exc:
        raise PayPalAPIError("PayPal returned an incomplete capture response") from exc

    if amount_value <= 0 or not currency:
        raise PayPalAPIError("PayPal returned an invalid capture amount")

    return {
        "status": status,
        "capture_id": capture_id,
        "amount": amount_value,
        "currency": currency,
        "raw": capture_payload,
    }


def verify_webhook_signature(raw_payload: bytes, headers: dict[str, str]) -> None:
    webhook_id = _required_environment_value("PAYPAL_WEBHOOK_ID")
    token, api_base_url = _get_access_token()

    required_headers = {
        "PAYPAL-AUTH-ALGO",
        "PAYPAL-CERT-URL",
        "PAYPAL-TRANSMISSION-ID",
        "PAYPAL-TRANSMISSION-SIG",
        "PAYPAL-TRANSMISSION-TIME",
    }
    missing = [name for name in required_headers if not headers.get(name)]
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise PayPalSignatureError(f"Missing PayPal webhook headers: {missing_list}")

    cert_url = headers["PAYPAL-CERT-URL"]
    parsed_cert_url = urlparse(cert_url)
    if parsed_cert_url.scheme != "https" or not parsed_cert_url.hostname:
        raise PayPalSignatureError("Invalid PayPal certificate URL")

    try:
        event = json.loads(raw_payload)
    except ValueError as exc:
        raise PayPalSignatureError("Invalid PayPal webhook payload") from exc

    verification_payload = {
        "auth_algo": headers["PAYPAL-AUTH-ALGO"],
        "cert_url": cert_url,
        "transmission_id": headers["PAYPAL-TRANSMISSION-ID"],
        "transmission_sig": headers["PAYPAL-TRANSMISSION-SIG"],
        "transmission_time": headers["PAYPAL-TRANSMISSION-TIME"],
        "webhook_id": webhook_id,
        "webhook_event": event,
    }

    try:
        response = requests.post(
            f"{api_base_url}/v1/notifications/verify-webhook-signature",
            json=verification_payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=_timeout_seconds(),
        )
    except requests.RequestException as exc:
        raise PayPalAPIError("PayPal webhook verification is temporarily unavailable") from exc

    if not response.ok:
        raise PayPalSignatureError("PayPal webhook verification request failed")

    try:
        verification_status = str(response.json()["verification_status"])
    except (KeyError, TypeError, ValueError) as exc:
        raise PayPalSignatureError("Invalid PayPal verification response") from exc

    if verification_status != "SUCCESS":
        raise PayPalSignatureError("Invalid PayPal webhook signature")
