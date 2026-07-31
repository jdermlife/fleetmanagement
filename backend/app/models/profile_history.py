from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, JSON, String, func

from app.database import Base


class HistoryConfiguration(Base):
    __tablename__ = "history_configuration"

    module_name = Column(String(64), primary_key=True)
    retention_months = Column(Integer, nullable=False, default=24)
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

    id = Column(Integer, primary_key=True)
    owner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    loan_application_id = Column(
        Integer,
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category = Column(String(64), nullable=False)
    observed_at = Column(DateTime(timezone=True), nullable=False)
    payload = Column(JSON, nullable=False)
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
    )