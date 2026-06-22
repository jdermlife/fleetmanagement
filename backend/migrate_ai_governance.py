"""One-time migration for AI governance tables."""

from app.database import engine
from app.models.ai_governance import AIFeedback, AIRequest, AIResponse


def run_migration() -> None:
    with engine.begin() as connection:
        AIRequest.__table__.create(bind=connection, checkfirst=True)
        AIResponse.__table__.create(bind=connection, checkfirst=True)
        AIFeedback.__table__.create(bind=connection, checkfirst=True)


if __name__ == "__main__":
    run_migration()
    print("AI governance migration completed successfully.")
