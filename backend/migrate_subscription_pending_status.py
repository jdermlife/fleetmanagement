"""Allow PENDING value in subscriptions.status check constraint."""

from __future__ import annotations

from app.database import engine


SQL = [
    "ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check",
    "ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS ck_subscriptions_status",
    (
        "ALTER TABLE subscriptions "
        "ADD CONSTRAINT ck_subscriptions_status "
        "CHECK (status IN ('PENDING','TRIAL','ACTIVE','SUSPENDED','EXPIRED','CANCELLED'))"
    ),
]


def run() -> None:
    with engine.begin() as connection:
        for statement in SQL:
            connection.exec_driver_sql(statement)


if __name__ == '__main__':
    run()
    print('subscriptions status constraint updated with PENDING')
