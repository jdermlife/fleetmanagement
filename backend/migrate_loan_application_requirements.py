#!/usr/bin/env python3
"""Add the new loan application columns for product type and structured requirements.

Run this once against an existing PostgreSQL database after deploying the updated model.
"""

from sqlalchemy import text

from app.database import engine


def main() -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                ALTER TABLE loan_applications
                ADD COLUMN IF NOT EXISTS product_type VARCHAR;
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE loan_applications
                ADD COLUMN IF NOT EXISTS requirements JSONB;
                """
            )
        )

    print("Loan application schema migration completed successfully.")


if __name__ == "__main__":
    main()
