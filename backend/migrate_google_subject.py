"""Add the stable Google account subject to users."""

from sqlalchemy import text

from app.database import engine


def run_migration() -> None:
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_subject VARCHAR(255)")
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_subject "
                "ON users (google_subject) WHERE google_subject IS NOT NULL"
            )
        )


if __name__ == "__main__":
    run_migration()
    print("Google subject migration completed.")