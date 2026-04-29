from __future__ import annotations

import sys
import unittest
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1] / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from main import create_app


class FleetManagementAppTests(unittest.TestCase):
    def setUp(self) -> None:
        tests_root = Path(__file__).resolve().parent
        self.database_path = tests_root / "test-fms.db"
        if self.database_path.exists():
            self.database_path.unlink()
        self.app = create_app(
            {
                "TESTING": True,
                "DATABASE_PATH": str(self.database_path),
            }
        )
        self.client = self.app.test_client()

    def tearDown(self) -> None:
        if self.database_path.exists():
            self.database_path.unlink()

    def test_health_and_public_vehicle_listing(self) -> None:
        health_response = self.client.get("/health")
        database_response = self.client.get("/database/status")
        vehicles_response = self.client.get("/vehicles")

        self.assertEqual(health_response.status_code, 200)
        self.assertEqual(health_response.get_json()["status"], "ok")
        self.assertEqual(database_response.status_code, 200)
        self.assertEqual(database_response.get_json()["engine"], "sqlite")
        self.assertEqual(vehicles_response.status_code, 200)
        self.assertEqual(len(vehicles_response.get_json()), 2)

    def test_vehicle_crud_is_public_and_audited(self) -> None:
        create_response = self.client.post(
            "/vehicles",
            json={"make": "Isuzu", "model": "D-Max", "year": 2024},
        )
        vehicle_id = create_response.get_json()["id"]

        update_response = self.client.put(
            f"/vehicles/{vehicle_id}",
            json={"make": "Isuzu", "model": "D-Max LS", "year": 2025},
        )
        delete_response = self.client.delete(f"/vehicles/{vehicle_id}")
        audit_response = self.client.get("/audit-logs")

        audit_actions = [entry["action"] for entry in audit_response.get_json()]

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.get_json()["model"], "D-Max LS")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(audit_response.status_code, 200)
        self.assertEqual(audit_actions[:3], ["vehicle.delete", "vehicle.update", "vehicle.create"])
        self.assertIsNone(audit_response.get_json()[0]["actorUsername"])

    def test_fuel_log_crud_is_public(self) -> None:
        create_response = self.client.post(
            "/fuel-logs",
            json={
                "date": "2026-04-28",
                "vehicle": "Toyota Camry",
                "fuelCard": "CARD-001",
                "liters": 42.5,
                "amount": 65.75,
                "notes": "Full tank",
                "theftSuspected": False,
                "abnormalRefill": False,
            },
        )
        fuel_log_id = create_response.get_json()["id"]

        update_response = self.client.put(
            f"/fuel-logs/{fuel_log_id}",
            json={
                "date": "2026-04-29",
                "vehicle": "Toyota Camry",
                "fuelCard": "CARD-001",
                "liters": 40,
                "amount": 60.25,
                "notes": "Adjusted entry",
                "theftSuspected": True,
                "abnormalRefill": False,
            },
        )
        list_response = self.client.get("/fuel-logs")
        delete_response = self.client.delete(f"/fuel-logs/{fuel_log_id}")

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.get_json()["notes"], "Adjusted entry")
        self.assertEqual(list_response.status_code, 200)
        self.assertGreaterEqual(len(list_response.get_json()), 1)
        self.assertEqual(delete_response.status_code, 200)

    def test_credit_score_is_public_and_validates_numeric_input(self) -> None:
        invalid_response = self.client.post("/credit-score", json={"income": "abc", "debt": 100})
        valid_response = self.client.post("/credit-score", json={"income": 1000, "debt": 250})

        self.assertEqual(invalid_response.status_code, 400)
        self.assertEqual(valid_response.status_code, 200)
        self.assertEqual(valid_response.get_json()["score"], 75.0)


if __name__ == "__main__":
    unittest.main()
