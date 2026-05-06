from __future__ import annotations

from contextlib import closing
from datetime import datetime, timezone
import os
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    from .driver_scorecard import DriverScorecardInput, compute_driver_scorecard
    from .lease_scorecard import LeaseScorecardInput, compute_lease_scorecard
    from .models import (
        get_connection,
        get_database_status,
        init_db,
        resolve_database_config,
        row_to_audit_log,
        row_to_driver,
        row_to_driver_management_scorecard,
        row_to_fuel_log,
        row_to_insurance_record,
        row_to_lease_scorecard,
        row_to_maintenance_record,
        row_to_vehicle,
    )
except ImportError:
    from driver_scorecard import DriverScorecardInput, compute_driver_scorecard
    from lease_scorecard import LeaseScorecardInput, compute_lease_scorecard
    from models import (
        get_connection,
        get_database_status,
        init_db,
        resolve_database_config,
        row_to_audit_log,
        row_to_driver,
        row_to_driver_management_scorecard,
        row_to_fuel_log,
        row_to_insurance_record,
        row_to_lease_scorecard,
        row_to_maintenance_record,
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

    @app.get("/drivers")
    def list_drivers():
        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            rows = connection.execute(
                """
                SELECT id, first_name, last_name, license_number, phone, email, status, created_at
                FROM drivers
                ORDER BY id DESC
                LIMIT 50
                """
            ).fetchall()

        return jsonify([row_to_driver(row) for row in rows])

    @app.post("/drivers")
    def create_driver():
        data = _get_json_payload()
        payload, error = _parse_driver_payload(data)
        if error:
            return jsonify({"error": error}), 400

        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            with connection:
                row = connection.execute(
                    """
                    INSERT INTO drivers (
                        first_name, last_name, license_number, phone, email, status
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    RETURNING id, first_name, last_name, license_number, phone, email, status, created_at
                    """,
                    (
                        payload["first_name"],
                        payload["last_name"],
                        payload["license_number"],
                        payload["phone"],
                        payload["email"],
                        payload["status"],
                    ),
                ).fetchone()
                _log_audit_event(
                    connection,
                    action="driver.create",
                    entity_type="driver",
                    entity_id=row["id"],
                    details=f"Registered driver {payload['first_name']} {payload['last_name']}.",
                )

        return jsonify(row_to_driver(row)), 201

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

    @app.get("/lease-scorecards")
    def list_lease_scorecards():
        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            rows = connection.execute(
                """
                SELECT id, customer_name, company_name, vehicle_type, vehicle_value, down_payment,
                       requested_amount, monthly_income, existing_debt, lease_term_months, credit_score,
                       years_in_business, employment_years, monthly_estimated_payment, debt_service_ratio,
                       loan_to_value, credit_component, affordability_component, equity_component,
                       stability_component, asset_component, final_score, risk_grade, decision, summary, created_at
                FROM lease_scorecards
                ORDER BY id DESC
                LIMIT 20
                """
            ).fetchall()

        return jsonify([row_to_lease_scorecard(row) for row in rows])

    @app.post("/lease-scorecards")
    def create_lease_scorecard():
        data = _get_json_payload()
        payload, error = _parse_lease_scorecard_payload(data)
        if error:
            return jsonify({"error": error}), 400

        computed = compute_lease_scorecard(payload)

        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            with connection:
                row = connection.execute(
                    """
                    INSERT INTO lease_scorecards (
                        customer_name, company_name, vehicle_type, vehicle_value, down_payment,
                        requested_amount, monthly_income, existing_debt, lease_term_months, credit_score,
                        years_in_business, employment_years, monthly_estimated_payment, debt_service_ratio,
                        loan_to_value, credit_component, affordability_component, equity_component,
                        stability_component, asset_component, final_score, risk_grade, decision, summary
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING id, customer_name, company_name, vehicle_type, vehicle_value, down_payment,
                              requested_amount, monthly_income, existing_debt, lease_term_months, credit_score,
                              years_in_business, employment_years, monthly_estimated_payment, debt_service_ratio,
                              loan_to_value, credit_component, affordability_component, equity_component,
                              stability_component, asset_component, final_score, risk_grade, decision, summary, created_at
                    """,
                    (
                        payload.customer_name,
                        payload.company_name,
                        payload.vehicle_type,
                        payload.vehicle_value,
                        payload.down_payment,
                        payload.requested_amount,
                        payload.monthly_income,
                        payload.existing_debt,
                        payload.lease_term_months,
                        payload.credit_score,
                        payload.years_in_business,
                        payload.employment_years,
                        computed["monthlyEstimatedPayment"],
                        computed["debtServiceRatio"],
                        computed["loanToValue"],
                        computed["creditComponent"],
                        computed["affordabilityComponent"],
                        computed["equityComponent"],
                        computed["stabilityComponent"],
                        computed["assetComponent"],
                        computed["finalScore"],
                        computed["riskGrade"],
                        computed["decision"],
                        computed["summary"],
                    ),
                ).fetchone()
                _log_audit_event(
                    connection,
                    action="lease-scorecard.create",
                    entity_type="lease-scorecard",
                    entity_id=row["id"],
                    details=f"Saved lease scorecard for {payload.customer_name}.",
                )

        return jsonify(row_to_lease_scorecard(row)), 201

    @app.get("/driver-management-scorecards")
    def list_driver_management_scorecards():
        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            rows = connection.execute(
                """
                SELECT id, driver_name, license_class, years_driving, employment_years,
                       incidents_last_3_years, violations_last_3_years, training_hours, on_time_rate,
                       customer_rating, fatigue_events, safety_component, compliance_component,
                       experience_component, service_component, stability_component, final_score,
                       risk_grade, recommendation, summary, created_at
                FROM driver_management_scorecards
                ORDER BY id DESC
                LIMIT 20
                """
            ).fetchall()

        return jsonify([row_to_driver_management_scorecard(row) for row in rows])

    @app.post("/driver-management-scorecards")
    def create_driver_management_scorecard():
        data = _get_json_payload()
        payload, error = _parse_driver_management_scorecard_payload(data)
        if error:
            return jsonify({"error": error}), 400

        computed = compute_driver_scorecard(payload)

        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            with connection:
                row = connection.execute(
                    """
                    INSERT INTO driver_management_scorecards (
                        driver_name, license_class, years_driving, employment_years,
                        incidents_last_3_years, violations_last_3_years, training_hours, on_time_rate,
                        customer_rating, fatigue_events, safety_component, compliance_component,
                        experience_component, service_component, stability_component, final_score,
                        risk_grade, recommendation, summary
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING id, driver_name, license_class, years_driving, employment_years,
                              incidents_last_3_years, violations_last_3_years, training_hours, on_time_rate,
                              customer_rating, fatigue_events, safety_component, compliance_component,
                              experience_component, service_component, stability_component, final_score,
                              risk_grade, recommendation, summary, created_at
                    """,
                    (
                        payload.driver_name,
                        payload.license_class,
                        payload.years_driving,
                        payload.employment_years,
                        payload.incidents_last_3_years,
                        payload.violations_last_3_years,
                        payload.training_hours,
                        payload.on_time_rate,
                        payload.customer_rating,
                        payload.fatigue_events,
                        computed["safetyComponent"],
                        computed["complianceComponent"],
                        computed["experienceComponent"],
                        computed["serviceComponent"],
                        computed["stabilityComponent"],
                        computed["finalScore"],
                        computed["riskGrade"],
                        computed["recommendation"],
                        computed["summary"],
                    ),
                ).fetchone()
                _log_audit_event(
                    connection,
                    action="driver-management-scorecard.create",
                    entity_type="driver-management-scorecard",
                    entity_id=row["id"],
                    details=f"Saved driver management scorecard for {payload.driver_name}.",
                )

        return jsonify(row_to_driver_management_scorecard(row)), 201

    @app.get("/maintenance-records")
    def list_maintenance_records():
        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            rows = connection.execute(
                """
                SELECT id, vehicle_id, vehicle_label, maintenance_type, service_date, next_service_date,
                       odometer_km, vendor, estimated_cost, status, notes, created_at
                FROM maintenance_records
                ORDER BY service_date DESC, id DESC
                LIMIT 50
                """
            ).fetchall()

        return jsonify([row_to_maintenance_record(row) for row in rows])

    @app.post("/maintenance-records")
    def create_maintenance_record():
        data = _get_json_payload()
        payload, error = _parse_maintenance_record_payload(data)
        if error:
            return jsonify({"error": error}), 400

        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            with connection:
                row = connection.execute(
                    """
                    INSERT INTO maintenance_records (
                        vehicle_id, vehicle_label, maintenance_type, service_date, next_service_date,
                        odometer_km, vendor, estimated_cost, status, notes
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING id, vehicle_id, vehicle_label, maintenance_type, service_date, next_service_date,
                              odometer_km, vendor, estimated_cost, status, notes, created_at
                    """,
                    (
                        payload["vehicle_id"],
                        payload["vehicle_label"],
                        payload["maintenance_type"],
                        payload["service_date"],
                        payload["next_service_date"],
                        payload["odometer_km"],
                        payload["vendor"],
                        payload["estimated_cost"],
                        payload["status"],
                        payload["notes"],
                    ),
                ).fetchone()
                _log_audit_event(
                    connection,
                    action="maintenance-record.create",
                    entity_type="maintenance-record",
                    entity_id=row["id"],
                    details=f"Saved maintenance record for {payload['vehicle_label']}.",
                )

        return jsonify(row_to_maintenance_record(row)), 201

    @app.get("/insurance-records")
    def list_insurance_records():
        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            rows = connection.execute(
                """
                SELECT id, vehicle_id, vehicle_label, provider, policy_number, coverage_type,
                       premium_amount, insured_value, start_date, end_date, status, contact_person,
                       notes, created_at
                FROM insurance_records
                ORDER BY end_date ASC, id DESC
                LIMIT 50
                """
            ).fetchall()

        return jsonify([row_to_insurance_record(row) for row in rows])

    @app.post("/insurance-records")
    def create_insurance_record():
        data = _get_json_payload()
        payload, error = _parse_insurance_record_payload(data)
        if error:
            return jsonify({"error": error}), 400

        with closing(get_connection(app.config["DATABASE_CONFIG"])) as connection:
            with connection:
                row = connection.execute(
                    """
                    INSERT INTO insurance_records (
                        vehicle_id, vehicle_label, provider, policy_number, coverage_type,
                        premium_amount, insured_value, start_date, end_date, status, contact_person, notes
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING id, vehicle_id, vehicle_label, provider, policy_number, coverage_type,
                              premium_amount, insured_value, start_date, end_date, status, contact_person,
                              notes, created_at
                    """,
                    (
                        payload["vehicle_id"],
                        payload["vehicle_label"],
                        payload["provider"],
                        payload["policy_number"],
                        payload["coverage_type"],
                        payload["premium_amount"],
                        payload["insured_value"],
                        payload["start_date"],
                        payload["end_date"],
                        payload["status"],
                        payload["contact_person"],
                        payload["notes"],
                    ),
                ).fetchone()
                _log_audit_event(
                    connection,
                    action="insurance-record.create",
                    entity_type="insurance-record",
                    entity_id=row["id"],
                    details=f"Saved insurance record for {payload['vehicle_label']} under policy {payload['policy_number']}.",
                )

        return jsonify(row_to_insurance_record(row)), 201

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


def _parse_lease_scorecard_payload(data: dict[str, object]) -> tuple[LeaseScorecardInput | None, str | None]:
    customer_name = str(data.get("customerName", "")).strip()
    company_name = str(data.get("companyName", "")).strip()
    vehicle_type = str(data.get("vehicleType", "")).strip()

    if not customer_name:
        return None, "Customer name is required."
    if not vehicle_type:
        return None, "Vehicle type is required."

    try:
        vehicle_value = float(data.get("vehicleValue", 0))
        down_payment = float(data.get("downPayment", 0))
        requested_amount = float(data.get("requestedAmount", 0))
        monthly_income = float(data.get("monthlyIncome", 0))
        existing_debt = float(data.get("existingDebt", 0))
        lease_term_months = int(data.get("leaseTermMonths", 0))
        credit_score = int(data.get("creditScore", 0))
        years_in_business = float(data.get("yearsInBusiness", 0))
        employment_years = float(data.get("employmentYears", 0))
    except (TypeError, ValueError):
        return None, "Lease scorecard amounts, terms, and score fields must be numeric."

    if vehicle_value <= 0:
        return None, "Vehicle value must be greater than zero."
    if down_payment < 0:
        return None, "Down payment cannot be negative."
    if requested_amount <= 0:
        return None, "Requested amount must be greater than zero."
    if down_payment > requested_amount:
        return None, "Down payment cannot exceed the requested amount."
    if monthly_income <= 0:
        return None, "Monthly income must be greater than zero."
    if existing_debt < 0:
        return None, "Existing debt cannot be negative."
    if lease_term_months < 6:
        return None, "Lease term must be at least 6 months."
    if credit_score < 300 or credit_score > 850:
        return None, "Credit score must be between 300 and 850."
    if years_in_business < 0 or employment_years < 0:
        return None, "Experience fields cannot be negative."

    return (
        LeaseScorecardInput(
            customer_name=customer_name,
            company_name=company_name,
            vehicle_type=vehicle_type,
            vehicle_value=vehicle_value,
            down_payment=down_payment,
            requested_amount=requested_amount,
            monthly_income=monthly_income,
            existing_debt=existing_debt,
            lease_term_months=lease_term_months,
            credit_score=credit_score,
            years_in_business=years_in_business,
            employment_years=employment_years,
        ),
        None,
    )


def _parse_driver_management_scorecard_payload(
    data: dict[str, object],
) -> tuple[DriverScorecardInput | None, str | None]:
    driver_name = str(data.get("driverName", "")).strip()
    license_class = str(data.get("licenseClass", "")).strip()

    if not driver_name:
        return None, "Driver name is required."
    if not license_class:
        return None, "License class is required."

    try:
        years_driving = float(data.get("yearsDriving", 0))
        employment_years = float(data.get("employmentYears", 0))
        incidents_last_3_years = int(data.get("incidentsLast3Years", 0))
        violations_last_3_years = int(data.get("violationsLast3Years", 0))
        training_hours = float(data.get("trainingHours", 0))
        on_time_rate = float(data.get("onTimeRate", 0))
        customer_rating = float(data.get("customerRating", 0))
        fatigue_events = int(data.get("fatigueEvents", 0))
    except (TypeError, ValueError):
        return None, "Driver scorecard values must be numeric where applicable."

    if years_driving < 0 or employment_years < 0:
        return None, "Experience values cannot be negative."
    if incidents_last_3_years < 0 or violations_last_3_years < 0 or fatigue_events < 0:
        return None, "Incident, violation, and fatigue counts cannot be negative."
    if training_hours < 0:
        return None, "Training hours cannot be negative."
    if on_time_rate < 0 or on_time_rate > 100:
        return None, "On-time rate must be between 0 and 100."
    if customer_rating < 0 or customer_rating > 5:
        return None, "Customer rating must be between 0 and 5."

    return (
        DriverScorecardInput(
            driver_name=driver_name,
            license_class=license_class,
            years_driving=years_driving,
            employment_years=employment_years,
            incidents_last_3_years=incidents_last_3_years,
            violations_last_3_years=violations_last_3_years,
            training_hours=training_hours,
            on_time_rate=on_time_rate,
            customer_rating=customer_rating,
            fatigue_events=fatigue_events,
        ),
        None,
    )


def _parse_driver_payload(data: dict[str, object]) -> tuple[dict[str, str], str | None]:
    first_name = str(data.get("firstName", "")).strip()
    last_name = str(data.get("lastName", "")).strip()
    license_number = str(data.get("licenseNumber", "")).strip()
    phone = str(data.get("phone", "")).strip()
    email = str(data.get("email", "")).strip()
    status = str(data.get("status", "")).strip()

    if not first_name:
        return {}, "First name is required."
    if not last_name:
        return {}, "Last name is required."
    if not license_number:
        return {}, "License number is required."
    if not phone:
        return {}, "Phone number is required."
    if not email:
        return {}, "Email is required."
    if "@" not in email or "." not in email:
        return {}, "Email must be a valid address."
    if not status:
        return {}, "Status is required."

    return (
        {
            "first_name": first_name,
            "last_name": last_name,
            "license_number": license_number,
            "phone": phone,
            "email": email,
            "status": status,
        },
        None,
    )


def _parse_maintenance_record_payload(
    data: dict[str, object],
) -> tuple[dict[str, object], str | None]:
    vehicle_id_raw = data.get("vehicleId")
    vehicle_label = str(data.get("vehicleLabel", "")).strip()
    maintenance_type = str(data.get("maintenanceType", "")).strip()
    service_date = str(data.get("serviceDate", "")).strip()
    next_service_date = str(data.get("nextServiceDate", "")).strip() or None
    vendor = str(data.get("vendor", "")).strip()
    status = str(data.get("status", "")).strip()
    notes = str(data.get("notes", "")).strip()

    if not vehicle_label:
        return {}, "Vehicle is required."
    if not maintenance_type:
        return {}, "Maintenance type is required."
    if not status:
        return {}, "Status is required."

    try:
        datetime.strptime(service_date, "%Y-%m-%d")
    except ValueError:
        return {}, "Service date must use YYYY-MM-DD format."

    if next_service_date is not None:
        try:
            datetime.strptime(next_service_date, "%Y-%m-%d")
        except ValueError:
            return {}, "Next service date must use YYYY-MM-DD format."

    try:
        odometer_km = float(data.get("odometerKm", 0))
        estimated_cost = float(data.get("estimatedCost", 0))
    except (TypeError, ValueError):
        return {}, "Odometer and estimated cost must be numeric."

    if odometer_km < 0:
        return {}, "Odometer cannot be negative."
    if estimated_cost < 0:
        return {}, "Estimated cost cannot be negative."

    vehicle_id = None
    if vehicle_id_raw not in (None, ""):
        try:
            vehicle_id = int(vehicle_id_raw)
        except (TypeError, ValueError):
            return {}, "Vehicle id must be numeric when provided."

    return (
        {
            "vehicle_id": vehicle_id,
            "vehicle_label": vehicle_label,
            "maintenance_type": maintenance_type,
            "service_date": service_date,
            "next_service_date": next_service_date,
            "odometer_km": odometer_km,
            "vendor": vendor,
            "estimated_cost": estimated_cost,
            "status": status,
            "notes": notes,
        },
        None,
    )


def _parse_insurance_record_payload(
    data: dict[str, object],
) -> tuple[dict[str, object], str | None]:
    vehicle_id_raw = data.get("vehicleId")
    vehicle_label = str(data.get("vehicleLabel", "")).strip()
    provider = str(data.get("provider", "")).strip()
    policy_number = str(data.get("policyNumber", "")).strip()
    coverage_type = str(data.get("coverageType", "")).strip()
    start_date = str(data.get("startDate", "")).strip()
    end_date = str(data.get("endDate", "")).strip()
    status = str(data.get("status", "")).strip()
    contact_person = str(data.get("contactPerson", "")).strip()
    notes = str(data.get("notes", "")).strip()

    if not vehicle_label:
        return {}, "Vehicle is required."
    if not provider:
        return {}, "Provider is required."
    if not policy_number:
        return {}, "Policy number is required."
    if not coverage_type:
        return {}, "Coverage type is required."
    if not status:
        return {}, "Status is required."

    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    except ValueError:
        return {}, "Start date must use YYYY-MM-DD format."

    try:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        return {}, "End date must use YYYY-MM-DD format."

    if end_dt < start_dt:
        return {}, "End date must be on or after the start date."

    try:
        premium_amount = float(data.get("premiumAmount", 0))
        insured_value = float(data.get("insuredValue", 0))
    except (TypeError, ValueError):
        return {}, "Premium amount and insured value must be numeric."

    if premium_amount < 0:
        return {}, "Premium amount cannot be negative."
    if insured_value <= 0:
        return {}, "Insured value must be greater than zero."

    vehicle_id = None
    if vehicle_id_raw not in (None, ""):
        try:
            vehicle_id = int(vehicle_id_raw)
        except (TypeError, ValueError):
            return {}, "Vehicle id must be numeric when provided."

    return (
        {
            "vehicle_id": vehicle_id,
            "vehicle_label": vehicle_label,
            "provider": provider,
            "policy_number": policy_number,
            "coverage_type": coverage_type,
            "premium_amount": premium_amount,
            "insured_value": insured_value,
            "start_date": start_date,
            "end_date": end_date,
            "status": status,
            "contact_person": contact_person,
            "notes": notes,
        },
        None,
    )


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
