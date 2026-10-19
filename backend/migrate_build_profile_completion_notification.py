"""Add the one-time Build Profile completion notification timestamp."""

from sqlalchemy import text

from app.database import engine


def run_migration() -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS build_profile_90_notification_sent_at TIMESTAMPTZ"
            )
        )


if __name__ == "__main__":
    run_migration()
    print("Build Profile completion notification migration completed.")