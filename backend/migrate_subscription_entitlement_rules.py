"""Subscription entitlement migration for free-window and per-record pricing rules."""

from sqlalchemy import text

from app.database import engine


STATEMENTS = [
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS free_record_limit_lifetime INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS free_days_from_start INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS minimum_monthly_fee NUMERIC(12,2) NOT NULL DEFAULT 0",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS per_record_fee NUMERIC(12,2) NOT NULL DEFAULT 0",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS role_code VARCHAR(50)",
    "CREATE INDEX IF NOT EXISTS idx_subscription_plans_role_code ON subscription_plans(role_code)",
    "CREATE TABLE IF NOT EXISTS subscription_record_usage_events ("
    "id BIGSERIAL PRIMARY KEY,"
    "subscription_id BIGINT NOT NULL REFERENCES subscriptions(id),"
    "user_id INTEGER NOT NULL REFERENCES users(id),"
    "record_type VARCHAR(50) NOT NULL DEFAULT 'loan_application',"
    "record_ref VARCHAR(100),"
    "event_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),"
    "billing_month DATE NOT NULL,"
    "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
    ")",
    "CREATE INDEX IF NOT EXISTS idx_sru_events_sub_month ON subscription_record_usage_events(subscription_id, billing_month)",
    "CREATE INDEX IF NOT EXISTS idx_sru_events_user_ts ON subscription_record_usage_events(user_id, event_ts)",
]


def run_migration() -> None:
    with engine.begin() as connection:
        for statement in STATEMENTS:
            connection.execute(text(statement))


if __name__ == "__main__":
    run_migration()
    print("Subscription entitlement migration completed.")
