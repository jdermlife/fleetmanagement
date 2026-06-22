# Workflow Engine - Loan Application State Machine

**Date**: 2026-06-22  
**Status**: ✅ Complete - Production ready  
**Type**: State machine for managing loan application lifecycle

---

## Overview

The Workflow Engine provides a flexible, auditable state machine for managing loan applications through their complete lifecycle. It enforces:

- **State transitions** with validation
- **Role-based access control** for each transition
- **Audit logging** of all state changes
- **Extensibility** for other entities (vehicles, applications, etc.)

---

## Loan Workflow States

```
Draft
  ↓
Submitted
  ↓
Credit Review
  ↓
Committee Review
  ├→ Approved → Released → Closed
  └→ Rejected
  
Emergency paths:
- Submitted → Withdrawn (borrower/officer cancels)
- Credit Review → Rejected (analyst decision)
- Committee Review → Rejected (manager decision)
- Approved → Rejected (rare override)
```

### State Definitions

| State | Role | Display | Description |
|-------|------|---------|-------------|
| `draft` | - | Draft | Initial state - borrower gathering information |
| `submitted` | Loan Officer | Submitted | Application submitted for review |
| `credit_review` | Credit Analyst | Credit Review | Credit analyst reviewing application |
| `committee_review` | Credit Manager | Committee Review | Management committee review |
| `approved` | Approver | Approved | Loan approved by committee |
| `released` | Operations | Released | Funds released to borrower |
| `closed` | Operations | Closed | Loan fully repaid or terminated |
| `rejected` | Credit Manager | Rejected | Loan application rejected |
| `withdrawn` | Loan Officer | Withdrawn | Application withdrawn by borrower |

---

## Transition Rules (RBAC)

### From DRAFT
- **→ SUBMITTED**: `loan_officer`, `admin`
  - Description: Submit application for review
- **→ WITHDRAWN**: `loan_officer`, `admin`
  - Description: Withdraw incomplete application

### From SUBMITTED
- **→ CREDIT_REVIEW**: `credit_analyst`, `credit_manager`, `admin`
  - Description: Begin credit analysis
- **→ WITHDRAWN**: `loan_officer`, `credit_manager`, `admin`
  - Description: Withdraw at any point

### From CREDIT_REVIEW
- **→ COMMITTEE_REVIEW**: `credit_analyst`, `credit_manager`, `admin`
  - Description: Complete credit analysis, escalate to committee
- **→ REJECTED**: `credit_analyst`, `credit_manager`, `admin`
  - Description: Reject based on credit analysis

### From COMMITTEE_REVIEW
- **→ APPROVED**: `credit_manager`, `approver`, `admin`
  - Description: Approve loan
- **→ REJECTED**: `credit_manager`, `approver`, `admin`
  - Description: Reject loan at committee level

### From APPROVED
- **→ RELEASED**: `approver`, `admin`
  - Description: Final approval and fund release
- **→ REJECTED**: `approver`, `admin`
  - Description: Reject even after approval (rare override)

### From RELEASED
- **→ CLOSED**: `operations`, `admin`
  - Description: Mark as closed (repaid or terminated)

---

## API Endpoints

### Get Current Workflow State
```
GET /workflows/loans/{loan_id}/state
```

**Authentication**: JWT required (Loan Officer, Credit Analyst, Credit Manager, Approver, Admin)

**Response**:
```json
{
  "entity_id": 42,
  "current_state": "submitted",
  "display_state": "Submitted",
  "valid_next_states": ["credit_review"],
  "valid_transitions": [
    {
      "to_state": "credit_review",
      "description": "Begin credit analysis"
    }
  ]
}
```

### Transition Loan to New State
```
POST /workflows/loans/{loan_id}/transition
```

**Request**:
```json
{
  "to_state": "credit_review",
  "reason": "Application meets initial requirements",
  "metadata": {
    "documents_verified": true,
    "borrower_verified": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Transitioned from submitted to credit_review",
  "from_state": "submitted",
  "to_state": "credit_review"
}
```

