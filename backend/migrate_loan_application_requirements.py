#!/usr/bin/env python3
"""Normalize Build Profile requirements into loan application columns.

Safe to run repeatedly against an existing PostgreSQL database.
"""

from pathlib import Path

from sqlalchemy import inspect

from app.database import engine


def main() -> None:
    if not inspect(engine).has_table("loan_applications"):
        print("Loan applications table does not exist yet; migration skipped.")
        return

    migration_path = Path(__file__).with_name(
        "migrate_loan_application_requirements_to_columns.sql"
    )
    script = migration_path.read_text(encoding="utf-8")
    connection = engine.raw_connection()
    try:
        cursor = connection.cursor()
        try:
            cursor.execute(
                "ALTER TABLE loan_applications "
                "ADD COLUMN IF NOT EXISTS product_type VARCHAR, "
                "ADD COLUMN IF NOT EXISTS requirements JSONB"
            )
            cursor.execute(script)
        finally:
            cursor.close()
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    print("Loan application requirements migration completed successfully.")


if __name__ == "__main__":
    main()
