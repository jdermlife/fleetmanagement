from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class LoanApplication(Base):
    __tablename__ = "loan_applications"

    id = Column(Integer, primary_key=True, index=True)
    application_no = Column(String, unique=True, index=True)

    status = Column(String)
    product_type = Column(String)

    borrower_name = Column(String)
    email = Column(String)
    phone = Column(String)
    gov_id = Column(String)
    address = Column(Text)

    monthly_income = Column(Float)
    other_income = Column(Float)
    debt_obligations = Column(Float)

    loan_amount = Column(Float)
    term_months = Column(Integer)
    interest_rate = Column(Float)
    purpose = Column(String)

    vehicle_info = Column(String)
    appraised_value = Column(Float)

    committee_remarks = Column(Text)
    executive_approval = Column(Boolean, default=False)

    dti = Column(Float)
    dsr = Column(Float)
    ltv = Column(Float)

    scorecard_total = Column(Integer)
    ai_probability = Column(Float)

    requirements = Column(JSONB)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    credit_scores = relationship(
        "CreditScore",
        back_populates="loan_application",
        cascade="all, delete-orphan",
    )
    fraud_scores = relationship(
        "FraudScore",
        back_populates="loan_application",
        cascade="all, delete-orphan",
    )
    social_scores = relationship(
        "SocialScore",
        back_populates="loan_application",
        cascade="all, delete-orphan",
    )
    psychometric_scores = relationship(
        "PsychometricScore",
        back_populates="loan_application",
        cascade="all, delete-orphan",
    )
    credit_bureau_reports = relationship(
        "CreditBureauReport",
        back_populates="loan_application",
        cascade="all, delete-orphan",
    )
    collateral_scores = relationship(
        "CollateralScore",
        back_populates="loan_application",
        cascade="all, delete-orphan",
    )
    profitability_scores = relationship(
        "ProfitabilityScore",
        back_populates="loan_application",
        cascade="all, delete-orphan",
    )
    relationship_scores = relationship(
        "RelationshipScore",
        back_populates="loan_application",
        cascade="all, delete-orphan",
    )
    ai_recommendations = relationship(
        "AIRecommendation",
        back_populates="loan_application",
        cascade="all, delete-orphan",
    )
    overall_scores = relationship(
        "OverallScore",
        back_populates="loan_application",
        cascade="all, delete-orphan",
    )
    decision_audit_trail = relationship(
        "DecisionAuditTrail",
        back_populates="loan_application",
        cascade="all, delete-orphan",
    )


