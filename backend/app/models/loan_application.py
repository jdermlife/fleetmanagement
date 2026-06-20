from sqlalchemy import Column, Integer, String, Float, Boolean, Text, JSON, DateTime
from sqlalchemy.sql import func
from app.database import Base

class LoanApplication(Base):
    __tablename__ = "loan_applications"

    id = Column(Integer, primary_key=True, index=True)

    application_no = Column(String)

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

    requirements = Column(JSON)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
