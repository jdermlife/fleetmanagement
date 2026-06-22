# Enterprise Security Features

**Date**: 2026-06-22  
**Status**: ✅ Implemented

This document details the complete enterprise-grade security framework now integrated into the Fleet Management System.

---

## 1. Authentication & Authorization

### JWT Authentication
- **Algorithm**: HS256 with PBKDF2-SHA256 password hashing
- **Iterations**: 100,000 (OWASP recommended)
- **Token Expiry**: Configurable via `TOKEN_EXPIRY_HOURS` (default 24 hours)
- **Refresh Token**: `POST /auth/refresh` to obtain new token without re-authenticating

### Role-Based Access Control (RBAC)

**8 Enterprise Roles** (replacing generic Admin/Manager/Viewer):

| Role | Use Case | Key Permissions |
|------|----------|-----------------|
| **Admin** | System administration | Full access to all resources and user management |
| **Loan Officer** | Loan origination | Create loans, manage borrowers, view scorecards |
| **Credit Analyst** | Credit evaluation | Score loans, view analytics, read-only data access |
| **Credit Manager** | Portfolio oversight | Approve loans, manage loan officers, analytics |
| **Approver** | Final authorization | Final sign-off on loans, high-value transaction approval |
| **Operations** | Fleet management | Vehicles, drivers, fuel, maintenance (fleet ops only) |
| **Auditor** | Compliance & audit | Read-only access to all data + full audit log access |
| **Read-Only User** | Dashboard views | Limited read-only access to analytics and dashboards |

**Granular Permissions** (~35 total):
- `read:loans`, `create:loans`, `edit:loans`, `approve:loans`, `final_approve:loans`
- `read:borrowers`, `create:borrowers`, `edit:borrowers`
- `read:scorecards`, `write:scorecards`, `read:analytics`
- `read:vehicles`, `write:vehicles`, `delete:vehicles`
- `read:drivers`, `write:drivers`, `delete:drivers`
- `read:fuel_logs`, `write:fuel_logs`, `delete:fuel_logs`
- `read:audit_logs`, `admin:users`, `manage:system`

---

## 2. Account Lockout Protection

### Overview
Prevents brute-force attacks by locking accounts after failed login attempts.

### Configuration
```bash
export MAX_FAILED_LOGIN_ATTEMPTS="5"              # Lock after N failures (default: 5)
export ACCOUNT_LOCKOUT_DURATION_MINUTES="15"     # Lock duration (default: 15 min)
```

### Behavior
1. User fails login 5 times consecutively
2. Account is locked for 15 minutes
3. Returns HTTP 423 (Locked) with retry countdown
4. Failed attempt counter resets on successful login
5. Admin can manually unlock via `POST /auth/unlock-account`

### API Response (When Locked)
```json
{
  "error": "Account is locked. Try again in 847 seconds.",
  "code": "account_locked"
}
```

---

## 3. Password Reset

### Overview
Secure password reset flow with time-expiring tokens.

### Configuration
```bash
export PASSWORD_RESET_TOKEN_EXPIRY_MINUTES="30"  # Token validity (default: 30 min)
```

### Flow

