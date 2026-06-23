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
- Node.js 16+ and npm (for frontend)
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

### Frontend

1. Navigate to `frontend`
2. Install dependencies: `npm install`
3. Create a `.env.local` file:
   ```
   VITE_API_URL=http://localhost:5000
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
