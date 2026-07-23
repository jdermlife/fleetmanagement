"""Backfill the public Single/Multiple Profile subscription plans for expired-trial checkout."""

from sqlalchemy import text

from app.database import engine


MIGRATION_STATEMENTS = [
    """
    INSERT INTO subscription_plans (
        plan_code,
        plan_name,
        description,
        billing_cycle,
        monthly_price,
        yearly_price,
        currency,
        max_users,
        max_vehicles,
        max_drivers,
        max_storage_gb,
        ai_enabled,
        api_enabled,
        reporting_enabled,
        is_active
    )
    VALUES
        ('SINGLE_PROFILE', 'Subscriber Single Profile Plan', 'Single profile monthly subscription', 'MONTHLY', 160, 1920, 'PHP', 1, 5, 5, 2, TRUE, FALSE, TRUE, TRUE),
        ('MULTIPLE_PROFILE', 'Subscriber Multiple Profile Plan', 'Multiple profile monthly subscription', 'MONTHLY', 1600, 19200, 'PHP', 20, 50, 20, 20, TRUE, TRUE, TRUE, TRUE)
    ON CONFLICT (plan_code) DO UPDATE
    SET
        plan_name = EXCLUDED.plan_name,
        description = EXCLUDED.description,
        billing_cycle = EXCLUDED.billing_cycle,
        monthly_price = EXCLUDED.monthly_price,
        yearly_price = EXCLUDED.yearly_price,
        currency = EXCLUDED.currency,
        max_users = EXCLUDED.max_users,
        max_vehicles = EXCLUDED.max_vehicles,
        max_drivers = EXCLUDED.max_drivers,
        max_storage_gb = EXCLUDED.max_storage_gb,
        ai_enabled = EXCLUDED.ai_enabled,
        api_enabled = EXCLUDED.api_enabled,
        reporting_enabled = EXCLUDED.reporting_enabled,
        is_active = EXCLUDED.is_active;
    """,
    """
    INSERT INTO plan_features (plan_id, feature_id)
    SELECT p.id, f.id
    FROM subscription_plans p
    JOIN features f ON f.feature_code IN ('DASHBOARD', 'FLEET', 'REPORTS', 'LENDING')
    WHERE p.plan_code = 'SINGLE_PROFILE'
    ON CONFLICT DO NOTHING;
    """,
    """
    INSERT INTO plan_features (plan_id, feature_id)
    SELECT p.id, f.id
    FROM subscription_plans p
    JOIN features f ON f.feature_code IN ('DASHBOARD', 'FLEET', 'REPORTS', 'LENDING', 'AI_CHAT', 'API_ACCESS')
    WHERE p.plan_code = 'MULTIPLE_PROFILE'
    ON CONFLICT DO NOTHING;
    """,
]


def run_migration() -> None:
    with engine.begin() as connection:
        for statement in MIGRATION_STATEMENTS:
            connection.execute(text(statement))


if __name__ == "__main__":
    run_migration()
    print("Public trial profile plan migration completed.")
