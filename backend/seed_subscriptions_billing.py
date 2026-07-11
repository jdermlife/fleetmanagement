"""Seed script to populate subscription billing reference data."""

from sqlalchemy import text

from app.database import engine


SEED_STATEMENTS = [
    # 1. Seed Payment Providers
    """
    INSERT INTO payment_providers
    (provider_code, provider_name, api_endpoint, webhook_url, is_active)
    VALUES
    ('STRIPE', 'Stripe', 'https://api.stripe.com', '/api/webhooks/stripe', TRUE),
    ('PAYPAL', 'PayPal', 'https://api.paypal.com', '/api/webhooks/paypal', TRUE),
    ('GCASH', 'GCash', 'https://api.gcash.com', '/api/webhooks/gcash', TRUE),
    ('MAYA', 'Maya', 'https://api.maya.ph', '/api/webhooks/maya', TRUE),
    ('PAYMONGO', 'PayMongo', 'https://api.paymongo.com', '/api/subscriptions/payments/paymongo/webhook', TRUE),
    ('XENDIT', 'Xendit', 'https://api.xendit.co', '/api/webhooks/xendit', TRUE)
    ON CONFLICT(provider_code) DO NOTHING;
    """,
    """
    UPDATE payment_providers
    SET api_endpoint = 'https://api.paymongo.com',
        webhook_url = '/api/subscriptions/payments/paymongo/webhook'
    WHERE provider_code = 'PAYMONGO';
    """,
    # 2. Seed Subscription Plans
    """
    INSERT INTO subscription_plans
    (plan_code, plan_name, description, billing_cycle, monthly_price, yearly_price,
     currency, max_users, max_vehicles, max_drivers, max_storage_gb,
     ai_enabled, api_enabled, reporting_enabled, is_active)
    VALUES
    ('FREE', 'Free', 'Starter Plan', 'MONTHLY', 0, 0, 'PHP', 1, 5, 5, 2, TRUE, FALSE, TRUE, TRUE),
    ('STARTER', 'Starter', 'Small Business', 'MONTHLY', 999, 9990, 'PHP', 5, 50, 20, 20, TRUE, TRUE, TRUE, TRUE),
    ('PRO', 'Professional', 'Growing Business', 'MONTHLY', 2999, 29990, 'PHP', 20, 500, 100, 100, TRUE, TRUE, TRUE, TRUE),
    ('ENTERPRISE', 'Enterprise', 'Unlimited Enterprise', 'YEARLY', 0, 0, 'PHP', 999999, 999999, 999999, 999999, TRUE, TRUE, TRUE, TRUE)
    ON CONFLICT(plan_code) DO NOTHING;
    """,
    # 3. Seed Features
    """
    INSERT INTO features
    (feature_code, feature_name, description)
    VALUES
    ('DASHBOARD', 'Dashboard', 'Dashboard'),
    ('FLEET', 'Fleet Management', 'Fleet'),
    ('LOAN', 'Loan Origination', 'Loan'),
    ('LEASE', 'Lease Scorecard', 'Lease'),
    ('LENDING', 'Lending Scorecard', 'Lending'),
    ('GPS', 'GPS Tracking', 'GPS'),
    ('MAINTENANCE', 'Maintenance', 'Maintenance'),
    ('INSURANCE', 'Insurance', 'Insurance'),
    ('OCR', 'OCR Scanner', 'OCR'),
    ('AI_CHAT', 'AI Chat', 'AI'),
    ('AI_SUMMARY', 'AI Summarizer', 'AI'),
    ('VOICE', 'Voice Assistant', 'Voice'),
    ('PDF_EXPORT', 'PDF Export', 'Export'),
    ('EXCEL_EXPORT', 'Excel Export', 'Export'),
    ('API_ACCESS', 'API', 'API'),
    ('AUDIT', 'Audit Logs', 'Audit'),
    ('REPORTS', 'Reports', 'Reports'),
    ('USERS', 'User Management', 'Users'),
    ('RBAC', 'Role Management', 'Security'),
    ('SETTINGS', 'System Settings', 'Settings')
    ON CONFLICT(feature_code) DO NOTHING;
    """,
    # 4. Assign Features to FREE Plan
    """
    INSERT INTO plan_features (plan_id, feature_id)
    SELECT p.id, f.id
    FROM subscription_plans p
    JOIN features f ON f.feature_code IN ('DASHBOARD', 'FLEET', 'REPORTS')
    WHERE p.plan_code = 'FREE'
    ON CONFLICT DO NOTHING;
    """,
    # 5. Assign Features to STARTER Plan
    """
    INSERT INTO plan_features (plan_id, feature_id)
    SELECT p.id, f.id
    FROM subscription_plans p
    CROSS JOIN features f
    WHERE p.plan_code = 'STARTER' AND f.feature_code != 'RBAC'
    ON CONFLICT DO NOTHING;
    """,
    # 6. Assign Features to PRO Plan
    """
    INSERT INTO plan_features (plan_id, feature_id)
    SELECT p.id, f.id
    FROM subscription_plans p
    CROSS JOIN features f
    WHERE p.plan_code = 'PRO'
    ON CONFLICT DO NOTHING;
    """,
    # 7. Assign Features to ENTERPRISE Plan
    """
    INSERT INTO plan_features (plan_id, feature_id)
    SELECT p.id, f.id
    FROM subscription_plans p
    CROSS JOIN features f
    WHERE p.plan_code = 'ENTERPRISE'
    ON CONFLICT DO NOTHING;
    """,
]


def run_seed() -> None:
    with engine.begin() as connection:
        for statement in SEED_STATEMENTS:
            connection.execute(text(statement))


if __name__ == "__main__":
    run_seed()
    print("Subscription billing seed data completed.")
