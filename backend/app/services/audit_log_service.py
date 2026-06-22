import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


MAX_AUDIT_VALUE_LENGTH = 20000


def _safe_json(value: Any) -> str | None:
    if value is None:
        return None

    try:
        serialized = json.dumps(value, default=str)
    except Exception:
        serialized = str(value)

    if len(serialized) > MAX_AUDIT_VALUE_LENGTH:
        return serialized[:MAX_AUDIT_VALUE_LENGTH] + "...[truncated]"

    return serialized


def write_audit_log(
    db: Session,
    *,
    user_id: int | None,
    action: str,
    table_name: str,
    record_id: str | None,
    old_value: Any = None,
    new_value: Any = None,
    ip_address: str | None = None,
    device: str | None = None,
) -> None:
    entry = AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_value=_safe_json(old_value),
        new_value=_safe_json(new_value),
        ip_address=ip_address,
        device=device,
    )
    db.add(entry)
    db.commit()


def create_immutable_audit_constraints(connection) -> None:
    """Enforce audit_logs immutability at database level."""
    dialect = connection.dialect.name

    if dialect == "postgresql":
        connection.execute(
            text(
                """
                CREATE OR REPLACE FUNCTION prevent_audit_logs_mutation()
                RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION 'audit_logs is immutable: % not allowed', TG_OP;
                END;
                $$ LANGUAGE plpgsql;
                """
            )
        )

        connection.execute(
            text(
                """
                DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
                CREATE TRIGGER trg_audit_logs_no_update
                BEFORE UPDATE ON audit_logs
                FOR EACH ROW EXECUTE FUNCTION prevent_audit_logs_mutation();
                """
            )
        )

        connection.execute(
            text(
                """
                DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;
                CREATE TRIGGER trg_audit_logs_no_delete
                BEFORE DELETE ON audit_logs
                FOR EACH ROW EXECUTE FUNCTION prevent_audit_logs_mutation();
                """
            )
        )

    elif dialect == "sqlite":
        connection.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_update
                BEFORE UPDATE ON audit_logs
                BEGIN
                    SELECT RAISE(FAIL, 'audit_logs is immutable: UPDATE not allowed');
                END;
                """
            )
        )

        connection.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_delete
                BEFORE DELETE ON audit_logs
                BEGIN
                    SELECT RAISE(FAIL, 'audit_logs is immutable: DELETE not allowed');
                END;
                """
            )
        )
