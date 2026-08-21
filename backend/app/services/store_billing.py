from __future__ import annotations

import base64
import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import jwt
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa


class StoreBillingConfigurationError(RuntimeError):
    pass


class StorePurchaseVerificationError(ValueError):
    pass


@dataclass(frozen=True)
class VerifiedStorePurchase:
    platform: Literal["ANDROID", "IOS"]
    product_id: str
    transaction_id: str
    original_transaction_id: str | None
    purchase_token_hash: str
    status: str
    purchased_at: datetime | None
    expires_at: datetime | None


def _timestamp_millis(value: object) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.fromtimestamp(int(value) / 1000, timezone.utc)
    except (TypeError, ValueError, OSError) as exc:
        raise StorePurchaseVerificationError("Store returned an invalid timestamp") from exc


def _iso_datetime(value: object) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as exc:
        raise StorePurchaseVerificationError("Store returned an invalid expiration time") from exc


def _verify_certificate_signature(certificate: x509.Certificate, issuer: x509.Certificate) -> None:
    public_key = issuer.public_key()
    if isinstance(public_key, rsa.RSAPublicKey):
        public_key.verify(
            certificate.signature,
            certificate.tbs_certificate_bytes,
            padding.PKCS1v15(),
            certificate.signature_hash_algorithm,
        )
    elif isinstance(public_key, ec.EllipticCurvePublicKey):
        public_key.verify(
            certificate.signature,
            certificate.tbs_certificate_bytes,
            ec.ECDSA(certificate.signature_hash_algorithm),
        )
    else:
        raise StorePurchaseVerificationError("Apple certificate uses an unsupported key type")


def _load_apple_root_certificate() -> x509.Certificate:
    configured_path = os.getenv("APPLE_ROOT_CA_PATH", "").strip()
    if not configured_path:
        raise StoreBillingConfigurationError("APPLE_ROOT_CA_PATH is not configured")
    try:
        raw_certificate = Path(configured_path).read_bytes()
    except OSError as exc:
        raise StoreBillingConfigurationError("Apple root certificate cannot be read") from exc
    try:
        return x509.load_pem_x509_certificate(raw_certificate)
    except ValueError:
        try:
            return x509.load_der_x509_certificate(raw_certificate)
        except ValueError as exc:
            raise StoreBillingConfigurationError("Apple root certificate is invalid") from exc


