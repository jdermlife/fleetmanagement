from sqlalchemy import Column, DateTime, Float, Integer, String, TIMESTAMP, text

from app.database import Base


class GpsTrackingRecord(Base):
    __tablename__ = "gps_tracking"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, nullable=True)
    vehicle_label = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed_kph = Column(Float, nullable=False, default=0.0)
    heading = Column(String(32), nullable=False, default="")
    status = Column(String(100), nullable=False)
    route_label = Column(String(255), nullable=False, default="")
    geofence = Column(String(255), nullable=False, default="")
    recorded_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
