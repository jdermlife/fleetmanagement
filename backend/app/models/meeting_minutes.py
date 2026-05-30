from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func

from app.database import Base


class MeetingMinutes(Base):
    __tablename__ = "meeting_minutes"

    id = Column(Integer, primary_key=True, index=True)

    meeting_title = Column(String(255))

    meeting_date = Column(DateTime)

    transcript = Column(Text)

    summary = Column(Text)

    action_items = Column(Text)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )