"""Add application-specific FILSCORE Wealth fields to overall_scores."""

from __future__ import annotations

from app.database import engine
from sqlalchemy import text


WEALTH_COLUMNS = {
    "wealth_building_score": "NUMERIC(10, 2)",
    "wealth_grade": "VARCHAR(10)",
    "wealth_rating": "VARCHAR(50)",
    "wealth_component_scores": "JSONB",
    "wealth_calculated_at": "TIMESTAMP WITH TIME ZONE",
    "wealth_certification_status": "VARCHAR(30)",
}


def _has_column(connection, table_name: str, column_name: str) -> bool:
    if connection.dialect.name == "sqlite":
        rows = connection.exec_driver_sql(f"PRAGMA table_info({table_name})")
        return any(row[1] == column_name for row in rows)

    return connection.execute(
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
    ).first() is not None


def run() -> None:
    with engine.begin() as connection:
        for column_name, postgres_type in WEALTH_COLUMNS.items():
            if _has_column(connection, "overall_scores", column_name):
                continue

            column_type = postgres_type
            if connection.dialect.name == "sqlite":
                column_type = "TEXT" if column_name in {
                    "wealth_component_scores",
                    "wealth_calculated_at",
                } else postgres_type
            connection.exec_driver_sql(
                f"ALTER TABLE overall_scores ADD COLUMN {column_name} {column_type}"
            )


if __name__ == "__main__":
    run()
    print("overall_scores wealth fields migration complete")