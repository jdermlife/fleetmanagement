from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.fastapi_auth import CurrentUser, require_authenticated_user
from app.models.profile_history import ProfileHistory
from app.routes.loan_routes import enforce_loan_application_access, get_loan_application_or_404
from app.schemas.profile_history_schema import (
    HistoryCategory,
    ProfileHistoryCreate,
    ProfileHistoryListResponse,
    ProfileHistoryResponse,
)


router = APIRouter(prefix="/profiles", tags=["Profile History"])


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _next_month(value: datetime) -> datetime:
    if value.month == 12:
        return value.replace(year=value.year + 1, month=1, day=1)
    return value.replace(month=value.month + 1, day=1)


def _response(snapshot: ProfileHistory, application_no: str) -> ProfileHistoryResponse:
    return ProfileHistoryResponse(
        id=snapshot.id,
        application_no=application_no,
        category=snapshot.category,
        observed_at=snapshot.observed_at,
        payload=snapshot.payload,
        created_at=snapshot.created_at,
    )


def _profile_query(db: Session, *, application_id: int, owner_id: int):
    return db.query(ProfileHistory).filter(
        ProfileHistory.loan_application_id == application_id,
        ProfileHistory.owner_id == owner_id,
    )


@router.post(
    "/{application_no}/history",
    response_model=ProfileHistoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_profile_history(
    payload: ProfileHistoryCreate,
    application_no: str = Path(min_length=1, max_length=255),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_authenticated_user),
):
    application = get_loan_application_or_404(db, application_no)
    enforce_loan_application_access(user, application)
    owner_id = application.created_by
    if owner_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile does not have an owner",
        )

    observed_at = _normalize_datetime(payload.observed_at)
    if payload.category == HistoryCategory.FINANCIAL_HEALTH_SCORE:
        month_start = observed_at.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        current_month_start = datetime.now(timezone.utc).replace(
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )
        if month_start > current_month_start:
            raise HTTPException(
                status_code=422,
                detail="Financial health snapshot month cannot be in the future",
            )
        existing = _profile_query(
            db,
            application_id=application.id,
            owner_id=owner_id,
        ).filter(
            ProfileHistory.category == HistoryCategory.FINANCIAL_HEALTH_SCORE.value,
            ProfileHistory.observed_at >= month_start,
            ProfileHistory.observed_at < _next_month(month_start),
        ).first()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A financial health snapshot already exists for this month",
            )

    snapshot = ProfileHistory(
        owner_id=owner_id,
        loan_application_id=application.id,
        category=payload.category.value,
        observed_at=observed_at,
        payload=payload.payload,
        created_by=user.id,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return _response(snapshot, application.application_no)


@router.get(
    "/{application_no}/history",
    response_model=ProfileHistoryListResponse,
)
def list_profile_history(
    application_no: str = Path(min_length=1, max_length=255),
    category: HistoryCategory | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_authenticated_user),
):
    application = get_loan_application_or_404(db, application_no)
    enforce_loan_application_access(user, application)
    owner_id = application.created_by
    if owner_id is None:
        return ProfileHistoryListResponse(items=[], total=0)

    query = _profile_query(db, application_id=application.id, owner_id=owner_id)
    if category is not None:
        query = query.filter(ProfileHistory.category == category.value)
    if date_from is not None:
        query = query.filter(ProfileHistory.observed_at >= _normalize_datetime(date_from))
    if date_to is not None:
        query = query.filter(ProfileHistory.observed_at <= _normalize_datetime(date_to))

    total = query.count()
    snapshots = (
        query.order_by(ProfileHistory.observed_at.desc(), ProfileHistory.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return ProfileHistoryListResponse(
        items=[_response(snapshot, application.application_no) for snapshot in snapshots],
        total=total,
    )


@router.get(
    "/{application_no}/history/{history_id}",
    response_model=ProfileHistoryResponse,
)
def get_profile_history(
    application_no: str = Path(min_length=1, max_length=255),
    history_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_authenticated_user),
):
    application = get_loan_application_or_404(db, application_no)
    enforce_loan_application_access(user, application)
    owner_id = application.created_by
    snapshot = None if owner_id is None else _profile_query(
        db,
        application_id=application.id,
        owner_id=owner_id,
    ).filter(ProfileHistory.id == history_id).first()
    if snapshot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="History record not found")
    return _response(snapshot, application.application_no)