from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import case, func

from app.database import SessionLocal
from app.fastapi_auth import CurrentUser, require_authenticated_user
from app.models.loan_application import LoanApplication

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/statistics")
def dashboard_statistics(user: CurrentUser = Depends(require_authenticated_user)):
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

        return {
            "totalApplications": int(row.total_applications or 0),
            "approved": int(row.approved or 0),
            "pending": int(row.pending or 0),
            "rejected": int(row.rejected or 0),
        }
    finally:
        db.close()