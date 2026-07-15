from fastapi import APIRouter, Depends, Query

from app.database import SessionLocal
from app.fastapi_auth import require_roles
from app.models.audit_log import AuditLog

router = APIRouter()


@router.get(
    "/audit-logs",
    dependencies=[Depends(require_roles("admin"))],
)
def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    table_name: str | None = Query(None),
    user_id: int | None = Query(None),
):
    db = SessionLocal()
    try:
        query = db.query(AuditLog)

        if table_name:
            query = query.filter(AuditLog.table_name == table_name)

        if user_id is not None:
            query = query.filter(AuditLog.user_id == user_id)

        rows = query.order_by(AuditLog.id.desc()).offset(offset).limit(limit).all()

        return [
            {
                "id": row.id,
                "user_id": row.user_id,
                "action": row.action,
                "table_name": row.table_name,
                "record_id": row.record_id,
                "old_value": row.old_value,
                "new_value": row.new_value,
                "ip_address": row.ip_address,
                "device": row.device,
                "created_at": row.created_at,
            }
            for row in rows
        ]
    finally:
        db.close()
