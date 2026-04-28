from __future__ import annotations

import sys
import time
import unittest
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1] / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from main import _generate_totp_code, create_app


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
                "BOOTSTRAP_ADMIN_USERNAME": None,
                "BOOTSTRAP_ADMIN_PASSWORD": None,
            }
        )
        self.client = self.app.test_client()

    def tearDown(self) -> None:
        if self.database_path.exists():
            self.database_path.unlink()

    def bootstrap_admin(self, username: str = "admin", password: str = "Password123!") -> dict[str, object]:
        response = self.client.post(
            "/auth/bootstrap",
            json={"username": username, "password": password},
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()

    def login(self, username: str = "admin", password: str = "Password123!") -> str:
        response = self.client.post("/auth/login", json={"username": username, "password": password})
        self.assertEqual(response.status_code, 200)
        return response.get_json()["token"]

    @staticmethod
    def auth_headers(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def create_user(self, token: str, username: str, password: str, role: str) -> dict[str, object]:
        response = self.client.post(
            "/users",
            json={"username": username, "password": password, "role": role},
            headers=self.auth_headers(token),
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()

    def test_user_can_enable_mfa_and_login_requires_code(self) -> None:
        self.bootstrap_admin()
        token = self.login()

        setup_response = self.client.post(
            "/auth/mfa/setup",
            json={"currentPassword": "Password123!"},
            headers=self.auth_headers(token),
        )
        secret = setup_response.get_json()["secret"]
        otp_code = _generate_totp_code(secret, int(time.time()))

        confirm_response = self.client.post(
            "/auth/mfa/confirm",
            json={"otpCode": otp_code},
            headers=self.auth_headers(token),
        )
        login_without_code = self.client.post(
            "/auth/login",
            json={"username": "admin", "password": "Password123!"},
        )
        login_with_code = self.client.post(
            "/auth/login",
            json={"username": "admin", "password": "Password123!", "otpCode": _generate_totp_code(secret, int(time.time()))},
        )

        self.assertEqual(setup_response.status_code, 200)
        self.assertTrue(setup_response.get_json()["otpauthUrl"].startswith("otpauth://totp/"))
        self.assertEqual(confirm_response.status_code, 200)
        self.assertTrue(confirm_response.get_json()["user"]["mfaEnabled"])
        self.assertEqual(len(confirm_response.get_json()["backupCodes"]), 8)
        self.assertEqual(login_without_code.status_code, 401)
        self.assertTrue(login_without_code.get_json()["mfaRequired"])
        self.assertEqual(login_with_code.status_code, 200)

    def test_user_can_disable_mfa(self) -> None:
        self.bootstrap_admin()
        token = self.login()
        setup_response = self.client.post(
            "/auth/mfa/setup",
            json={"currentPassword": "Password123!"},
            headers=self.auth_headers(token),
        )
        secret = setup_response.get_json()["secret"]
        self.client.post(
            "/auth/mfa/confirm",
            json={"otpCode": _generate_totp_code(secret, int(time.time()))},
            headers=self.auth_headers(token),
        )

        login_with_mfa = self.client.post(
            "/auth/login",
            json={"username": "admin", "password": "Password123!", "otpCode": _generate_totp_code(secret, int(time.time()))},
        )
        mfa_token = login_with_mfa.get_json()["token"]
        disable_response = self.client.post(
            "/auth/mfa/disable",
            json={"currentPassword": "Password123!", "otpCode": _generate_totp_code(secret, int(time.time()))},
            headers=self.auth_headers(mfa_token),
        )
        login_without_code = self.client.post(
            "/auth/login",
            json={"username": "admin", "password": "Password123!"},
        )

        self.assertEqual(disable_response.status_code, 200)
        self.assertFalse(disable_response.get_json()["user"]["mfaEnabled"])
        self.assertEqual(login_without_code.status_code, 200)

    def test_backup_code_can_be_used_once_and_regenerated(self) -> None:
        self.bootstrap_admin()
        token = self.login()
        setup_response = self.client.post(
            "/auth/mfa/setup",
            json={"currentPassword": "Password123!"},
            headers=self.auth_headers(token),
        )
        secret = setup_response.get_json()["secret"]
        confirm_response = self.client.post(
            "/auth/mfa/confirm",
            json={"otpCode": _generate_totp_code(secret, int(time.time()))},
            headers=self.auth_headers(token),
        )
        backup_code = confirm_response.get_json()["backupCodes"][0]

        backup_login = self.client.post(
            "/auth/login",
            json={"username": "admin", "password": "Password123!", "backupCode": backup_code},
        )
        reused_backup_login = self.client.post(
            "/auth/login",
            json={"username": "admin", "password": "Password123!", "backupCode": backup_code},
        )
        regen_token = backup_login.get_json()["token"]
        regenerate_response = self.client.post(
            "/auth/mfa/backup-codes/regenerate",
            json={"currentPassword": "Password123!", "otpCode": _generate_totp_code(secret, int(time.time()))},
            headers=self.auth_headers(regen_token),
        )
        old_backup_after_regen = self.client.post(
            "/auth/login",
            json={"username": "admin", "password": "Password123!", "backupCode": confirm_response.get_json()["backupCodes"][1]},
        )
        new_backup_login = self.client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "Password123!",
                "backupCode": regenerate_response.get_json()["backupCodes"][0],
            },
        )

        self.assertEqual(backup_login.status_code, 200)
        self.assertEqual(reused_backup_login.status_code, 401)
        self.assertEqual(regenerate_response.status_code, 200)
        self.assertEqual(len(regenerate_response.get_json()["backupCodes"]), 8)
        self.assertEqual(old_backup_after_regen.status_code, 401)
        self.assertEqual(new_backup_login.status_code, 200)

    def test_user_can_change_password_and_old_password_stops_working(self) -> None:
        self.bootstrap_admin()
        old_token = self.login()
        change_response = self.client.post(
            "/auth/change-password",
            json={"currentPassword": "Password123!", "newPassword": "Password456!"},
            headers=self.auth_headers(old_token),
        )
        relogin_old = self.client.post(
            "/auth/login",
            json={"username": "admin", "password": "Password123!"},
        )
        relogin_new = self.client.post(
            "/auth/login",
            json={"username": "admin", "password": "Password456!"},
        )

        self.assertEqual(change_response.status_code, 200)
        self.assertNotEqual(change_response.get_json()["token"], old_token)
        self.assertEqual(relogin_old.status_code, 401)
        self.assertEqual(relogin_new.status_code, 200)

    def test_bootstrap_then_login_and_me(self) -> None:
        bootstrap_status = self.client.get("/auth/bootstrap-status")
        bootstrap_response = self.bootstrap_admin()
        login_response = self.client.post(
            "/auth/login",
            json={"username": "admin", "password": "Password123!"},
        )
        me_response = self.client.get(
            "/auth/me",
            headers=self.auth_headers(login_response.get_json()["token"]),
        )

        self.assertEqual(bootstrap_status.status_code, 200)
        self.assertTrue(bootstrap_status.get_json()["requiresBootstrap"])
        self.assertEqual(bootstrap_response["user"]["role"], "admin")
        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.get_json()["username"], "admin")

    def test_admin_can_create_users_and_view_audit_logs(self) -> None:
        self.bootstrap_admin()
        admin_token = self.login()
        created_user = self.create_user(admin_token, "manager1", "ManagerPass1!", "manager")
        users_response = self.client.get("/users", headers=self.auth_headers(admin_token))
        audit_response = self.client.get("/audit-logs", headers=self.auth_headers(admin_token))

        self.assertEqual(created_user["role"], "manager")
        self.assertEqual(users_response.status_code, 200)
        usernames = [user["username"] for user in users_response.get_json()]
        self.assertIn("manager1", usernames)

        self.assertEqual(audit_response.status_code, 200)
        audit_actions = [log["action"] for log in audit_response.get_json()]
        self.assertIn("user.create", audit_actions)

    def test_admin_can_reset_and_deactivate_then_reactivate_user(self) -> None:
        self.bootstrap_admin()
        admin_token = self.login()
        created_user = self.create_user(admin_token, "viewer2", "ViewerPass1!", "viewer")

        reset_response = self.client.post(
            f"/users/{created_user['id']}/reset-password",
            json={"newPassword": "ViewerPass2!"},
            headers=self.auth_headers(admin_token),
        )
        old_login = self.client.post(
            "/auth/login",
            json={"username": "viewer2", "password": "ViewerPass1!"},
        )
        new_login = self.client.post(
            "/auth/login",
            json={"username": "viewer2", "password": "ViewerPass2!"},
        )
        deactivate_response = self.client.post(
            f"/users/{created_user['id']}/deactivate",
            headers=self.auth_headers(admin_token),
        )
        deactivated_login = self.client.post(
            "/auth/login",
            json={"username": "viewer2", "password": "ViewerPass2!"},
        )
        reactivate_response = self.client.post(
            f"/users/{created_user['id']}/reactivate",
            headers=self.auth_headers(admin_token),
        )
        reactivated_login = self.client.post(
            "/auth/login",
            json={"username": "viewer2", "password": "ViewerPass2!"},
        )

        self.assertEqual(reset_response.status_code, 200)
        self.assertEqual(old_login.status_code, 401)
        self.assertEqual(new_login.status_code, 200)
        self.assertEqual(deactivate_response.status_code, 200)
        self.assertFalse(deactivate_response.get_json()["isActive"])
        self.assertEqual(deactivated_login.status_code, 403)
        self.assertEqual(reactivate_response.status_code, 200)
        self.assertTrue(reactivate_response.get_json()["isActive"])
        self.assertEqual(reactivated_login.status_code, 200)

    def test_admin_can_recover_user_mfa(self) -> None:
        self.bootstrap_admin()
        admin_token = self.login()
        created_user = self.create_user(admin_token, "analyst1", "AnalystPass1!", "viewer")

        analyst_login = self.client.post(
            "/auth/login",
            json={"username": "analyst1", "password": "AnalystPass1!"},
        )
        analyst_token = analyst_login.get_json()["token"]
        setup_response = self.client.post(
            "/auth/mfa/setup",
            json={"currentPassword": "AnalystPass1!"},
            headers=self.auth_headers(analyst_token),
        )
        secret = setup_response.get_json()["secret"]
        self.client.post(
            "/auth/mfa/confirm",
            json={"otpCode": _generate_totp_code(secret, int(time.time()))},
            headers=self.auth_headers(analyst_token),
        )

        mfa_blocked_login = self.client.post(
            "/auth/login",
            json={"username": "analyst1", "password": "AnalystPass1!"},
        )
        recover_response = self.client.post(
            f"/users/{created_user['id']}/mfa/recover",
            headers=self.auth_headers(admin_token),
        )
        recovered_login = self.client.post(
            "/auth/login",
            json={"username": "analyst1", "password": "AnalystPass1!"},
        )

        self.assertEqual(mfa_blocked_login.status_code, 401)
        self.assertTrue(mfa_blocked_login.get_json()["mfaRequired"])
        self.assertEqual(recover_response.status_code, 200)
        self.assertFalse(recover_response.get_json()["mfaEnabled"])
        self.assertEqual(recovered_login.status_code, 200)

    def test_user_can_request_mfa_recovery_and_admin_can_approve_it(self) -> None:
        self.bootstrap_admin()
        admin_token = self.login()
        created_user = self.create_user(admin_token, "auditor1", "AuditorPass1!", "viewer")

        user_login = self.client.post(
            "/auth/login",
            json={"username": "auditor1", "password": "AuditorPass1!"},
        )
        user_token = user_login.get_json()["token"]
        setup_response = self.client.post(
            "/auth/mfa/setup",
            json={"currentPassword": "AuditorPass1!"},
            headers=self.auth_headers(user_token),
        )
        secret = setup_response.get_json()["secret"]
        self.client.post(
            "/auth/mfa/confirm",
            json={"otpCode": _generate_totp_code(secret, int(time.time()))},
            headers=self.auth_headers(user_token),
        )

        blocked_login = self.client.post(
            "/auth/login",
            json={"username": "auditor1", "password": "AuditorPass1!"},
        )
        request_response = self.client.post(
            "/auth/mfa/recovery-request",
            json={"username": "auditor1", "password": "AuditorPass1!", "reason": "Lost device"},
        )
        duplicate_request = self.client.post(
            "/auth/mfa/recovery-request",
            json={"username": "auditor1", "password": "AuditorPass1!", "reason": "Still locked out"},
        )
        list_requests = self.client.get(
            "/users/mfa-recovery-requests",
            headers=self.auth_headers(admin_token),
        )
        approve_response = self.client.post(
            f"/users/mfa-recovery-requests/{request_response.get_json()['id']}/approve",
            headers=self.auth_headers(admin_token),
        )
        recovered_login = self.client.post(
            "/auth/login",
            json={"username": "auditor1", "password": "AuditorPass1!"},
        )

        self.assertEqual(blocked_login.status_code, 401)
        self.assertTrue(blocked_login.get_json()["mfaRequired"])
        self.assertEqual(request_response.status_code, 201)
        self.assertEqual(request_response.get_json()["reason"], "Lost device")
        self.assertEqual(duplicate_request.status_code, 409)
        self.assertEqual(list_requests.status_code, 200)
        self.assertTrue(any(item["userId"] == created_user["id"] for item in list_requests.get_json()))
        self.assertEqual(approve_response.status_code, 200)
        self.assertEqual(approve_response.get_json()["status"], "approved")
        self.assertEqual(recovered_login.status_code, 200)

    def test_manager_can_create_update_and_delete_fleet_records(self) -> None:
        self.bootstrap_admin()
        admin_token = self.login()
        self.create_user(admin_token, "ops-manager", "ManagerPass1!", "manager")

        manager_login = self.client.post(
            "/auth/login",
            json={"username": "ops-manager", "password": "ManagerPass1!"},
        )
        manager_token = manager_login.get_json()["token"]

        vehicle_create = self.client.post(
            "/vehicles",
            json={"make": "Ford", "model": "Ranger", "year": 2024},
            headers=self.auth_headers(manager_token),
        )
        vehicle_id = vehicle_create.get_json()["id"]

        vehicle_update = self.client.put(
            f"/vehicles/{vehicle_id}",
            json={"make": "Ford", "model": "Everest", "year": 2025},
            headers=self.auth_headers(manager_token),
        )

        fuel_create = self.client.post(
            "/fuel-logs",
            json={
                "date": "2026-04-22",
                "vehicle": "Ford Everest",
                "fuelCard": "CARD-100",
                "liters": 55,
                "amount": 89.5,
                "notes": "Weekly route refill",
                "theftSuspected": False,
                "abnormalRefill": False,
            },
            headers=self.auth_headers(manager_token),
        )
        fuel_log_id = fuel_create.get_json()["id"]

        fuel_update = self.client.put(
            f"/fuel-logs/{fuel_log_id}",
            json={
                "date": "2026-04-23",
                "vehicle": "Ford Everest",
                "fuelCard": "CARD-100",
                "liters": 60,
                "amount": 91,
                "notes": "Adjusted quantity",
                "theftSuspected": False,
                "abnormalRefill": True,
            },
            headers=self.auth_headers(manager_token),
        )

        delete_fuel = self.client.delete(
            f"/fuel-logs/{fuel_log_id}",
            headers=self.auth_headers(manager_token),
        )
        delete_vehicle = self.client.delete(
            f"/vehicles/{vehicle_id}",
            headers=self.auth_headers(manager_token),
        )

        self.assertEqual(vehicle_create.status_code, 201)
        self.assertEqual(vehicle_update.status_code, 200)
        self.assertEqual(vehicle_update.get_json()["model"], "Everest")
        self.assertEqual(fuel_create.status_code, 201)
        self.assertEqual(fuel_update.status_code, 200)
        self.assertTrue(fuel_update.get_json()["abnormalRefill"])
        self.assertEqual(delete_fuel.status_code, 200)
        self.assertEqual(delete_vehicle.status_code, 200)

    def test_viewer_cannot_mutate_records(self) -> None:
        self.bootstrap_admin()
        admin_token = self.login()
        self.create_user(admin_token, "viewer1", "ViewerPass1!", "viewer")

        viewer_login = self.client.post(
            "/auth/login",
            json={"username": "viewer1", "password": "ViewerPass1!"},
        )
        viewer_token = viewer_login.get_json()["token"]

        create_response = self.client.post(
            "/vehicles",
            json={"make": "Nissan", "model": "Navara", "year": 2022},
            headers=self.auth_headers(viewer_token),
        )

        self.assertEqual(create_response.status_code, 403)

    def test_credit_score_requires_auth_and_validates_numeric_input(self) -> None:
        unauthorized_response = self.client.post(
            "/credit-score",
            json={"income": 20000, "debt": 1000},
        )

        self.bootstrap_admin()
        token = self.login()
        bad_request_response = self.client.post(
            "/credit-score",
            json={"income": "bad-input", "debt": 1000},
            headers=self.auth_headers(token),
        )

        self.assertEqual(unauthorized_response.status_code, 401)
        self.assertEqual(bad_request_response.status_code, 400)
        self.assertIn("error", bad_request_response.get_json())


if __name__ == "__main__":
    unittest.main()
