from sqlalchemy import Column, Date, Float, Integer, String, Text, TIMESTAMP, text

from app.database import Base


class InsuranceRecord(Base):
    __tablename__ = "insurance_records"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, nullable=True)
    vehicle_label = Column(String(255), nullable=False)
    provider = Column(String(255), nullable=False)
    policy_number = Column(String(255), nullable=False)
    coverage_type = Column(String(255), nullable=False)
    premium_amount = Column(Float, nullable=False, default=0.0)
    insured_value = Column(Float, nullable=False, default=0.0)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(100), nullable=False)
    contact_person = Column(String(255), nullable=False, default="")
    notes = Column(Text, nullable=False, default="")
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
