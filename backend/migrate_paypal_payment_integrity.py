"""Add PayPal transaction and webhook replay-protection indexes."""

from __future__ import annotations

from app.database import engine


SQL = [
    (
        "ALTER TABLE payment_webhooks "
        "ADD COLUMN IF NOT EXISTS provider_event_id VARCHAR(255)"
    ),
    (
        "CREATE UNIQUE INDEX IF NOT EXISTS "
        "uq_subscription_payments_provider_transaction_id "
        "ON subscription_payments(provider_id, provider_transaction_id) "
        "WHERE provider_transaction_id IS NOT NULL"
    ),
    (
        "CREATE UNIQUE INDEX IF NOT EXISTS "
        "uq_payment_webhooks_provider_event_id "
        "ON payment_webhooks(provider_id, provider_event_id) "
        "WHERE provider_event_id IS NOT NULL"
    ),
]


def run() -> None:
    with engine.begin() as connection:
        for statement in SQL:
            connection.exec_driver_sql(statement)


if __name__ == "__main__":
    run()
    print("PayPal payment integrity migration completed.")
