from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path


SCHEMA = """
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2100),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fuel_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    vehicle TEXT NOT NULL,
    fuel_card TEXT NOT NULL,
    liters REAL NOT NULL CHECK (liters >= 0),
    amount REAL NOT NULL CHECK (amount >= 0),
    notes TEXT NOT NULL DEFAULT '',
    theft_suspected INTEGER NOT NULL DEFAULT 0,
    abnormal_refill INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'viewer')),
    is_active INTEGER NOT NULL DEFAULT 1,
    mfa_secret TEXT,
    mfa_enabled INTEGER NOT NULL DEFAULT 0,
    deactivated_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mfa_backup_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code_hash TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mfa_recovery_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT,
    processed_by_user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);
"""


def get_connection(database_path: str | Path) -> sqlite3.Connection:
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db(database_path: str | Path) -> None:
    db_path = Path(database_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with closing(get_connection(db_path)) as connection:
        with connection:
            connection.executescript(SCHEMA)
            ensure_column(
                connection,
                table_name="vehicles",
                column_name="updated_at",
                definition="TEXT",
                backfill_expression="CURRENT_TIMESTAMP",
            )
            ensure_column(
                connection,
                table_name="fuel_logs",
                column_name="updated_at",
                definition="TEXT",
                backfill_expression="CURRENT_TIMESTAMP",
            )
            ensure_column(
                connection,
                table_name="users",
                column_name="is_active",
                definition="INTEGER NOT NULL DEFAULT 1",
            )
            ensure_column(
                connection,
                table_name="users",
                column_name="mfa_secret",
                definition="TEXT",
            )
            ensure_column(
                connection,
                table_name="users",
                column_name="mfa_enabled",
                definition="INTEGER NOT NULL DEFAULT 0",
            )
            ensure_column(
                connection,
                table_name="users",
                column_name="deactivated_at",
                definition="TEXT",
            )
            _migrate_legacy_vehicle_table(connection)
            _seed_vehicles(connection)


def ensure_column(
    connection: sqlite3.Connection,
    *,
    table_name: str,
    column_name: str,
    definition: str,
    backfill_expression: str | None = None,
) -> None:
    columns = {
        row["name"]
        for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    if column_name in columns:
        return

    connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")
    if backfill_expression:
        connection.execute(
            f"UPDATE {table_name} SET {column_name} = {backfill_expression} WHERE {column_name} IS NULL"
        )


def row_to_vehicle(row: sqlite3.Row) -> dict[str, int | str]:
    return {
        "id": row["id"],
        "make": row["make"],
        "model": row["model"],
        "year": row["year"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def row_to_fuel_log(row: sqlite3.Row) -> dict[str, int | float | str | bool]:
    return {
        "id": row["id"],
        "date": row["date"],
        "vehicle": row["vehicle"],
        "fuelCard": row["fuel_card"],
        "liters": row["liters"],
        "amount": row["amount"],
        "notes": row["notes"],
        "theftSuspected": bool(row["theft_suspected"]),
        "abnormalRefill": bool(row["abnormal_refill"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def row_to_user(row: sqlite3.Row) -> dict[str, int | str]:
    return {
        "id": row["id"],
        "username": row["username"],
        "role": row["role"],
        "isActive": bool(row["is_active"]),
        "mfaEnabled": bool(row["mfa_enabled"]),
        "deactivatedAt": row["deactivated_at"],
        "createdAt": row["created_at"],
    }


def row_to_audit_log(row: sqlite3.Row) -> dict[str, int | str | None]:
    return {
        "id": row["id"],
        "action": row["action"],
        "entityType": row["entity_type"],
        "entityId": row["entity_id"],
        "details": row["details"],
        "createdAt": row["created_at"],
        "actorUsername": row["actor_username"],
        "actorRole": row["actor_role"],
    }


def row_to_mfa_recovery_request(row: sqlite3.Row) -> dict[str, int | str | None]:
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "username": row["username"],
        "role": row["role"],
        "status": row["status"],
        "reason": row["reason"],
        "requestedAt": row["requested_at"],
        "processedAt": row["processed_at"],
        "processedByUsername": row["processed_by_username"],
    }


def _migrate_legacy_vehicle_table(connection: sqlite3.Connection) -> None:
    has_legacy_table = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vehicle'"
    ).fetchone()
    has_vehicle_rows = connection.execute("SELECT COUNT(*) FROM vehicles").fetchone()[0]

    if not has_legacy_table or has_vehicle_rows:
        return

    legacy_rows = connection.execute(
        "SELECT make, model, year FROM vehicle ORDER BY id ASC"
    ).fetchall()
    if not legacy_rows:
        return

    connection.executemany(
        "INSERT INTO vehicles (make, model, year) VALUES (?, ?, ?)",
        [(row["make"], row["model"], row["year"]) for row in legacy_rows],
    )


def _seed_vehicles(connection: sqlite3.Connection) -> None:
    vehicle_count = connection.execute("SELECT COUNT(*) FROM vehicles").fetchone()[0]
    if vehicle_count:
        return

    connection.executemany(
        "INSERT INTO vehicles (make, model, year) VALUES (?, ?, ?)",
        [
            ("Toyota", "Camry", 2020),
            ("Honda", "Civic", 2019),
        ],
    )
