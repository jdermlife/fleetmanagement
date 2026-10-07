from datetime import datetime, timezone
from types import SimpleNamespace

from app.services import new_user_notification_service
from app.services.email_service import send_email


class FakeDatabase:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0

    def commit(self) -> None:
        self.commits += 1

    def refresh(self, _user) -> None:
        return None

    def rollback(self) -> None:
        self.rollbacks += 1


def test_notifies_both_admins_and_records_sent_time(monkeypatch) -> None:
    deliveries: list[tuple[tuple[str, ...], str, str]] = []
    monkeypatch.setattr(
        new_user_notification_service,
        "send_email",
        lambda recipients, subject, body: deliveries.append((recipients, subject, body)),
    )
    user = SimpleNamespace(
        id=7,
        username="new-user",
        email="new@example.com",
        role="subscriber_borrower",
        created_at=datetime(2026, 8, 6, tzinfo=timezone.utc),
        admin_user_notification_sent_at=None,
    )
    db = FakeDatabase()

    sent_at = new_user_notification_service.notify_admins_of_new_user(user, db)

    assert sent_at is not None
    assert deliveries[0][0] == (
        "jdioneda@gmail.com",
        "jdioneda@quantech.international",
    )
    assert "new@example.com" in deliveries[0][2]
    assert user.admin_user_notification_sent_at == sent_at
    assert db.commits == 1
    assert db.rollbacks == 0


def test_does_not_record_sent_time_when_delivery_fails(monkeypatch) -> None:
    def fail_delivery(*_args) -> None:
        raise RuntimeError("SMTP unavailable")

    monkeypatch.setattr(new_user_notification_service, "send_email", fail_delivery)
    user = SimpleNamespace(
        id=8,
        username="new-user",
        email="new@example.com",
        role="subscriber_lender",
        created_at=datetime(2026, 8, 6, tzinfo=timezone.utc),
        admin_user_notification_sent_at=None,
    )
    db = FakeDatabase()

    sent_at = new_user_notification_service.notify_admins_of_new_user(user, db)

    assert sent_at is None
    assert user.admin_user_notification_sent_at is None
    assert db.commits == 0
    assert db.rollbacks == 1


def test_email_transport_uses_both_envelope_recipients(monkeypatch) -> None:
    sent_to: list[str] = []

    class FakeSmtp:
        def __init__(self, *_args, **_kwargs) -> None:
            return None

        def starttls(self) -> None:
            return None

        def login(self, _username, _password) -> None:
            return None

        def send_message(self, _message, *, to_addrs) -> None:
            sent_to.extend(to_addrs)

        def quit(self) -> None:
            return None

    monkeypatch.setenv("SMTP_SERVER", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USERNAME", "sender@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    monkeypatch.setattr("app.services.email_service.smtplib.SMTP", FakeSmtp)

    send_email(
        ("jdioneda@gmail.com", "jdioneda@quantech.international"),
        "New user",
        "A user was created.",
    )

    assert sent_to == ["jdioneda@gmail.com", "jdioneda@quantech.international"]