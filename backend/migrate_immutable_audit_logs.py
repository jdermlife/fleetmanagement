"""One-time migration for immutable audit_logs table."""

from app.database import engine
from app.models.audit_log import AuditLog
from app.services.audit_log_service import create_immutable_audit_constraints


def run_migration() -> None:
    with engine.begin() as connection:
        AuditLog.__table__.create(bind=connection, checkfirst=True)
        create_immutable_audit_constraints(connection)


if __name__ == "__main__":
    run_migration()
    print("Immutable audit_logs migration completed successfully.")
