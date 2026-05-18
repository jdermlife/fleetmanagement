from sqlalchemy import Column, Integer, String, TIMESTAMP, text
from app.database import Base

class Driver(Base):

    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)

    first_name = Column(String(100))

    last_name = Column(String(100))

    license_number = Column(String(100), unique=True)

    phone = Column(String(50))

    email = Column(String(100))

    status = Column(String(50), server_default="active")

    created_at = Column(
        TIMESTAMP,
        server_default=text("CURRENT_TIMESTAMP")
    )