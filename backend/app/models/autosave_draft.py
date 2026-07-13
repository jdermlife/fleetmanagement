from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    func,
)

from app.database import Base


class AutosaveDraft(Base):
    """Short-lived, user-owned form state saved by the autosave API."""

    __tablename__ = "autosave_drafts"

    id = Column(Integer, primary_key=True)
    owner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scope = Column(String(128), nullable=False)
    entity_key = Column(String(255), nullable=False)
    payload = Column(JSON, nullable=False)
    revision = Column(Integer, nullable=False, default=1)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "owner_id",
            "scope",
            "entity_key",
            name="uq_autosave_drafts_owner_scope_entity",
        ),
        CheckConstraint("revision >= 1", name="chk_autosave_drafts_revision"),
        Index("idx_autosave_drafts_expires_at", "expires_at"),
    )
