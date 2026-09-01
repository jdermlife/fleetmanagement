"""Create profile history storage and seed category retention settings."""

from sqlalchemy import select

from app.database import engine
from app.models.loan_application import LoanApplication  # noqa: F401
from app.models.profile_history import HistoryConfiguration, ProfileHistory
from app.models.profile_monthly_snapshot import ProfileMonthlySnapshot
from app.models.users import User  # noqa: F401
from app.schemas.profile_history_schema import HistoryCategory


DEFAULT_RETENTION_MONTHS = 24


def run_migration() -> None:
    with engine.begin() as connection:
        HistoryConfiguration.__table__.create(bind=connection, checkfirst=True)
        ProfileHistory.__table__.create(bind=connection, checkfirst=True)
        ProfileMonthlySnapshot.__table__.create(bind=connection, checkfirst=True)

        existing_categories = set(
            connection.execute(select(HistoryConfiguration.module_name)).scalars()
        )
        missing = [
            {
                "module_name": category.value,
                "retention_months": DEFAULT_RETENTION_MONTHS,
            }
            for category in HistoryCategory
            if category.value not in existing_categories
        ]
        if missing:
            connection.execute(HistoryConfiguration.__table__.insert(), missing)


if __name__ == "__main__":
    run_migration()
    print("Profile history migration completed successfully.")