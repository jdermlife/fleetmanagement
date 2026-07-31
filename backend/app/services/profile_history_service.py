import calendar
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.profile_history import HistoryConfiguration, ProfileHistory


def subtract_calendar_months(value: datetime, months: int) -> datetime:
    month_index = value.year * 12 + value.month - 1 - months
    year, zero_based_month = divmod(month_index, 12)
    month = zero_based_month + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def cleanup_expired_profile_history(
    db: Session,
    *,
    now: datetime | None = None,
) -> int:
    reference_time = now or datetime.now(timezone.utc)
    configurations = db.query(HistoryConfiguration).all()
    deleted = 0

    for configuration in configurations:
        cutoff = subtract_calendar_months(reference_time, configuration.retention_months)
        deleted += (
            db.query(ProfileHistory)
            .filter(
                ProfileHistory.category == configuration.module_name,
                ProfileHistory.observed_at < cutoff,
            )
            .delete(synchronize_session=False)
        )

    db.commit()
    return deleted