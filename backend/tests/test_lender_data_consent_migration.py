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


def test_users_migration_includes_provider_disconnect_fields():
    required_columns = {
        "apple_sign_in_disconnected_at",
        "google_sign_in_disconnected_at",
    }

    for column in required_columns:
        assert any(
            f"ADD COLUMN IF NOT EXISTS {column}" in statement
            for statement in migration.ALTER_STATEMENTS
        )
    assert any(
        "ix_auth_sessions_auth_provider" in statement
        for statement in migration.INDEX_STATEMENTS
    )
    assert any(
        "ADD COLUMN IF NOT EXISTS auth_provider" in statement
        for statement in migration.AUTH_SESSION_ALTER_STATEMENTS
    )