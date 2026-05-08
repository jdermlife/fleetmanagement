from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1] / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

# Set test database before importing
os.environ["DATABASE_URL"] = "sqlite:///:memory:"


from main import create_app


class AuthTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = create_app({"TESTING": True})
        self.client = self.app.test_client()

    def test_register_endpoint_exists(self) -> None:
        response = self.client.post(
            "/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "password123",
            },
        )
        self.assertEqual(response.status_code, 201)

    def test_login_endpoint_exists(self) -> None:
        self.client.post(
            "/auth/register",
            json={
                "username": "loginuser",
                "email": "login@example.com",
                "password": "password123",
            },
        )
        response = self.client.post(
            "/auth/login",
            json={"username": "loginuser", "password": "password123"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.get_json())


if __name__ == "__main__":
    unittest.main()