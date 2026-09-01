from datetime import date

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
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


def _snapshot_month_default(context):
    observed_at = context.get_current_parameters().get("observed_at")
    if observed_at is None:
        return date.today().replace(day=1)
    return observed_at.date().replace(day=1)


class HistoryConfiguration(Base):
    __tablename__ = "history_configuration"

    module_name = Column(String(64), primary_key=True)

    retention_months = Column(
        Integer,
        nullable=False,
        default=24,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "retention_months > 0",
            name="chk_history_configuration_retention_months",
        ),
    )


class ProfileHistory(Base):
    __tablename__ = "profile_history"

    id = Column(
        Integer,
        primary_key=True,
    )

    owner_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    loan_application_id = Column(
        Integer,
        ForeignKey(
            "loan_applications.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    category = Column(
        String(64),
        nullable=False,
    )

    snapshot_month = Column(
        Date,
        default=_snapshot_month_default,
        nullable=False,
    )

    observed_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    payload = Column(
        JSON,
        nullable=False,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (

        CheckConstraint(
            "category IN ("
            "'budget_snapshot', "
            "'net_worth_snapshot', "
            "'wealth_building_score', "
            "'financial_health_score', "
            "'credit_health_score', "
            "'bill_payment', "
            "'loan_monitoring', "
            "'goal_tracking', "
            "'ai_recommendation', "
            "'certification', "
            "'risk_assessment'"
            ")",
            name="chk_profile_history_category",
        ),

        # One record per user/category/month
        UniqueConstraint(
            "owner_id",
            "snapshot_month",
            "category",
            name="uq_profile_history_owner_month_category",
        ),

        Index(
            "idx_profile_history_profile_category_observed",
            "loan_application_id",
            "category",
            "observed_at",
        ),

        Index(
            "idx_profile_history_owner_profile",
            "owner_id",
            "loan_application_id",
        ),

        Index(
            "idx_profile_history_owner_month",
            "owner_id",
            "snapshot_month",
        ),
    )