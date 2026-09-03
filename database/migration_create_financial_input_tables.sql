-- Additive PostgreSQL schema for financial details and history.
-- loan_applications remains the authoritative master table and is not altered.
-- Its scalar and JSONB columns retain current values; these tables store only
-- repeating records and historical snapshots that cannot fit in one master row.

BEGIN;

CREATE OR REPLACE FUNCTION set_financial_child_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Individual dependents supplement the master's dependent count.
CREATE TABLE IF NOT EXISTS loan_application_dependents (
    id BIGSERIAL PRIMARY KEY,
    loan_application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    sequence_no INTEGER NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    date_of_birth DATE,
    monthly_support_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (sequence_no > 0),
    CHECK (monthly_support_amount >= 0),
    UNIQUE (loan_application_id, sequence_no)
);

-- Additional parties supplement the single primary party fields in the master.
CREATE TABLE IF NOT EXISTS loan_application_additional_parties (
    id BIGSERIAL PRIMARY KEY,
    loan_application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    party_type VARCHAR(20) NOT NULL CHECK (party_type IN ('CO_BORROWER', 'GUARANTOR', 'REFERENCE')),
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    full_name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    email VARCHAR(320),
    mobile_number VARCHAR(50),
    address TEXT,
    date_of_birth DATE,
    citizenship VARCHAR(100),
    employer_business_name VARCHAR(255),
    occupation VARCHAR(150),
    position VARCHAR(150),
    monthly_income NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (monthly_income >= 0),
    monthly_expenses NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (monthly_expenses >= 0),
    debt_obligations NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (debt_obligations >= 0),
    credit_standing VARCHAR(50),
    additional_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (loan_application_id, party_type, sequence_no)
);

