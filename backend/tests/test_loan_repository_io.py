from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from app.models.loan_application import LoanApplication
from app.services import loan_repository_io
from app.services.loan_repository_io import EXPORT_FIELDS, UPSERT_FIELDS, generate_csv_bytes


def test_export_fields_match_loan_application_table_columns() -> None:
    expected_fields = [column.name for column in LoanApplication.__table__.columns]

    assert EXPORT_FIELDS == expected_fields


def test_upsert_fields_exclude_export_only_columns() -> None:
    assert "id" not in UPSERT_FIELDS
    assert "updated_at" not in UPSERT_FIELDS
    assert set(EXPORT_FIELDS) - set(UPSERT_FIELDS) == {
        "id",
        "created_by",
        "updated_by",
        "reviewed_by",
        "approved_by",
        "released_by",
        "deleted_by",
        "updated_at",
    }


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


class FakeDatabaseSession:
    def __init__(self) -> None:
        self.added_records: list[LoanApplication] = []
        self.commit_called = False

    def add(self, record: LoanApplication) -> None:
        self.added_records.append(record)

    def commit(self) -> None:
        self.commit_called = True

    def query(self, *_args, **_kwargs):
        raise AssertionError("Unexpected row-by-row database lookup during import")


def test_upsert_loan_applications_uses_prefetched_records(monkeypatch) -> None:
    existing_record = LoanApplication(
        application_no="APP-EXISTING-001",
        borrower_name="Existing Borrower",
    )
    existing_record.status = "Draft"

    monkeypatch.setattr(
        loan_repository_io,
        "load_existing_loan_applications",
        lambda _db, _application_numbers: {"APP-EXISTING-001": existing_record},
    )

    db = FakeDatabaseSession()
    result = loan_repository_io.upsert_loan_applications(
        db,
        [
            {
                "application_no": "APP-EXISTING-001",
                "status": "Approved",
                "borrower_name": "Updated Existing Borrower",
            },
            {
                "application_no": "APP-NEW-001",
                "status": "Submitted",
                "borrower_name": "New Borrower",
            },
        ],
    )

    assert result == {"inserted": 1, "updated": 1, "skipped": 0}
    assert db.commit_called is True
    assert len(db.added_records) == 1
    assert db.added_records[0].application_no == "APP-NEW-001"
    assert existing_record.borrower_name == "Updated Existing Borrower"


def test_upsert_loan_applications_reuses_new_record_for_duplicate_rows(monkeypatch) -> None:
    monkeypatch.setattr(
        loan_repository_io,
        "load_existing_loan_applications",
        lambda _db, _application_numbers: {},
    )

    db = FakeDatabaseSession()
    result = loan_repository_io.upsert_loan_applications(
        db,
        [
            {
                "application_no": "APP-DUPE-001",
                "status": "Draft",
                "borrower_name": "First Value",
            },
            {
                "application_no": "APP-DUPE-001",
                "status": "Approved",
                "borrower_name": "Second Value",
            },
        ],
    )

    assert result == {"inserted": 1, "updated": 1, "skipped": 0}
    assert db.commit_called is True
    assert len(db.added_records) == 1
    assert db.added_records[0].application_no == "APP-DUPE-001"
    assert db.added_records[0].borrower_name == "Second Value"
    assert db.added_records[0].status == "Approved"
