"""
Workflow routes - API endpoints for state transitions.

Provides REST endpoints for:
- Viewing current workflow state
- Getting available transitions
- Triggering state transitions with audit logging
- Viewing workflow history
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.fastapi_auth import CurrentUser, require_roles
from app.models.loan_application import LoanApplication
from app.workflow import loan_workflow, normalize_workflow_state


router = APIRouter(prefix="/workflows", tags=["workflows"])


def canonical_status_from_workflow_state(state: str) -> str:
    normalized = normalize_workflow_state(state)
    for workflow_state in loan_workflow.states.values():
        if normalize_workflow_state(workflow_state.name) == normalized:
            return workflow_state.display_name

    return str(state).strip().title()


def workflow_state_from_status(status: str) -> str:
    return normalize_workflow_state(status)


def load_loan_application_or_404(db: Session, application_no: str) -> LoanApplication:
    record = (
        db.query(LoanApplication)
        .filter(LoanApplication.application_no == application_no)
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    return record


def serialize_workflow_history_row(row) -> dict:
    return {
        "from_state": canonical_status_from_workflow_state(row.from_state),
        "to_state": canonical_status_from_workflow_state(row.to_state),
        "user_role": row.user_role,
        "reason": row.reason,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


class WorkflowStateResponse(BaseModel):
    """Response model for current workflow state."""
    entity_id: int
    current_state: str
    display_state: str
    valid_next_states: list[str]
    valid_transitions: list[dict]


class WorkflowTransitionRequest(BaseModel):
    """Request model for state transition."""
    to_state: str
    reason: str = ""
    metadata: dict | None = None


class WorkflowHistoryItem(BaseModel):
    """Response model for history item."""
    from_state: str
    to_state: str
    user_role: str
    reason: str
    created_at: str


@router.get("/loans/{application_no}/state", response_model=WorkflowStateResponse)
def get_loan_workflow_state(
    application_no: str,
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
):
    db = SessionLocal()

    try:
        record = load_loan_application_or_404(db, application_no)

        current_state = workflow_state_from_status(record.status or "Draft")
        valid_next_states = [
            canonical_status_from_workflow_state(state)
            for state in loan_workflow.get_valid_next_states(current_state, user.role)
        ]
        valid_transitions = [
            {
                "from_state": canonical_status_from_workflow_state(transition.from_state),
                "to_state": canonical_status_from_workflow_state(transition.to_state),
                "description": transition.description,
            }
            for transition in loan_workflow.get_valid_transitions(current_state)
            if user.role.lower() in [role.lower() for role in transition.allowed_roles]
        ]

        return WorkflowStateResponse(
            entity_id=record.id,
            current_state=canonical_status_from_workflow_state(current_state),
            display_state=canonical_status_from_workflow_state(current_state),
            valid_next_states=valid_next_states,
            valid_transitions=valid_transitions,
        )
    finally:
        db.close()


@router.post("/loans/{application_no}/state")
def transition_loan_workflow_state(
    application_no: str,
    request: WorkflowTransitionRequest,
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
):
    db = SessionLocal()

    try:
        record = load_loan_application_or_404(db, application_no)
        current_state = workflow_state_from_status(record.status or "Draft")
        to_state = workflow_state_from_status(request.to_state)

        if not loan_workflow.can_transition(current_state, to_state, user.role):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transition not allowed.",
            )

        previous_status = record.status or "Draft"
        new_status = canonical_status_from_workflow_state(to_state)

        record.status = new_status
        if request.reason:
            record.committee_remarks = request.reason

        connection = db.connection()
        loan_workflow.log_transition(
            connection,
            entity_id=record.id,
            from_state=current_state,
            to_state=to_state,
            user_id=user.id,
            user_role=user.role,
            reason=request.reason,
            metadata=request.metadata,
        )

        db.commit()

        return {
            "message": f"Status updated to {new_status}",
            "previous_status": previous_status,
            "new_status": new_status,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@router.get("/loans/{application_no}/history", response_model=list[WorkflowHistoryItem])
def get_loan_workflow_history(
    application_no: str,
    user: CurrentUser = Depends(require_roles("Admin", "Subscriber")),
):
    db = SessionLocal()

    try:
        record = load_loan_application_or_404(db, application_no)
        query = (
            db.execute(
                """
                SELECT from_state, to_state, user_role, reason, created_at
                FROM workflow_history
                WHERE entity_type = :entity_type AND entity_id = :entity_id
                ORDER BY created_at DESC, id DESC
                """,
                {"entity_type": "loan", "entity_id": record.id},
            )
            .mappings()
            .all()
        )

        return [serialize_workflow_history_row(row) for row in query]
    finally:
        db.close()
