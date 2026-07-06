from sqlalchemy import Boolean, Column, Date, Float, Integer, String, Text, TIMESTAMP, text

from app.database import Base


class FuelLog(Base):
    __tablename__ = "fuel_logs"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    vehicle = Column(String(255), nullable=False)
    fuel_card = Column(String(255), nullable=False)
    liters = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)
    notes = Column(Text, nullable=False, default="")
    theft_suspected = Column(Boolean, nullable=False, default=False)
    abnormal_refill = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
