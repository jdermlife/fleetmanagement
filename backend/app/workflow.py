"""
Workflow Engine - State machine for managing entity state transitions.

Supports:
- State definitions with allowed transitions
- Permission-based access control for transitions
- Audit logging of all state changes
- Extensible for any entity (loans, vehicles, applications, etc.)

Example:
    workflow = Workflow('loan', LOAN_STATES)
    if workflow.can_transition(current_state, new_state, user_role):
        workflow.transition(connection, entity_id, current_state, new_state, user_id, reason)
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


@dataclass
class WorkflowState:
    """Represents a state in a workflow."""
    name: str
    display_name: str
    description: str
    color: str = "#808080"  # Hex color for UI


@dataclass
class WorkflowTransition:
    """Represents an allowed transition between states."""
    from_state: str
    to_state: str
    allowed_roles: list[str]  # Which roles can make this transition
    description: str = ""


class LoanWorkflowStates(str, Enum):
    """Loan application workflow states."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    CREDIT_REVIEW = "credit_review"
    COMMITTEE_REVIEW = "committee_review"
    APPROVED = "approved"
    RELEASED = "released"
    CLOSED = "closed"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


# Loan workflow state definitions
LOAN_STATES = {
    LoanWorkflowStates.DRAFT: WorkflowState(
        name=LoanWorkflowStates.DRAFT,
        display_name="Draft",
        description="Initial state - borrower gathering information",
        color="#CCCCCC"
    ),
    LoanWorkflowStates.SUBMITTED: WorkflowState(
        name=LoanWorkflowStates.SUBMITTED,
        display_name="Submitted",
        description="Application submitted for review",
        color="#FFA500"
    ),
    LoanWorkflowStates.CREDIT_REVIEW: WorkflowState(
        name=LoanWorkflowStates.CREDIT_REVIEW,
        display_name="Credit Review",
        description="Credit analyst reviewing application",
        color="#FF6B6B"
    ),
    LoanWorkflowStates.COMMITTEE_REVIEW: WorkflowState(
        name=LoanWorkflowStates.COMMITTEE_REVIEW,
        display_name="Committee Review",
        description="Management committee review",
        color="#4ECDC4"
    ),
    LoanWorkflowStates.APPROVED: WorkflowState(
        name=LoanWorkflowStates.APPROVED,
        display_name="Approved",
        description="Loan approved by committee",
        color="#95E1D3"
    ),
    LoanWorkflowStates.RELEASED: WorkflowState(
        name=LoanWorkflowStates.RELEASED,
        display_name="Released",
        description="Funds released to borrower",
        color="#68C4AF"
    ),
    LoanWorkflowStates.CLOSED: WorkflowState(
        name=LoanWorkflowStates.CLOSED,
        display_name="Closed",
        description="Loan fully repaid or terminated",
        color="#2E8B57"
    ),
    LoanWorkflowStates.REJECTED: WorkflowState(
        name=LoanWorkflowStates.REJECTED,
        display_name="Rejected",
        description="Loan application rejected",
        color="#FF0000"
    ),
    LoanWorkflowStates.WITHDRAWN: WorkflowState(
        name=LoanWorkflowStates.WITHDRAWN,
        display_name="Withdrawn",
        description="Application withdrawn by borrower",
        color="#9999CC"
    ),
}

# Loan workflow transitions with RBAC
LOAN_TRANSITIONS = [
    # Loan Officer transitions
    WorkflowTransition(
        from_state=LoanWorkflowStates.DRAFT,
        to_state=LoanWorkflowStates.SUBMITTED,
        allowed_roles=["loan_officer", "admin"],
        description="Submit application for review"
    ),
    WorkflowTransition(
        from_state=LoanWorkflowStates.DRAFT,
        to_state=LoanWorkflowStates.WITHDRAWN,
        allowed_roles=["loan_officer", "admin"],
        description="Withdraw incomplete application"
    ),
    
    # Credit Analyst transitions
    WorkflowTransition(
        from_state=LoanWorkflowStates.SUBMITTED,
        to_state=LoanWorkflowStates.CREDIT_REVIEW,
        allowed_roles=["credit_analyst", "credit_manager", "admin"],
        description="Begin credit analysis"
    ),
    WorkflowTransition(
        from_state=LoanWorkflowStates.CREDIT_REVIEW,
        to_state=LoanWorkflowStates.COMMITTEE_REVIEW,
        allowed_roles=["credit_analyst", "credit_manager", "admin"],
        description="Complete credit analysis, escalate to committee"
    ),
    WorkflowTransition(
        from_state=LoanWorkflowStates.CREDIT_REVIEW,
        to_state=LoanWorkflowStates.REJECTED,
        allowed_roles=["credit_analyst", "credit_manager", "admin"],
        description="Reject based on credit analysis"
    ),
    
    # Credit Manager transitions
    WorkflowTransition(
        from_state=LoanWorkflowStates.COMMITTEE_REVIEW,
        to_state=LoanWorkflowStates.APPROVED,
        allowed_roles=["credit_manager", "approver", "admin"],
        description="Approve loan"
    ),
    WorkflowTransition(
        from_state=LoanWorkflowStates.COMMITTEE_REVIEW,
        to_state=LoanWorkflowStates.REJECTED,
        allowed_roles=["credit_manager", "approver", "admin"],
        description="Reject loan at committee level"
    ),
    
    # Approver transitions (final approval)
    WorkflowTransition(
        from_state=LoanWorkflowStates.APPROVED,
        to_state=LoanWorkflowStates.RELEASED,
        allowed_roles=["approver", "admin"],
        description="Final approval and fund release"
    ),
    
    # Operations transitions
    WorkflowTransition(
        from_state=LoanWorkflowStates.RELEASED,
        to_state=LoanWorkflowStates.CLOSED,
        allowed_roles=["operations", "admin"],
        description="Mark as closed (repaid or terminated)"
    ),
    
    # Emergency/Override transitions
    WorkflowTransition(
        from_state=LoanWorkflowStates.SUBMITTED,
        to_state=LoanWorkflowStates.WITHDRAWN,
        allowed_roles=["loan_officer", "credit_manager", "admin"],
        description="Withdraw at any point"
    ),
    WorkflowTransition(
        from_state=LoanWorkflowStates.APPROVED,
        to_state=LoanWorkflowStates.REJECTED,
        allowed_roles=["approver", "admin"],
        description="Reject even after approval (rare)"
    ),
]


