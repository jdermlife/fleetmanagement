from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

from app.routes.subscriptions import _store_purchase_grants_entitlement
from app.services.store_billing import StorePurchaseVerificationError, verify_apple_transaction


def _certificate(
    *,
    subject_name: str,
    subject_key,
    issuer_name: x509.Name,
    issuer_key,
    is_ca: bool,
) -> x509.Certificate:
    now = datetime.now(timezone.utc)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, subject_name)])
    return (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer_name)
        .public_key(subject_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=is_ca, path_length=None), critical=True)
        .sign(issuer_key, hashes.SHA256())
    )


def _signed_transaction(tmp_path, monkeypatch, *, bundle_id: str = "com.quantech.filscore") -> str:
    root_key = ec.generate_private_key(ec.SECP256R1())
    root_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Test Apple Root")])
    root_certificate = _certificate(
        subject_name="Test Apple Root",
        subject_key=root_key,
        issuer_name=root_name,
        issuer_key=root_key,
        is_ca=True,
    )
    leaf_key = ec.generate_private_key(ec.SECP256R1())
    leaf_certificate = _certificate(
        subject_name="Test StoreKit Signing",
        subject_key=leaf_key,
        issuer_name=root_certificate.subject,
        issuer_key=root_key,
        is_ca=False,
    )
    root_path = tmp_path / "apple-root.pem"
    root_path.write_bytes(root_certificate.public_bytes(serialization.Encoding.PEM))
    monkeypatch.setenv("APPLE_ROOT_CA_PATH", str(root_path))
    monkeypatch.setenv("APPLE_BUNDLE_ID", "com.quantech.filscore")
    monkeypatch.setenv("APPLE_STORE_ENVIRONMENT", "Sandbox")
    now_millis = int(datetime.now(timezone.utc).timestamp() * 1000)
    return jwt.encode(
        {
            "transactionId": "2000000123456789",
            "originalTransactionId": "2000000123456000",
            "productId": "com.quantech.filscore.single.monthly",
            "bundleId": bundle_id,
            "environment": "Sandbox",
            "purchaseDate": now_millis,
            "expiresDate": now_millis + 3_600_000,
        },
        leaf_key,
        algorithm="ES256",
        headers={
            "x5c": [base64.b64encode(leaf_certificate.public_bytes(serialization.Encoding.DER)).decode("ascii")],
        },
    )


def test_verify_apple_transaction_accepts_trusted_storekit_jws(tmp_path, monkeypatch):
    signed_transaction = _signed_transaction(tmp_path, monkeypatch)

    verified = verify_apple_transaction(signed_transaction)

    assert verified.platform == "IOS"
    assert verified.product_id == "com.quantech.filscore.single.monthly"
    assert verified.transaction_id == "2000000123456789"
    assert verified.status == "ACTIVE"


def test_verify_apple_transaction_rejects_another_bundle(tmp_path, monkeypatch):
    signed_transaction = _signed_transaction(tmp_path, monkeypatch, bundle_id="com.example.other")

    with pytest.raises(StorePurchaseVerificationError, match="another application"):
        verify_apple_transaction(signed_transaction)


def test_cancelled_subscription_remains_entitled_until_expiration():
    now = datetime.now(timezone.utc)

    assert _store_purchase_grants_entitlement("CANCELLED", now + timedelta(days=2)) is True
    assert _store_purchase_grants_entitlement("CANCELLED", now - timedelta(seconds=1)) is False