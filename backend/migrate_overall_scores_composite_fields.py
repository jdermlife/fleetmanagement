"""Add composite score and final rating fields to overall_scores table."""

from __future__ import annotations

from app.database import engine
from sqlalchemy import text


def _sqlite_has_column(connection, table_name: str, column_name: str) -> bool:
    rows = connection.exec_driver_sql(f"PRAGMA table_info({table_name})")
    return any(row[1] == column_name for row in rows)


def _postgres_has_column(connection, table_name: str, column_name: str) -> bool:
    row = connection.execute(
    text(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
      AND table_name = :table_name
      AND column_name = :column_name
        LIMIT 1
        """
    ),
        {"table_name": table_name, "column_name": column_name},
    ).first()
    return row is not None


def run() -> None:
    with engine.begin() as connection:
        dialect = connection.dialect.name

        if dialect == "sqlite":
            if not _sqlite_has_column(connection, "overall_scores", "composite_score"):
                connection.exec_driver_sql(
                    "ALTER TABLE overall_scores ADD COLUMN composite_score NUMERIC(10, 2)"
                )
            if not _sqlite_has_column(connection, "overall_scores", "final_rating"):
                connection.exec_driver_sql(
                    "ALTER TABLE overall_scores ADD COLUMN final_rating VARCHAR(50)"
                )
            return

        # Postgres and compatible dialects.
        if not _postgres_has_column(connection, "overall_scores", "composite_score"):
            connection.exec_driver_sql(
                "ALTER TABLE overall_scores ADD COLUMN composite_score NUMERIC(10, 2)"
            )
        if not _postgres_has_column(connection, "overall_scores", "final_rating"):
            connection.exec_driver_sql(
                "ALTER TABLE overall_scores ADD COLUMN final_rating VARCHAR(50)"
            )


if __name__ == "__main__":
    run()
    print("overall_scores composite fields migration complete")
