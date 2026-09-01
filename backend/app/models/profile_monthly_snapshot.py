from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


class ProfileMonthlySnapshot(Base):
    __tablename__ = "profile_monthly_snapshots"

    id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    snapshot_month = Column(
        Date,
        nullable=False,
    )

    financial_health_score = Column(
        Numeric(6, 2),
        nullable=True,
    )

    credit_health_score = Column(
        Numeric(6, 2),
        nullable=True,
    )

    net_worth_positioning_score = Column(
        Numeric(6, 2),
        nullable=True,
    )

    budget_tracking_score = Column(
        Numeric(6, 2),
        nullable=True,
    )

    loan_monitoring_score = Column(
        Numeric(6, 2),
        nullable=True,
    )

    bill_reminder_score = Column(
        Numeric(6, 2),
        nullable=True,
    )

    financial_health_summary = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )

    credit_health_summary = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )

    net_worth_summary = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )

    budget_tracking_summary = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )

    loan_monitoring_summary = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )

    bill_reminder_summary = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )

    profile_data = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
    )

    source_profile_id = Column(
        String(128),
        nullable=True,
    )

    source_loan_application_id = Column(
        Integer,
        ForeignKey(
            "loan_applications.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

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
            "user_id",
            "snapshot_month",
            name="uq_profile_monthly_snapshots_user_month",
        ),

        Index(
            "idx_profile_monthly_snapshots_user_month",
            "user_id",
            "snapshot_month",
        ),

        Index(
            "idx_profile_monthly_snapshots_loan",
            "source_loan_application_id",
        ),
    )