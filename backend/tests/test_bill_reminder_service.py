from datetime import date

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.notification import (
    Notification,
    NotificationDeadLetter,
    NotificationDeliveryAttempt,
)
from app.services import notification_service
from app.services.bill_reminder_service import queue_due_bill_reminders


def test_due_reminder_uses_application_email_and_marks_successful_delivery(monkeypatch) -> None:
    engine = create_engine("sqlite:///:memory:")
    Notification.__table__.create(engine)
    NotificationDeadLetter.__table__.create(engine)
    NotificationDeliveryAttempt.__table__.create(engine)

    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE loan_applications ("
            "id INTEGER PRIMARY KEY, application_no TEXT, email TEXT, "
            "created_by_user_id INTEGER, created_by INTEGER)"
        ))
        connection.execute(text(
            "CREATE TABLE loan_application_bill_reminders ("
            "id INTEGER PRIMARY KEY, loan_application_id INTEGER, biller_name TEXT, "
            "bill_type TEXT, amount_due NUMERIC, due_date DATE, payment_status TEXT, "
            "reminder_enabled BOOLEAN, reminder_days_before INTEGER, reminder_sent BOOLEAN, "
            "updated_at DATETIME)"
        ))
        connection.execute(
            text(
                "INSERT INTO loan_applications "
                "(id, application_no, email, created_by_user_id) "
                "VALUES (1, 'APP-001', 'borrower@example.com', 7)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO loan_application_bill_reminders "
                "(id, loan_application_id, biller_name, bill_type, amount_due, due_date, "
                "payment_status, reminder_enabled, reminder_days_before, reminder_sent) "
                "VALUES (11, 1, 'Electric Company', 'Electricity', 2500, '2026-10-01', "
                "'PENDING', TRUE, 10, FALSE)"
            )
        )

    session = sessionmaker(bind=engine)()
    deliveries: list[tuple[str, str, str]] = []
    monkeypatch.setattr(
        notification_service,
        "send_email",
        lambda recipient, subject, body: deliveries.append((recipient, subject, body)),
    )

    assert queue_due_bill_reminders(session, today=date(2026, 9, 21)) == 1
    queued = session.query(Notification).one()
    assert queued.destination == "borrower@example.com"
    assert queued.source_record_id == "11"
    assert queue_due_bill_reminders(session, today=date(2026, 9, 21)) == 0

    result = notification_service.dispatch_queued_notifications(session)

    assert result == {"processed": 1, "sent": 1, "failed": 0}
    assert deliveries[0][0] == "borrower@example.com"
    reminder_sent = session.execute(
        text("SELECT reminder_sent FROM loan_application_bill_reminders WHERE id = 11")
    ).scalar_one()
    assert bool(reminder_sent) is True

    session.close()