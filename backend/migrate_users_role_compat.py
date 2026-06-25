"""Compatibility migration: restore users.role column for existing auth/token flow."""

from sqlalchemy import text

from app.database import engine


STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(100)",
    "UPDATE users SET role = COALESCE(role, 'SUBSCRIBER')",
    "ALTER TABLE users ALTER COLUMN role SET DEFAULT 'SUBSCRIBER'",
    "ALTER TABLE users ALTER COLUMN role SET NOT NULL",
    "CREATE INDEX IF NOT EXISTS ix_users_role ON users(role)",
]


def run_migration() -> None:
    with engine.begin() as connection:
        for statement in STATEMENTS:
            connection.execute(text(statement))


if __name__ == "__main__":
    run_migration()
    print("Users role compatibility migration completed.")
