from __future__ import annotations

from contextlib import closing
from datetime import datetime, timezone
import os
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    from .models import (
        get_connection,
        get_database_status,
        init_db,
        resolve_database_config,
        row_to_audit_log,
        row_to_fuel_log,
        row_to_vehicle,
    )
except ImportError:
    from models import (
        get_connection,
        get_database_status,
        init_db,
        resolve_database_config,
        row_to_audit_log,
        row_to_fuel_log,
        row_to_vehicle,
    )


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATABASE_PATH = BASE_DIR / "fms.db"


def create_app(test_config: dict[str, object] | None = None) -> Flask:
    app = Flask(__name__)
    CORS(app)
    app.config.from_mapping(
        DATABASE_PATH=str(DEFAULT_DATABASE_PATH),
        DATABASE_URL=os.getenv("DATABASE_URL", "").strip() or None,
    )

    if test_config:
        app.config.update(test_config)

    database_config = resolve_database_config(
        database_url=app.config.get("DATABASE_URL"),
        database_path=app.config.get("DATABASE_PATH"),
    )
    app.config["DATABASE_CONFIG"] = database_config
    init_db(database_config)

    @app.get("/health")
    def health_check():
        return jsonify({"status": "ok"})

    @app.get("/database/status")
    def database_status():
        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            connection.execute("SELECT 1")

        return jsonify(get_database_status(app.config["DATABASE_CONFIG"]))

    @app.get("/audit-logs")
    def list_audit_logs():
        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            audit_logs = connection.execute(
                """
                SELECT audit_logs.id, audit_logs.action, audit_logs.entity_type, audit_logs.entity_id,
                       audit_logs.details, audit_logs.created_at,
                       NULL AS actor_username, NULL AS actor_role
                FROM audit_logs
                ORDER BY audit_logs.id DESC
                LIMIT 50
                """
            ).fetchall()
        return jsonify([row_to_audit_log(log) for log in audit_logs])

    @app.get("/vehicles")
    def get_vehicles():
        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            vehicles = connection.execute(
                """
                SELECT id, make, model, year, created_at, updated_at
                FROM vehicles
                ORDER BY year DESC, make ASC, model ASC
                """
            ).fetchall()
        return jsonify([row_to_vehicle(vehicle) for vehicle in vehicles])

    @app.post("/vehicles")
    def create_vehicle():
        data = _get_json_payload()
        vehicle_data, error = _parse_vehicle_payload(data)
        if error:
            return jsonify({"error": error}), 400

        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            with connection:
                vehicle = connection.execute(
                    """
                    INSERT INTO vehicles (make, model, year, updated_at)
                    VALUES (?, ?, ?, ?)
                    RETURNING id, make, model, year, created_at, updated_at
                    """,
                    (
                        vehicle_data["make"],
                        vehicle_data["model"],
                        vehicle_data["year"],
                        _utcnow_iso(),
                    ),
                ).fetchone()
                _log_audit_event(
                    connection,
                    action="vehicle.create",
                    entity_type="vehicle",
                    entity_id=vehicle["id"],
                    details=f"Created vehicle {vehicle['make']} {vehicle['model']} ({vehicle['year']}).",
                )

        return jsonify(row_to_vehicle(vehicle)), 201

    @app.put("/vehicles/<int:vehicle_id>")
    def update_vehicle(vehicle_id: int):
        data = _get_json_payload()
        vehicle_data, error = _parse_vehicle_payload(data)
        if error:
            return jsonify({"error": error}), 400

        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            existing_vehicle = connection.execute(
                "SELECT id FROM vehicles WHERE id = ?",
                (vehicle_id,),
            ).fetchone()
            if not existing_vehicle:
                return jsonify({"error": "Vehicle not found."}), 404

            with connection:
                connection.execute(
                    """
                    UPDATE vehicles
                    SET make = ?, model = ?, year = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        vehicle_data["make"],
                        vehicle_data["model"],
                        vehicle_data["year"],
                        _utcnow_iso(),
                        vehicle_id,
                    ),
                )
                vehicle = connection.execute(
                    """
                    SELECT id, make, model, year, created_at, updated_at
                    FROM vehicles
                    WHERE id = ?
                    """,
                    (vehicle_id,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    action="vehicle.update",
                    entity_type="vehicle",
                    entity_id=vehicle_id,
                    details=f"Updated vehicle {vehicle['make']} {vehicle['model']} ({vehicle['year']}).",
                )

        return jsonify(row_to_vehicle(vehicle))

    @app.delete("/vehicles/<int:vehicle_id>")
    def delete_vehicle(vehicle_id: int):
        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            vehicle = connection.execute(
                """
                SELECT id, make, model, year, created_at, updated_at
                FROM vehicles
                WHERE id = ?
                """,
                (vehicle_id,),
            ).fetchone()
            if not vehicle:
                return jsonify({"error": "Vehicle not found."}), 404

            with connection:
                connection.execute("DELETE FROM vehicles WHERE id = ?", (vehicle_id,))
                _log_audit_event(
                    connection,
                    action="vehicle.delete",
                    entity_type="vehicle",
                    entity_id=vehicle_id,
                    details=f"Deleted vehicle {vehicle['make']} {vehicle['model']} ({vehicle['year']}).",
                )

        return jsonify({"status": "deleted"})

    @app.get("/fuel-logs")
    def get_fuel_logs():
        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            logs = connection.execute(
                """
                SELECT id, date, vehicle, fuel_card, liters, amount, notes,
                       theft_suspected, abnormal_refill, created_at, updated_at
                FROM fuel_logs
                ORDER BY date DESC, id DESC
                """
            ).fetchall()
        return jsonify([row_to_fuel_log(log) for log in logs])

    @app.post("/fuel-logs")
    def create_fuel_log():
        data = _get_json_payload()
        fuel_log_data, error = _parse_fuel_log_payload(data)
        if error:
            return jsonify({"error": error}), 400

        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            with connection:
                fuel_log = connection.execute(
                    """
                    INSERT INTO fuel_logs (
                        date, vehicle, fuel_card, liters, amount, notes,
                        theft_suspected, abnormal_refill, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING id, date, vehicle, fuel_card, liters, amount, notes,
                              theft_suspected, abnormal_refill, created_at, updated_at
                    """,
                    (
                        fuel_log_data["date"],
                        fuel_log_data["vehicle"],
                        fuel_log_data["fuel_card"],
                        fuel_log_data["liters"],
                        fuel_log_data["amount"],
                        fuel_log_data["notes"],
                        int(fuel_log_data["theft_suspected"]),
                        int(fuel_log_data["abnormal_refill"]),
                        _utcnow_iso(),
                    ),
                ).fetchone()
                _log_audit_event(
                    connection,
                    action="fuel-log.create",
                    entity_type="fuel-log",
                    entity_id=fuel_log["id"],
                    details=f"Created fuel log for {fuel_log['vehicle']} on {fuel_log['date']}.",
                )

        return jsonify(row_to_fuel_log(fuel_log)), 201

    @app.put("/fuel-logs/<int:fuel_log_id>")
    def update_fuel_log(fuel_log_id: int):
        data = _get_json_payload()
        fuel_log_data, error = _parse_fuel_log_payload(data)
        if error:
            return jsonify({"error": error}), 400

        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            existing_log = connection.execute(
                "SELECT id FROM fuel_logs WHERE id = ?",
                (fuel_log_id,),
            ).fetchone()
            if not existing_log:
                return jsonify({"error": "Fuel log not found."}), 404

            with connection:
                connection.execute(
                    """
                    UPDATE fuel_logs
                    SET date = ?, vehicle = ?, fuel_card = ?, liters = ?, amount = ?,
                        notes = ?, theft_suspected = ?, abnormal_refill = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        fuel_log_data["date"],
                        fuel_log_data["vehicle"],
                        fuel_log_data["fuel_card"],
                        fuel_log_data["liters"],
                        fuel_log_data["amount"],
                        fuel_log_data["notes"],
                        int(fuel_log_data["theft_suspected"]),
                        int(fuel_log_data["abnormal_refill"]),
                        _utcnow_iso(),
                        fuel_log_id,
                    ),
                )
                fuel_log = connection.execute(
                    """
                    SELECT id, date, vehicle, fuel_card, liters, amount, notes,
                           theft_suspected, abnormal_refill, created_at, updated_at
                    FROM fuel_logs
                    WHERE id = ?
                    """,
                    (fuel_log_id,),
                ).fetchone()
                _log_audit_event(
                    connection,
                    action="fuel-log.update",
                    entity_type="fuel-log",
                    entity_id=fuel_log_id,
                    details=f"Updated fuel log for {fuel_log['vehicle']} on {fuel_log['date']}.",
                )

        return jsonify(row_to_fuel_log(fuel_log))

    @app.delete("/fuel-logs/<int:fuel_log_id>")
    def delete_fuel_log(fuel_log_id: int):
        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            fuel_log = connection.execute(
                """
                SELECT id, date, vehicle, fuel_card, liters, amount, notes,
                       theft_suspected, abnormal_refill, created_at, updated_at
                FROM fuel_logs
                WHERE id = ?
                """,
                (fuel_log_id,),
            ).fetchone()
            if not fuel_log:
                return jsonify({"error": "Fuel log not found."}), 404

            with connection:
                connection.execute("DELETE FROM fuel_logs WHERE id = ?", (fuel_log_id,))
                _log_audit_event(
                    connection,
                    action="fuel-log.delete",
                    entity_type="fuel-log",
                    entity_id=fuel_log_id,
                    details=f"Deleted fuel log for {fuel_log['vehicle']} on {fuel_log['date']}.",
                )

        return jsonify({"status": "deleted"})

    @app.post("/credit-score")
    def calculate_credit_score():
        data = _get_json_payload()

        try:
            income = float(data.get("income", 0))
            debt = float(data.get("debt", 0))
        except (TypeError, ValueError):
            return jsonify({"error": "Income and debt must be numeric."}), 400

        score = max(0, min(1000, (income - debt) / 10))
        return jsonify({"score": round(score, 2)})

    return app


