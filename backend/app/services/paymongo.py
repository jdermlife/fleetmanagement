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


def _api_settings() -> tuple[str, str, float]:
    secret_key = _required_environment_value("PAYMONGO_SECRET_KEY")
    api_base_url = os.getenv("PAYMONGO_API_BASE_URL", "https://api.paymongo.com").rstrip("/")
    parsed_api_url = urlparse(api_base_url)
    if parsed_api_url.scheme != "https" or not parsed_api_url.hostname:
        raise PayMongoConfigurationError("PAYMONGO_API_BASE_URL must be an absolute HTTPS URL")
    if os.getenv("ENVIRONMENT", "development").lower() == "production" and parsed_api_url.hostname != "api.paymongo.com":
        raise PayMongoConfigurationError("PAYMONGO_API_BASE_URL must use api.paymongo.com in production")
    return secret_key, api_base_url, float(os.getenv("PAYMONGO_TIMEOUT_SECONDS", "15"))


def create_customer(*, first_name: str, last_name: str, email: str) -> str:
    secret_key, api_base_url, timeout_seconds = _api_settings()
    payload = {
        "data": {
            "attributes": {
                "first_name": first_name[:255] or "FILSCORE",
                "last_name": last_name[:255] or "Subscriber",
                "email": email[:255],
                "default_device": "email",
            }
        }
    }
    try:
        response = requests.post(
            f"{api_base_url}/v1/customers",
            auth=(secret_key, ""),
            json=payload,
            timeout=timeout_seconds,
        )
    except requests.RequestException as exc:
        raise PayMongoAPIError("PayMongo customer setup is temporarily unavailable") from exc
    if not response.ok:
        raise PayMongoAPIError("PayMongo rejected the customer setup request")
    try:
        customer_id = str(response.json()["data"]["id"])
    except (KeyError, TypeError, ValueError) as exc:
        raise PayMongoAPIError("PayMongo returned an invalid customer response") from exc
    if not customer_id.startswith("cus_"):
        raise PayMongoAPIError("PayMongo returned an invalid customer identifier")
    return customer_id


def create_subscription(*, customer_id: str, plan_id: str) -> dict[str, Any]:
    secret_key, api_base_url, timeout_seconds = _api_settings()
    payload = {
        "data": {
            "attributes": {
                "customer_id": customer_id,
                "plan_id": plan_id,
            }
        }
    }
    try:
        response = requests.post(
            f"{api_base_url}/v1/subscriptions",
            auth=(secret_key, ""),
            json=payload,
            timeout=timeout_seconds,
        )
    except requests.RequestException as exc:
        raise PayMongoAPIError("PayMongo recurring subscription is temporarily unavailable") from exc
    if not response.ok:
        raise PayMongoAPIError("PayMongo rejected the recurring subscription request")
    try:
        resource = response.json()["data"]
        attributes = resource["attributes"]
        agreement_id = str(resource["id"])
        status = str(attributes.get("status") or "incomplete")
        setup_intent = attributes.get("setup_intent") or {}
        latest_invoice = attributes.get("latest_invoice") or {}
    except (KeyError, TypeError, ValueError) as exc:
        raise PayMongoAPIError("PayMongo returned an invalid recurring subscription response") from exc
    if not agreement_id.startswith("subs_"):
        raise PayMongoAPIError("PayMongo returned an invalid subscription identifier")
    return {
        "agreement_id": agreement_id,
        "status": status,
        "approval_url": setup_intent.get("next_action_url"),
        "payment_intent_id": (latest_invoice.get("payment_intent") or {}).get("id"),
        "invoice_id": latest_invoice.get("id"),
        "next_billing_date": attributes.get("next_billing_schedule"),
        "payment_method_id": attributes.get("default_customer_payment_method_id"),
        "raw": resource,
    }


def attach_subscription_payment_method(*, payment_intent_id: str, payment_method_id: str) -> dict[str, Any]:
    secret_key, api_base_url, timeout_seconds = _api_settings()
    return_url = _validate_return_url(
        _required_environment_value("PAYMONGO_RECURRING_RETURN_URL"),
        "PAYMONGO_RECURRING_RETURN_URL",
    )
    payload = {
        "data": {
            "attributes": {
                "payment_method": payment_method_id,
                "return_url": return_url,
            }
        }
    }
    try:
        response = requests.post(
            f"{api_base_url}/v1/payment_intents/{payment_intent_id}/attach",
            auth=(secret_key, ""),
            json=payload,
            timeout=timeout_seconds,
        )
    except requests.RequestException as exc:
        raise PayMongoAPIError("PayMongo payment authorization is temporarily unavailable") from exc
    if not response.ok:
        raise PayMongoAPIError("PayMongo rejected the recurring payment authorization")
    try:
        attributes = response.json()["data"]["attributes"]
        status = str(attributes["status"])
        next_action = attributes.get("next_action") or {}
    except (KeyError, TypeError, ValueError) as exc:
        raise PayMongoAPIError("PayMongo returned an invalid payment authorization response") from exc
    return {
        "status": status,
        "approval_url": next_action.get("redirect", {}).get("url"),
    }


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
