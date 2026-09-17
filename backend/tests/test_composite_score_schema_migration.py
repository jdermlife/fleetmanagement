from sqlalchemy import create_engine, inspect

import migrate_overall_scores_composite_fields as migration


def test_composite_score_migration_is_safe_before_table_exists():
    test_engine = create_engine("sqlite://")

    migration.ensure_composite_score_columns(test_engine)

    assert inspect(test_engine).has_table("overall_scores") is False


def test_composite_score_migration_repairs_legacy_table_idempotently(monkeypatch):
    test_engine = create_engine("sqlite://")
    with test_engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE overall_scores (id INTEGER PRIMARY KEY, final_score NUMERIC(10, 2))"
        )

    monkeypatch.setattr(migration, "engine", test_engine)

    migration.run()
    migration.run()

    columns = {
        column["name"] for column in inspect(test_engine).get_columns("overall_scores")
    }
    assert {"composite_score", "final_rating"}.issubset(columns)