def _get_json_payload() -> dict[str, object]:
    payload = request.get_json(silent=True)
    if isinstance(payload, dict):
        return payload
    return {}


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_vehicle_payload(data: dict[str, object]) -> tuple[dict[str, object], str | None]:
    make = str(data.get("make", "")).strip()
    model = str(data.get("model", "")).strip()
    year_value = data.get("year")

    if not make or not model:
        return {}, "Make and model are required."

    try:
        year = int(year_value)
    except (TypeError, ValueError):
        return {}, "Year must be a valid number."

    current_year = datetime.now(timezone.utc).year + 1
    if year < 1900 or year > current_year:
        return {}, f"Year must be between 1900 and {current_year}."

    return {"make": make, "model": model, "year": year}, None


def _parse_fuel_log_payload(data: dict[str, object]) -> tuple[dict[str, object], str | None]:
    entry_date = str(data.get("date", "")).strip()
    vehicle = str(data.get("vehicle", "")).strip()
    fuel_card = str(data.get("fuelCard", "")).strip()
    notes = str(data.get("notes", "")).strip()

    try:
        datetime.strptime(entry_date, "%Y-%m-%d")
    except ValueError:
        return {}, "Date must use YYYY-MM-DD format."

    if not vehicle or not fuel_card:
        return {}, "Vehicle and fuel card are required."

    try:
        liters = float(data.get("liters", 0))
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return {}, "Liters and amount must be numeric."

    if liters <= 0:
        return {}, "Liters must be greater than zero."

    if amount < 0:
        return {}, "Amount cannot be negative."

    return {
        "date": entry_date,
        "vehicle": vehicle,
        "fuel_card": fuel_card,
        "liters": liters,
        "amount": amount,
        "notes": notes,
        "theft_suspected": bool(data.get("theftSuspected", False)),
        "abnormal_refill": bool(data.get("abnormalRefill", False)),
    }, None


def _log_audit_event(
    connection,
    *,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    details: str = "",
) -> None:
    connection.execute(
        """
        INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, ?, ?, ?)
        """,
        (None, action, entity_type, entity_id, details),
    )


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
