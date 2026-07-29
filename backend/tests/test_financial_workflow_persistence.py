from datetime import date
from types import SimpleNamespace

from app.routes import loan_routes
from app.schemas.loan_schema import (
    BillReminderRecordPayload,
    BillReminderRecordsPayload,
    BudgetRecordPayload,
    BudgetRecordsPayload,
    MonitoringRecordPayload,
    NetWorthRecordPayload,
)


class FakeSession:
    def __init__(self):
        self.executions = []
        self.commits = 0

    def execute(self, statement, params):
        self.executions.append((str(statement), params))

    def commit(self):
        self.commits += 1

    def rollback(self):
        raise AssertionError("Workflow persistence should not roll back")

    def close(self):
        pass


def configure_route(monkeypatch):
    record = SimpleNamespace(id=17, application_no="APP-WORKFLOW-1", updated_by=None)
    session = FakeSession()
    monkeypatch.setattr(loan_routes, "SessionLocal", lambda: session)
    monkeypatch.setattr(
        loan_routes,
        "get_loan_application_or_404",
        lambda _db, application_no: record if application_no == record.application_no else None,
    )
    monkeypatch.setattr(loan_routes, "enforce_loan_application_access", lambda *_args: None)
    return record, session, SimpleNamespace(id=42, role="Subscriber")


def test_net_worth_is_saved_for_internal_loan_id(monkeypatch):
    record, session, user = configure_route(monkeypatch)
    payload = NetWorthRecordPayload(
        snapshot_date=date(2026, 7, 29),
        total_assets=1_500_000,
        total_liabilities=400_000,
        net_worth=1_100_000,
        monthly_income=90_000,
        monthly_expenses=45_000,
        savings_rate=50,
    )

    result = loan_routes.save_net_worth_record(record.application_no, payload, user)

    assert "loan_application_networth" in session.executions[1][0]
    assert session.executions[1][1]["loan_application_id"] == 17
    assert session.executions[1][1]["net_worth"] == 1_100_000
    assert session.commits == 1
    assert record.updated_by == 42
    assert result["application_no"] == record.application_no


def test_budget_collection_replaces_application_rows(monkeypatch):
    record, session, user = configure_route(monkeypatch)
    payload = BudgetRecordsPayload(records=[
        BudgetRecordPayload(
            budget_month=date(2026, 7, 1),
            category="Income from Salary",
            budget_amount=75_000,
            actual_amount=80_000,
            variance=5_000,
        ),
    ])

    result = loan_routes.save_budget_records(record.application_no, payload, user)

    assert "DELETE FROM loan_application_budget" in session.executions[0][0]
    assert "INSERT INTO loan_application_budget" in session.executions[1][0]
    assert session.executions[1][1]["loan_application_id"] == 17
    assert result["saved"] == 1


def test_monitoring_snapshot_is_saved_for_selected_application(monkeypatch):
    record, session, user = configure_route(monkeypatch)
    payload = MonitoringRecordPayload(
        monitoring_date=date(2026, 7, 29),
        outstanding_balance=250_000,
        principal_paid=25_000,
        interest_paid=8_000,
        monthly_payment=12_000,
        days_past_due=0,
        loan_status="Released",
        dsr=31.5,
        ltv=65,
        risk_level="Healthy",
    )

    loan_routes.save_monitoring_record(record.application_no, payload, user)

    assert "loan_application_monitoring" in session.executions[1][0]
    assert session.executions[1][1]["loan_application_id"] == 17
    assert session.executions[1][1]["outstanding_balance"] == 250_000


def test_bill_reminders_replace_application_collection(monkeypatch):
    record, session, user = configure_route(monkeypatch)
    payload = BillReminderRecordsPayload(records=[
        BillReminderRecordPayload(
            bill_type="Electricity",
            biller_name="Meralco",
            amount_due=5_000,
            due_date=date(2026, 7, 31),
            payment_date=None,
            payment_status="PENDING",
            reminder_sent=False,
        ),
    ])

    result = loan_routes.save_bill_reminder_records(record.application_no, payload, user)

    assert "DELETE FROM loan_application_bill_reminders" in session.executions[0][0]
    assert "INSERT INTO loan_application_bill_reminders" in session.executions[1][0]
    assert session.executions[1][1]["loan_application_id"] == 17
    assert result["saved"] == 1