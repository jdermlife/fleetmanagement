from sqlalchemy import create_engine, inspect

from migrate_overall_scores_wealth_fields import (
    WEALTH_COLUMNS,
    ensure_wealth_score_columns,
)


def test_wealth_schema_preflight_is_safe_before_overall_scores_exists():
    test_engine = create_engine("sqlite://")

    ensure_wealth_score_columns(test_engine)

    assert inspect(test_engine).has_table("overall_scores") is False


def test_wealth_schema_preflight_repairs_legacy_table_idempotently():
    test_engine = create_engine("sqlite://")
    with test_engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE overall_scores (id INTEGER PRIMARY KEY, final_score NUMERIC(10, 2))"
        )

    ensure_wealth_score_columns(test_engine)
    ensure_wealth_score_columns(test_engine)

    columns = [
        column["name"] for column in inspect(test_engine).get_columns("overall_scores")
    ]
    assert set(WEALTH_COLUMNS).issubset(columns)
    assert len(columns) == 2 + len(WEALTH_COLUMNS)