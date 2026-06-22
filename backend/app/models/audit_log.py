from sqlalchemy import Column, DateTime, Integer, String, Text, func, Index

from app.database import Base


class AuditLog(Base):
    """Immutable audit log table. Rows are append-only."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    action = Column(String(255), nullable=False)
    table_name = Column(String(255), nullable=False)
    record_id = Column(String(255), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    device = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_audit_logs_created_at", "created_at"),
        Index("idx_audit_logs_user_id", "user_id"),
        Index("idx_audit_logs_table_record", "table_name", "record_id"),
    )
