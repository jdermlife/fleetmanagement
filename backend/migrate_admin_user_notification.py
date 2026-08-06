"""Add the new-user admin notification timestamp to users."""

from sqlalchemy import text

from app.database import engine


def run_migration() -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS admin_user_notification_sent_at TIMESTAMPTZ"
            )
        )


if __name__ == "__main__":
    run_migration()
    print("Admin user notification migration completed.")