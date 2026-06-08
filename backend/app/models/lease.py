from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class Leasee(Base):
    __tablename__ = "lease"

    id = Column(Integer, primary_key=True, index=True)

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
    years_in_business = Column(Integer)
    employment_years = Column(Integer)
    vehicle_age = Column(Integer)
    vehicles_use = Column(Integer)
    estimated_residual_value = Column(Float)
    final_score = Column(Float)
    risk_grade = Column(String(20))
    decision = Column(String(20))
    monthly_estimated_payment = Column(Float)
    loan_to_value = Column(Float)
    summary = Column(String(500))
    # Optional: add created_at timestamp if you want to track record creation
    # from sqlalchemy.sql import func
    # created_at = Column(DateTime(timezone=True), server_default=func.now())
