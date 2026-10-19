from types import SimpleNamespace

from app.services import build_profile_completion_notification_service


class FakeDatabase:
    def __init__(self, user) -> None:
        self.user = user
        self.commits = 0
        self.refreshes = 0
        self.rollbacks = 0

    def get(self, _model, user_id):
        return self.user if self.user.id == user_id else None

    def commit(self) -> None:
        self.commits += 1

    def refresh(self, _user) -> None:
        self.refreshes += 1

    def rollback(self) -> None:
        self.rollbacks += 1


def _user():
    return SimpleNamespace(
        id=17,
        username="profile-owner",
        email="owner@example.com",
        build_profile_90_notification_sent_at=None,
    )


def test_sends_one_notice_when_build_profile_reaches_ninety_percent(monkeypatch) -> None:
    deliveries: list[tuple[str, str, str]] = []
    monkeypatch.delenv("BUILD_PROFILE_COMPLETION_NOTIFICATION_RECIPIENT", raising=False)
    monkeypatch.setattr(
        build_profile_completion_notification_service,
        "send_email",
        lambda recipient, subject, body: deliveries.append((recipient, subject, body)),
    )
    user = _user()
    db = FakeDatabase(user)

    sent_at = build_profile_completion_notification_service.notify_build_profile_completion(
        user.id,
        db,
        completion_percent=90,
        profile_id="PRO-90-001",
    )
    duplicate = build_profile_completion_notification_service.notify_build_profile_completion(
        user.id,
        db,
        completion_percent=96,
        profile_id="PRO-90-001",
    )

    assert sent_at is not None
    assert duplicate is None
    assert deliveries[0][0] == "JDioneda@gmail.com"
    assert "owner@example.com" in deliveries[0][2]
    assert "PRO-90-001" in deliveries[0][2]
    assert len(deliveries) == 1
    assert db.commits == 1
    assert db.refreshes == 1


def test_does_not_send_notice_below_ninety_percent(monkeypatch) -> None:
    deliveries = []
    monkeypatch.setattr(
        build_profile_completion_notification_service,
        "send_email",
        lambda *args: deliveries.append(args),
    )
    db = FakeDatabase(_user())

    result = build_profile_completion_notification_service.notify_build_profile_completion(
        17,
        db,
        completion_percent=89,
        profile_id="PRO-89-001",
    )

    assert result is None
    assert deliveries == []
    assert db.commits == 0


def test_email_failure_rolls_back_notification_without_raising(monkeypatch) -> None:
    def fail_delivery(*_args) -> None:
        raise RuntimeError("SMTP unavailable")

    monkeypatch.setattr(
        build_profile_completion_notification_service,
        "send_email",
        fail_delivery,
    )
    user = _user()
    db = FakeDatabase(user)

    result = build_profile_completion_notification_service.notify_build_profile_completion(
        user.id,
        db,
        completion_percent=100,
        profile_id="PRO-100-001",
    )

    assert result is None
    assert user.build_profile_90_notification_sent_at is None
    assert db.commits == 0
    assert db.rollbacks == 1