class Workflow:
    """Workflow engine for managing state transitions."""
    
    def __init__(self, entity_type: str, states: dict[Any, WorkflowState], transitions: list[WorkflowTransition]):
        """
        Initialize workflow.
        
        Args:
            entity_type: Type of entity (e.g., 'loan', 'vehicle')
            states: Dict mapping state enums to WorkflowState definitions
            transitions: List of allowed WorkflowTransition objects
        """
        self.entity_type = entity_type
        self.states = states
        self.transitions = transitions
        
        # Build transition lookup map for fast access
        self._transition_map: dict[tuple, WorkflowTransition] = {}
        for transition in transitions:
            key = (str(transition.from_state), str(transition.to_state))
            self._transition_map[key] = transition
    
    def get_valid_transitions(self, current_state: str) -> list[WorkflowTransition]:
        """Get all valid transitions from current state."""
        return [t for t in self.transitions if str(t.from_state) == str(current_state)]
    
    def get_valid_next_states(self, current_state: str, user_role: str) -> list[str]:
        """Get valid next states for given role."""
        valid = []
        for transition in self.get_valid_transitions(current_state):
            if user_role.lower() in [r.lower() for r in transition.allowed_roles]:
                valid.append(str(transition.to_state))
        return valid
    
    def can_transition(self, from_state: str, to_state: str, user_role: str) -> bool:
        """Check if transition is allowed for user role."""
        key = (str(from_state), str(to_state))
        transition = self._transition_map.get(key)
        
        if not transition:
            return False
        
        return user_role.lower() in [r.lower() for r in transition.allowed_roles]
    
    def get_transition_description(self, from_state: str, to_state: str) -> str:
        """Get description of transition."""
        key = (str(from_state), str(to_state))
        transition = self._transition_map.get(key)
        return transition.description if transition else "State change"
    
    def log_transition(
        self,
        connection,
        entity_id: int,
        from_state: str,
        to_state: str,
        user_id: int,
        user_role: str,
        reason: str = "",
        metadata: dict | None = None,
    ) -> None:
        """Log state transition to audit table."""
        try:
            timestamp = datetime.now(timezone.utc).isoformat()
            
            connection.execute(
                """
                INSERT INTO workflow_history 
                (entity_type, entity_id, from_state, to_state, user_id, user_role, reason, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    self.entity_type,
                    entity_id,
                    str(from_state),
                    str(to_state),
                    user_id,
                    user_role,
                    reason,
                    metadata and str(metadata) or None,
                    timestamp,
                ),
            )
        except Exception as e:
            # Log but don't fail workflow on audit error
            print(f"Workflow audit logging error: {e}")
    
    def get_history(self, connection, entity_id: int, limit: int = 100) -> list[dict]:
        """Get workflow history for entity."""
        try:
            cursor = connection.execute(
                """
                SELECT entity_type, entity_id, from_state, to_state, user_id, user_role, reason, metadata, created_at
                FROM workflow_history
                WHERE entity_type = ? AND entity_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (self.entity_type, entity_id, limit),
            )
            return [dict(row) for row in cursor.fetchall()]
        except Exception:
            return []


# Create workflow instances
loan_workflow = Workflow("loan", LOAN_STATES, LOAN_TRANSITIONS)


def create_workflow_tables(connection) -> None:
    """Create workflow_history table if it doesn't exist."""
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS workflow_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id INTEGER NOT NULL,
                from_state TEXT NOT NULL,
                to_state TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                user_role TEXT,
                reason TEXT,
                metadata TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        
        # Create index for faster queries
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_workflow_history_entity
            ON workflow_history(entity_type, entity_id, created_at)
            """
        )
    except Exception as e:
        print(f"Error creating workflow tables: {e}")
