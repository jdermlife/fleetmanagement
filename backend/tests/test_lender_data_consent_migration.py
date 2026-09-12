from __future__ import annotations

import migrate_users_enterprise_fields as migration


def test_users_migration_includes_lender_consent_audit_fields():
    required_columns = {
        "lender_data_sharing_consent_purpose",
        "lender_data_sharing_consent_version",
        "lender_data_sharing_consent_withdrawn_at",
    }

    for column in required_columns:
        assert any(
            f"ADD COLUMN IF NOT EXISTS {column}" in statement
            for statement in migration.ALTER_STATEMENTS
        )


def test_users_migration_does_not_add_provider_disconnect_fields():
    statements = migration.ALTER_STATEMENTS + migration.INDEX_STATEMENTS

    assert not any("sign_in_disconnected_at" in statement for statement in statements)
    assert not any("auth_sessions_auth_provider" in statement for statement in statements)
    assert not any("auth_provider" in statement for statement in statements)