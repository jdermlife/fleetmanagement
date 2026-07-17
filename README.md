# Fleet Management System

Production-grade fleet management platform with enterprise security features.

## Features

- **Enterprise Document Repository** — Store, version, and sign business documents (payslips, bank statements, vehicle registration, insurance, contracts, IDs)
- **Workflow Engine** — State machine for loan application lifecycle (Draft → Submitted → Credit Review → Committee Review → Approved → Released → Closed)
- **JWT Authentication** with PBKDF2 password hashing
- **Account Lockout** after failed login attempts
- **Password Reset** with time-expiring tokens
- **Role-Based Access Control (RBAC)** with 8 enterprise roles:
   - Admin, Loan Officer, Credit Analyst, Credit Manager, Approver, Operations, Auditor, Read-Only User
- **Audit Logging** for compliance and state change tracking
- **Rate Limiting** protection
- **PostgreSQL** database with connection pooling
- **Security Headers** (HSTS, CSP, X-Frame-Options)
- **OpenAPI/Swagger** documentation
- **Observability Stack** with Sentry, Prometheus metrics, and Grafana dashboards

## Setup

### Prerequisites

- Python 3.11 or 3.12 and pip (for backend)
- Node.js 20.19+ (or 22.12+) and npm (for frontend)
- PostgreSQL connection (Neon cloud, local instance, or other provider)

### Backend

1. Navigate to `backend`
2. Create a virtual environment:
   - **Windows**: `py -3.11 -m venv venv`
   - **macOS/Linux**: `python3.11 -m venv venv`
3. Activate it:
   - **Windows**: `venv\Scripts\activate`
   - **macOS/Linux**: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Set environment variables:
   ```bash
   # Windows PowerShell:
   $env:DATABASE_URL = "postgresql://user:password@host:5432/database"
   $env:SECRET_KEY = "your-32-char-secret-key"
   
   # macOS/Linux:
   export DATABASE_URL="postgresql://user:password@host:5432/database"
   export SECRET_KEY="your-32-char-secret-key"
   ```
6. Initialize the database: `python setup_db.py`
7. Start the API: `python -m app.main`

The backend runs on `http://localhost:5000`.

Note: Python 3.13+ is not currently supported for the FastAPI smoke-test stack in this project.

For production deployments, keep startup migrations disabled and run schema changes through the dedicated setup or migration scripts first.
Before deploying the hardened PayPal flow, run `python migrate_paypal_payment_integrity.py` from `backend`.

### Frontend

1. Navigate to `frontend`
2. Install dependencies: `npm install`
3. Create a `.env.local` file:
   ```
   VITE_API_URL=http://localhost:5000
   VITE_APPLE_CLIENT_ID=your-apple-service-id
   VITE_APPLE_REDIRECT_URI=https://fleetmanagement-flame.vercel.app/backend/api/auth/apple/callback
   ```
4. Start the dev server: `npm run dev`

The frontend runs on `http://localhost:5173`.

## Authentication

Protected endpoints require a JWT token in the Authorization header:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:5000/vehicles
```

### Default Roles

- **Admin**: Full access to all resources
- **Manager**: Read/write vehicles, fuel logs, drivers, scorecards, audit logs
- **Driver**: Read-only access to vehicles and fuel logs
- **Viewer**: Read-only access to vehicles and fuel logs

### Apple Sign-In Setup

Configure Apple Sign-In in Apple Developer Console and mirror those values in backend and frontend environment variables.

1. In Apple Developer Console, create or use a Service ID for web sign-in.
2. Enable Sign in with Apple for that Service ID.
3. Register `fleetmanagement-flame.vercel.app` as a web domain and add the exact HTTPS callback URL as a Return URL. Apple does not accept `localhost` or an IP address.
4. Set matching environment variables:
   - Backend: `APPLE_OAUTH_CLIENT_ID=your-apple-service-id`
   - Frontend: `VITE_APPLE_CLIENT_ID=your-apple-service-id`
   - Frontend: `VITE_APPLE_REDIRECT_URI=https://fleetmanagement-flame.vercel.app/backend/api/auth/apple/callback`
5. Keep the backend and frontend client IDs identical.

For first-time Apple sign-in, the API requires subscriber type and lender data-sharing preference before creating the account.

## API Endpoints

