from __future__ import annotations

import unittest
from types import SimpleNamespace

import tests._warning_filters  # noqa: F401

from app.routes.security import (
    _fallback_permissions_for_role_names,
    _resolve_registration_role,
    _user_permissions,
)


class SecurityPermissionTests(unittest.TestCase):
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
