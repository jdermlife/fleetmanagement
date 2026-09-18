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
    created_by = Column(
    Integer,
    ForeignKey("users.id")
    )

    created_by_user_id = Column(
    Integer,
    ForeignKey("users.id"),
    index=True,
    )

    updated_by = Column(
    Integer,
    ForeignKey("users.id")
    )

    reviewed_by = Column(
    Integer,
    ForeignKey("users.id")
    )

    approved_by = Column(
    Integer,
    ForeignKey("users.id")
    )

    released_by = Column(
    Integer,
    ForeignKey("users.id")
    )

    deleted_by = Column(
    Integer,
    ForeignKey("users.id")
    )

    status = Column(String)
    product_type = Column(String)

    client_name = Column(String(255))
    borrower_name = Column(String)
    email = Column(String)
    phone = Column(String)
    gov_id = Column(String)
    address = Column(Text)

    last_name = Column(String)
    first_name = Column(String)
    middle_name = Column(String)
    date_of_birth = Column(Date)
    place_of_birth = Column(String)
    age = Column(Integer)
    gender = Column(String)
    citizenship = Column(String)
    number_of_dependents = Column(Integer)
    marital_status = Column(String)
    mothers_maiden_name = Column(String)
    mobile_number = Column(String)
    home_phone_number = Column(String)
    tin = Column(String)
    sss_gsis_number = Column(String)
    other_government_id = Column(String)
    id_number = Column(String)
    issue_date = Column(Date)
    expiry_date = Column(Date)
    present_address = Column(Text)
    permanent_address = Column(Text)
    mailing_address = Column(Text)
    length_of_stay = Column(String)
    home_ownership = Column(String)
    educational_attainment = Column(String)
    number_of_vehicles_owned = Column(Integer)
    recent_photo_uploaded = Column(Boolean)

    employment_status = Column(String)
    employer_business_name = Column(String)
    office_address = Column(Text)
    occupation = Column(String)
    position = Column(String)
    nature_of_work_business = Column(String)
    date_hired = Column(Date)
    office_phone_number = Column(String)
    previous_employer = Column(String)
    total_years_working = Column(String)
    gross_monthly_income = Column(Numeric)
    monthly_living_expenses = Column(Numeric)
    other_sources_of_income = Column(Text)
    investment_income = Column(Numeric)
    business_income = Column(Numeric)
    pension_income = Column(Numeric)

    monthly_income = Column(Float)
    other_income = Column(Float)
    debt_obligations = Column(Float)

    loan_amount = Column(Float)
    term_months = Column(Integer)
    interest_rate = Column(Float)
    purpose = Column(String)

    vehicle_info = Column(String)
    appraised_value = Column(Float)

    insurance = Column(String)
    registration = Column(String)
    property_address = Column(Text)
    registered_owner = Column(String)
    lot_number = Column(String)
    block_number = Column(String)
    tct_cct_number = Column(String)

    spouse_name = Column(String)
    spouse_date_of_birth = Column(Date)
    spouse_place_of_birth = Column(String)
    spouse_citizenship = Column(String)
    spouse_mobile_number = Column(String)
    spouse_present_address = Column(Text)
    spouse_employer_business_name = Column(String)
    spouse_office_address = Column(Text)
    spouse_occupation = Column(String)
    spouse_position = Column(String)
    spouse_nature_of_work = Column(String)
    spouse_years_with_employer = Column(String)
    spouse_previous_employer = Column(String)
    spouse_total_years_working = Column(String)
    spouse_gross_monthly_income = Column(Numeric)
    spouse_monthly_expenses = Column(Numeric)
    spouse_other_income_sources = Column(Text)

    credit_card_issuer = Column(String)
    credit_card_number = Column(String)
    credit_limit = Column(Numeric)
    outstanding_balance = Column(Numeric)
    member_since = Column(Date)
    bank_branch = Column(String)
    account_type = Column(String)
    account_number = Column(String)
    current_balance = Column(Numeric)
    loan_lender = Column(String)
    loan_type = Column(String)
    loan_current_balance = Column(Numeric)
    loan_monthly_amortization = Column(Numeric)

    co_borrower_name = Column(String)
    co_borrower_relationship = Column(String)
    co_borrower_monthly_income = Column(Numeric)
    guarantor_name = Column(String)
    guarantor_mobile = Column(String)
    guarantor_address = Column(Text)
    guarantor_relationship = Column(String)
    guarantor_monthly_income = Column(Numeric)

    enhanced_due_diligence = Column(Text)
    identity_verification_status = Column(String)
    document_verification_status = Column(String)
    banking_verification_status = Column(String)
    device_verification_status = Column(String)
    questionnaire_responses = Column(JSONB)
    asset_details = Column(JSONB)
    liability_details = Column(JSONB)
    additional_loan_details = Column(JSONB)
    bank_account_details = Column(JSONB)
    credit_history_details = Column(JSONB)
    financial_goal_target_amount = Column(Numeric)
    financial_goal_target_period = Column(Integer)
    financial_goal_target_period_unit = Column(String)

    committee_remarks = Column(Text)
    executive_approval = Column(Boolean, default=False)

    credit_officer = Column(String)
    branch_manager = Column(String)
    credit_committee = Column(String)
    bank_account = Column(String)
    disbursement_account_number = Column(String)
    disbursement_date = Column(Date)
    booking_date = Column(Date)
    start_repayment_date = Column(Date)
    first_payment_date = Column(Date)
    all_required_documents_provided = Column(Boolean)
    all_signatures_collected = Column(Boolean)
    credit_committee_approved = Column(Boolean)
    executive_approval_obtained = Column(Boolean)
    collateral_documentation_ready = Column(Boolean)

    dti = Column(Float)
    dsr = Column(Float)
    ltv = Column(Float)

    scorecard_total = Column(Integer)
    ai_probability = Column(Float)

    requirements = Column(JSONB)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    creator_user = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="joined",
    )

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
    scorecard_snapshots = relationship(
        "LoanScorecardSnapshot",
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
    composite_score = Column(Numeric(10, 2))
    final_grade = Column(String(10))
    final_rating = Column(String(50))
    final_decision = Column(String(50))
    wealth_building_score = Column(Numeric(10, 2))
    wealth_grade = Column(String(10))
    wealth_rating = Column(String(50))
    wealth_component_scores = Column(JSONB)
    wealth_calculated_at = Column(DateTime(timezone=True))
    wealth_certification_status = Column(String(30))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    loan_application = relationship("LoanApplication", back_populates="overall_scores")


class LoanScorecardSnapshot(Base):
    __tablename__ = "loan_scorecard_snapshots"

    id = Column(BigInteger, primary_key=True)
    loan_application_id = Column(
        Integer,
        ForeignKey("loan_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    snapshot_date = Column(Date, nullable=False, index=True)
    finalized_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    finalized_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    final_status = Column(String(30), nullable=False, default="FINAL", server_default="FINAL")
    overall_score = Column(Numeric(10, 2))
    grade = Column(String(20))
    rating = Column(String(100))
    decision = Column(String(50))
    scorecard_payload = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    loan_application = relationship("LoanApplication", back_populates="scorecard_snapshots")


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
