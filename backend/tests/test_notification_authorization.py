from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.fastapi_auth import get_db
from app.routes.notifications import router
from security.auth import create_token


class ExpiredAccountQuery:
    def __init__(self, account):
        self.account = account

    def filter(self, *_args):
        return self

    def first(self):
        return self.account


class ExpiredAccountDatabase:
    def __init__(self):
        self.account = SimpleNamespace(
            id=42,
            is_active=True,
            is_deleted=False,
            account_status="ACTIVE",
            account_access_expires_at=datetime.now(timezone.utc) - timedelta(days=2),
            subscription=None,
        )

    def query(self, *_args):
        return ExpiredAccountQuery(self.account)

    def commit(self):
        return None


class NotificationAuthorizationTests(unittest.TestCase):
    def test_expired_unpaid_account_cannot_access_user_notifications(self):
        requests = [
        ("get", "/notifications/preferences", None),
        ("put", "/notifications/preferences/billing", {}),
        ("get", "/notifications/me", None),
        ("post", "/notifications/me/1/read", None),
        ("post", "/notifications/me/read-all", None),
        ("get", "/notifications/me/unread-count", None),
        ]

        for method, path, payload in requests:
            with self.subTest(method=method, path=path):
                app = FastAPI()
                app.include_router(router)
                database = ExpiredAccountDatabase()
                app.dependency_overrides[get_db] = lambda: database
                client = TestClient(app)
                token = create_token(42, "expired-user", "subscriber", expires_in_hours=1)

                response = client.request(
                    method,
                    path,
                    headers={"Authorization": f"Bearer {token}"},
                    json=payload,
                )

                self.assertEqual(response.status_code, 403)
                self.assertFalse(database.account.is_active)
                self.assertEqual(database.account.account_status, "SUSPENDED")


if __name__ == "__main__":
    unittest.main()