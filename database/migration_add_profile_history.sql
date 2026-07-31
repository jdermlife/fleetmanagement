BEGIN;

CREATE TABLE IF NOT EXISTS history_configuration (
    module_name VARCHAR(64) PRIMARY KEY,
    retention_months INTEGER NOT NULL DEFAULT 24,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_history_configuration_retention_months
        CHECK (retention_months > 0)
);

CREATE TABLE IF NOT EXISTS profile_history (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    loan_application_id INTEGER NOT NULL
        REFERENCES loan_applications(id) ON DELETE CASCADE,
    category VARCHAR(64) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    payload JSON NOT NULL,
    created_by INTEGER NOT NULL
        REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_profile_history_category'
          AND conrelid = 'profile_history'::regclass
    ) THEN
        ALTER TABLE profile_history
        ADD CONSTRAINT chk_profile_history_category CHECK (
            category IN (
                'budget_snapshot',
                'net_worth_snapshot',
                'wealth_building_score',
                'financial_health_score',
                'credit_health_score',
                'bill_payment',
                'loan_monitoring',
                'goal_tracking',
                'ai_recommendation',
                'certification',
                'risk_assessment'
            )
        );
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS ix_profile_history_owner_id
    ON profile_history (owner_id);

CREATE INDEX IF NOT EXISTS ix_profile_history_loan_application_id
    ON profile_history (loan_application_id);

CREATE INDEX IF NOT EXISTS idx_profile_history_profile_category_observed
    ON profile_history (loan_application_id, category, observed_at);

CREATE INDEX IF NOT EXISTS idx_profile_history_owner_profile
    ON profile_history (owner_id, loan_application_id);

INSERT INTO history_configuration (module_name, retention_months)
VALUES
    ('budget_snapshot', 24),
    ('net_worth_snapshot', 24),
    ('wealth_building_score', 24),
    ('financial_health_score', 24),
    ('credit_health_score', 24),
    ('bill_payment', 24),
    ('loan_monitoring', 24),
    ('goal_tracking', 24),
    ('ai_recommendation', 24),
    ('certification', 24),
    ('risk_assessment', 24)
ON CONFLICT (module_name) DO NOTHING;

CREATE OR REPLACE FUNCTION cleanup_expired_profile_history()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM profile_history AS history
    USING history_configuration AS configuration
    WHERE history.category = configuration.module_name
      AND history.observed_at < (
          CURRENT_TIMESTAMP
          - make_interval(months => configuration.retention_months)
      );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

COMMIT;

-- Manual cleanup:
-- SELECT cleanup_expired_profile_history();

-- Retrieve newest history for one persisted profile:
-- SELECT history.*
-- FROM profile_history AS history
-- JOIN loan_applications AS application
--   ON application.id = history.loan_application_id
-- WHERE application.application_no = 'APP-001'
--   AND history.category = 'financial_health_score'
-- ORDER BY history.observed_at DESC, history.id DESC;