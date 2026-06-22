# Workflow Engine - Quick Start Guide

**Status**: ✅ Production Ready  
**Date**: 2026-06-22

---

## What is the Workflow Engine?

A **state machine** that manages loan applications through their complete lifecycle:

```
Loan Created (Draft)
         ↓
    Submit (Officer submits for review)
         ↓
  Credit Review (Analyst reviews creditworthiness)
         ↓
 Committee Review (Manager committee decision)
         ├─→ Approved
         │     ↓
         │ Released (Approver releases funds)
         │     ↓
         │   Closed (Fully repaid/terminated)
         │
         └─→ Rejected (at any point)
```

---

## Key Concepts

| Term | Meaning |
|------|---------|
| **State** | Current status of a loan (e.g., "submitted") |
| **Transition** | Change from one state to another |
| **Role** | User type that determines allowed transitions |
| **Audit Trail** | Complete history of who changed what, when, and why |

---

## 3 Main API Endpoints

### 1️⃣ Check Current State & Available Transitions
```bash
GET /workflows/loans/{loan_id}/state
```

**Example Request**:
```bash
curl -X GET http://localhost:5000/workflows/loans/42/state \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Example Response**:
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

**What it tells you**:
- 📍 Loan is currently in "Submitted" state
- ✅ You can only transition to "Credit Review"
- ❌ You cannot transition to any other state (lacks permission or not allowed)

---

### 2️⃣ Trigger State Transition
```bash
POST /workflows/loans/{loan_id}/transition
```

**Example Request**:
```bash
curl -X POST http://localhost:5000/workflows/loans/42/transition \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "to_state": "credit_review",
    "reason": "All required documents received and verified",
    "metadata": {
      "documents_verified": true,
      "borrower_verified": true,
      "employment_verified": true
    }
  }'
```

**Example Response**:
```json
{
  "success": true,
  "message": "Transitioned from submitted to credit_review",
  "from_state": "submitted",
  "to_state": "credit_review"
}
```

**What happens**:
- ✅ Loan status updated to new state
- 📝 Transition logged with timestamp, user, reason
- 🔒 Role validated (you have permission for this transition)

---

### 3️⃣ View Complete Workflow History
```bash
GET /workflows/loans/{loan_id}/history?limit=50
```

**Example Request**:
```bash
curl -X GET "http://localhost:5000/workflows/loans/42/history?limit=50" \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Example Response**:
```json
{
  "entity_id": 42,
  "entity_type": "loan",
  "total": 3,
  "history": [
    {
      "from_state": "submitted",
      "to_state": "credit_review",
      "user_role": "credit_analyst",
      "reason": "All required documents received and verified",
      "created_at": "2026-06-22T14:30:45Z"
    },
    {
      "from_state": "draft",
      "to_state": "submitted",
      "user_role": "loan_officer",
      "reason": "Initial submission",
      "created_at": "2026-06-22T10:15:30Z"
    }
  ]
}
```

**What it tells you**:
- 📜 Complete audit trail of state changes
- 👤 Who made each change (user role)
- 💬 Reason for each transition
- ⏰ Exact timestamp of each change

---

## Step-by-Step Example

### Scenario: Loan Officer submits an application

**Step 1: Check current state**
```bash
curl -X GET http://localhost:5000/workflows/loans/42/state \
  -H "Authorization: Bearer $LOAN_OFFICER_TOKEN"
```

Response:
```json
{
  "current_state": "draft",
  "display_state": "Draft",
  "valid_next_states": ["submitted", "withdrawn"],
  "valid_transitions": [
    { "to_state": "submitted", "description": "Submit application for review" },
    { "to_state": "withdrawn", "description": "Withdraw incomplete application" }
  ]
}
```

**Step 2: Submit application**
```bash
curl -X POST http://localhost:5000/workflows/loans/42/transition \
  -H "Authorization: Bearer $LOAN_OFFICER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_state": "submitted",
    "reason": "All documents collected, ready for credit review",
    "metadata": {
      "documents_count": 12,
      "borrower_verified": true
    }
  }'
```

Response:
```json
{
  "success": true,
  "message": "Transitioned from draft to submitted",
  "from_state": "draft",
  "to_state": "submitted"
}
```

**Step 3: Frontend updates**
- UI shows "Submitted" status with new color
- Button to submit disappears
- History shows new transition

---

## Role-Based Access Examples

### ✅ What Each Role Can Do

| Transition | Loan Officer | Credit Analyst | Credit Manager | Approver | Operations |
|-----------|----------|---------|---------|------|-----------|
| Draft → Submitted | ✅ | ❌ | ❌ | ❌ | ❌ |
| Submitted → Credit Review | ❌ | ✅ | ✅ | ❌ | ❌ |
| Credit Review → Committee Review | ❌ | ✅ | ✅ | ❌ | ❌ |
| Committee Review → Approved | ❌ | ❌ | ✅ | ✅ | ❌ |
| Approved → Released | ❌ | ❌ | ❌ | ✅ | ❌ |
| Released → Closed | ❌ | ❌ | ❌ | ❌ | ✅ |
| Any → Rejected | ❌ | ✅ | ✅ | ✅ | ❌ |

### 🚫 What Happens if You Try Unauthorized Transition

