# Global Production Launch Checklist

**Project**: Fleet Management System (FMS)  
**Last Updated**: 2026-06-23  
**Status**: Ready for Production Staging

---

## Pre-Launch Gate: All items must be COMPLETE before go-live.

---

## Section 1: Security & Secrets Configuration

### 1.1 Generate and Store JWT Secret Key
- **Owner**: DevOps/Infrastructure Lead
- **Task**: Generate a strong 64-character hex secret and store in platform secret vault
- **Command**:
  ```bash
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
- **Vault Location**: `BACKEND_SECRET_KEY` (GitHub Secrets or platform equivalent)
- **Evidence**: Screenshot of secret stored (no value exposed)
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 1.2 Configure Production Database URL
- **Owner**: DBA/Infrastructure Lead
- **Task**: Provision PostgreSQL 13+ with SSL enforcement and connection pooling
- **Vault Location**: `DATABASE_URL` (GitHub Secrets or platform equivalent)
- **Format**: `postgresql://user:pass@host:5432/dbname?sslmode=require`
- **Evidence**: Database connection test output
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 1.3 Provision Redis Instance
- **Owner**: Infrastructure Lead
- **Task**: Deploy Redis 6+ for distributed rate limiting and session caching
- **Configuration**:
  - Mode: `redis` (not memory/single-process)
  - Replication: enabled if multi-instance
  - Persistence: AOF enabled
- **Vault Location**: `REDIS_URL` (GitHub Secrets)
- **Format**: `redis://auth-token@host:6379/0`
- **Evidence**: Redis-cli connectivity test from backend host
  ```bash
  redis-cli -u $REDIS_URL ping
  ```
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 1.4 Generate API Keys (if using AI/External Services)
- **Owner**: DevOps/Platform Lead
- **Task**: Create API keys for OpenAI, Sentry, SMTP if enabled
- **Vault Locations**:
  - `SENTRY_DSN` (optional, for error tracking)
  - `OPENAI_API_KEY` (optional, if AI enabled)
  - `SMTP_PASSWORD` (optional, if email enabled)
- **Evidence**: API key creation confirmation (no key value)
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 1.5 Restrict CORS Origins
- **Owner**: Security/DevOps Lead
- **Task**: Set exact production frontend origin(s)
- **Environment Variable**: `FRONTEND_ORIGINS`
- **Format**: `https://app.example.com` or `https://app.example.com,https://admin.example.com`
- **Validation**: 
  ```bash
  curl -H "Origin: https://app.example.com" -i http://backend:5000/health
  # Should return 200 with Access-Control-Allow-Origin header
  ```
- **Evidence**: CORS validation test results
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 1.6 Configure Social Sign-In Identifiers
- **Owner**: Security/DevOps Lead
- **Task**: Configure Google and Apple sign-in identifiers for backend verification and frontend providers
- **Required Values**:
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `APPLE_OAUTH_CLIENT_ID`
  - `VITE_GOOGLE_CLIENT_ID`
  - `VITE_APPLE_CLIENT_ID`
  - `VITE_APPLE_REDIRECT_URI`
- **Validation**:
  ```bash
  echo $GOOGLE_OAUTH_CLIENT_ID
  echo $APPLE_OAUTH_CLIENT_ID
  echo $VITE_GOOGLE_CLIENT_ID
  echo $VITE_APPLE_CLIENT_ID
  echo $VITE_APPLE_REDIRECT_URI
  ```
- **Evidence**: Secret manager and deployment environment screenshots (values redacted)
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

---

## Section 2: CI/CD Pipeline Configuration

### 2.1 Configure GitHub Secrets
- **Owner**: DevOps/Platform Lead
- **Task**: Register deployment webhook URLs and security tokens
- **Required Secrets**:
  - `SECRET_KEY`: JWT signing key (from 1.1)
  - `DATABASE_URL`: PostgreSQL URL (from 1.2)
  - `REDIS_URL`: Redis URL (from 1.3)
  - `GOOGLE_OAUTH_CLIENT_ID`: Google OAuth web client ID
  - `APPLE_OAUTH_CLIENT_ID`: Apple Service ID for backend token verification
  - `BACKEND_DEPLOY_WEBHOOK_URL`: Render.com or equivalent
  - `FRONTEND_DEPLOY_WEBHOOK_URL`: Vercel, Netlify, or CDN URL
