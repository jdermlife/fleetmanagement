"""Add the canonical client name field to loan applications."""

import os
import sys

from sqlalchemy import text

from app.database import engine


def add_loan_application_client_name_column() -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                ALTER TABLE loan_applications
                ADD COLUMN IF NOT EXISTS client_name VARCHAR(255);
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE loan_applications
                SET client_name = borrower_name
                WHERE (client_name IS NULL OR BTRIM(client_name) = '')
                  AND borrower_name IS NOT NULL
                  AND BTRIM(borrower_name) <> '';
                """
            )
        )


if __name__ == "__main__":
    try:
        if not os.getenv("DATABASE_URL"):
            raise RuntimeError("DATABASE_URL environment variable is required")
        add_loan_application_client_name_column()
        print("Loan application client name migration completed successfully")
        sys.exit(0)
    except Exception as exc:
        print(f"Loan application client name migration failed: {exc}", file=sys.stderr)
        sys.exit(1)