```bash
curl -X POST http://localhost:5000/workflows/loans/42/transition \
  -H "Authorization: Bearer $AUDITOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to_state": "approved", "reason": "Approve loan"}'
```

Response (HTTP 403):
```json
{
  "detail": "Not authorized to transition from committee_review to approved"
}
```

---

## Error Scenarios

### ❌ Loan Not Found
```bash
curl -X GET http://localhost:5000/workflows/loans/9999/state
```

Response (HTTP 404):
```json
{
  "detail": "Loan not found"
}
```

### ❌ Invalid Transition
```bash
# Trying to go from "draft" to "released" (not allowed)
curl -X POST http://localhost:5000/workflows/loans/42/transition \
  -H "Authorization: Bearer $LOAN_OFFICER_TOKEN" \
  -d '{"to_state": "released"}'
```

Response (HTTP 403):
```json
{
  "detail": "Not authorized to transition from draft to released"
}
```

### ❌ Missing Authentication
```bash
curl -X GET http://localhost:5000/workflows/loans/42/state
```

Response (HTTP 401):
```json
{
  "detail": "Authentication required"
}
```

---

## Frontend Integration Example

### React Component

```typescript
import { useState, useEffect } from 'react';

export function LoanWorkflow({ loanId, token }) {
  const [state, setState] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current state
    fetch(`/workflows/loans/${loanId}/state`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(setState);

    // Get history
    fetch(`/workflows/loans/${loanId}/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => setHistory(data.history));

    setLoading(false);
  }, [loanId, token]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Current State */}
      <div style={{ fontSize: 18, fontWeight: 'bold' }}>
        Status: {state.display_state}
      </div>

      {/* Available Transitions */}
      <div>
        {state.valid_transitions.map(t => (
          <button key={t.to_state} onClick={() => transitionLoan(t.to_state)}>
            {t.description}
          </button>
        ))}
      </div>

      {/* History Timeline */}
      <div>
        {history.map((item, i) => (
          <div key={i}>
            <strong>{item.from_state} → {item.to_state}</strong>
            <p>{item.reason}</p>
            <small>{new Date(item.created_at).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );

  async function transitionLoan(toState: string) {
    const response = await fetch(`/workflows/loans/${loanId}/transition`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to_state: toState,
        reason: 'User initiated transition',
        metadata: { timestamp: new Date().toISOString() }
      })
    });

    if (response.ok) {
      // Refresh state and history
      window.location.reload();
    } else {
      const error = await response.json();
      alert(`Error: ${error.detail}`);
    }
  }
}
```

---

## Common Questions

**Q: Can I skip steps?**  
A: No, the workflow enforces specific step sequences. But some steps can be skipped in error cases (e.g., Draft → Withdrawn, or Committee Review → Rejected).

**Q: Who can reject a loan?**  
A: Credit Analyst, Credit Manager, or Approver (depending on stage).

**Q: Can I go back to a previous state?**  
A: No, the workflow is forward-only (with rejection as an alternative path).

**Q: How do I see who changed what?**  
A: Use `GET /workflows/loans/{id}/history` to get complete audit trail.

**Q: What if there's an error?**  
A: All state changes are atomic—either completes fully or not at all. No partial updates.

---

## State Diagram

```
                ┌─────────────────────────────────────┐
                │          DRAFT                      │
                │  (Loan Officer creates)             │
                └────────────┬────────────────────────┘
                             │
                      Loan Officer
                      "Submit for review"
                             │
                ┌────────────▼────────────────────────┐
                │        SUBMITTED                    │
                │    (Ready for analysis)             │
                └────────────┬────────────────────────┘
                             │
                    Credit Analyst
                    "Begin analysis"
                             │
                ┌────────────▼────────────────────────┐
                │      CREDIT REVIEW                  │
                │  (Analyst evaluating)               │
                └─┬──────────────────────────────────┬┘
                  │                                  │
         Escalate │                          Reject │
                  │                                  │
        ┌─────────▼──────────────┐      ┌──────────▼──────────┐
        │ COMMITTEE REVIEW       │      │   REJECTED          │
        │ (Manager decision)     │      │ (Application denied) │
        └─┬───────────────────┬──┘      └─────────────────────┘
          │                   │
     Approve                Reject
          │                   │
    ┌─────▼─────────┐    ┌────▼──────┐
    │   APPROVED    │    │ REJECTED   │
    │ (Committee OK)│    │  (Denied)  │
    └─────┬─────────┘    └────────────┘
          │
     Approver
     "Release funds"
          │
    ┌─────▼──────────┐
    │   RELEASED     │
    │ (Funds sent)   │
    └─────┬──────────┘
          │
      Operations
      "Close loan"
          │
    ┌─────▼──────────┐
    │     CLOSED     │
    │  (Repaid/Done) │
    └────────────────┘
```

---

## Additional Resources

- **Full Documentation**: [WORKFLOW_ENGINE.md](../WORKFLOW_ENGINE.md)
- **Database Schema**: [database/schema.sql](../database/schema.sql)
- **Security Features**: [ENTERPRISE_SECURITY.md](../ENTERPRISE_SECURITY.md)

---

**Ready to deploy?** Just set `AUTO_RUN_SCHEMA_MIGRATIONS=true` on startup!
