from __future__ import annotations

import hashlib
import hmac
import os
import time
from typing import Any
from urllib.parse import urlparse

import requests


class PayMongoConfigurationError(RuntimeError):
    pass


class PayMongoAPIError(RuntimeError):
    pass


class PayMongoSignatureError(ValueError):
    pass


def _required_environment_value(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise PayMongoConfigurationError(f"{name} is not configured")
    return value


def _validate_return_url(value: str, name: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise PayMongoConfigurationError(f"{name} must be an absolute HTTP(S) URL")
    if os.getenv("ENVIRONMENT", "development").lower() == "production" and parsed.scheme != "https":
        raise PayMongoConfigurationError(f"{name} must use HTTPS in production")
    return value


def _checkout_payment_methods() -> list[str]:
    configured = os.getenv("PAYMONGO_PAYMENT_METHODS", "card,gcash,paymaya,grab_pay")
    methods = [item.strip().lower() for item in configured.split(",") if item.strip()]
    if not methods:
        raise PayMongoConfigurationError("PAYMONGO_PAYMENT_METHODS must include at least one method")
    return list(dict.fromkeys(methods))


def create_checkout_session(
    *,
    amount_centavos: int,
    currency: str,
    description: str,
    item_name: str,
    reference_number: str,
    customer_name: str | None = None,
    customer_email: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, str]:
    if amount_centavos <= 0:
        raise ValueError("Checkout amount must be greater than zero")

    secret_key = _required_environment_value("PAYMONGO_SECRET_KEY")
    success_url = _validate_return_url(
        _required_environment_value("PAYMONGO_SUCCESS_URL"),
        "PAYMONGO_SUCCESS_URL",
    )
    cancel_url = _validate_return_url(
        _required_environment_value("PAYMONGO_CANCEL_URL"),
        "PAYMONGO_CANCEL_URL",
    )
    api_base_url = os.getenv("PAYMONGO_API_BASE_URL", "https://api.paymongo.com").rstrip("/")
    parsed_api_url = urlparse(api_base_url)
    if parsed_api_url.scheme != "https" or not parsed_api_url.hostname:
        raise PayMongoConfigurationError("PAYMONGO_API_BASE_URL must be an absolute HTTPS URL")
    if (
        os.getenv("ENVIRONMENT", "development").lower() == "production"
        and parsed_api_url.hostname != "api.paymongo.com"
    ):
        raise PayMongoConfigurationError("PAYMONGO_API_BASE_URL must use api.paymongo.com in production")
    timeout_seconds = float(os.getenv("PAYMONGO_TIMEOUT_SECONDS", "15"))

    metadata_payload: dict[str, Any] = {"payment_reference": reference_number}
    if metadata:
        metadata_payload.update(metadata)

    attributes: dict[str, Any] = {
        "cancel_url": cancel_url,
        "description": description,
        "line_items": [
            {
                "amount": amount_centavos,
                "currency": currency.upper(),
                "description": description,
                "name": item_name,
                "quantity": 1,
            }
        ],
        "metadata": metadata_payload,
        "payment_method_types": _checkout_payment_methods(),
        "reference_number": reference_number,
        "send_email_receipt": True,
        "show_description": True,
        "show_line_items": True,
        "success_url": success_url,
    }
    billing = {
        key: value
        for key, value in {"name": customer_name, "email": customer_email}.items()
        if value
    }
    if billing:
        attributes["billing"] = billing

    try:
        response = requests.post(
            f"{api_base_url}/v1/checkout_sessions",
            auth=(secret_key, ""),
            json={"data": {"attributes": attributes}},
            timeout=timeout_seconds,
        )
    except requests.RequestException as exc:
        raise PayMongoAPIError("PayMongo checkout is temporarily unavailable") from exc

    if not response.ok:
        detail = "PayMongo rejected the checkout request"
        try:
            errors = response.json().get("errors", [])
            if errors and isinstance(errors[0], dict) and errors[0].get("detail"):
                detail = str(errors[0]["detail"])
        except (ValueError, AttributeError):
            pass
        raise PayMongoAPIError(detail)

    try:
        checkout = response.json()["data"]
        checkout_id = str(checkout["id"])
        checkout_url = str(checkout["attributes"]["checkout_url"])
    except (KeyError, TypeError, ValueError) as exc:
        raise PayMongoAPIError("PayMongo returned an invalid checkout response") from exc

    if not checkout_id.startswith("cs_"):
        raise PayMongoAPIError("PayMongo returned an invalid checkout identifier")

    parsed_checkout_url = urlparse(checkout_url)
    if parsed_checkout_url.scheme != "https" or not parsed_checkout_url.hostname:
        raise PayMongoAPIError("PayMongo returned an unsafe checkout URL")
    if not (
        parsed_checkout_url.hostname == "paymongo.com"
        or parsed_checkout_url.hostname.endswith(".paymongo.com")
    ):
        raise PayMongoAPIError("PayMongo returned an unexpected checkout host")

    return {"checkout_id": checkout_id, "checkout_url": checkout_url}


def verify_webhook_signature(
    raw_payload: bytes,
    signature_header: str,
    *,
    secret: str | None = None,
    now: int | None = None,
    tolerance_seconds: int | None = None,
) -> str:
    webhook_secret = secret or _required_environment_value("PAYMONGO_WEBHOOK_SECRET")
    parts: dict[str, str] = {}
    for item in signature_header.split(","):
        key, separator, value = item.strip().partition("=")
        if separator and key in {"t", "te", "li"}:
            parts[key] = value

    try:
        timestamp = int(parts["t"])
    except (KeyError, TypeError, ValueError) as exc:
        raise PayMongoSignatureError("Invalid PayMongo signature timestamp") from exc

    allowed_age = tolerance_seconds
    if allowed_age is None:
        allowed_age = int(os.getenv("PAYMONGO_WEBHOOK_TOLERANCE_SECONDS", "300"))
    current_time = int(time.time()) if now is None else now
    if allowed_age >= 0 and abs(current_time - timestamp) > allowed_age:
        raise PayMongoSignatureError("Stale PayMongo webhook")

    signed_payload = str(timestamp).encode("utf-8") + b"." + raw_payload
    expected = hmac.new(
        webhook_secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    if parts.get("li") and hmac.compare_digest(expected, parts["li"]):
        return "live"
    if parts.get("te") and hmac.compare_digest(expected, parts["te"]):
        return "test"
    raise PayMongoSignatureError("Invalid PayMongo webhook signature")
