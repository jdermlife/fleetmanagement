from __future__ import annotations

import unittest
from types import SimpleNamespace

import tests._warning_filters  # noqa: F401
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routes.security import (
    _fallback_permissions_for_role_names,
    _resolve_registration_role,
    _user_permissions,
    admin_router,
    get_db,
)
from security.auth import create_token


class SecurityPermissionTests(unittest.TestCase):
    def test_user_management_endpoint_is_admin_only(self) -> None:
        class EmptyQuery:
            def order_by(self, *_args):
                return self

            def all(self):
                return []

        class EmptyDatabase:
            def query(self, *_args):
                return EmptyQuery()

        def empty_database_override():
            yield EmptyDatabase()

        app = FastAPI()
        app.include_router(admin_router, prefix="/api")
        app.dependency_overrides[get_db] = empty_database_override
        client = TestClient(app)

        subscriber_token = create_token(42, "subscriber", "subscriber", expires_in_hours=1)
        subscriber_response = client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {subscriber_token}"},
        )
        self.assertEqual(subscriber_response.status_code, 403)

        admin_token = create_token(1, "admin", "admin", expires_in_hours=1)
        admin_response = client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(admin_response.status_code, 200)
        self.assertEqual(admin_response.json(), {"users": []})

    def test_subscriber_role_maps_to_repository_permissions(self) -> None:
        permissions = _fallback_permissions_for_role_names(["subscriber"])

        self.assertIn("read:loans", permissions)
        self.assertIn("create:loans", permissions)
        self.assertIn("edit:loans", permissions)
        self.assertIn("export:loans", permissions)

    def test_user_permissions_fall_back_to_role_name_when_user_roles_are_empty(self) -> None:
        user = SimpleNamespace(
            username="maker456",
            role="SUBSCRIBER",
            role_ref=None,
            roles=[],
        )
        fake_db = SimpleNamespace()

        permissions = _user_permissions(user, fake_db)

        self.assertIn("read:loans", permissions)
        self.assertIn("create:loans", permissions)
        self.assertIn("edit:loans", permissions)

    def test_subscriber_borrower_role_is_limited(self) -> None:
        permissions = _fallback_permissions_for_role_names(["subscriber_borrower"])

        self.assertIn("read:loans", permissions)
        self.assertIn("create:loans", permissions)
        self.assertIn("edit:loans", permissions)
        self.assertNotIn("export:loans", permissions)
        self.assertNotIn("read:analytics", permissions)

    def test_registration_role_maps_borrower_and_lender_types(self) -> None:
        self.assertEqual(_resolve_registration_role("borrower"), "subscriber_borrower")
        self.assertEqual(_resolve_registration_role("lender"), "subscriber_lender")


if __name__ == "__main__":
    unittest.main()