- **Evidence**: Screenshot of secrets page (values redacted)
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 2.2 Enable Branch Protection Rules
- **Owner**: Engineering/Platform Lead
- **Task**: Enforce status checks on main branch
- **Required Checks**:
  - `backend-build-test` ✓
  - `backend-security-scan` ✓
  - `frontend-build-test` ✓
  - `frontend-security-scan` ✓
  - `secret-scan` ✓
- **Settings**:
  - Require status checks to pass before merging: YES
  - Dismiss stale pull request approvals: YES
  - Require code review before merge: YES (minimum 1 approval)
- **Evidence**: GitHub Settings → Branch protection screenshot
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 2.3 Trigger CI Dry-Run on Main
- **Owner**: DevOps Lead
- **Task**: Run full CI/CD pipeline to validate all checks pass
- **Command**: Push a test commit to main (or trigger manually)
- **Validation**:
  - All build jobs complete successfully
  - All test jobs complete successfully
  - All security scans pass (pip-audit, bandit, npm audit, Gitleaks)
  - No deployment triggered yet (webhook URL validation only)
- **Evidence**: GitHub Actions workflow run screenshot showing all green
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

---

## Section 3: Database & Migration

### 3.1 Run Database Schema Migrations
- **Owner**: DBA/Ops Lead
- **Task**: Apply all schema migrations to production database
- **Precondition**: `AUTO_RUN_SCHEMA_MIGRATIONS=false` (no auto-migration on startup)
- **Command** (one-time, as privileged user):
  ```bash
  cd backend
  python setup_db.py
  ```
- **Validation**:
  ```bash
  psql $DATABASE_URL -c "\dt"
  # Should list all application tables
  ```
- **Evidence**: Table listing screenshot
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 3.2 Verify Connection Pool Settings
- **Owner**: DBA Lead
- **Task**: Confirm connection pooling is correctly configured
- **Validation**:
  ```bash
  psql $DATABASE_URL -c "SELECT name, setting FROM pg_settings WHERE name LIKE '%pool%';"
  ```
- **Expected**: Connection pool size appropriate for load (typically 20-50)
- **Evidence**: Connection pool configuration screenshot
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

---

## Section 4: Infrastructure & Deployment

### 4.1 Configure Backend Deployment Platform
- **Owner**: DevOps/Infrastructure Lead
- **Task**: Set up backend host (Render, AWS EC2, Heroku, etc.)
- **Requirements**:
  - Python 3.11 runtime
  - Environment variables pre-populated from Section 1
  - Health check: `GET /health` → 200 response
  - Graceful shutdown: 30-second drain before termination
- **Deployment Command** (if manual):
  ```bash
  cd backend
  python3.11 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  gunicorn main:app \
    -k uvicorn.workers.UvicornWorker \
    --workers 3 \
    --threads 2 \
    --timeout 120 \
    --graceful-timeout 30 \
    --keep-alive 5 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --bind 0.0.0.0:5000
  ```
- **Evidence**: Health check test successful
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 4.2 Configure Frontend Deployment Platform
- **Owner**: DevOps/Infrastructure Lead
- **Task**: Set up static hosting (Vercel, Netlify, S3+CloudFront, etc.)
- **Requirements**:
  - Node 18 build environment
  - Environment file: `frontend/.env.production` with:
    - `VITE_API_URL=https://api.yourdomain.com`
    - `VITE_GOOGLE_CLIENT_ID=<your-google-web-client-id>`
    - `VITE_APPLE_CLIENT_ID=<your-apple-service-id>`
    - `VITE_APPLE_REDIRECT_URI=https://app.yourdomain.com`
  - Build command: `npm ci && npm run build`
  - Output directory: `dist/`
  - Cache headers: Set long TTL for asset files, short/no-cache for index.html
- **Evidence**: Frontend build and deployment successful
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 4.5 Validate Social Sign-In in Production
- **Owner**: QA Lead / Security Lead
- **Task**: Verify Google and Apple sign-in behavior for existing and first-time users
- **Validation Cases**:
  1. Existing Google user login succeeds.
  2. Existing Apple user login succeeds.
  3. First-time social login without subscriber type returns HTTP 400.
  4. First-time social login with subscriber type and lender data-sharing preference succeeds.
