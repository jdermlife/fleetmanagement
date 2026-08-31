"""Add provider-managed recurring billing agreements."""

from __future__ import annotations

from app.database import engine


SQL = [
    """
    CREATE TABLE IF NOT EXISTS subscription_billing_agreements (
        id BIGSERIAL PRIMARY KEY,
        subscription_id BIGINT NOT NULL REFERENCES subscriptions(id),
        provider_id BIGINT NOT NULL REFERENCES payment_providers(id),
        provider_customer_id VARCHAR(255),
        provider_plan_id VARCHAR(255) NOT NULL,
        provider_agreement_id VARCHAR(255) NOT NULL,
        provider_payment_method_id VARCHAR(255),
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        authorized_at TIMESTAMPTZ,
        first_charge_at TIMESTAMPTZ NOT NULL,
        next_charge_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        last_error_code VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ,
        CONSTRAINT ck_subscription_billing_agreements_status CHECK (
            status IN ('PENDING','APPROVAL_PENDING','AUTHORIZED','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED','EXPIRED','FAILED')
        ),
        CONSTRAINT uq_subscription_billing_agreements_provider_agreement UNIQUE (provider_id, provider_agreement_id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_subscription_billing_agreements_subscription_id ON subscription_billing_agreements(subscription_id)",
    "CREATE INDEX IF NOT EXISTS ix_subscription_billing_agreements_provider_id ON subscription_billing_agreements(provider_id)",
    "CREATE INDEX IF NOT EXISTS ix_subscription_billing_agreements_first_charge_at ON subscription_billing_agreements(first_charge_at)",
    "CREATE INDEX IF NOT EXISTS ix_subscription_billing_agreements_next_charge_at ON subscription_billing_agreements(next_charge_at)",
    "ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255)",
    "ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS billing_period_start DATE",
    "ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS billing_period_end DATE",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_payments_provider_idempotency ON subscription_payments(provider_id, idempotency_key) WHERE idempotency_key IS NOT NULL",
]


def run() -> None:
    with engine.begin() as connection:
        for statement in SQL:
            connection.exec_driver_sql(statement)


if __name__ == "__main__":
    run()
    print("Recurring billing migration completed.")