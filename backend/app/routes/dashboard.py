from __future__ import annotations

import os
import time

from fastapi import APIRouter, Depends
from sqlalchemy import case, func

from app.database import SessionLocal
from app.fastapi_auth import CurrentUser, require_authenticated_user
from app.models.loan_application import LoanApplication

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_DASHBOARD_CACHE_TTL_SECONDS = int(os.getenv("DASHBOARD_CACHE_TTL_SECONDS", "30"))
_dashboard_cache: dict[str, tuple[float, dict[str, int]]] = {}


def invalidate_dashboard_statistics_cache() -> None:
    _dashboard_cache.clear()


@router.get("/statistics")
def dashboard_statistics(user: CurrentUser = Depends(require_authenticated_user)):
    cache_key = f"dashboard:{user.role.lower()}:{user.id if user.role.lower() != 'admin' else 'all'}"
    now = time.time()
    cached = _dashboard_cache.get(cache_key)
    if cached and (now - cached[0]) < _DASHBOARD_CACHE_TTL_SECONDS:
        return cached[1]

    db = SessionLocal()

    try:
        pending_statuses = ["Draft", "Submitted", "Under Review", "Credit Review", "Reviewed"]
        query = db.query(LoanApplication)

        if user.role.lower() != "admin":
            query = query.filter(LoanApplication.created_by == user.id)

        row = (
            query.with_entities(
                func.count(LoanApplication.id).label("total_applications"),
                func.coalesce(
                    func.sum(case((LoanApplication.status == "Approved", 1), else_=0)),
                    0,
                ).label("approved"),
                func.coalesce(
                    func.sum(case((LoanApplication.status.in_(pending_statuses), 1), else_=0)),
                    0,
                ).label("pending"),
                func.coalesce(
                    func.sum(case((LoanApplication.status == "Rejected", 1), else_=0)),
                    0,
                ).label("rejected"),
            )
            .one()
        )

        payload = {
            "totalApplications": int(row.total_applications or 0),
            "approved": int(row.approved or 0),
            "pending": int(row.pending or 0),
            "rejected": int(row.rejected or 0),
        }
        _dashboard_cache[cache_key] = (now, payload)
        return payload
    finally:
        db.close()