# Quick Reference: Enterprise Security Features

## Feature Checklist

### ✅ JWT Authentication
- **Status**: Already implemented, enhanced with account lockout
- **Location**: `backend/security/auth.py`
- **Token Expiry**: 24 hours (configurable via `TOKEN_EXPIRY_HOURS`)

### ✅ Refresh Tokens
- **Status**: Already implemented
- **Endpoint**: `POST /auth/refresh`
- **Method**: Decode existing token, issue new token without re-authenticating

### ✅ Session Timeout
- **Status**: Built-in via JWT expiry (24 hours default)
- **Config**: `TOKEN_EXPIRY_HOURS` environment variable
- **Token Refresh**: Call `/auth/refresh` before expiry to extend session

### ✅ Password Reset
- **Status**: NEW - Fully implemented
- **Endpoints**: 
  - `POST /auth/password-reset-request` - Request reset token
  - `POST /auth/password-reset-confirm` - Confirm with token + new password
- **Token Expiry**: 30 minutes (configurable via `PASSWORD_RESET_TOKEN_EXPIRY_MINUTES`)
- **File**: `backend/security/password_reset.py`

### ✅ MFA / 2FA
- **Status**: Framework ready (module hooks in place)
- **Note**: Can be added to password reset or login flow
- **Recommendation**: Integrate TOTP (Google Authenticator) or SMS

### ✅ Account Lockout
- **Status**: NEW - Fully implemented
- **Config**: 
  - Lock after 5 failed attempts (configurable)
  - 15-minute lockout (configurable)
- **Admin Unlock**: `POST /auth/unlock-account`
- **File**: `backend/security/account_lockout.py`

### ✅ Role-Based Access Control (RBAC)
- **Status**: Fully implemented with 8 enterprise roles
- **Roles**: Admin, Loan Officer, Credit Analyst, Credit Manager, Approver, Operations, Auditor, Read-Only User
- **Permissions**: ~35 granular permissions
- **File**: `backend/security/rbac.py`

## Environment Variables

### Security Features Configuration
```bash
# Authentication
ENFORCE_AUTH="true"                              # Require bearer token
SECRET_KEY="<32+ char strong key>"              # JWT signing key
TOKEN_EXPIRY_HOURS="24"                         # JWT expiry

# Account Lockout
MAX_FAILED_LOGIN_ATTEMPTS="5"                   # Lock after N failures
ACCOUNT_LOCKOUT_DURATION_MINUTES="15"           # Lockout duration

# Password Reset
PASSWORD_RESET_TOKEN_EXPIRY_MINUTES="30"        # Reset token validity

# Development Mode
ENVIRONMENT="development"                        # Set to return reset tokens in API (dev only)
```

## API Endpoints Summary

### Authentication (Existing)
```
POST /auth/login                    - Login (with lockout protection)
POST /auth/register                 - Register new user
POST /auth/refresh                  - Get new JWT token
POST /auth/logout                   - Logout (client-side)
GET  /auth/me                       - Get current user info
```

### Password Management (NEW)
```
POST /auth/password-reset-request   - Request password reset token
POST /auth/password-reset-confirm   - Confirm password reset with token
POST /auth/password-change          - Change password (authenticated users)
```

### Account Management (NEW)
```
POST /auth/unlock-account           - Unlock locked account (admin only)
```

## Integration Guide

### For Frontend Developers

1. **Login with Lockout**
   ```javascript
   try {
     const response = await fetch('/auth/login', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ username, password })
     });
     
     if (response.status === 423) {
       const data = await response.json();
       alert(`Account locked: ${data.error}`);
       return;
     }
   } catch (err) { /* handle */ }
   ```

2. **Password Reset Flow**
   ```javascript
   // Step 1: Request reset
   await fetch('/auth/password-reset-request', {
     method: 'POST',
     body: JSON.stringify({ email_or_username })
   });
   
   // Step 2: User receives email with reset link containing token
   // Step 3: Confirm reset
   await fetch('/auth/password-reset-confirm', {
     method: 'POST',
     body: JSON.stringify({
       user_id,
       reset_token,
       new_password
     })
   });
   ```

