"""One-time migration for notification framework tables."""

from sqlalchemy import text

from app.database import engine
from app.models.notification import (
    Notification,
    NotificationDeadLetter,
    NotificationDeliveryAttempt,
    NotificationPreference,
    NotificationTemplate,
)


def run_migration() -> None:
    with engine.begin() as connection:
        NotificationTemplate.__table__.create(bind=connection, checkfirst=True)
        NotificationPreference.__table__.create(bind=connection, checkfirst=True)
        Notification.__table__.create(bind=connection, checkfirst=True)
        NotificationDeadLetter.__table__.create(bind=connection, checkfirst=True)
        NotificationDeliveryAttempt.__table__.create(bind=connection, checkfirst=True)

        if connection.dialect.name == "postgresql":
            connection.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS attempts_count INTEGER DEFAULT 0"))
            connection.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 5"))
            connection.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ DEFAULT NOW()"))
            connection.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ"))
            connection.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT"))


if __name__ == "__main__":
    run_migration()
    print("Notification framework migration completed successfully.")