class CreditScore(Base):
    __tablename__ = "credit_scores"

    id = Column(BigInteger, primary_key=True)
    loan_application_id = Column(
        Integer,
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    character_score = Column(Numeric(10, 2))
    capacity_score = Column(Numeric(10, 2))
    capital_score = Column(Numeric(10, 2))
    collateral_score = Column(Numeric(10, 2))
    conditions_score = Column(Numeric(10, 2))
    bureau_score = Column(Numeric(10, 2))
    internal_score = Column(Numeric(10, 2))
    total_credit_score = Column(Numeric(10, 2))
    credit_grade = Column(String(10))
    model_version = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    loan_application = relationship("LoanApplication", back_populates="credit_scores")


class FraudScore(Base):
    __tablename__ = "fraud_scores"

    id = Column(BigInteger, primary_key=True)
    loan_application_id = Column(
        Integer,
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    identity_score = Column(Numeric(10, 2))
    document_score = Column(Numeric(10, 2))
    geo_location_score = Column(Numeric(10, 2))
    device_score = Column(Numeric(10, 2))
    duplicate_application_score = Column(Numeric(10, 2))
    overall_fraud_score = Column(Numeric(10, 2))
    fraud_risk_level = Column(String(50))
    fraud_flags = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    loan_application = relationship("LoanApplication", back_populates="fraud_scores")


class SocialScore(Base):
    __tablename__ = "social_scores"

    id = Column(BigInteger, primary_key=True)
    loan_application_id = Column(
        Integer,
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    residence_stability_score = Column(Numeric(10, 2))
    employment_stability_score = Column(Numeric(10, 2))
    family_stability_score = Column(Numeric(10, 2))
    education_score = Column(Numeric(10, 2))
    banking_relationship_score = Column(Numeric(10, 2))
    overall_social_score = Column(Numeric(10, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    loan_application = relationship("LoanApplication", back_populates="social_scores")


class PsychometricScore(Base):
    __tablename__ = "psychometric_scores"

    id = Column(BigInteger, primary_key=True)
    loan_application_id = Column(
        Integer,
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    discipline_score = Column(Numeric(10, 2))
    planning_score = Column(Numeric(10, 2))
    responsibility_score = Column(Numeric(10, 2))
    honesty_score = Column(Numeric(10, 2))
    resilience_score = Column(Numeric(10, 2))
    overall_psychometric_score = Column(Numeric(10, 2))
    questionnaire_answers = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    loan_application = relationship(
        "LoanApplication",
        back_populates="psychometric_scores",
    )


class CreditBureauReport(Base):
    __tablename__ = "credit_bureau_reports"

    id = Column(BigInteger, primary_key=True)
    loan_application_id = Column(
        Integer,
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bureau_name = Column(String(100))
    bureau_score = Column(Numeric(10, 2))
    total_loans = Column(Integer)
    active_loans = Column(Integer)
    closed_loans = Column(Integer)
    delinquent_accounts = Column(Integer)
    defaulted_accounts = Column(Integer)
    outstanding_balance = Column(Numeric(18, 2))
    report_json = Column(JSONB)
    report_date = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    loan_application = relationship(
        "LoanApplication",
        back_populates="credit_bureau_reports",
    )


class CollateralScore(Base):
    __tablename__ = "collateral_scores"

    id = Column(BigInteger, primary_key=True)
    loan_application_id = Column(
        Integer,
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ltv_score = Column(Numeric(10, 2))
    asset_quality_score = Column(Numeric(10, 2))
    marketability_score = Column(Numeric(10, 2))
    insurance_score = Column(Numeric(10, 2))
    overall_collateral_score = Column(Numeric(10, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    loan_application = relationship(
        "LoanApplication",
        back_populates="collateral_scores",
    )


class ProfitabilityScore(Base):
    __tablename__ = "profitability_scores"

    id = Column(BigInteger, primary_key=True)
    loan_application_id = Column(
        Integer,
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    projected_interest_income = Column(Numeric(18, 2))
    fee_income = Column(Numeric(18, 2))
    expected_loss = Column(Numeric(18, 2))
    operating_cost = Column(Numeric(18, 2))
    funding_cost = Column(Numeric(18, 2))
    projected_profit = Column(Numeric(18, 2))
    profitability_score = Column(Numeric(10, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    loan_application = relationship(
        "LoanApplication",
        back_populates="profitability_scores",
    )


class RelationshipScore(Base):
    __tablename__ = "relationship_scores"

    id = Column(BigInteger, primary_key=True)
    loan_application_id = Column(
        Integer,
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_since = Column(Date)
    number_of_accounts = Column(Integer)
    deposit_balance = Column(Numeric(18, 2))
    prior_loans = Column(Integer)
    relationship_score = Column(Numeric(10, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    loan_application = relationship(
        "LoanApplication",
        back_populates="relationship_scores",
    )


class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"

    id = Column(BigInteger, primary_key=True)
    loan_application_id = Column(
        Integer,
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recommendation = Column(String(50))
    confidence_score = Column(Numeric(10, 2))
    explanation = Column(Text)
    suggested_amount = Column(Numeric(18, 2))
    ai_model = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    loan_application = relationship(
        "LoanApplication",
        back_populates="ai_recommendations",
    )


class OverallScore(Base):
    __tablename__ = "overall_scores"

    id = Column(BigInteger, primary_key=True)
    loan_application_id = Column(
        Integer,
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    credit_score = Column(Numeric(10, 2))
    fraud_score = Column(Numeric(10, 2))
    social_score = Column(Numeric(10, 2))
    psychometric_score = Column(Numeric(10, 2))
    collateral_score = Column(Numeric(10, 2))
    profitability_score = Column(Numeric(10, 2))
    relationship_score = Column(Numeric(10, 2))
    final_score = Column(Numeric(10, 2))
    final_grade = Column(String(10))
    final_decision = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    loan_application = relationship("LoanApplication", back_populates="overall_scores")


class DecisionAuditTrail(Base):
    __tablename__ = "decision_audit_trail"

    id = Column(BigInteger, primary_key=True)
    loan_application_id = Column(
        Integer,
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_status = Column(String(50))
    new_status = Column(String(50))
    remarks = Column(Text)
    changed_by = Column(String(255))
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    loan_application = relationship(
        "LoanApplication",
        back_populates="decision_audit_trail",
    )
