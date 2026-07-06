from __future__ import annotations

from datetime import date, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.models.fuel_logs import FuelLog
from app.models.gps_tracking import GpsTrackingRecord
from app.models.insurance_records import InsuranceRecord
from app.models.maintenance_logs import MaintenanceRecord
from app.models.vehicles import Vehicle
from app.routes.fleet_operations import router as fleet_operations_router
from security.auth import create_token


class FakeQuery:
    def __init__(self, rows: list[object], bucket: list[object]):
        self._rows = rows
        self._bucket = bucket

    def _extract(self, criterion) -> tuple[str | None, object | None]:
        left = getattr(criterion, "left", None)
        right = getattr(criterion, "right", None)
        key = getattr(left, "key", None)
        value = getattr(right, "value", None)
        if value is None and right is not None:
            value = getattr(right, "effective_value", None)
        return key, value

    def filter(self, *criteria):
        for criterion in criteria:
            key, value = self._extract(criterion)
            if key is None:
                continue
            self._rows = [row for row in self._rows if getattr(row, key, None) == value]
        return self

    def order_by(self, *_args, **_kwargs):
        return self

    def all(self):
        return list(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None


class FakeSession:
    def __init__(self):
        self.rows_by_model: dict[type, list[object]] = {}

    def query(self, model):
        bucket = self.rows_by_model.setdefault(model, [])
        return FakeQuery(list(bucket), bucket)

    def add(self, row):
        bucket = self.rows_by_model.setdefault(type(row), [])
        if getattr(row, "id", None) is None:
          setattr(row, "id", len(bucket) + 1)
        if getattr(row, "created_at", None) is None:
            setattr(row, "created_at", datetime(2026, 7, 6, 8, 0, 0))
        bucket.append(row)

    def commit(self):
        return None

    def refresh(self, _row):
        return None

    def delete(self, row):
        bucket = self.rows_by_model.setdefault(type(row), [])
        if row in bucket:
            bucket.remove(row)

    def close(self):
        return None


@pytest.fixture
def fake_db():
    return FakeSession()


@pytest.fixture
def client(fake_db: FakeSession):
    app = FastAPI()
    app.include_router(fleet_operations_router)
    app.dependency_overrides[get_db] = lambda: fake_db
    return TestClient(app)


@pytest.fixture
def admin_headers():
    token = create_token(user_id=1, username="admin", role="Admin")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def viewer_headers():
    token = create_token(user_id=2, username="viewer", role="Viewer")
    return {"Authorization": f"Bearer {token}"}


def test_vehicle_create_and_list_smoke(client: TestClient, admin_headers, fake_db: FakeSession):
    response = client.post(
        "/vehicles",
        headers=admin_headers,
        json={"make": "Toyota", "model": "Hilux", "year": 2024},
    )
    assert response.status_code == 201
    assert response.json()["make"] == "Toyota"

    list_response = client.get("/vehicles", headers=admin_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert fake_db.rows_by_model[Vehicle][0].model == "Hilux"


def test_viewer_cannot_create_vehicle(client: TestClient, viewer_headers):
    response = client.post(
        "/vehicles",
        headers=viewer_headers,
        json={"make": "Toyota", "model": "Hilux", "year": 2024},
    )
    assert response.status_code == 403


def test_fuel_log_crud_smoke(client: TestClient, admin_headers, fake_db: FakeSession):
    create_response = client.post(
        "/fuel-logs",
        headers=admin_headers,
        json={
            "date": "2026-07-06",
            "vehicle": "Toyota Hilux",
            "fuelCard": "CARD-001",
            "liters": 42.0,
            "amount": 3000.0,
            "notes": "Route refill",
            "theftSuspected": False,
            "abnormalRefill": False,
        },
    )
    assert create_response.status_code == 201
    fuel_log_id = create_response.json()["id"]

    update_response = client.put(
        f"/fuel-logs/{fuel_log_id}",
        headers=admin_headers,
        json={
            "date": "2026-07-07",
            "vehicle": "Toyota Hilux",
            "fuelCard": "CARD-001",
            "liters": 40.0,
            "amount": 2800.0,
            "notes": "Adjusted entry",
            "theftSuspected": True,
            "abnormalRefill": False,
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["theftSuspected"] is True

    list_response = client.get("/fuel-logs", headers=admin_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    delete_response = client.delete(f"/fuel-logs/{fuel_log_id}", headers=admin_headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "deleted"
    assert fake_db.rows_by_model[FuelLog] == []


def test_maintenance_insurance_and_gps_create_smoke(client: TestClient, admin_headers, fake_db: FakeSession):
    maintenance_response = client.post(
        "/maintenance-records",
        headers=admin_headers,
        json={
            "vehicleId": 1,
            "vehicleLabel": "Toyota Hilux (2024)",
            "maintenanceType": "Preventive Service",
            "serviceDate": "2026-07-06",
            "nextServiceDate": "2026-08-06",
            "odometerKm": 1000,
            "vendor": "FleetCare",
            "estimatedCost": 2500,
            "status": "Scheduled",
            "notes": "Initial service",
        },
    )
    assert maintenance_response.status_code == 201

    insurance_response = client.post(
        "/insurance-records",
        headers=admin_headers,
        json={
            "vehicleId": 1,
            "vehicleLabel": "Toyota Hilux (2024)",
            "provider": "SecureDrive",
            "policyNumber": "POL-001",
            "coverageType": "Comprehensive",
            "premiumAmount": 10000,
            "insuredValue": 1200000,
            "startDate": "2026-07-01",
            "endDate": "2027-07-01",
            "status": "Active",
            "contactPerson": "Anna Reyes",
            "notes": "Annual policy",
        },
    )
    assert insurance_response.status_code == 201

    gps_response = client.post(
        "/gps-tracking",
        headers=admin_headers,
        json={
            "vehicleId": 1,
            "vehicleLabel": "Toyota Hilux (2024)",
            "latitude": 14.5995,
            "longitude": 120.9842,
            "speedKph": 45,
            "heading": "NE",
            "status": "moving",
            "routeLabel": "North Loop",
            "geofence": "Warehouse A",
        },
    )
    assert gps_response.status_code == 201

    assert len(fake_db.rows_by_model[MaintenanceRecord]) == 1
    assert len(fake_db.rows_by_model[InsuranceRecord]) == 1
    assert len(fake_db.rows_by_model[GpsTrackingRecord]) == 1