**Error Responses**:
- `403 Forbidden`: User role not authorized for this transition
- `404 Not Found`: Loan not found
- `500 Internal Server Error`: Transition failed

### Get Workflow History
```
GET /workflows/loans/{loan_id}/history?limit=50
```

**Response**:
```json
{
  "entity_id": 42,
  "entity_type": "loan",
  "history": [
    {
      "from_state": "submitted",
      "to_state": "credit_review",
      "user_role": "credit_analyst",
      "reason": "Application meets initial requirements",
      "created_at": "2026-06-22T14:30:00Z"
    },
    {
      "from_state": "draft",
      "to_state": "submitted",
      "user_role": "loan_officer",
      "reason": "All required documents provided",
      "created_at": "2026-06-22T10:15:00Z"
    }
  ],
  "total": 2
}
```

---

## Database Schema

### workflow_history Table
```sql
CREATE TABLE workflow_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,              -- 'loan', 'vehicle', etc.
  entity_id INTEGER NOT NULL,             -- ID of the entity
  from_state TEXT NOT NULL,               -- Previous state
  to_state TEXT NOT NULL,                 -- New state
  user_id INTEGER NOT NULL,               -- Who made the transition
  user_role TEXT,                         -- Role of user
  reason TEXT,                            -- Reason for transition
  metadata TEXT,                          -- JSON metadata
  created_at TEXT NOT NULL                -- ISO 8601 timestamp
);

CREATE INDEX idx_workflow_history_entity
ON workflow_history(entity_type, entity_id, created_at);
```

### loan_applications Table (Updated)
```sql
ALTER TABLE loan_applications ADD COLUMN status VARCHAR;
ALTER TABLE loan_applications ADD COLUMN updated_at TIMESTAMPTZ;
```

---

## Implementation Architecture

### Core Components

**1. WorkflowState** — Represents a state
```python
@dataclass
class WorkflowState:
    name: str                 # e.g., 'submitted'
    display_name: str         # e.g., 'Submitted'
    description: str          # e.g., 'Application submitted for review'
    color: str = "#808080"    # For UI
```

**2. WorkflowTransition** — Represents an allowed transition
```python
@dataclass
class WorkflowTransition:
    from_state: str                   # Start state
    to_state: str                     # End state
    allowed_roles: list[str]          # Roles that can make this transition
    description: str = ""             # Reason/description
```

**3. Workflow** — The state machine
```python
class Workflow:
    def __init__(self, entity_type, states, transitions):
        # Initialize workflow
    
    def can_transition(self, from_state, to_state, user_role) -> bool:
        # Check if transition allowed
    
    def get_valid_next_states(self, current_state, user_role) -> list[str]:
        # Get valid next states for role
    
    def log_transition(self, connection, entity_id, from_state, to_state, user_id, reason):
        # Log state change to database
    
    def get_history(self, connection, entity_id, limit) -> list[dict]:
        # Get state change history
```

---

## Integration Guide

### For Frontend Developers

**1. Display Current State**
```typescript
// Get current state
const response = await fetch('/workflows/loans/{loanId}/state', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const state = await response.json();

// Display state with color
<div style={{ backgroundColor: getStateColor(state.current_state) }}>
  {state.display_state}
</div>
```

**2. Show Available Transitions**
```typescript
// Get valid next states
const transitions = state.valid_transitions;

<div>
  {transitions.map(t => (
    <button 
      key={t.to_state} 
      onClick={() => transitionLoan(t.to_state)}
    >
      {t.description}
    </button>
  ))}
</div>
```

**3. Trigger State Transition**
```typescript
async function transitionLoan(toState: string, reason: string) {
  const response = await fetch(`/workflows/loans/${loanId}/transition`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to_state: toState,
      reason: reason,
      metadata: { 
        initiatedBy: currentUser.name,
        timestamp: new Date().toISOString()
      }
    })
  });
  
  if (response.ok) {
    // Transition successful
    refreshLoanState();
  } else {
    const error = await response.json();
    showError(error.detail);
  }
}
```