def decode_apple_signed_payload(signed_payload: str) -> dict[str, object]:
    try:
        header = jwt.get_unverified_header(signed_payload)
        chain_data = header["x5c"]
        certificates = [x509.load_der_x509_certificate(base64.b64decode(item)) for item in chain_data]
    except (KeyError, TypeError, ValueError, jwt.PyJWTError) as exc:
        raise StorePurchaseVerificationError("Invalid StoreKit transaction signature") from exc
    if not certificates:
        raise StorePurchaseVerificationError("StoreKit transaction certificate chain is missing")

    root_certificate = _load_apple_root_certificate()
    now = datetime.now(timezone.utc)
    for certificate in certificates:
        not_before = certificate.not_valid_before_utc
        not_after = certificate.not_valid_after_utc
        if now < not_before or now > not_after:
            raise StorePurchaseVerificationError("StoreKit transaction certificate has expired")
    try:
        for certificate, issuer in zip(certificates, certificates[1:]):
            _verify_certificate_signature(certificate, issuer)
        chain_root = certificates[-1]
        if chain_root.fingerprint(hashes.SHA256()) != root_certificate.fingerprint(hashes.SHA256()):
            _verify_certificate_signature(chain_root, root_certificate)
    except Exception as exc:
        raise StorePurchaseVerificationError("StoreKit transaction certificate chain is invalid") from exc

    try:
        payload = jwt.decode(
            signed_payload,
            certificates[0].public_key(),
            algorithms=["ES256"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise StorePurchaseVerificationError("StoreKit transaction signature is invalid") from exc
    if not isinstance(payload, dict):
        raise StorePurchaseVerificationError("StoreKit signed payload is invalid")
    return payload


def verify_apple_transaction(signed_transaction: str) -> VerifiedStorePurchase:
    payload = decode_apple_signed_payload(signed_transaction)
    now = datetime.now(timezone.utc)

    expected_bundle_id = os.getenv("APPLE_BUNDLE_ID", "com.quantech.filscore").strip()
    expected_environment = os.getenv("APPLE_STORE_ENVIRONMENT", "Production").strip().lower()
    if str(payload.get("bundleId") or "") != expected_bundle_id:
        raise StorePurchaseVerificationError("StoreKit transaction belongs to another application")
    if str(payload.get("environment") or "").lower() != expected_environment:
        raise StorePurchaseVerificationError("StoreKit transaction environment does not match")

    transaction_id = str(payload.get("transactionId") or "").strip()
    product_id = str(payload.get("productId") or "").strip()
    if not transaction_id or not product_id:
        raise StorePurchaseVerificationError("StoreKit transaction is incomplete")
    expires_at = _timestamp_millis(payload.get("expiresDate"))
    revoked = payload.get("revocationDate") is not None
    status = "REVOKED" if revoked else ("EXPIRED" if expires_at and expires_at <= now else "ACTIVE")
    return VerifiedStorePurchase(
        platform="IOS",
        product_id=product_id,
        transaction_id=transaction_id,
        original_transaction_id=str(payload.get("originalTransactionId") or "").strip() or None,
        purchase_token_hash=hashlib.sha256(signed_transaction.encode("utf-8")).hexdigest(),
        status=status,
        purchased_at=_timestamp_millis(payload.get("purchaseDate")),
        expires_at=expires_at,
    )


def verify_google_pubsub_token(authorization: str | None) -> None:
    expected_audience = os.getenv("GOOGLE_PUBSUB_AUDIENCE", "").strip()
    if not expected_audience:
        raise StoreBillingConfigurationError("GOOGLE_PUBSUB_AUDIENCE is not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise StorePurchaseVerificationError("Google Pub/Sub authorization is required")
    try:
        from google.auth.transport.requests import Request as GoogleAuthRequest
        from google.oauth2 import id_token
    except ImportError as exc:
        raise StoreBillingConfigurationError("google-auth is required for Google Pub/Sub verification") from exc
    try:
        claims = id_token.verify_oauth2_token(
            authorization.removeprefix("Bearer ").strip(),
            GoogleAuthRequest(),
            expected_audience,
        )
    except ValueError as exc:
        raise StorePurchaseVerificationError("Google Pub/Sub authorization is invalid") from exc
    expected_email = os.getenv("GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL", "").strip().lower()
    if expected_email and str(claims.get("email") or "").lower() != expected_email:
        raise StorePurchaseVerificationError("Google Pub/Sub service account does not match")


def _google_credentials():
    try:
        from google.oauth2 import service_account
    except ImportError as exc:
        raise StoreBillingConfigurationError("google-auth is required for Google Play verification") from exc

    configured = os.getenv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "").strip()
    if not configured:
        raise StoreBillingConfigurationError("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured")
    try:
        service_account_info = json.loads(configured) if configured.startswith("{") else json.loads(Path(configured).read_text())
        return service_account.Credentials.from_service_account_info(
            service_account_info,
            scopes=["https://www.googleapis.com/auth/androidpublisher"],
        )
    except (OSError, ValueError, TypeError) as exc:
        raise StoreBillingConfigurationError("Google Play service account configuration is invalid") from exc


def verify_google_play_purchase(purchase_token: str) -> VerifiedStorePurchase:
    try:
        from google.auth.transport.requests import AuthorizedSession
    except ImportError as exc:
        raise StoreBillingConfigurationError("google-auth is required for Google Play verification") from exc

    package_name = os.getenv("GOOGLE_PLAY_PACKAGE_NAME", "com.quantech.filscore").strip()
    if not purchase_token.strip():
        raise StorePurchaseVerificationError("Google Play purchase token is required")
    session = AuthorizedSession(_google_credentials())
    response = session.get(
        "https://androidpublisher.googleapis.com/androidpublisher/v3/"
        f"applications/{package_name}/purchases/subscriptionsv2/tokens/{purchase_token}",
        timeout=15,
    )
    if response.status_code != 200:
        raise StorePurchaseVerificationError("Google Play could not verify this purchase")
    try:
        payload = response.json()
        line_item = payload["lineItems"][0]
        product_id = str(line_item["productId"])
        transaction_id = str(payload.get("latestOrderId") or "").strip()
        expires_at = _iso_datetime(line_item.get("expiryTime"))
    except (IndexError, KeyError, TypeError, ValueError) as exc:
        raise StorePurchaseVerificationError("Google Play returned an incomplete purchase") from exc
    if not transaction_id:
        raise StorePurchaseVerificationError("Google Play order identifier is missing")

    state = str(payload.get("subscriptionState") or "")
    status_by_state = {
        "SUBSCRIPTION_STATE_ACTIVE": "ACTIVE",
        "SUBSCRIPTION_STATE_IN_GRACE_PERIOD": "GRACE_PERIOD",
        "SUBSCRIPTION_STATE_PENDING": "PENDING",
        "SUBSCRIPTION_STATE_PAUSED": "SUSPENDED",
        "SUBSCRIPTION_STATE_ON_HOLD": "SUSPENDED",
        "SUBSCRIPTION_STATE_CANCELED": "CANCELLED",
        "SUBSCRIPTION_STATE_EXPIRED": "EXPIRED",
    }
    status = status_by_state.get(state, "PENDING")
    if status == "SUSPENDED":
        status = "EXPIRED"
    return VerifiedStorePurchase(
        platform="ANDROID",
        product_id=product_id,
        transaction_id=transaction_id,
        original_transaction_id=(
            hashlib.sha256(str(payload["linkedPurchaseToken"]).encode("utf-8")).hexdigest()
            if payload.get("linkedPurchaseToken")
            else None
        ),
        purchase_token_hash=hashlib.sha256(purchase_token.encode("utf-8")).hexdigest(),
        status=status,
        purchased_at=_iso_datetime(payload.get("startTime")),
        expires_at=expires_at,
    )


def verify_store_purchase(platform: str, verification_data: str) -> VerifiedStorePurchase:
    normalized_platform = platform.strip().upper()
    if normalized_platform == "ANDROID":
        return verify_google_play_purchase(verification_data)
    if normalized_platform == "IOS":
        return verify_apple_transaction(verification_data)
    raise StorePurchaseVerificationError("Unsupported store platform")