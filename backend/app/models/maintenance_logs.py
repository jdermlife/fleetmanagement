from sqlalchemy import Column, Date, Float, Integer, String, Text, TIMESTAMP, text

from app.database import Base


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, nullable=True)
    vehicle_label = Column(String(255), nullable=False)
    maintenance_type = Column(String(255), nullable=False)
    service_date = Column(Date, nullable=False)
    next_service_date = Column(Date, nullable=True)
    odometer_km = Column(Float, nullable=False, default=0.0)
    vendor = Column(String(255), nullable=False, default="")
    estimated_cost = Column(Float, nullable=False, default=0.0)
    status = Column(String(100), nullable=False)
    notes = Column(Text, nullable=False, default="")
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
