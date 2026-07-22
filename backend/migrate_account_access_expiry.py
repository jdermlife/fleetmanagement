"""Add account access expiry field for trial/payment lifecycle enforcement."""

from sqlalchemy import text

from app.database import engine


ALTER_STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_access_expires_at TIMESTAMPTZ",
]


def run_migration() -> None:
    with engine.begin() as connection:
        for statement in ALTER_STATEMENTS:
            connection.execute(text(statement))


if __name__ == "__main__":
    run_migration()
    print("Account access expiry migration completed.")
