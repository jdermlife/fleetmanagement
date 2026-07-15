"""Ensure PAYPAL payment provider exists and is active."""

from sqlalchemy import text

from app.database import engine


UPSERT_PAYPAL_PROVIDER_SQL = """
INSERT INTO payment_providers (provider_code, provider_name, api_endpoint, webhook_url, is_active)
VALUES ('PAYPAL', 'PayPal', 'https://api-m.sandbox.paypal.com', NULL, TRUE)
ON CONFLICT (provider_code)
DO UPDATE SET
    provider_name = EXCLUDED.provider_name,
    api_endpoint = EXCLUDED.api_endpoint,
    is_active = TRUE;
"""


def run_migration() -> None:
    with engine.begin() as connection:
        connection.execute(text(UPSERT_PAYPAL_PROVIDER_SQL))


if __name__ == "__main__":
    run_migration()
    print("PAYPAL provider migration completed.")
