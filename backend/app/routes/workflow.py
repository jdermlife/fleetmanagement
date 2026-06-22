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

from app.fastapi_auth import CurrentUser, require_roles
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



# NOTE: Workflow endpoints temporarily disabled due to incomplete database abstraction layer
# TODO: Refactor to use SessionLocal pattern consistent with rest of app
# 
# @router.get("/loans/{loan_id}/state")
# async def get_loan_workflow_state(...): ...
