from __future__ import annotations

import migrate_users_enterprise_fields as migration


def test_users_migration_includes_google_subject_column_and_unique_index():
    assert any("ADD COLUMN IF NOT EXISTS google_subject" in statement for statement in migration.ALTER_STATEMENTS)
    assert any(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_subject" in statement
        for statement in migration.INDEX_STATEMENTS
    )