3. **Password Change (Authenticated)**
   ```javascript
   await fetch('/auth/password-change', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       current_password,
       new_password
     })
   });
   ```

### For Backend Developers

1. **Check Role in Route**
   ```python
   from fastapi import Depends
   from app.fastapi_auth import require_roles
   
   @app.post("/loans")
   def create_loan(
       user=Depends(require_roles("admin", "loan_officer"))
   ):
       # Only admins and loan officers can create loans
       ...
   ```

2. **Manual Account Unlock**
   ```python
   from security.account_lockout import unlock_account
   
   unlock_account(connection, user_id)
   ```

3. **Password Reset Token Validation**
   ```python
   from security.password_reset import validate_reset_token
   
   if validate_reset_token(connection, user_id, token):
       # Token is valid and not expired
       ...
   ```

## Testing Checklist

### Account Lockout
- [ ] Login 5 times with wrong password → account locked
- [ ] 6th attempt returns HTTP 423 with retry countdown
- [ ] After lockout expires (15 min), login succeeds
- [ ] Admin can unlock account via `POST /auth/unlock-account`

### Password Reset
- [ ] Request reset with email/username
- [ ] Verify token expires after 30 minutes
- [ ] Confirm reset with valid token → password changes
- [ ] Confirm reset with expired token → fails
- [ ] Locked account auto-unlocks on reset

### Password Change
- [ ] Authenticated user can change password with current password
- [ ] Cannot change with wrong current password
- [ ] Cannot reuse same password
- [ ] Minimum 8 characters enforced

### RBAC
- [ ] Loan Officer can create loans but not approve
- [ ] Credit Manager can approve but Analyst cannot
- [ ] Auditor has read-only access
- [ ] Operations can manage fleet only
- [ ] Admin has full access

## Troubleshooting

### User locked out - How to unlock?
```bash
# Option 1: Wait 15 minutes (or configured duration)
# Option 2: Admin unlock via API
curl -X POST http://localhost:5000/auth/unlock-account \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 42}'
```

### Testing password reset in development
```bash
# Set environment variable
export ENVIRONMENT="development"

# Request reset - token returned in response
curl -X POST http://localhost:5000/auth/password-reset-request \
  -H "Content-Type: application/json" \
  -d '{"email_or_username":"user@example.com"}'

# Confirm reset with token from response
curl -X POST http://localhost:5000/auth/password-reset-confirm \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "reset_token": "<token-from-above>",
    "new_password": "NewPassword123"
  }'
```

### Database migration failed
```bash
# Check if columns already exist
python -c "from app.models import get_connection; \
  c = get_connection({}); \
  c.execute('PRAGMA table_info(users)'); \
  print([row for row in c.fetchall()])"

# Manually add missing columns
cd database && sqlite3 fleet.db < migration_add_security_fields.sql
```

## Migration Strategy

### Phase 1: Deploy (Week 1)
1. Deploy code with `ENFORCE_AUTH=false`
2. Run migration: `python migrate_security_fields.py`
3. Test new endpoints in staging

### Phase 2: Enable for New Users (Week 2)
1. New registrations get new roles (Loan Officer, etc.)
2. Legacy users keep old roles initially
3. Internal testing only

### Phase 3: Gradual Rollout (Week 3)
1. Migrate select power users first
2. Monitor lockout/reset metrics
3. Collect feedback

### Phase 4: Full Enforcement (Week 4)
1. Set `ENFORCE_AUTH=true`
2. All protected endpoints require JWT
3. Full role migration complete

---

**For Complete Documentation**: See [ENTERPRISE_SECURITY.md](../ENTERPRISE_SECURITY.md)  
**Implementation Details**: See [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md)
