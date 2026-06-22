"""
Workflow routes - API endpoints for state transitions.

Provides REST endpoints for:
- Viewing current workflow state
- Getting available transitions
- Triggering state transitions with audit logging
- Viewing workflow history
"""

from __future__ import annotations

from contextlib import closing
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db_config
from app.fastapi_auth import CurrentUser, require_roles
from app.models import get_connection
from app.workflow import loan_workflow, LoanWorkflowStates
from app.database import SessionLocal
from app.models.notification import NotificationPriority
from app.services.notification_service import queue_event_notifications


router = APIRouter(prefix="/workflows", tags=["workflows"])


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


@router.get("/loans/{loan_id}/state")
async def get_loan_workflow_state(
    loan_id: int,
    user: CurrentUser | None = Depends(require_roles("admin", "loan_officer", "credit_analyst", "credit_manager", "approver")),
) -> WorkflowStateResponse:
    """Get current workflow state and available transitions."""
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    
    config = get_db_config()
    with closing(get_connection(config)) as connection:
        loan = connection.execute(
            "SELECT id, status FROM loan_applications WHERE id = ?",
            (loan_id,),
        ).fetchone()
        
        if not loan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")
        
        current_state = loan["status"] or LoanWorkflowStates.DRAFT.value
        valid_next_states = loan_workflow.get_valid_next_states(current_state, user.role)
        
        # Get transition details
        valid_transitions = []
        for next_state in valid_next_states:
            transition = loan_workflow._transition_map.get((current_state, next_state))
            if transition:
                valid_transitions.append({
                    "to_state": next_state,
                    "description": transition.description,
                })
        
        state_def = loan_workflow.states.get(current_state)
        display_state = state_def.display_name if state_def else current_state
        
        return WorkflowStateResponse(
            entity_id=loan_id,
            current_state=current_state,
            display_state=display_state,
            valid_next_states=valid_next_states,
            valid_transitions=valid_transitions,
        )


@router.post("/loans/{loan_id}/transition")
async def transition_loan_state(
    loan_id: int,
    request: WorkflowTransitionRequest,
    user: CurrentUser | None = Depends(require_roles("admin", "loan_officer", "credit_analyst", "credit_manager", "approver")),
) -> dict:
    """Transition loan to new state."""
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    
    config = get_db_config()
    with closing(get_connection(config)) as connection:
        # Get current loan state
        loan = connection.execute(
            "SELECT id, status FROM loan_applications WHERE id = ?",
            (loan_id,),
        ).fetchone()
        
        if not loan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")
        
        current_state = loan["status"] or LoanWorkflowStates.DRAFT.value
        
        # Check if transition is allowed
        if not loan_workflow.can_transition(current_state, request.to_state, user.role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Not authorized to transition from {current_state} to {request.to_state}",
            )
        
        # Execute transition
        try:
            with connection:
                # Update loan status
                connection.execute(
                    "UPDATE loan_applications SET status = ?, updated_at = ? WHERE id = ?",
                    (request.to_state, datetime.now(timezone.utc).isoformat(), loan_id),
                )
                
                # Log to workflow history
                loan_workflow.log_transition(
                    connection,
                    entity_id=loan_id,
                    from_state=current_state,
                    to_state=request.to_state,
                    user_id=user.id,
                    user_role=user.role,
                    reason=request.reason,
                    metadata=request.metadata,
                )

            # Emit role-targeted notifications for the transition.
            recipients: list[dict] = []
            target_roles = ["admin", "credit_manager", "approver", "loan_officer"]
            for role in target_roles:
                rows = connection.execute(
                    "SELECT id, email FROM users WHERE lower(role) = ? AND is_active = 1",
                    (role,),
                ).fetchall()
                recipients.extend(
                    {
                        "user_id": row["id"],
                        "email": row["email"],
                        "phone": None,
                        "webhook_url": None,
                    }
                    for row in rows
                )

            if recipients:
                session_db: Session = SessionLocal()
                try:
                    queue_event_notifications(
                        session_db,
                        event_type="loan.workflow.transition",
                        recipients=recipients,
                        context={
                            "loan_id": loan_id,
                            "from_state": current_state,
                            "to_state": request.to_state,
                            "reason": request.reason,
                            "triggered_by": user.username,
                        },
                        fallback_title=f"Loan {loan_id} moved to {request.to_state}",
                        fallback_message=(
                            f"Loan {loan_id} transitioned from {current_state} to {request.to_state} "
                            f"by {user.username}. Reason: {request.reason or 'N/A'}"
                        ),
                        priority=NotificationPriority.HIGH,
                        source_table="loan_applications",
                        source_record_id=str(loan_id),
                        created_by=user.username,
                    )
                finally:
                    session_db.close()
            
            return {
                "success": True,
                "message": f"Transitioned from {current_state} to {request.to_state}",
                "from_state": current_state,
                "to_state": request.to_state,
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Transition failed: {str(e)}",
            )


@router.get("/loans/{loan_id}/history")
async def get_loan_workflow_history(
    loan_id: int,
    limit: int = 50,
    user: CurrentUser | None = Depends(require_roles("admin", "loan_officer", "credit_analyst", "credit_manager", "approver", "auditor")),
) -> dict:
    """Get workflow transition history for loan."""
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    
    config = get_db_config()
    with closing(get_connection(config)) as connection:
        # Verify loan exists
        loan = connection.execute(
            "SELECT id FROM loan_applications WHERE id = ?",
            (loan_id,),
        ).fetchone()
        
        if not loan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")
        
        history = loan_workflow.get_history(connection, loan_id, limit=limit)
        
        return {
            "entity_id": loan_id,
            "entity_type": "loan",
            "history": [
                {
                    "from_state": item["from_state"],
                    "to_state": item["to_state"],
                    "user_role": item["user_role"],
                    "reason": item["reason"],
                    "created_at": item["created_at"],
                }
                for item in history
            ],
            "total": len(history),
        }
