"""Apply latest subscription_plans and subscriptions SQL amendments."""

from sqlalchemy import text

from app.database import engine


PLAN_ALTERS = [
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 30",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_custom_pricing BOOLEAN DEFAULT FALSE",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_ai_requests_per_month INTEGER DEFAULT 1000",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_api_calls_per_month INTEGER DEFAULT 10000",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_documents INTEGER DEFAULT 1000",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_reports INTEGER DEFAULT 500",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_meetings INTEGER DEFAULT 500",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_storage_files INTEGER DEFAULT 10000",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS storage_unit VARCHAR(20) DEFAULT 'GB'",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS support_level VARCHAR(30) DEFAULT 'STANDARD'",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS sla_hours INTEGER DEFAULT 48",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS color_code VARCHAR(20)",
    "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS icon_name VARCHAR(100)",
]

PLAN_CONSTRAINTS = [
    """
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_support_level') THEN
        ALTER TABLE subscription_plans
        ADD CONSTRAINT chk_support_level
        CHECK (support_level IN ('STANDARD','PRIORITY','PREMIUM','ENTERPRISE'));
      END IF;
    END $$;
    """,
]

PLAN_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_subscription_plans_public ON subscription_plans(is_public)",
    "CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active)",
    "CREATE INDEX IF NOT EXISTS idx_subscription_plans_display ON subscription_plans(display_order)",
]

SUBSCRIPTION_ALTERS = [
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(20) DEFAULT 'TRIAL'",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_by INTEGER",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grace_period_end DATE",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_count INTEGER DEFAULT 0",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_payment_date DATE",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_invoice_date DATE",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_users INTEGER DEFAULT 1",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_vehicles INTEGER DEFAULT 0",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_drivers INTEGER DEFAULT 0",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_storage_gb NUMERIC(12,2) DEFAULT 0",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_ai_requests INTEGER DEFAULT 0",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_api_calls INTEGER DEFAULT 0",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_by INTEGER",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_by INTEGER",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS deleted_by INTEGER",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tenant_id BIGINT",
]

SUBSCRIPTION_CONSTRAINTS = [
    """
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscription_cancelled_by') THEN
        ALTER TABLE subscriptions
        ADD CONSTRAINT fk_subscription_cancelled_by
        FOREIGN KEY (cancelled_by) REFERENCES users(id);
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscription_created_by') THEN
        ALTER TABLE subscriptions
        ADD CONSTRAINT fk_subscription_created_by
        FOREIGN KEY (created_by) REFERENCES users(id);
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscription_updated_by') THEN
        ALTER TABLE subscriptions
        ADD CONSTRAINT fk_subscription_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id);
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscription_deleted_by') THEN
        ALTER TABLE subscriptions
        ADD CONSTRAINT fk_subscription_deleted_by
        FOREIGN KEY (deleted_by) REFERENCES users(id);
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_subscription_type') THEN
        ALTER TABLE subscriptions
        ADD CONSTRAINT chk_subscription_type
        CHECK (subscription_type IN ('FREE','TRIAL','PAID','LIFETIME'));
      END IF;
    END $$;
    """,
]

SUBSCRIPTION_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_subscription_status ON subscriptions(status)",
    "CREATE INDEX IF NOT EXISTS idx_subscription_plan ON subscriptions(plan_id)",
    "CREATE INDEX IF NOT EXISTS idx_subscription_user ON subscriptions(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_subscription_billing ON subscriptions(next_billing_date)",
    "CREATE INDEX IF NOT EXISTS idx_subscription_end ON subscriptions(subscription_end)",
    "CREATE INDEX IF NOT EXISTS idx_subscription_deleted ON subscriptions(is_deleted)",
]

SEED_UPDATES = [
    "UPDATE subscription_plans SET trial_days = 30, display_order = 1, support_level = 'STANDARD' WHERE plan_code = 'FREE'",
    "UPDATE subscription_plans SET display_order = 2, support_level = 'STANDARD' WHERE plan_code = 'STARTER'",
    "UPDATE subscription_plans SET display_order = 3, support_level = 'PRIORITY' WHERE plan_code = 'PRO'",
    "UPDATE subscription_plans SET display_order = 4, support_level = 'ENTERPRISE', is_custom_pricing = TRUE WHERE plan_code = 'ENTERPRISE'",
]


def run_migration() -> None:
    with engine.begin() as connection:
        for statement in PLAN_ALTERS:
            connection.execute(text(statement))
        for statement in PLAN_CONSTRAINTS:
            connection.execute(text(statement))
        for statement in PLAN_INDEXES:
            connection.execute(text(statement))

        for statement in SUBSCRIPTION_ALTERS:
            connection.execute(text(statement))
        for statement in SUBSCRIPTION_CONSTRAINTS:
            connection.execute(text(statement))
        for statement in SUBSCRIPTION_INDEXES:
            connection.execute(text(statement))

        for statement in SEED_UPDATES:
            connection.execute(text(statement))


if __name__ == "__main__":
    run_migration()
    print("Subscription amendment migration v2 completed.")
