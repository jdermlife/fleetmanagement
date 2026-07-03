"""One-time migration to add lender data-sharing consent fields to users."""

from sqlalchemy import text

from app.database import engine


ALTER_STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS lender_data_sharing_consent BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS lender_data_sharing_consent_recorded_at TIMESTAMPTZ",
]


def run_migration() -> None:
    with engine.begin() as connection:
        for statement in ALTER_STATEMENTS:
            connection.execute(text(statement))


if __name__ == "__main__":
    run_migration()
    print("Lender data-sharing consent migration completed.")
