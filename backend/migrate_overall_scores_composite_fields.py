"""Add composite score and final rating fields to overall_scores table."""

from __future__ import annotations

from app.database import engine
from sqlalchemy import inspect


COMPOSITE_SCORE_COLUMNS = {
    "composite_score": "NUMERIC(10, 2)",
    "final_rating": "VARCHAR(50)",
}


def ensure_composite_score_columns(bind=None) -> None:
    bind = bind or engine
    with bind.begin() as connection:
        if not inspect(connection).has_table("overall_scores"):
            return

        if connection.dialect.name == "postgresql":
            for column_name, column_type in COMPOSITE_SCORE_COLUMNS.items():
                connection.exec_driver_sql(
                    f"ALTER TABLE overall_scores ADD COLUMN IF NOT EXISTS {column_name} {column_type}"
                )
            return

        existing_columns = {
            column["name"] for column in inspect(connection).get_columns("overall_scores")
        }
        for column_name, column_type in COMPOSITE_SCORE_COLUMNS.items():
            if column_name not in existing_columns:
                connection.exec_driver_sql(
                    f"ALTER TABLE overall_scores ADD COLUMN {column_name} {column_type}"
                )


def run() -> None:
    ensure_composite_score_columns()


if __name__ == "__main__":
    run()
    print("overall_scores composite fields migration complete")
