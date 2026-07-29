"""Add application-specific FILSCORE Wealth fields to overall_scores."""

from __future__ import annotations

from app.database import engine
from sqlalchemy import inspect


WEALTH_COLUMNS = {
    "wealth_building_score": "NUMERIC(10, 2)",
    "wealth_grade": "VARCHAR(10)",
    "wealth_rating": "VARCHAR(50)",
    "wealth_component_scores": "JSONB",
    "wealth_calculated_at": "TIMESTAMP WITH TIME ZONE",
    "wealth_certification_status": "VARCHAR(30)",
}


def ensure_wealth_score_columns(bind=engine) -> None:
    with bind.begin() as connection:
        if not inspect(connection).has_table("overall_scores"):
            return

        if connection.dialect.name == "postgresql":
            for column_name, column_type in WEALTH_COLUMNS.items():
                connection.exec_driver_sql(
                    f"ALTER TABLE overall_scores ADD COLUMN IF NOT EXISTS {column_name} {column_type}"
                )
            return

        existing_columns = {
            column["name"] for column in inspect(connection).get_columns("overall_scores")
        }
        for column_name, default_type in WEALTH_COLUMNS.items():
            if column_name in existing_columns:
                continue

            column_type = default_type
            if connection.dialect.name == "sqlite" and column_name in {
                "wealth_component_scores",
                "wealth_calculated_at",
            }:
                column_type = "TEXT"
            connection.exec_driver_sql(
                f"ALTER TABLE overall_scores ADD COLUMN {column_name} {column_type}"
            )


def run() -> None:
    ensure_wealth_score_columns()


if __name__ == "__main__":
    run()
    print("overall_scores wealth fields migration complete")