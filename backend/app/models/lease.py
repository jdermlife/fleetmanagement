from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base
from sqlalchemy import DateTime
from sqlalchemy.sql import func

created_at = Column(
    DateTime(timezone=True),
    server_default=func.now()
)

class Leasee(Base):
    __tablename__ = "lease_scorecards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    customer_name = Column(String(255))
    company_name = Column(String(255))
    vehicle_type = Column(String(100))
    vehicle_value = Column(Float)
    down_payment = Column(Float)
    requested_amount = Column(Float)
    monthly_income = Column(Float)
    existing_debt = Column(Float)
    lease_term_months = Column(Integer)
    credit_score = Column(Integer)
    years_in_business = Column(Float)
    employment_years = Column(Float)
    vehicle_age = Column(Integer)
    vehicle_use = Column(Integer)
    estimated_residual_value = Column(Float)
    final_score = Column(Float)
    risk_grade = Column(String(50))
    decision = Column(String(50))
    monthly_estimated_payment = Column(Float)
    loan_to_value = Column(Float)
    summary = Column(String(500))
    # Optional: add created_at timestamp if you want to track record creation
    # from sqlalchemy.sql import func
    # created_at = Column(DateTime(timezone=True), server_default=func.now())