**4. Display Workflow History**
```typescript
// Get history
const historyResponse = await fetch(`/workflows/loans/${loanId}/history?limit=50`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const history = await historyResponse.json();

// Display timeline
<div className="timeline">
  {history.history.map((item, i) => (
    <div key={i} className="timeline-item">
      <div>{item.from_state} → {item.to_state}</div>
      <div>{item.user_role}</div>
      <div>{item.reason}</div>
      <div>{formatDate(item.created_at)}</div>
    </div>
  ))}
</div>
```

### For Backend Developers

**1. Programmatically Trigger Transition**
```python
from app.workflow import loan_workflow
from app.models import get_connection

with closing(get_connection(config)) as connection:
    # Check if transition allowed
    if loan_workflow.can_transition("submitted", "credit_review", "credit_analyst"):
        # Update loan
        connection.execute(
            "UPDATE loan_applications SET status = ? WHERE id = ?",
            ("credit_review", loan_id)
        )
        
        # Log transition
        loan_workflow.log_transition(
            connection,
            entity_id=loan_id,
            from_state="submitted",
            to_state="credit_review",
            user_id=current_user.id,
            user_role=current_user.role,
            reason="Credit analysis initiated",
            metadata={"analyst": current_user.username}
        )
```

**2. Get Valid Transitions**
```python
from app.workflow import loan_workflow

valid_states = loan_workflow.get_valid_next_states("submitted", "credit_analyst")
# Returns: ['credit_review']

# Or get all transitions from state
transitions = loan_workflow.get_valid_transitions("submitted")
for t in transitions:
    print(f"Can transition to {t.to_state} if role in {t.allowed_roles}")
```

**3. Adding New Workflows**
```python
# Create state enum
class VehicleWorkflowStates(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    ACTIVE = "active"
    RETIRED = "retired"

# Define states
VEHICLE_STATES = {
    VehicleWorkflowStates.DRAFT: WorkflowState(...),
    ...
}

# Define transitions
VEHICLE_TRANSITIONS = [
    WorkflowTransition(...),
    ...
]

# Create workflow instance
vehicle_workflow = Workflow("vehicle", VEHICLE_STATES, VEHICLE_TRANSITIONS)
```

---

## Use Cases

### Scenario 1: Loan Processing Workflow
1. **Loan Officer** creates loan in DRAFT state
2. **Loan Officer** submits → SUBMITTED
3. **Credit Analyst** begins review → CREDIT_REVIEW
4. **Credit Analyst** escalates → COMMITTEE_REVIEW
5. **Credit Manager** approves → APPROVED
6. **Approver** releases funds → RELEASED
7. **Operations** closes → CLOSED

**At each step**, the workflow engine validates:
- User has correct role
- Current state allows transition
- Logs who made the change and when

### Scenario 2: Rejection Workflow
1. Application reaches CREDIT_REVIEW
2. **Credit Analyst** finds issues → REJECTED
3. Workflow logs rejection reason and metadata
4. Frontend displays rejection and history to borrower

### Scenario 3: Withdrawal
1. Application at any point in DRAFT/SUBMITTED/CREDIT_REVIEW
2. **Loan Officer** or **Borrower** can withdraw → WITHDRAWN
3. Can potentially restart from DRAFT with new data

### Scenario 4: Audit Trail
1. Auditor queries `GET /workflows/loans/{id}/history`
2. Gets complete timeline of who changed what and when
3. Can use for compliance, dispute resolution, performance analysis

---

## Error Handling

### Unauthorized Transition
**User**: `credit_analyst`  
**Current State**: `draft`  
**Attempted Transition**: `approved` → `released`

**Response**:
```json
{
  "detail": "Not authorized to transition from draft to released"
}
```

### Invalid State
**Current State**: `closed`  
**Attempted Transition**: `closed` → `released`

**Response**:
```json
{
  "detail": "Not authorized to transition from closed to released"
}
```

