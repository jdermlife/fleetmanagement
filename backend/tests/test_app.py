from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.models.fuel_logs import FuelLog
from app.models.vehicles import Vehicle


class FakeQuery:
    def __init__(self, rows: list[object]):
        self._rows = rows

    def filter(self, *criteria):
        for criterion in criteria:
            left = getattr(criterion, "left", None)
            right = getattr(criterion, "right", None)
            key = getattr(left, "key", None)
            value = getattr(right, "value", None)
            if key is not None:
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
        return FakeQuery(list(self.rows_by_model.get(model, [])))

    def add(self, row):
        bucket = self.rows_by_model.setdefault(type(row), [])
        if getattr(row, "id", None) is None:
            setattr(row, "id", len(bucket) + 1)
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
def app_client(monkeypatch):
    monkeypatch.setenv("ENFORCE_AUTH", "true")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-fastapi-app-smoke")
    monkeypatch.setenv("ENABLE_RATE_LIMIT", "false")

    import security.auth as auth_module
    import main as main_module

    auth_module = importlib.reload(auth_module)
    main_module = importlib.reload(main_module)
    fake_db = FakeSession()

    main_module.app.dependency_overrides[get_db] = lambda: fake_db

    with TestClient(main_module.app) as client:
        yield client, auth_module, fake_db

    main_module.app.dependency_overrides.clear()


def test_health_and_home_endpoints(app_client):
    client, _auth_module, _fake_db = app_client

    health_response = client.get("/health")
    home_response = client.get("/")

    assert health_response.status_code == 200
    assert health_response.json()["status"] == "healthy"
    assert home_response.status_code == 200
    assert "message" in home_response.json()


def test_database_status_requires_and_allows_admin_token(app_client):
    client, auth_module, _fake_db = app_client

    unauthorized_response = client.get("/database/status")
    assert unauthorized_response.status_code == 401

    token = auth_module.create_token(1, "admin.user", "Admin", expires_in_hours=1)
    authorized_response = client.get(
        "/database/status",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert authorized_response.status_code == 200
    assert "engine" in authorized_response.json()


def test_vehicle_and_fuel_log_routes_work_with_current_fastapi_stack(app_client):
    client, auth_module, fake_db = app_client
    token = auth_module.create_token(1, "admin.user", "Admin", expires_in_hours=1)
    headers = {"Authorization": f"Bearer {token}"}

    create_vehicle = client.post(
        "/vehicles",
        headers=headers,
        json={"make": "Isuzu", "model": "D-Max", "year": 2024},
    )
    assert create_vehicle.status_code == 201
    vehicle_id = create_vehicle.json()["id"]

    update_vehicle = client.put(
        f"/vehicles/{vehicle_id}",
        headers=headers,
        json={"make": "Isuzu", "model": "D-Max LS", "year": 2025},
    )
    assert update_vehicle.status_code == 200
    assert update_vehicle.json()["model"] == "D-Max LS"

    list_vehicles = client.get("/vehicles", headers=headers)
    assert list_vehicles.status_code == 200
    assert len(list_vehicles.json()) == 1

    create_fuel_log = client.post(
        "/fuel-logs",
        headers=headers,
        json={
            "date": "2026-04-28",
            "vehicle": "Isuzu D-Max LS",
            "fuelCard": "CARD-001",
            "liters": 42.5,
            "amount": 65.75,
            "notes": "Full tank",
            "theftSuspected": False,
            "abnormalRefill": False,
        },
    )
    assert create_fuel_log.status_code == 201
    fuel_log_id = create_fuel_log.json()["id"]

    update_fuel_log = client.put(
        f"/fuel-logs/{fuel_log_id}",
        headers=headers,
        json={
            "date": "2026-04-29",
            "vehicle": "Isuzu D-Max LS",
            "fuelCard": "CARD-001",
            "liters": 40,
            "amount": 60.25,
            "notes": "Adjusted entry",
            "theftSuspected": True,
            "abnormalRefill": False,
        },
    )
    assert update_fuel_log.status_code == 200
    assert update_fuel_log.json()["notes"] == "Adjusted entry"

    delete_fuel_log = client.delete(f"/fuel-logs/{fuel_log_id}", headers=headers)
    assert delete_fuel_log.status_code == 200
    assert fake_db.rows_by_model[FuelLog] == []

    delete_vehicle = client.delete(f"/vehicles/{vehicle_id}", headers=headers)
    assert delete_vehicle.status_code == 200
    assert fake_db.rows_by_model[Vehicle] == []