**Step 1: Request Reset**
```bash
POST /auth/password-reset-request
{
  "email_or_username": "user@example.com"
}
```
- Returns 200 (even if user doesn't exist - security best practice)
- In production: Email sent with reset link containing token
- In development: Token returned in response (set `ENVIRONMENT=development`)

**Step 2: Confirm Reset**
```bash
POST /auth/password-reset-confirm
{
  "user_id": 42,
  "reset_token": "...",
  "new_password": "NewSecurePassword123"
}
```
- Validates token expiry and hash
- Resets password
- Unlocks account if locked
- Clears reset token after use

### Security Properties
- Tokens expire after 30 minutes (configurable)
- Tokens are one-time use (deleted after reset)
- Tokens are hashed (never stored in plaintext)
- Failed attempts don't count toward lockout (reset flow is separate)

---

## 4. Password Change

### Overview
Allows authenticated users to change their password with current password verification.

### Endpoint
```bash
POST /auth/password-change
Authorization: Bearer <jwt_token>
{
  "current_password": "CurrentPassword123",
  "new_password": "NewPassword456"
}
```

### Validations
- Current password must be correct
- New password must be 8+ characters
- New password must differ from current password
- Requires valid JWT token

---

## 5. Account Unlock

### Overview
Admin-only endpoint to unlock locked accounts.

### Endpoint
```bash
POST /auth/unlock-account
Authorization: Bearer <admin_jwt_token>
{
  "user_id": 42
}
```

### Access Control
- Admin role required
- Clears failed attempt counter
- Removes lockout expiry

---

## Database Schema Extensions

The following columns are added to the `users` table:

```sql
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;  -- ISO 8601 datetime
ALTER TABLE users ADD COLUMN password_reset_token TEXT;  -- SHA256 hashed
ALTER TABLE users ADD COLUMN password_reset_token_expires TEXT;  -- ISO 8601 datetime
```

### Migration
Run before deploying:
```bash
cd backend
python migrate_security_fields.py
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description | Public |
|--------|----------|-------------|--------|
| POST | `/auth/login` | Authenticate user | ✅ |
| POST | `/auth/register` | Register new user | ✅ |
| POST | `/auth/refresh` | Get new JWT token | ✅ |
| POST | `/auth/logout` | Logout (client-side) | ✅ |
| GET | `/auth/me` | Get current user info | 🔒 |

### Account Management
| Method | Endpoint | Description | Required Role |
|--------|----------|-------------|---------------|
| POST | `/auth/password-reset-request` | Request password reset token | Public |
| POST | `/auth/password-reset-confirm` | Confirm password reset | Public |
| POST | `/auth/password-change` | Change password (authenticated) | Authenticated |
| POST | `/auth/unlock-account` | Unlock user account | Admin |

---

## Security Best Practices Implemented

✅ **Password Security**
- PBKDF2-SHA256 hashing with 100,000 iterations
- Cryptographically secure salt generation
- Constant-time comparison to prevent timing attacks

✅ **Account Protection**
- Account lockout after 5 failed attempts
- 15-minute automatic unlock (configurable)
- Failed attempt counter resets on success

✅ **Token Security**
- JWT tokens with 24-hour expiry
- Unique JTI (JWT ID) per token (prevents replay)
- HS256 signing with strong SECRET_KEY (32+ chars recommended)

✅ **Password Reset**
- One-time use tokens
- 30-minute expiry
- SHA256 hashing of tokens (never plaintext)
- Automatic account unlock on reset

✅ **Brute-Force Prevention**
- Rate limiting on API endpoints (100 req/60s default)
- Account lockout on login failures
- Password reset tokens separate from login attempts

✅ **Role-Based Access**
- 8 granular roles for enterprise scenarios
- Permission-based enforcement on routes
- Admin-only sensitive operations

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `ENFORCE_AUTH` | `false` | Require Bearer token on protected routes |
| `SECRET_KEY` | Auto-generated | JWT signing key (32+ chars recommended) |
| `TOKEN_EXPIRY_HOURS` | `24` | JWT token expiration time |
| `MAX_FAILED_LOGIN_ATTEMPTS` | `5` | Lock account after N failures |
| `ACCOUNT_LOCKOUT_DURATION_MINUTES` | `15` | How long to lock account |
| `PASSWORD_RESET_TOKEN_EXPIRY_MINUTES` | `30` | Reset token validity period |
| `ENVIRONMENT` | `production` | Set to `development` to return reset tokens in response |

---

## Development vs. Production

### Development Mode
```bash
export ENVIRONMENT="development"
export ENFORCE_AUTH="false"
export SECRET_KEY="dev-key-12345"
```
- Password reset tokens returned in API response (for testing)
- Auth enforcement optional (easier testing)

### Production Mode
```bash
export ENVIRONMENT="production"
export ENFORCE_AUTH="true"
export SECRET_KEY="<strong-32-char-key>"
export ACCOUNT_LOCKOUT_DURATION_MINUTES="30"  # Longer lockout
export PASSWORD_RESET_TOKEN_EXPIRY_MINUTES="15"  # Shorter reset window
```
- Password reset tokens NOT in response (email-only)
- Auth enforcement required
- Stricter timeouts

---

## Migration Path

### Phase 1: Deploy without enforcement (Week 1)
1. Deploy code with `ENFORCE_AUTH=false`
2. Run migration script: `python migrate_security_fields.py`
3. New fields populated with defaults
4. Test new endpoints without affecting users

### Phase 2: Enable for new registrations (Week 2)
1. New users get new roles (Loan Officer, etc.)
2. Legacy users remain with old roles temporarily
3. Gradual migration of existing users

### Phase 3: Enforce authentication (Week 3)
1. Set `ENFORCE_AUTH=true`
2. All protected endpoints now require JWT
3. 401 response for missing/invalid tokens
4. Existing API integrations must add tokens

### Phase 4: Complete migration (Week 4)
1. Migrate all legacy users to new roles
2. Full enforcement active
3. Monitor lockout/reset metrics

---

## Troubleshooting

### User locked out
```bash
# Admin unlock
curl -X POST http://localhost:5000/auth/unlock-account \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 42}'
```

### Forgot password
1. User visits password reset page
2. Enters email/username
3. Clicks link with token from email
4. Sets new password
5. Account automatically unlocked if locked

### Testing lockout (development)
```bash
# Login 5 times with wrong password
for i in {1..5}; do
  curl -X POST http://localhost:5000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","password":"wrong"}'
done

# Next attempt returns 423 (Locked)
```

---

## Compliance & Auditing

All security events logged via audit system:
- Failed login attempts
- Account lockouts
- Password resets initiated
- Password changes
- Account unlocks
- Role changes

Query audit logs:
```bash
GET /audit-logs?action=login_failed&days=7
GET /audit-logs?action=account_locked&days=30
```

---

**Last Updated**: 2026-06-22  
**Version**: 1.0 - Production Ready
