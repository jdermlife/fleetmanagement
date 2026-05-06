from __future__ import annotations

import sqlite3
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    psycopg = None
    dict_row = None


SQLITE_SCHEMA = """
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

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lease_scorecards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    company_name TEXT NOT NULL DEFAULT '',
    vehicle_type TEXT NOT NULL,
    vehicle_value REAL NOT NULL,
    down_payment REAL NOT NULL,
    requested_amount REAL NOT NULL,
    monthly_income REAL NOT NULL,
    existing_debt REAL NOT NULL,
    lease_term_months INTEGER NOT NULL,
    credit_score INTEGER NOT NULL,
    years_in_business REAL NOT NULL DEFAULT 0,
    employment_years REAL NOT NULL DEFAULT 0,
    monthly_estimated_payment REAL NOT NULL,
    debt_service_ratio REAL NOT NULL,
    loan_to_value REAL NOT NULL,
    credit_component REAL NOT NULL,
    affordability_component REAL NOT NULL,
    equity_component REAL NOT NULL,
    stability_component REAL NOT NULL,
    asset_component REAL NOT NULL,
    final_score REAL NOT NULL,
    risk_grade TEXT NOT NULL,
    decision TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS driver_management_scorecards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    driver_name TEXT NOT NULL,
    license_class TEXT NOT NULL,
    years_driving REAL NOT NULL,
    employment_years REAL NOT NULL,
    incidents_last_3_years INTEGER NOT NULL,
    violations_last_3_years INTEGER NOT NULL,
    training_hours REAL NOT NULL,
    on_time_rate REAL NOT NULL,
    customer_rating REAL NOT NULL,
    fatigue_events INTEGER NOT NULL,
    safety_component REAL NOT NULL,
    compliance_component REAL NOT NULL,
    experience_component REAL NOT NULL,
    service_component REAL NOT NULL,
    stability_component REAL NOT NULL,
    final_score REAL NOT NULL,
    risk_grade TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    license_number TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER,
    vehicle_label TEXT NOT NULL,
    maintenance_type TEXT NOT NULL,
    service_date TEXT NOT NULL,
    next_service_date TEXT,
    odometer_km REAL NOT NULL,
    vendor TEXT NOT NULL DEFAULT '',
    estimated_cost REAL NOT NULL,
    status TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insurance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER,
    vehicle_label TEXT NOT NULL,
    provider TEXT NOT NULL,
    policy_number TEXT NOT NULL,
    coverage_type TEXT NOT NULL,
    premium_amount REAL NOT NULL,
    insured_value REAL NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL,
    contact_person TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gps_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER,
    vehicle_label TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    speed_kph REAL NOT NULL DEFAULT 0,
    heading TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'unknown',
    route_label TEXT NOT NULL DEFAULT '',
    geofence TEXT NOT NULL DEFAULT '',
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""

POSTGRES_SCHEMA = """
CREATE SCHEMA IF NOT EXISTS neondb;
SET search_path TO neondb;

CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fuel_logs (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    date DATE NOT NULL,
    vehicle TEXT NOT NULL,
    fuel_card TEXT NOT NULL,
    liters DOUBLE PRECISION NOT NULL CHECK (liters >= 0),
    amount DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
    notes TEXT NOT NULL DEFAULT '',
    theft_suspected BOOLEAN NOT NULL DEFAULT FALSE,
    abnormal_refill BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    actor_user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lease_scorecards (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    customer_name TEXT NOT NULL,
    company_name TEXT NOT NULL DEFAULT '',
    vehicle_type TEXT NOT NULL,
    vehicle_value DOUBLE PRECISION NOT NULL,
    down_payment DOUBLE PRECISION NOT NULL,
    requested_amount DOUBLE PRECISION NOT NULL,
    monthly_income DOUBLE PRECISION NOT NULL,
    existing_debt DOUBLE PRECISION NOT NULL,
    lease_term_months INTEGER NOT NULL,
    credit_score INTEGER NOT NULL,
    years_in_business DOUBLE PRECISION NOT NULL DEFAULT 0,
    employment_years DOUBLE PRECISION NOT NULL DEFAULT 0,
    monthly_estimated_payment DOUBLE PRECISION NOT NULL,
    debt_service_ratio DOUBLE PRECISION NOT NULL,
    loan_to_value DOUBLE PRECISION NOT NULL,
    credit_component DOUBLE PRECISION NOT NULL,
    affordability_component DOUBLE PRECISION NOT NULL,
    equity_component DOUBLE PRECISION NOT NULL,
    stability_component DOUBLE PRECISION NOT NULL,
    asset_component DOUBLE PRECISION NOT NULL,
    final_score DOUBLE PRECISION NOT NULL,
    risk_grade TEXT NOT NULL,
    decision TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS driver_management_scorecards (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    driver_name TEXT NOT NULL,
    license_class TEXT NOT NULL,
    years_driving DOUBLE PRECISION NOT NULL,
    employment_years DOUBLE PRECISION NOT NULL,
    incidents_last_3_years INTEGER NOT NULL,
    violations_last_3_years INTEGER NOT NULL,
    training_hours DOUBLE PRECISION NOT NULL,
    on_time_rate DOUBLE PRECISION NOT NULL,
    customer_rating DOUBLE PRECISION NOT NULL,
    fatigue_events INTEGER NOT NULL,
    safety_component DOUBLE PRECISION NOT NULL,
    compliance_component DOUBLE PRECISION NOT NULL,
    experience_component DOUBLE PRECISION NOT NULL,
    service_component DOUBLE PRECISION NOT NULL,
    stability_component DOUBLE PRECISION NOT NULL,
    final_score DOUBLE PRECISION NOT NULL,
    risk_grade TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    license_number TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_records (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    vehicle_id INTEGER,
    vehicle_label TEXT NOT NULL,
    maintenance_type TEXT NOT NULL,
    service_date DATE NOT NULL,
    next_service_date DATE,
    odometer_km DOUBLE PRECISION NOT NULL,
    vendor TEXT NOT NULL DEFAULT '',
    estimated_cost DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insurance_records (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    vehicle_id INTEGER,
    vehicle_label TEXT NOT NULL,
    provider TEXT NOT NULL,
    policy_number TEXT NOT NULL,
    coverage_type TEXT NOT NULL,
    premium_amount DOUBLE PRECISION NOT NULL,
    insured_value DOUBLE PRECISION NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL,
    contact_person TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gps_tracking (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    vehicle_id INTEGER,
    vehicle_label TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed_kph DOUBLE PRECISION NOT NULL DEFAULT 0,
    heading TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'unknown',
    route_label TEXT NOT NULL DEFAULT '',
    geofence TEXT NOT NULL DEFAULT '',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


@dataclass(frozen=True)
class DatabaseConfig:
    engine: str
    path: str | None = None
    url: str | None = None
    host: str | None = None
    port: int | None = None
    name: str | None = None


class DatabaseConnection:
    def __init__(self, raw_connection: Any, engine: str) -> None:
        self.raw_connection = raw_connection
        self.engine = engine

    def __enter__(self):
        self.raw_connection.__enter__()
        return self

    def __exit__(self, exc_type, exc, tb):
        return self.raw_connection.__exit__(exc_type, exc, tb)

    def close(self) -> None:
        self.raw_connection.close()

    def execute(self, query: str, params: tuple[Any, ...] | list[Any] | None = None):
        return self.raw_connection.execute(_normalize_query(query, self.engine), params or ())

    def executemany(self, query: str, params_seq):
        if self.engine == "postgresql":
            with self.raw_connection.cursor() as cursor:
                return cursor.executemany(_normalize_query(query, self.engine), params_seq)
        return self.raw_connection.executemany(_normalize_query(query, self.engine), params_seq)

    def executescript(self, script: str) -> None:
        if self.engine == "sqlite":
            self.raw_connection.executescript(script)
            return

        for statement in [segment.strip() for segment in script.split(";") if segment.strip()]:
            self.raw_connection.execute(statement)


def resolve_database_config(database_url: str | None, database_path: str | Path | None) -> DatabaseConfig:
    if database_url:
        parsed = urlparse(database_url)
        if not parsed.scheme.startswith("postgres"):
            raise ValueError("DATABASE_URL must use a PostgreSQL scheme such as postgresql:// (Neon compatible)")

        return DatabaseConfig(
            engine="postgresql",
            url=database_url,
            host=parsed.hostname,
            port=parsed.port,
            name=(parsed.path or "").lstrip("/") or "fleet_mgmt_db",
        )

    if database_path is None:
        raise ValueError("A SQLite database path is required when DATABASE_URL is not set.")

    return DatabaseConfig(
        engine="sqlite", 
        path=str(database_path), 
        name="fleet_mgmt_db",
    )


def get_connection(config: DatabaseConfig) -> DatabaseConnection:
    if config.engine == "postgresql":
        if psycopg is None or dict_row is None:
            raise RuntimeError(
                "PostgreSQL support requires psycopg. Install the backend requirements to use DATABASE_URL."
            )

        raw_connection = psycopg.connect(config.url, row_factory=dict_row, autocommit=False)
        return DatabaseConnection(raw_connection, config.engine)

    sqlite_connection = sqlite3.connect(config.path)
    sqlite_connection.row_factory = sqlite3.Row
    sqlite_connection.execute("PRAGMA foreign_keys = ON")
    return DatabaseConnection(sqlite_connection, config.engine)


def init_db(config: DatabaseConfig) -> None:
    if config.engine == "sqlite":
        db_path = Path(config.path)
        db_path.parent.mkdir(parents=True, exist_ok=True)

    with closing(get_connection(config)) as connection:
        with connection:
            connection.executescript(SQLITE_SCHEMA if config.engine == "sqlite" else POSTGRES_SCHEMA)
            if config.engine == "sqlite":
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
                _migrate_legacy_vehicle_table(connection)

            _seed_vehicles(connection)


def ensure_column(
    connection: DatabaseConnection,
    *,
    table_name: str,
    column_name: str,
    definition: str,
    backfill_expression: str | None = None,
) -> None:
    if connection.engine != "sqlite":
        return

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


def get_database_status(config: DatabaseConfig) -> dict[str, Any]:
    return {
        "engine": config.engine,
        "connected": True,
        "database": config.name,
        "host": config.host,
        "port": config.port,
        "source": _format_database_source(config),
    }


def row_to_vehicle(row) -> dict[str, int | str]:
    return {
        "id": row["id"],
        "make": row["make"],
        "model": row["model"],
        "year": row["year"],
        "createdAt": _serialize_timestamp(row["created_at"]),
        "updatedAt": _serialize_timestamp(row["updated_at"]),
    }


def row_to_fuel_log(row) -> dict[str, int | float | str | bool]:
    return {
        "id": row["id"],
        "date": _serialize_date(row["date"]),
        "vehicle": row["vehicle"],
        "fuelCard": row["fuel_card"],
        "liters": row["liters"],
        "amount": row["amount"],
        "notes": row["notes"],
        "theftSuspected": bool(row["theft_suspected"]),
        "abnormalRefill": bool(row["abnormal_refill"]),
        "createdAt": _serialize_timestamp(row["created_at"]),
        "updatedAt": _serialize_timestamp(row["updated_at"]),
    }


def row_to_audit_log(row) -> dict[str, int | str | None]:
    return {
        "id": row["id"],
        "action": row["action"],
        "entityType": row["entity_type"],
        "entityId": row["entity_id"],
        "details": row["details"],
        "createdAt": _serialize_timestamp(row["created_at"]),
        "actorUsername": row["actor_username"],
        "actorRole": row["actor_role"],
    }


def row_to_lease_scorecard(row) -> dict[str, int | float | str]:
    return {
        "id": row["id"],
        "customerName": row["customer_name"],
        "companyName": row["company_name"],
        "vehicleType": row["vehicle_type"],
        "vehicleValue": row["vehicle_value"],
        "downPayment": row["down_payment"],
        "requestedAmount": row["requested_amount"],
        "monthlyIncome": row["monthly_income"],
        "existingDebt": row["existing_debt"],
        "leaseTermMonths": row["lease_term_months"],
        "creditScore": row["credit_score"],
        "yearsInBusiness": row["years_in_business"],
        "employmentYears": row["employment_years"],
        "monthlyEstimatedPayment": row["monthly_estimated_payment"],
        "debtServiceRatio": row["debt_service_ratio"],
        "loanToValue": row["loan_to_value"],
        "creditComponent": row["credit_component"],
        "affordabilityComponent": row["affordability_component"],
        "equityComponent": row["equity_component"],
        "stabilityComponent": row["stability_component"],
        "assetComponent": row["asset_component"],
        "finalScore": row["final_score"],
        "riskGrade": row["risk_grade"],
        "decision": row["decision"],
        "summary": row["summary"],
        "createdAt": _serialize_timestamp(row["created_at"]),
    }


def row_to_driver_management_scorecard(row) -> dict[str, int | float | str]:
    return {
        "id": row["id"],
        "driverName": row["driver_name"],
        "licenseClass": row["license_class"],
        "yearsDriving": row["years_driving"],
        "employmentYears": row["employment_years"],
        "incidentsLast3Years": row["incidents_last_3_years"],
        "violationsLast3Years": row["violations_last_3_years"],
        "trainingHours": row["training_hours"],
        "onTimeRate": row["on_time_rate"],
        "customerRating": row["customer_rating"],
        "fatigueEvents": row["fatigue_events"],
        "safetyComponent": row["safety_component"],
        "complianceComponent": row["compliance_component"],
        "experienceComponent": row["experience_component"],
        "serviceComponent": row["service_component"],
        "stabilityComponent": row["stability_component"],
        "finalScore": row["final_score"],
        "riskGrade": row["risk_grade"],
        "recommendation": row["recommendation"],
        "summary": row["summary"],
        "createdAt": _serialize_timestamp(row["created_at"]),
    }


def row_to_driver(row) -> dict[str, int | str]:
    return {
        "id": row["id"],
        "firstName": row["first_name"],
        "lastName": row["last_name"],
        "licenseNumber": row["license_number"],
        "phone": row["phone"],
        "email": row["email"],
        "status": row["status"],
        "createdAt": _serialize_timestamp(row["created_at"]),
    }


def row_to_maintenance_record(row) -> dict[str, int | float | str | None]:
    return {
        "id": row["id"],
        "vehicleId": row["vehicle_id"],
        "vehicleLabel": row["vehicle_label"],
        "maintenanceType": row["maintenance_type"],
        "serviceDate": _serialize_date(row["service_date"]),
        "nextServiceDate": _serialize_date(row["next_service_date"]) if row["next_service_date"] is not None else None,
        "odometerKm": row["odometer_km"],
        "vendor": row["vendor"],
        "estimatedCost": row["estimated_cost"],
        "status": row["status"],
        "notes": row["notes"],
        "createdAt": _serialize_timestamp(row["created_at"]),
    }


def row_to_insurance_record(row) -> dict[str, int | float | str | None]:
    return {
        "id": row["id"],
        "vehicleId": row["vehicle_id"],
        "vehicleLabel": row["vehicle_label"],
        "provider": row["provider"],
        "policyNumber": row["policy_number"],
        "coverageType": row["coverage_type"],
        "premiumAmount": row["premium_amount"],
        "insuredValue": row["insured_value"],
        "startDate": _serialize_date(row["start_date"]),
        "endDate": _serialize_date(row["end_date"]),
        "status": row["status"],
        "contactPerson": row["contact_person"],
        "notes": row["notes"],
        "createdAt": _serialize_timestamp(row["created_at"]),
    }


def row_to_gps_tracking(row) -> dict[str, int | float | str]:
    return {
        "id": row["id"],
        "vehicleId": row["vehicle_id"],
        "vehicleLabel": row["vehicle_label"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "speedKph": row["speed_kph"],
        "heading": row["heading"],
        "status": row["status"],
        "routeLabel": row["route_label"],
        "geofence": row["geofence"],
        "recordedAt": _serialize_timestamp(row["recorded_at"]),
        "createdAt": _serialize_timestamp(row["created_at"]),
    }


def _normalize_query(query: str, engine: str) -> str:
    if engine == "postgresql":
        return query.replace("?", "%s")
    return query


def _format_database_source(config: DatabaseConfig) -> str:
    if config.engine == "postgresql":
        host = config.host or "localhost"
        port = config.port or 5432
        name = config.name or "fleet_mgmt_db"
        return f"postgresql://{host}:{port}/{name}"

    return config.path or ""


def _migrate_legacy_vehicle_table(connection: DatabaseConnection) -> None:
    has_legacy_table = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vehicle'"
    ).fetchone()
    has_vehicle_rows = connection.execute("SELECT COUNT(*) AS count FROM vehicles").fetchone()["count"]

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


def _seed_vehicles(connection: DatabaseConnection) -> None:
    vehicle_count = connection.execute("SELECT COUNT(*) AS count FROM vehicles").fetchone()["count"]
    if vehicle_count:
        return

    connection.executemany(
        "INSERT INTO vehicles (make, model, year) VALUES (?, ?, ?)",
        [
            ("Toyota", "Camry", 2020),
            ("Honda", "Civic", 2019),
        ],
    )


def _serialize_timestamp(value: Any) -> str:
    if isinstance(value, datetime):
        normalized = value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return normalized.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return str(value)


def _serialize_date(value: Any) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