- **Evidence**: API logs/screenshots showing expected status codes and successful session creation
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 4.3 Configure HTTPS/SSL
- **Owner**: Infrastructure Lead
- **Task**: Enable SSL/TLS for both backend and frontend domains
- **Requirements**:
  - Certificate: Valid, non-self-signed (e.g., Let's Encrypt)
  - Backend: HTTPS on port 443, HTTP → HTTPS redirect
  - Frontend: HTTPS only
  - HSTS header: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- **Validation**:
  ```bash
  curl -I https://api.yourdomain.com/health
  # Should return 200 with HSTS header
  
  curl -I https://app.yourdomain.com
  # Should return 200, no HTTP fallback
  ```
- **Evidence**: HTTPS test screenshots
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 4.4 Set Up Load Balancer (if multi-instance)
- **Owner**: Infrastructure Lead
- **Task**: Configure load balancer to distribute traffic across backend instances
- **Requirements** (if applicable):
  - Health check endpoint: `/health`
  - Session affinity: Not required (stateless API)
  - Rate limit handling: Forward requests to backend rate limiter
- **Evidence**: Load balancer configuration screenshot
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

---

## Section 5: Backup & Disaster Recovery

### 5.1 Configure Daily Automated Backups
- **Owner**: DBA/Ops Lead
- **Task**: Set up daily backup schedule for database and critical files
- **Frequency**: Daily at 01:30 UTC
- **Backup Components**:
  - Database: PostgreSQL dump (custom format)
  - Documents: Tar.gz or zip archive
  - Configuration: Env files (encrypted)
- **Retention**: Minimum 30 days
- **Script**: `ops/backup/run_daily_backup.sh` (Linux/macOS) or `run_daily_backup.ps1` (Windows)
- **Verification**: Run `python ops/backup/verify_backups.py --backup-root backups/daily`
- **Evidence**: Backup verification output showing successful backup(s)
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 5.2 Test Backup Restore in Staging
- **Owner**: DBA/Ops Lead
- **Task**: Perform full test restore from latest backup to staging environment
- **Steps**:
  1. Stop staging backend
  2. Run restore script: `ops/dr/restore_from_backup.sh <backup_run_path>` (or PS1 on Windows)
  3. Verify database integrity
  4. Run smoke tests on restored data
  5. Verify audit logs are present
- **Expected RTO**: < 4 hours
- **Expected RPO**: < 24 hours
- **Evidence**: Restore test log showing success and smoke test results
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 5.3 Document Rollback Procedure
- **Owner**: Ops Lead
- **Task**: Create and test a procedure to quickly revert to previous production version
- **Steps** (outline):
  1. Revert frontend CDN/static host to previous version tag
  2. Scale backend to previous version image
  3. Verify `/health` endpoint responds
  4. Run smoke tests (login, basic workflow)
  5. Monitor error rates for 10 minutes
- **Estimated Time**: 15-30 minutes
- **Evidence**: Rollback runbook document
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

---

## Section 6: Monitoring, Logging & Alerting

### 6.1 Configure Application Monitoring
- **Owner**: Ops/SRE Lead
- **Task**: Set up Prometheus metrics collection and baseline performance
- **Metrics to Capture**:
  - Request latency (p50, p95, p99)
  - Error rate (5xx, 4xx)
  - Database connection pool utilization
  - Redis connection health
- **Prometheus Endpoint**: `GET /metrics`
- **Baseline SLOs**:
  - API uptime: >= 99.9% monthly
  - p95 latency: <= 300ms
  - Error rate: <= 1% (excluding 4xx)
- **Evidence**: Prometheus dashboard showing metrics collection working
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 6.2 Configure Error Tracking (Sentry)
- **Owner**: Ops Lead
- **Task**: Set up Sentry DSN for exception monitoring
- **Configuration**:
  - `SENTRY_DSN`: Set (get from Sentry.io)
  - `SENTRY_ENVIRONMENT`: `production`
  - `SENTRY_TRACES_SAMPLE_RATE`: 0.05 (5% trace sampling)
  - `SENTRY_PROFILES_SAMPLE_RATE`: 0.0 (disable profiling initially)
- **Validation**: Deploy and trigger a test error, verify in Sentry dashboard
- **Evidence**: Sentry dashboard showing received events
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 6.3 Configure Log Aggregation
- **Owner**: Ops/SRE Lead
- **Task**: Set up centralized logging (e.g., ELK, Datadog, CloudWatch)
- **Log Streams**:
  - Backend API: `fleet.api`
  - Backend Errors: `fleet.error`
  - Security/Audit: `fleet.security`, `fleet.audit`
  - AI usage: `fleet.ai`
- **Log Retention**: Minimum 30 days
- **Evidence**: Log aggregation dashboard showing incoming logs
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 6.4 Configure Alerts & Notification Channels
- **Owner**: Ops/SRE Lead
- **Task**: Set up alert rules and on-call notification routing
- **Critical Alerts** (trigger page immediately):
  - 5xx error rate > 10% for 5 min
  - p95 latency > 1 second for 10 min
  - Database connection pool exhaustion
  - Redis connectivity failure
- **Warning Alerts** (email/Slack):
  - 5xx error rate > 5% for 15 min
  - p95 latency > 500ms for 10 min
  - Dead-letter queue growth > 100 messages
- **Notification Channels**: PagerDuty, Slack, email (as configured)
- **Evidence**: Alert configuration screenshot and test alert delivery
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

---

## Section 7: Operational Readiness

### 7.1 Assign On-Call Ownership
- **Owner**: Engineering Lead
- **Task**: Document on-call rotation and escalation contacts
- **Document**:
  - Primary on-call: Name, phone, email
  - Escalation (30 min): Name, phone, email
  - Manager (60 min): Name, phone, email
  - SLA response times: P1 (15 min), P2 (1 hour), P3 (4 hours)
- **Evidence**: On-call runbook document signed by all parties
- **Signatures**:
  - Primary: _________________ Date: _______
  - Escalation: _________________ Date: _______
  - Manager: _________________ Date: _______
- [ ] COMPLETE

### 7.2 Create Production Runbooks
- **Owner**: Ops Lead
- **Task**: Document standard operating procedures
- **Runbooks Required**:
  - Deployment runbook (deploy new version)
  - Rollback runbook (revert to previous version)
  - Database runbook (connection troubleshooting, query diagnostics)
  - Alert response runbook (common alerts and remediation steps)
  - Incident runbook (major outage response, stakeholder comms)
- **Evidence**: Runbook documents reviewed and signed by ops team
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 7.3 Conduct Load Testing
- **Owner**: QA/Ops Lead
- **Task**: Execute load test to validate SLOs under expected peak load
- **Test Scenarios**:
  - Sustained 100 req/sec for 10 minutes
  - Peak burst: 500 req/sec for 1 minute
  - Measure: latency distribution, error rate, resource utilization
- **Pass Criteria**:
  - p95 latency <= 300ms under sustained load
  - p99 latency <= 1 second under sustained load
  - Error rate <= 1%
  - No connection pool exhaustion
- **Evidence**: Load test report with latency graphs and pass/fail summary
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 7.4 Conduct Staged Rollout Drill
- **Owner**: Ops/DevOps Lead
- **Task**: Test deployment procedure with canary/staged approach
- **Steps**:
  1. Deploy to staging environment
  2. Run smoke tests (login, critical workflows)
  3. Deploy to 10% of production traffic (canary)
  4. Monitor metrics for 15 min
  5. Deploy to 100% of production traffic
  6. Monitor for 30 min, then declare success
- **Evidence**: Staged rollout test report and deployment logs
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

---

## Section 8: Security & Compliance Final Checks

### 8.1 Dependency Vulnerability Scan Review
- **Owner**: Security Lead
- **Task**: Review latest CI security scan results for unresolved HIGH/CRITICAL findings
- **Commands** (manual re-run if needed):
  ```bash
  cd backend && pip-audit -r requirements.txt
  cd frontend && npm audit --omit=dev --audit-level=high
  ```
- **Action**: Resolve or create exception for any HIGH/CRITICAL issues
- **Evidence**: Security scan report with approval sign-off
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 8.2 Secret Scan Final Pass
- **Owner**: Security Lead
- **Task**: Run Gitleaks on full repository history to confirm no secrets committed
- **Command**:
  ```bash
  docker run zricethezav/gitleaks:latest detect --source . --verbose
  ```
- **Expected Result**: No findings
- **Evidence**: Gitleaks scan output showing 0 findings
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 8.3 Penetration Test (Optional but Recommended)
- **Owner**: Security Lead / External Firm
- **Task**: Contract with security firm for light penetration test (1-2 days)
- **Scope**:
  - API authentication/authorization bypass
  - Injection vulnerabilities (SQL, NoSQL, command)
  - Session hijacking / token theft
  - CORS misconfigurations
- **Evidence**: Penetration test report with findings and remediation status
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE (or waived: _________________ Date: _______  )

### 8.4 Audit Logging Verification
- **Owner**: Compliance/Ops Lead
- **Task**: Verify audit logs are being captured for critical operations
- **Critical Actions to Log**:
  - User login/logout
  - Loan application state transitions
  - Document upload/download
  - User role/permission changes
  - Configuration changes
- **Validation**: Trigger sample action and verify logged in audit table
- **Evidence**: Audit log verification screenshots
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

---

## Section 9: Data Governance & Legal

### 9.1 Privacy Policy & Terms Updated
- **Owner**: Legal/Product Lead
- **Task**: Ensure privacy policy and terms of service reflect production data handling
- **Items to Review**:
  - Data retention policy (30+ days backup)
  - GDPR data deletion procedures
  - Incident notification procedures
  - Third-party service integration disclosure (Sentry, etc.)
- **Evidence**: Updated policy documents with effective date
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 9.2 Data Retention Policy Documented
- **Owner**: Compliance Lead
- **Task**: Document data retention policy and implement automated cleanup (if applicable)
- **Retention Periods**:
  - Audit logs: 90+ days
  - Backups: 30+ days
  - User session logs: 30 days
  - Deleted user data: purge within 30 days
- **Evidence**: Data retention policy document
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

---

## Section 10: Go-Live Approval

### 10.1 Executive Sign-off
- **Owner**: Engineering Lead / CTO
- **Task**: Confirm all sections are complete and system is ready for production
- **Conditions Met**:
  - [ ] All security checks passed (Section 8)
  - [ ] All infrastructure is provisioned and tested (Section 4)
  - [ ] Monitoring and alerting are active (Section 6)
  - [ ] On-call team is trained and ready (Section 7)
  - [ ] Backup and rollback procedures are tested (Section 5)
  - [ ] Load tests pass (Section 7.3)
  - [ ] Legal/compliance sign-off received (Section 9)
- **Executive Approval**:
  - Name: _____________________
  - Title: _____________________
  - Signature: _________________ Date: _______
  - [ ] APPROVED FOR GO-LIVE

### 10.2 Post-Launch Monitoring (First 24 Hours)
- **Owner**: Ops Lead (on-call)
- **Task**: Monitor system continuously for first 24 hours and log observations
- **Metrics to Track**:
  - Error rate (target: <= 1%)
  - Latency p95 (target: <= 300ms)
  - Database connection pool utilization (target: < 80%)
  - Redis connection health (target: connected)
  - Alert frequency (expected: few to none)
- **Daily Report**:
  - Errors: ______ (2xx%), Latency: ______ ms p95, Incidents: ______
  - Issues encountered: _____________________________
  - Resolutions applied: _____________________________
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

---

## Section 11: Post-Launch Tasks

### 11.1 Schedule Security Dependency Updates
- **Owner**: DevOps Lead
- **Task**: Enable Dependabot and schedule weekly dependency PR reviews
- **Review Cadence**: Weekly (Monday morning)
- **Approval Gate**: Security team reviews HIGH/CRITICAL, engineering reviews others
- **Rollout**: Fast-track security updates, standard process for others
- **Evidence**: Dependabot configuration screenshot
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 11.2 Schedule Weekly Security Scans
- **Owner**: DevOps Lead
- **Task**: Confirm automated weekly security scans are running (`.github/workflows/security-weekly.yml`)
- **Schedule**: Monday 03:00 UTC
- **Escalation**: Security team notified of any HIGH/CRITICAL findings
- **Evidence**: GitHub Actions workflow execution history
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 11.3 Schedule Monthly Backup Restore Drill
- **Owner**: DBA/Ops Lead
- **Task**: Set calendar reminder to test backup restore monthly
- **Procedure**: Section 5.2 (Test Backup Restore in Staging)
- **Calendar Entry**: 1st Friday of each month at 10:00 AM
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

### 11.4 Schedule Monthly Load Test Validation
- **Owner**: QA/Ops Lead
- **Task**: Re-run load tests monthly to ensure continued performance compliance
- **Calendar Entry**: 2nd Friday of each month at 14:00 UTC
- **Expected Results**: Latency/error rate metrics from Section 7.3
- **Owner Sign-off**: _________________ Date: _______
- [ ] COMPLETE

---

## Summary & Final Attestation

**Total Sections**: 11  
**Total Items**: 43  
**Items Complete**: ______ / 43  

### Completion Timeline
- **Started**: _______
- **Expected Completion**: _______
- **Actual Completion**: _______

### Attestation
I hereby attest that all items in this launch checklist have been completed, validated, and signed off by the responsible parties. The Fleet Management System is production-ready and safe for global launch.

**Engineering Lead**: _________________ Date: _______

**Operations Lead**: _________________ Date: _______

**Security Lead**: _________________ Date: _______

**Executive Sponsor**: _________________ Date: _______

---

**Distribution**: Attach this completed checklist to the deployment authorization email and retain for audit purposes.
