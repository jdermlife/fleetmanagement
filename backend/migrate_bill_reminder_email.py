"""Add email scheduling fields to persisted bill reminders."""

from sqlalchemy import inspect, text

from app.database import engine


def run_migration() -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        if "loan_application_bill_reminders" not in inspector.get_table_names():
            return

        columns = {
            column["name"]
            for column in inspector.get_columns("loan_application_bill_reminders")
        }
        if "reminder_enabled" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE loan_application_bill_reminders "
                    "ADD COLUMN reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
        if "reminder_days_before" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE loan_application_bill_reminders "
                    "ADD COLUMN reminder_days_before INTEGER NOT NULL DEFAULT 10"
                )
            )


if __name__ == "__main__":
    run_migration()
    print("Bill reminder email migration completed.")