### Authentication
- `POST /auth/login` - Authenticate user (with account lockout)
- `POST /auth/logout` - Logout user
- `POST /auth/register` - Register new user
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/password-reset-request` - Request password reset
- `POST /auth/password-reset-confirm` - Confirm password reset
- `POST /auth/password-change` - Change password
- `POST /auth/delete-account` - Disable the authenticated user account
- `POST /auth/unlock-account` - Unlock locked account (admin)

### Document Management
- `POST /documents/upload` - Upload new document
- `GET /documents/{id}` - Get document metadata
- `GET /documents/{id}/download` - Download document file
- `GET /documents/{id}/versions` - Get version history
- `POST /documents/{id}/sign` - Add digital signature
- `GET /documents/{id}/signatures` - Get all signatures
- `GET /documents/entity/{type}/{id}` - List documents for entity
- `GET /documents/expiry/upcoming` - Get expiring documents
- `GET /documents/expiry/bulk-check` - System-wide expiry status
- `POST /documents/{id}/archive` - Archive document
- `POST /documents/{id}/restore` - Restore archived document
- `GET /documents/search/{query}` - Search documents

### Workflow Management
- `GET /workflows/loans/{id}/state` - Get current workflow state and available transitions
- `POST /workflows/loans/{id}/transition` - Trigger state transition
- `GET /workflows/loans/{id}/history` - Get workflow state change history

### Core API
- `GET /health` - Health check
- `GET /database/status` - Database connection status
- `GET /vehicles` - List vehicles
- `POST /vehicles` - Create vehicle
- `GET /fuel-logs` - List fuel logs
- `GET /audit-logs` - List audit trail
- `POST /credit-score` - Calculate credit score

### AI Governance
- `POST /ai/feedback` - Submit AI quality feedback
- `GET /ai/governance/stats` - Get AI usage, token, and cost statistics
- `GET /ai/governance/requests` - List AI request audit records with filters
- `GET /ai/governance/responses` - List AI response audit records with filters
- `GET /ai/governance/requests/export` - Export filtered AI request audit records as CSV
- `GET /ai/governance/responses/export` - Export filtered AI response audit records as CSV

`GET /api/loan-applications` supports pagination with `limit` and `offset` query parameters.

## Verification

- Backend tests: `python -m unittest discover -s tests -v`
- Frontend lint: `npm run lint`
- Frontend build: `npm run build`

## DevOps

- DevOps requirements and runbook: `DEVOPS_REQUIREMENTS.md`
- CI/CD pipeline: `.github/workflows/ci-cd-deploy.yml`
- Global launch readiness audit: `GLOBAL_LAUNCH_READINESS.md`
- Daily backup scripts:
   - `ops/backup/run_daily_backup.sh`
   - `ops/backup/run_daily_backup.ps1`
- Backup verification:
   - `python ops/backup/verify_backups.py --backup-root backups/daily`
- Disaster recovery restore scripts:
   - `ops/dr/restore_from_backup.sh <backup_run_path>`
   - `ops/dr/restore_from_backup.ps1 -BackupRunPath <backup_run_path>`

## Observability

- Prometheus metrics endpoint: `GET /metrics`
- Health checks: `GET /health`, `GET /ai/health`
- Docker stack services:
   - Prometheus: `http://localhost:9090`
   - Grafana: `http://localhost:3001` (default `admin/admin`)
- Auto-provisioned Grafana dashboard: `FMS API Observability` (folder: `FMS Observability`)

Start local observability stack with Docker Compose:

```bash
docker compose -f docker-compose.yml.txt up -d backend prometheus grafana
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | Required |
| SECRET_KEY | JWT signing key (32+ chars) | Required in production |
| TOKEN_EXPIRY_HOURS | JWT expiration time | 24 |
| RATE_LIMIT_REQUESTS | Max requests per window | 100 |
| RATE_LIMIT_WINDOW | Rate limit window (seconds) | 60 |
| ENFORCE_AUTH | Require Bearer token on protected API routes | true |
| AUTO_RUN_SCHEMA_MIGRATIONS | Run schema creation/migration on startup | false |
| ENABLE_RATE_LIMIT | Enable API rate-limit middleware | true |
| RATE_LIMIT_BACKEND | Rate-limit backend (`memory` or `redis`) | memory |
| REDIS_URL | Redis connection string for distributed limits | empty |
| FRONTEND_ORIGIN_REGEX | Optional strict CORS regex override | empty |
| ENABLE_API_DOCS | Expose Swagger/ReDoc/OpenAPI endpoints | true in development, false in production |
| GOOGLE_OAUTH_CLIENT_ID | Google OAuth Web client ID used by backend token verification | empty |
| VITE_GOOGLE_CLIENT_ID | Google OAuth Web client ID exposed to frontend Sign-In widget | empty |
| APPLE_OAUTH_CLIENT_ID | Apple Service ID used by backend Apple token verification | empty |
| APPLE_JWKS_CACHE_TTL_SECONDS | TTL (seconds) for cached Apple JWKS public keys | 3600 |
| VITE_APPLE_CLIENT_ID | Apple Service ID exposed to frontend Apple Sign-In flow | empty |
| VITE_APPLE_REDIRECT_URI | Frontend Apple Sign-In redirect URI registered in Apple console | empty |
| VITE_PAYPAL_CLIENT_ID | PayPal JavaScript SDK client ID; must match the backend sandbox or live environment | empty |
| PAYPAL_CLIENT_ID | PayPal REST API client ID | Required for PayPal payments |
| PAYPAL_CLIENT_SECRET | PayPal REST API client secret; backend only | Required for PayPal payments |
| PAYPAL_WEBHOOK_ID | PayPal webhook ID used for signature verification | Required for PayPal webhooks |
| PAYPAL_API_BASE_URL | PayPal REST API base URL; sandbox or live must match the credentials | https://api-m.sandbox.paypal.com |
| PAYPAL_TIMEOUT_SECONDS | PayPal REST API request timeout | 15 |
| SENTRY_DSN | Sentry DSN for error monitoring | empty (disabled) |
| SENTRY_ENVIRONMENT | Sentry environment name | development |
| SENTRY_RELEASE | Sentry release identifier | empty |
| SENTRY_TRACES_SAMPLE_RATE | Sentry tracing sample rate (0.0-1.0) | 0.0 |
| SENTRY_PROFILES_SAMPLE_RATE | Sentry profiling sample rate (0.0-1.0) | 0.0 |
| SENTRY_SEND_DEFAULT_PII | Send user/IP metadata to Sentry | false |

## Security Notes

- All passwords are hashed with PBKDF2 (100,000 iterations)
- JWT tokens expire after 24 hours by default
- Rate limiting: 100 requests per 60 seconds per IP
- Security headers applied to all responses
- Audit logging captures all data mutations
