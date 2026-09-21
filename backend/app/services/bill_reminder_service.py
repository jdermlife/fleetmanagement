from datetime import date, datetime

from sqlalchemy import text

from app.models.notification import NotificationChannel, NotificationPriority
from app.services.notification_service import queue_notification


def _as_date(value: object) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


def queue_due_bill_reminders(db, today: date | None = None) -> int:
    current_date = today or date.today()
    rows = db.execute(
        text(
            "SELECT br.id, br.biller_name, br.bill_type, br.amount_due, br.due_date, "
            "br.reminder_days_before, la.application_no, la.email, "
            "COALESCE(la.created_by_user_id, la.created_by) AS user_id "
            "FROM loan_application_bill_reminders br "
            "JOIN loan_applications la ON la.id = br.loan_application_id "
            "WHERE br.reminder_enabled = TRUE AND br.reminder_sent = FALSE "
            "AND UPPER(br.payment_status) NOT IN ('PAID', 'CANCELLED') "
            "AND br.due_date IS NOT NULL AND la.email IS NOT NULL"
        )
    ).mappings().all()

    queued = 0
    for row in rows:
        due_date = _as_date(row["due_date"])
        recipient = str(row["email"] or "").strip()
        user_id = row["user_id"]
        reminder_days_before = max(1, int(row["reminder_days_before"] or 10))
        if not due_date or not recipient or user_id is None:
            continue

        days_until_due = (due_date - current_date).days
        if days_until_due < 0 or days_until_due > reminder_days_before:
            continue

        source_record_id = str(row["id"])
        existing = db.execute(
            text(
                "SELECT 1 FROM notifications WHERE event_type = :event_type "
                "AND source_table = :source_table AND source_record_id = :source_record_id LIMIT 1"
            ),
            {
                "event_type": "bill_due_reminder",
                "source_table": "loan_application_bill_reminders",
                "source_record_id": source_record_id,
            },
        ).first()
        if existing:
            continue

        biller_name = str(row["biller_name"] or row["bill_type"] or "your bill")
        title = f"FILSCORE bill reminder: {biller_name}"
        message = (
            f"Your {biller_name} bill for {row['amount_due']} is due on {due_date.isoformat()}. "
            f"This reminder was enabled for application {row['application_no']}."
        )
        queue_notification(
            db,
            user_id=int(user_id),
            event_type="bill_due_reminder",
            channel=NotificationChannel.EMAIL,
            title=title,
            message=message,
            priority=NotificationPriority.HIGH,
            payload={
                "bill_reminder_id": row["id"],
                "application_no": row["application_no"],
                "due_date": due_date.isoformat(),
            },
            destination=recipient,
            source_table="loan_application_bill_reminders",
            source_record_id=source_record_id,
            created_by="bill-reminder-scheduler",
        )
        queued += 1

    if queued:
        db.commit()
    return queued