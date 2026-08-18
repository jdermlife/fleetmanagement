from __future__ import annotations

import importlib
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

import tests._warning_filters  # noqa: F401


class FastAPIAuthSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if sys.version_info >= (3, 13):
            raise unittest.SkipTest(
                "FastAPI auth smoke tests require Python 3.11 or 3.12 runtime."
            )

        try:
            from fastapi.testclient import TestClient
        except Exception as exc:
            raise unittest.SkipTest(
                f"FastAPI test client unavailable in this environment: {exc}"
            ) from exc

        cls._original_env = {
            "ENFORCE_AUTH": os.getenv("ENFORCE_AUTH"),
            "SECRET_KEY": os.getenv("SECRET_KEY"),
            "ENABLE_RATE_LIMIT": os.getenv("ENABLE_RATE_LIMIT"),
            "DATABASE_URL": os.getenv("DATABASE_URL"),
        }

        os.environ["ENFORCE_AUTH"] = "true"
        os.environ["SECRET_KEY"] = "test-secret-key-for-fastapi-auth-smoke"
        os.environ["ENABLE_RATE_LIMIT"] = "false"
        os.environ["DATABASE_URL"] = "sqlite://"

        import security.auth as auth_module
        import app.fastapi_auth as fastapi_auth_module
        import main as main_module

        cls.auth_module = importlib.reload(auth_module)
        cls.fastapi_auth_module = fastapi_auth_module
        cls.main_module = importlib.reload(main_module)
        cls.client = TestClient(cls.main_module.app)
        cls.active_user = SimpleNamespace(
            is_active=True,
            is_deleted=False,
            account_access_expires_at=None,
        )
        cls.db = MagicMock()
        cls.db.query.return_value.filter.return_value.first.return_value = cls.active_user
        cls.get_db = cls.fastapi_auth_module.get_db
        cls.main_module.app.dependency_overrides[cls.get_db] = lambda: cls.db

    @classmethod
    def tearDownClass(cls) -> None:
        cls.main_module.app.dependency_overrides.pop(cls.get_db, None)
        for key, value in cls._original_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def test_missing_token_returns_401(self) -> None:
        response = self.client.get("/database/status")
        self.assertEqual(response.status_code, 401)

    def test_invalid_token_returns_401(self) -> None:
        response = self.client.get(
            "/database/status",
            headers={"Authorization": "Bearer not-a-real-token"},
        )
        self.assertEqual(response.status_code, 401)

    def test_admin_token_can_access_protected_route(self) -> None:
        token = self.auth_module.create_token(1, "admin.user", "Admin", expires_in_hours=1)
        response = self.client.get(
            "/database/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, 200)

    def test_viewer_token_cannot_create_driver(self) -> None:
        token = self.auth_module.create_token(2, "viewer.user", "Viewer", expires_in_hours=1)
        response = self.client.post(
            "/drivers",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "firstName": "Smoke",
                "lastName": "Tester",
                "licenseNumber": "LIC-SMOKE-001",
                "phone": "+630000000000",
                "email": "smoke.tester@example.com",
                "status": "Active",
            },
        )

        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
