from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String, Text, func

from app.database import Base


class AIRequest(Base):
    __tablename__ = "ai_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    endpoint = Column(String(255), nullable=False)
    prompt = Column(Text, nullable=True)
    model = Column(String(120), nullable=False)
    cost = Column(Float, default=0.0, nullable=False)
    input_tokens = Column(Integer, default=0, nullable=False)
    output_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    status = Column(String(32), default="started", nullable=False)
    error_message = Column(Text, nullable=True)
    request_metadata = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_ai_requests_user_created", "user_id", "created_at"),
        Index("idx_ai_requests_model", "model"),
        Index("idx_ai_requests_status", "status"),
    )


class AIResponse(Base):
    __tablename__ = "ai_responses"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("ai_requests.id"), nullable=False)
    user_id = Column(Integer, nullable=True)
    model = Column(String(120), nullable=False)
    response_text = Column(Text, nullable=True)
    response_json = Column(Text, nullable=True)
    cost = Column(Float, default=0.0, nullable=False)
    input_tokens = Column(Integer, default=0, nullable=False)
    output_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    latency_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_ai_responses_request", "request_id"),
        Index("idx_ai_responses_user_created", "user_id", "created_at"),
        Index("idx_ai_responses_model", "model"),
    )


class AIFeedback(Base):
    __tablename__ = "ai_feedback"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("ai_requests.id"), nullable=True)
    response_id = Column(Integer, ForeignKey("ai_responses.id"), nullable=True)
    user_id = Column(Integer, nullable=True)
    rating = Column(Integer, nullable=False)
    feedback_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_ai_feedback_response", "response_id"),
        Index("idx_ai_feedback_user_created", "user_id", "created_at"),
    )
