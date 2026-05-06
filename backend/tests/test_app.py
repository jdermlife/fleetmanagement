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

    def test_lease_scorecard_is_scored_and_saved(self) -> None:
        create_response = self.client.post(
            "/lease-scorecards",
            json={
                "customerName": "Maria Santos",
                "companyName": "Santos Logistics",
                "vehicleType": "SUV",
                "vehicleValue": 1800000,
                "downPayment": 300000,
                "requestedAmount": 1500000,
                "monthlyIncome": 220000,
                "existingDebt": 25000,
                "leaseTermMonths": 48,
                "creditScore": 730,
                "yearsInBusiness": 6,
                "employmentYears": 0,
            },
        )
        list_response = self.client.get("/lease-scorecards")

        self.assertEqual(create_response.status_code, 201)
        created = create_response.get_json()
        self.assertEqual(created["customerName"], "Maria Santos")
        self.assertEqual(created["riskGrade"], "A")
        self.assertEqual(created["decision"], "Approve")
        self.assertGreater(created["finalScore"], 85)
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.get_json()[0]["customerName"], "Maria Santos")

    def test_driver_management_scorecard_is_scored_and_saved(self) -> None:
        create_response = self.client.post(
            "/driver-management-scorecards",
            json={
                "driverName": "Roberto Cruz",
                "licenseClass": "Professional",
                "yearsDriving": 8,
                "employmentYears": 5,
                "incidentsLast3Years": 0,
                "violationsLast3Years": 1,
                "trainingHours": 24,
                "onTimeRate": 97,
                "customerRating": 4.7,
                "fatigueEvents": 0,
            },
        )
        list_response = self.client.get("/driver-management-scorecards")

        self.assertEqual(create_response.status_code, 201)
        created = create_response.get_json()
        self.assertEqual(created["driverName"], "Roberto Cruz")
        self.assertEqual(created["riskGrade"], "B")
        self.assertEqual(created["recommendation"], "Priority Assignment")
        self.assertGreater(created["finalScore"], 85)
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.get_json()[0]["driverName"], "Roberto Cruz")

    def test_driver_registration_is_saved(self) -> None:
        create_response = self.client.post(
            "/drivers",
            json={
                "firstName": "Liza",
                "lastName": "Martinez",
                "licenseNumber": "LIC-2026-771",
                "phone": "+639171234567",
                "email": "liza.martinez@example.com",
                "status": "Active",
            },
        )
        list_response = self.client.get("/drivers")

        self.assertEqual(create_response.status_code, 201)
        created = create_response.get_json()
        self.assertEqual(created["firstName"], "Liza")
        self.assertEqual(created["lastName"], "Martinez")
        self.assertEqual(created["licenseNumber"], "LIC-2026-771")
        self.assertEqual(created["status"], "Active")
        self.assertIn("createdAt", created)
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.get_json()[0]["firstName"], "Liza")

    def test_maintenance_record_is_saved(self) -> None:
        vehicles_response = self.client.get("/vehicles")
        vehicle = vehicles_response.get_json()[0]

        create_response = self.client.post(
            "/maintenance-records",
            json={
                "vehicleId": vehicle["id"],
                "vehicleLabel": f"{vehicle['make']} {vehicle['model']} ({vehicle['year']})",
                "maintenanceType": "Preventive Service",
                "serviceDate": "2026-04-29",
                "nextServiceDate": "2026-07-29",
                "odometerKm": 45210,
                "vendor": "FleetCare Garage",
                "estimatedCost": 8500,
                "status": "Scheduled",
                "notes": "Quarterly preventive maintenance booking.",
            },
        )
        list_response = self.client.get("/maintenance-records")

        self.assertEqual(create_response.status_code, 201)
        created = create_response.get_json()
        self.assertEqual(created["maintenanceType"], "Preventive Service")
        self.assertEqual(created["status"], "Scheduled")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.get_json()[0]["vehicleLabel"], f"{vehicle['make']} {vehicle['model']} ({vehicle['year']})")

    def test_insurance_record_is_saved(self) -> None:
        vehicles_response = self.client.get("/vehicles")
        vehicle = vehicles_response.get_json()[0]

        create_response = self.client.post(
            "/insurance-records",
            json={
                "vehicleId": vehicle["id"],
                "vehicleLabel": f"{vehicle['make']} {vehicle['model']} ({vehicle['year']})",
                "provider": "SecureDrive Insurance",
                "policyNumber": "SDI-2026-4481",
                "coverageType": "Comprehensive",
                "premiumAmount": 24500,
                "insuredValue": 1250000,
                "startDate": "2026-05-01",
                "endDate": "2027-04-30",
                "status": "Active",
                "contactPerson": "Anna Reyes",
                "notes": "Bundled coverage with roadside assistance.",
            },
        )
        list_response = self.client.get("/insurance-records")

        self.assertEqual(create_response.status_code, 201)
        created = create_response.get_json()
        self.assertEqual(created["provider"], "SecureDrive Insurance")
        self.assertEqual(created["policyNumber"], "SDI-2026-4481")
        self.assertEqual(created["status"], "Active")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.get_json()[0]["vehicleLabel"], f"{vehicle['make']} {vehicle['model']} ({vehicle['year']})")


if __name__ == "__main__":
    unittest.main()