-- Monthly net-worth history; current aggregates/details stay in loan_applications.
CREATE TABLE IF NOT EXISTS loan_application_networth (
    id BIGSERIAL PRIMARY KEY,
    loan_application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'PHP',
    total_assets NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_liabilities NUMERIC(18,2) NOT NULL DEFAULT 0,
    net_worth NUMERIC(18,2) NOT NULL DEFAULT 0,
    liquid_assets NUMERIC(18,2) NOT NULL DEFAULT 0,
    monthly_income NUMERIC(18,2) NOT NULL DEFAULT 0,
    monthly_expenses NUMERIC(18,2) NOT NULL DEFAULT 0,
    monthly_cash_flow NUMERIC(18,2) NOT NULL DEFAULT 0,
    savings_rate NUMERIC(9,4) NOT NULL DEFAULT 0,
    debt_to_income_ratio NUMERIC(9,4),
    debt_to_asset_ratio NUMERIC(9,4),
    emergency_fund_months NUMERIC(10,2),
    normalized_score NUMERIC(10,2),
    grade VARCHAR(30),
    rating VARCHAR(100),
    component_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (total_assets >= 0 AND total_liabilities >= 0 AND liquid_assets >= 0),
    UNIQUE (loan_application_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS loan_application_networth_items (
    id BIGSERIAL PRIMARY KEY,
    networth_snapshot_id BIGINT NOT NULL REFERENCES loan_application_networth(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('ASSET', 'LIABILITY')),
    category VARCHAR(100) NOT NULL,
    item_code VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    setup_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    actual_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (networth_snapshot_id, item_code)
);

-- Monthly line items supplement current budget_items JSONB and summary columns.
CREATE TABLE IF NOT EXISTS loan_application_budget (
    id BIGSERIAL PRIMARY KEY,
    loan_application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    budget_month DATE NOT NULL,
    period_end DATE,
    item_type VARCHAR(20) NOT NULL DEFAULT 'EXPENSE' CHECK (item_type IN ('INCOME', 'EXPENSE')),
    category VARCHAR(100) NOT NULL,
    allocation_percent NUMERIC(9,4) CHECK (allocation_percent BETWEEN 0 AND 100),
    budget_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    actual_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    variance NUMERIC(18,2) NOT NULL DEFAULT 0,
    variance_notes TEXT,
    corrective_actions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (loan_application_id, budget_month, item_type, category)
);

-- Multiple facilities supplement the current primary-loan fields and JSONB.
CREATE TABLE IF NOT EXISTS loan_application_loan_accounts (
    id BIGSERIAL PRIMARY KEY,
    loan_application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    lender VARCHAR(255),
    loan_type VARCHAR(100) NOT NULL,
    original_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    start_date DATE,
    annual_interest_rate NUMERIC(9,4),
    term_months INTEGER CHECK (term_months > 0),
    beginning_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    current_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    credit_limit NUMERIC(18,2),
    collateral_description TEXT,
    collateral_recorded_value NUMERIC(18,2),
    status VARCHAR(30) NOT NULL DEFAULT 'CURRENT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (original_amount >= 0 AND beginning_balance >= 0 AND current_balance >= 0),
    UNIQUE (loan_application_id, sequence_no)
);

-- Monthly monitoring supports multiple facilities and preserves score history.
CREATE TABLE IF NOT EXISTS loan_application_monitoring (
    id BIGSERIAL PRIMARY KEY,
    loan_application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    loan_account_id BIGINT REFERENCES loan_application_loan_accounts(id) ON DELETE CASCADE,
    monitoring_date DATE NOT NULL,
    outstanding_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    principal_paid NUMERIC(18,2) NOT NULL DEFAULT 0,
    interest_paid NUMERIC(18,2) NOT NULL DEFAULT 0,
    monthly_payment NUMERIC(18,2) NOT NULL DEFAULT 0,
    extra_monthly_payment NUMERIC(18,2) NOT NULL DEFAULT 0,
    days_past_due INTEGER NOT NULL DEFAULT 0,
    loan_status VARCHAR(30) NOT NULL DEFAULT 'CURRENT',
    dsr NUMERIC(9,4),
    desired_dsr_limit NUMERIC(9,4),
    utilization_rate NUMERIC(9,4),
    ltv NUMERIC(9,4),
    balance_reduction NUMERIC(9,4),
    collateral_current_value NUMERIC(18,2),
    collateral_mark_to_market_value NUMERIC(18,2),
    refinancing_improves_cash_flow BOOLEAN,
    consolidation_opportunity BOOLEAN,
    regular_extra_payments BOOLEAN,
    principal_prepayment BOOLEAN,
    declining_payment_behavior BOOLEAN,
    increasing_past_dues BOOLEAN,
    risk_level VARCHAR(30),
    monitoring_score NUMERIC(10,2),
    score_components JSONB NOT NULL DEFAULT '{}'::jsonb,
    predictions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_monitoring_application_account_date
    ON loan_application_monitoring (
        loan_application_id,
        COALESCE(loan_account_id, 0::bigint),
        monitoring_date
    );

-- Repeating billers and payments supplement current bill JSONB/summary fields.
CREATE TABLE IF NOT EXISTS loan_application_billers (
    id BIGSERIAL PRIMARY KEY,
    loan_application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    biller_name VARCHAR(255) NOT NULL,
    bill_type VARCHAR(100),
    estimated_due_day INTEGER CHECK (estimated_due_day BETWEEN 1 AND 31),
    payment_frequency VARCHAR(30) NOT NULL DEFAULT 'MONTHLY',
    budgeted_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (budgeted_amount >= 0),
    allocation_percent NUMERIC(9,4) CHECK (allocation_percent BETWEEN 0 AND 100),
    reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_days_before INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (loan_application_id, sequence_no)
);

-- Retains the table name and core columns used by the existing endpoint.
CREATE TABLE IF NOT EXISTS loan_application_bill_reminders (
    id BIGSERIAL PRIMARY KEY,
    loan_application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    biller_id BIGINT REFERENCES loan_application_billers(id) ON DELETE CASCADE,
    bill_type VARCHAR(100),
    biller_name VARCHAR(255),
    amount_due NUMERIC(18,2) NOT NULL DEFAULT 0,
    due_date DATE,
    payment_date DATE,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loan_application_bill_payments (
    id BIGSERIAL PRIMARY KEY,
    biller_id BIGINT NOT NULL REFERENCES loan_application_billers(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    date_covered DATE,
    due_date DATE,
    date_paid DATE,
    amount_due NUMERIC(18,2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(18,2) NOT NULL DEFAULT 0,
    variance NUMERIC(18,2) NOT NULL DEFAULT 0,
    variance_notes TEXT,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    days_late INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (period_end >= period_start),
    CHECK (amount_due >= 0 AND amount_paid >= 0)
);

CREATE INDEX IF NOT EXISTS idx_dependents_application ON loan_application_dependents (loan_application_id);
CREATE INDEX IF NOT EXISTS idx_parties_application ON loan_application_additional_parties (loan_application_id, party_type);
CREATE INDEX IF NOT EXISTS idx_networth_application_date ON loan_application_networth (loan_application_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_budget_application_month ON loan_application_budget (loan_application_id, budget_month DESC);
CREATE INDEX IF NOT EXISTS idx_loan_accounts_application ON loan_application_loan_accounts (loan_application_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_application_date ON loan_application_monitoring (loan_application_id, monitoring_date DESC);
CREATE INDEX IF NOT EXISTS idx_billers_application_active ON loan_application_billers (loan_application_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bill_payments_biller_period ON loan_application_bill_payments (biller_id, period_start DESC);

DO $$
DECLARE
    target_table TEXT;
BEGIN
    FOREACH target_table IN ARRAY ARRAY[
        'loan_application_dependents', 'loan_application_additional_parties',
        'loan_application_networth', 'loan_application_networth_items',
        'loan_application_budget', 'loan_application_loan_accounts',
        'loan_application_monitoring', 'loan_application_billers',
        'loan_application_bill_reminders', 'loan_application_bill_payments'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', target_table, target_table);
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION set_financial_child_updated_at()',
            target_table, target_table
        );
    END LOOP;
END;
$$;

COMMIT;