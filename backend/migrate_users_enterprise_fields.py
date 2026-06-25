"""One-time migration to align users table with enterprise fields."""

from sqlalchemy import text

from app.database import engine


ALTER_STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id BIGINT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id BIGINT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by INTEGER",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by INTEGER",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by INTEGER",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(30) DEFAULT 'ACTIVE'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_no VARCHAR(30)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS total_login_count INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS api_access BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_device TEXT",
]


CONSTRAINT_STATEMENTS = [
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_account_status'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT chk_account_status
        CHECK (account_status IN ('ACTIVE', 'PENDING', 'LOCKED', 'SUSPENDED', 'DISABLED', 'DELETED'));
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_created_by'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users(id);
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_updated_by'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT fk_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_deleted_by'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT fk_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_role'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id);
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_subscription'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT fk_users_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id);
      END IF;
    END $$;
    """,
]


INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_users_role_id ON users(role_id)",
    "CREATE INDEX IF NOT EXISTS ix_users_subscription_id ON users(subscription_id)",
    "CREATE INDEX IF NOT EXISTS ix_users_tenant_id ON users(tenant_id)",
    "CREATE INDEX IF NOT EXISTS ix_users_account_status ON users(account_status)",
]


def run_migration() -> None:
    with engine.begin() as connection:
        for statement in ALTER_STATEMENTS:
            connection.execute(text(statement))
        for statement in CONSTRAINT_STATEMENTS:
            connection.execute(text(statement))
        for statement in INDEX_STATEMENTS:
            connection.execute(text(statement))


if __name__ == "__main__":
    run_migration()
    print("Users enterprise field migration completed.")