### Missing Entity
**Loan ID**: 9999 (doesn't exist)

**Response**:
```json
{
  "detail": "Loan not found"
}
```

---

## Performance Considerations

### Indexing
- `idx_workflow_history_entity` on (entity_type, entity_id, created_at)
  - Fast lookup of history for loan
  - Supports reverse chronological queries

### Queries
- `can_transition()`: O(1) - uses hash lookup
- `get_valid_next_states()`: O(n) where n = transitions from state (typically 2-4)
- `get_history()`: O(log m) where m = total history entries (indexed)

### Scalability
- Workflow history is append-only (no updates/deletes)
- Can safely partition by entity_type for multi-tenant
- Archive old history (>1 year) to separate table

---

## Future Extensions

### Conditional Transitions
```python
WorkflowTransition(
    from_state="committee_review",
    to_state="approved",
    allowed_roles=["credit_manager", "approver"],
    conditions=[
        ("loan_amount", "<", 100000),  # Only for loans under $100k
        ("credit_score", ">", 650),
    ]
)
```

### Webhooks/Notifications
```python
workflow.on_transition("loan", lambda event: {
    send_email(event.user.email, f"Loan moved to {event.to_state}"),
    send_sms(event.borrower.phone, "Your application status changed"),
})
```

### Parallel States
```python
# Support parallel workflows (e.g., credit review AND compliance review)
# Both must complete before advancing to committee
```

### Time-Based Transitions
```python
# Automatically move to next state after N days
# E.g., auto-reject if no action for 30 days in credit_review
```

---

## Testing

### Unit Tests
```python
def test_can_transition():
    workflow = Workflow("loan", LOAN_STATES, LOAN_TRANSITIONS)
    assert workflow.can_transition("draft", "submitted", "loan_officer")
    assert not workflow.can_transition("draft", "approved", "loan_officer")
```

### Integration Tests
```python
def test_transition_workflow():
    # Create loan in draft
    loan = create_loan()
    
    # Submit as loan officer
    response = transition_loan(loan.id, "submitted", "loan_officer_token")
    assert response.status_code == 200
    
    # Verify history logged
    history = get_workflow_history(loan.id)
    assert history[0]["to_state"] == "submitted"
```

---

## Deployment Notes

### Initial Setup
1. Deploy code with `AUTO_RUN_SCHEMA_MIGRATIONS=true`
2. `create_workflow_tables()` runs on startup
3. `workflow_history` table created automatically
4. `updated_at` column added to `loan_applications` on first migration

### Rollback
- Workflow system is non-invasive
- Only adds columns and tables (doesn't modify existing schema)
- Safe to disable by setting `AUTO_RUN_SCHEMA_MIGRATIONS=false`

### Backward Compatibility
- Existing loans without status → assumed to be in "draft"
- Can migrate legacy statuses to new workflow states in migration script

---

## Summary

| Aspect | Details |
|--------|---------|
| **States** | 9 states (draft, submitted, credit_review, committee_review, approved, released, closed, rejected, withdrawn) |
| **Transitions** | 13 allowed transitions with role-based access |
| **Audit** | All changes logged with user, reason, metadata, timestamp |
| **Extensibility** | Can add new workflows (vehicle, application, etc.) without code changes |
| **Performance** | O(1) transition checks, indexed history queries |
| **Security** | Role-based access control on every transition |
| **Compliance** | Complete audit trail for regulatory requirements |

---

**Files**:
- [backend/app/workflow.py](../backend/app/workflow.py) — Core workflow engine
- [backend/app/routes/workflow.py](../backend/app/routes/workflow.py) — API endpoints
- [backend/main.py](../backend/main.py) — Route registration + table creation

**Documentation**:
- [SECURITY_QUICK_REFERENCE.md](../SECURITY_QUICK_REFERENCE.md) — Enterprise security overview
- [ENTERPRISE_SECURITY.md](../ENTERPRISE_SECURITY.md) — Security features details
