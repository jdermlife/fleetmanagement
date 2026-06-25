"""One-time migration to create subscription billing domain tables."""

from sqlalchemy import text

from app.database import engine


DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS subscription_plans (
        id BIGSERIAL PRIMARY KEY,
        plan_code VARCHAR(50) UNIQUE NOT NULL,
        plan_name VARCHAR(100) NOT NULL,
        description TEXT,
        billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('MONTHLY','QUARTERLY','YEARLY')),
        monthly_price NUMERIC(12,2),
        yearly_price NUMERIC(12,2),
        currency VARCHAR(10) DEFAULT 'PHP',
        max_users INTEGER,
        max_vehicles INTEGER,
        max_drivers INTEGER,
        max_storage_gb INTEGER,
        ai_enabled BOOLEAN DEFAULT TRUE,
        api_enabled BOOLEAN DEFAULT TRUE,
        reporting_enabled BOOLEAN DEFAULT TRUE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS payment_providers (
        id BIGSERIAL PRIMARY KEY,
        provider_code VARCHAR(50) UNIQUE,
        provider_name VARCHAR(100),
        api_endpoint TEXT,
        webhook_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS subscriptions (
        id BIGSERIAL PRIMARY KEY,
        subscription_no VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id),
        plan_id BIGINT NOT NULL REFERENCES subscription_plans(id),
        status VARCHAR(30) NOT NULL CHECK (status IN ('TRIAL','ACTIVE','SUSPENDED','EXPIRED','CANCELLED')),
        trial_start DATE,
        trial_end DATE,
        subscription_start DATE NOT NULL,
        subscription_end DATE,
        auto_renew BOOLEAN DEFAULT TRUE,
        payment_provider_id BIGINT REFERENCES payment_providers(id),
        next_billing_date DATE,
        remarks TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS subscription_payments (
        id BIGSERIAL PRIMARY KEY,
        payment_reference VARCHAR(100) UNIQUE,
        subscription_id BIGINT REFERENCES subscriptions(id),
        provider_id BIGINT REFERENCES payment_providers(id),
        invoice_no VARCHAR(50),
        amount NUMERIC(12,2),
        currency VARCHAR(10),
        payment_method VARCHAR(50),
        payment_status VARCHAR(30) CHECK (payment_status IN ('PENDING','SUCCESS','FAILED','REFUNDED')),
        provider_transaction_id VARCHAR(255),
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS subscription_invoices (
        id BIGSERIAL PRIMARY KEY,
        invoice_no VARCHAR(50) UNIQUE,
        subscription_id BIGINT REFERENCES subscriptions(id),
        invoice_date DATE,
        due_date DATE,
        subtotal NUMERIC(12,2),
        tax NUMERIC(12,2),
        total NUMERIC(12,2),
        status VARCHAR(30),
        pdf_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS subscription_usage (
        id BIGSERIAL PRIMARY KEY,
        subscription_id BIGINT REFERENCES subscriptions(id),
        usage_date DATE,
        users_used INTEGER,
        vehicles_used INTEGER,
        drivers_used INTEGER,
        storage_used_gb NUMERIC(10,2),
        api_calls INTEGER,
        ai_requests INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS subscription_events (
        id BIGSERIAL PRIMARY KEY,
        subscription_id BIGINT REFERENCES subscriptions(id),
        event_type VARCHAR(50),
        event_details JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS payment_webhooks (
        id BIGSERIAL PRIMARY KEY,
        provider_id BIGINT REFERENCES payment_providers(id),
        event_type VARCHAR(100),
        payload JSONB,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS features (
        id BIGSERIAL PRIMARY KEY,
        feature_code VARCHAR(100) UNIQUE,
        feature_name VARCHAR(200),
        description TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS plan_features (
        plan_id BIGINT REFERENCES subscription_plans(id),
        feature_id BIGINT REFERENCES features(id),
        PRIMARY KEY (plan_id, feature_id)
    );
    """,
]


def run_migration() -> None:
    with engine.begin() as connection:
        for statement in DDL_STATEMENTS:
            connection.execute(text(statement))


if __name__ == "__main__":
    run_migration()
    print("Subscription billing migration completed.")
