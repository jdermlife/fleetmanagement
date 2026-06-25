"""
Migration helper to add ownership field to loan_applications.

Run once in environments where AUTO_RUN_SCHEMA_MIGRATIONS is disabled.
"""

import os
import sys

from sqlalchemy import text

from app.database import engine


def add_loan_application_owner_column() -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                ALTER TABLE loan_applications
                ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_loan_applications_created_by_user_id
                ON loan_applications(created_by_user_id);
                """
            )
        )


if __name__ == "__main__":
    try:
        if not os.getenv("DATABASE_URL"):
            raise RuntimeError("DATABASE_URL environment variable is required")
        add_loan_application_owner_column()
        print("Loan ownership migration completed successfully")
        sys.exit(0)
    except Exception as exc:
        print(f"Loan ownership migration failed: {exc}", file=sys.stderr)
        sys.exit(1)