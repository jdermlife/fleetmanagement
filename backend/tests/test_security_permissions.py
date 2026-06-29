from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.routes.security import _fallback_permissions_for_role_names, _user_permissions


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


if __name__ == "__main__":
    unittest.main()
