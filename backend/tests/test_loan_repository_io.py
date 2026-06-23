from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from app.models.loan_application import LoanApplication
from app.services.loan_repository_io import EXPORT_FIELDS, UPSERT_FIELDS, generate_csv_bytes


def test_export_fields_match_loan_application_table_columns() -> None:
    expected_fields = [column.name for column in LoanApplication.__table__.columns]

    assert EXPORT_FIELDS == expected_fields


def test_upsert_fields_exclude_export_only_columns() -> None:
    assert "id" not in UPSERT_FIELDS
    assert "updated_at" not in UPSERT_FIELDS
    assert set(EXPORT_FIELDS) - set(UPSERT_FIELDS) == {"id", "updated_at"}


def test_generate_csv_bytes_includes_all_loan_application_columns() -> None:
    record = LoanApplication(
        application_no="APP-CSV-001",
        status="Approved",
        product_type="Auto Loan",
        borrower_name="Sample Borrower",
        email="borrower@example.com",
        phone="555-0100",
        gov_id="ID-001",
        address="123 Example Street",
        monthly_income=100000.0,
        other_income=5000.0,
        debt_obligations=12000.0,
        loan_amount=250000.0,
        term_months=36,
        interest_rate=7.5,
        purpose="Vehicle purchase",
        vehicle_info="Sedan collateral",
        appraised_value=275000.0,
        committee_remarks="Ready for release",
        executive_approval=True,
        dti=24.0,
        dsr=31.0,
        ltv=90.0,
        scorecard_total=88,
        ai_probability=82.0,
        requirements={"validGovernmentId": True},
    )
    record.id = 42
    record.created_at = datetime(2026, 6, 20, 8, 30, tzinfo=timezone.utc)
    record.updated_at = datetime(2026, 6, 21, 9, 45, tzinfo=timezone.utc)

    content = generate_csv_bytes([record]).decode("utf-8")
    parsed_rows = list(csv.DictReader(io.StringIO(content)))

    assert len(parsed_rows) == 1
    assert parsed_rows[0]["id"] == "42"
    assert parsed_rows[0]["application_no"] == "APP-CSV-001"
    assert parsed_rows[0]["updated_at"] == "2026-06-21T09:45:00+00:00"
    assert parsed_rows[0]["requirements"] == '{"validGovernmentId": true}'
