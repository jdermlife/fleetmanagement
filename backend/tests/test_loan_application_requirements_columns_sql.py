from pathlib import Path

from app.services.loan_application_profile_columns import PROFILE_COLUMN_NAMES


def test_requirements_sql_migration_covers_profile_columns() -> None:
    migration = (
        Path(__file__).resolve().parents[1]
        / "migrate_loan_application_requirements_to_columns.sql"
    ).read_text(encoding="utf-8")

    missing_columns = [
        column
        for column in PROFILE_COLUMN_NAMES
        if f"'{column}'" not in migration
        and f"ADD COLUMN IF NOT EXISTS {column} " not in migration
    ]

    assert missing_columns == []


def test_requirements_sql_migration_preserves_repeatable_sections() -> None:
    migration = (
        Path(__file__).resolve().parents[1]
        / "migrate_loan_application_requirements_to_columns.sql"
    ).read_text(encoding="utf-8")

    for column in (
        "build_profile_values",
        "build_profile_documents",
        "co_borrowers",
        "guarantors",
        "additional_collaterals",
        "real_estate_collaterals",
        "financial_instrument_collaterals",
        "property_declarations",
        "financial_investments",
        "dependents",
    ):
        assert f"ADD COLUMN IF NOT EXISTS {column} JSONB" in migration