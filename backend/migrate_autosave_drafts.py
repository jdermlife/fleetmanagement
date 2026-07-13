"""Create the portable autosave draft table and indexes."""

from sqlalchemy import text

from app.database import engine


POSTGRESQL_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS autosave_drafts (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scope VARCHAR(128) NOT NULL,
        entity_key VARCHAR(255) NOT NULL,
        payload JSON NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_autosave_drafts_owner_scope_entity
            UNIQUE (owner_id, scope, entity_key),
        CONSTRAINT chk_autosave_drafts_revision CHECK (revision >= 1)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_autosave_drafts_owner_id ON autosave_drafts (owner_id)",
    "CREATE INDEX IF NOT EXISTS idx_autosave_drafts_expires_at ON autosave_drafts (expires_at)",
)

SQLITE_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS autosave_drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scope VARCHAR(128) NOT NULL,
        entity_key VARCHAR(255) NOT NULL,
        payload JSON NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_autosave_drafts_owner_scope_entity
            UNIQUE (owner_id, scope, entity_key),
        CONSTRAINT chk_autosave_drafts_revision CHECK (revision >= 1)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_autosave_drafts_owner_id ON autosave_drafts (owner_id)",
    "CREATE INDEX IF NOT EXISTS idx_autosave_drafts_expires_at ON autosave_drafts (expires_at)",
)


def run_migration() -> None:
    with engine.begin() as connection:
        statements = (
            POSTGRESQL_STATEMENTS
            if connection.dialect.name == "postgresql"
            else SQLITE_STATEMENTS
        )
        for statement in statements:
            connection.execute(text(statement))


if __name__ == "__main__":
    run_migration()
    print("Autosave draft migration completed successfully.")
