from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.fastapi_auth import CurrentUser, require_authenticated_user
from app.models.profile_monthly_snapshot import ProfileMonthlySnapshot
from app.routes.loan_routes import enforce_loan_application_access, get_loan_application_or_404
from app.schemas.profile_monthly_snapshot_schema import (
    ProfileMonthlySnapshotListResponse,
    ProfileMonthlySnapshotResponse,
    ProfileMonthlySnapshotUpsert,
)
from app.services.profile_monthly_snapshot import save_monthly_profile_snapshot


router = APIRouter(prefix="/profile-monthly-snapshots", tags=["Profile Monthly Snapshots"])


def _owned_query(db: Session, user_id: int):
    return db.query(ProfileMonthlySnapshot).filter(ProfileMonthlySnapshot.user_id == user_id)


@router.put("/{snapshot_month}", response_model=ProfileMonthlySnapshotResponse)
def put_profile_monthly_snapshot(
    payload: ProfileMonthlySnapshotUpsert,
    snapshot_month: date = Path(),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_authenticated_user),
):
    month = snapshot_month.replace(day=1)
    loan_application_id = None
    if payload.source_application_no:
        application = get_loan_application_or_404(db, payload.source_application_no)
        enforce_loan_application_access(user, application)
        loan_application_id = application.id

    values = payload.model_dump(exclude={"source_application_no"})
    profile_id = values.pop("source_profile_id")
    return save_monthly_profile_snapshot(
        db,
        user_id=user.id,
        profile_id=profile_id,
        snapshot_month=month,
        loan_application_id=loan_application_id,
        **values,
    )


@router.get("", response_model=ProfileMonthlySnapshotListResponse)
def list_profile_monthly_snapshots(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    limit: int = Query(default=24, ge=1, le=120),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_authenticated_user),
):
    query = _owned_query(db, user.id)
    if date_from is not None:
        query = query.filter(ProfileMonthlySnapshot.snapshot_month >= date_from.replace(day=1))
    if date_to is not None:
        query = query.filter(ProfileMonthlySnapshot.snapshot_month <= date_to.replace(day=1))
    total = query.count()
    snapshots = (
        query.order_by(ProfileMonthlySnapshot.snapshot_month.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return ProfileMonthlySnapshotListResponse(items=snapshots, total=total)


@router.get("/{snapshot_month}", response_model=ProfileMonthlySnapshotResponse)
def get_profile_monthly_snapshot(
    snapshot_month: date = Path(),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_authenticated_user),
):
    snapshot = _owned_query(db, user.id).filter(
        ProfileMonthlySnapshot.snapshot_month == snapshot_month.replace(day=1),
    ).first()
    if snapshot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monthly snapshot not found")
    return snapshot