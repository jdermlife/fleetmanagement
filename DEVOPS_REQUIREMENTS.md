# DevOps Requirements

## Scope
This specification defines production DevOps requirements for monitoring, logging, CI/CD, backup, and disaster recovery.

## Monitoring Requirements

### Application Monitoring
- Track service health for backend API and frontend app.
- Expose and monitor uptime, restart frequency, and dependency availability.
- Define SLO targets:
  - API uptime >= 99.9% monthly.
  - Core endpoint p95 latency <= 300 ms.
  - Error rate <= 1% for non-4xx responses.

### Error Tracking
- Capture unhandled exceptions with request correlation data.
- Track error class, endpoint, release version, and user context (non-PII).
- Alert on:
  - Error rate spikes above baseline.
  - Repeated failures for notification dispatch and workflow transitions.
  - Dead-letter growth in notifications.

### API Monitoring
- Monitor endpoint throughput, latency percentiles, and status-code distribution.
- Critical endpoints to track:
  - /health
  - /auth/login
  - /api/loan-applications
  - /workflows/loans/{id}/transition
  - /documents/upload
  - /notifications/dispatch
- Alert if p95 latency or 5xx rate breaches thresholds for 5 minutes.

## Logging Requirements

### Frontend Logs
- Capture UI errors, failed API calls, and critical user actions.
- Include fields: timestamp, level, page, action, request_id, session_id.
- Redact secrets and personal identifiers before transport.

### Backend Logs
- Use structured JSON logs for API requests, security events, and business events.
- Include fields: timestamp, level, service, endpoint, method, status_code, duration_ms, request_id, user_id.
- Dedicated log channels available in backend/logging_config.py:
  - fleet.api
  - fleet.backend
  - fleet.security
  - fleet.audit
  - fleet.error

### Database Logs
- Enable query-level diagnostics for slow queries and connection failures.
- Log lock waits, deadlocks, and migration activity.
- Dedicated backend logger channel: fleet.database.

### AI Logs
- Capture AI request lifecycle: prompt class, token usage, latency, model, failure reason.
- Never persist raw sensitive input in logs.
- Dedicated backend logger channel: fleet.ai.

## CI/CD Requirements

Pipeline flow:
GitHub -> Build -> Test -> Deploy

### Required Stages
- Build:
  - Backend dependency installation and syntax compile checks.
  - Frontend type-check and production build.
- Test:
  - Backend smoke/unit tests.
  - Frontend build validation.
- Deploy:
  - Trigger backend and frontend deploy webhooks from main branch only.
  - Block deploy if any build/test stage fails.

### Implemented Workflow
- File: .github/workflows/ci-cd-deploy.yml
- Required secrets:
  - BACKEND_DEPLOY_WEBHOOK_URL
  - FRONTEND_DEPLOY_WEBHOOK_URL

### Nightly Backup Verification Workflow
- File: .github/workflows/nightly-backup-verification.yml
- Schedule: Daily at 01:30 UTC
- Required repository variable:
  - BACKUP_ROOT_PATH
- Optional repository variable:
  - BACKUP_MAX_AGE_HOURS (default 26)
- Optional secret for alerts:
  - ALERT_WEBHOOK_URL

## Backup Requirements

Frequency: Daily

Required backups:
- Database Backup
- Document Backup
- Configuration Backup

### Implemented Backup Scripts
- Linux/macOS:
  - ops/backup/run_daily_backup.sh
- Windows:
  - ops/backup/run_daily_backup.ps1
- Backup verification:
  - ops/backup/verify_backups.py

### Backup Artifacts Per Run
- database.dump (PostgreSQL custom format)
- documents archive (tar.gz on Unix, zip on Windows)
- config archive (tar.gz on Unix, zip on Windows)
- SHA256 checksum files for integrity verification

### Retention Policy
- Daily backups: 30 days minimum.
- Monthly full backups: 12 months minimum.
- Store copies in offsite/secondary storage.

## Disaster Recovery Requirements

### Restore Procedures
- Linux/macOS restore script:
  - ops/dr/restore_from_backup.sh
- Windows restore script:
  - ops/dr/restore_from_backup.ps1
- Restore order:
  1. Database
  2. Documents
  3. Configuration package
  4. Application startup and smoke tests

### Backup Verification
- Verify daily backup freshness and checksums with:
  - python ops/backup/verify_backups.py --backup-root backups/daily
- Perform test restore at least monthly in staging.
- Record RTO and RPO results after each drill.

### DR Targets
- RPO <= 24 hours.
- RTO <= 4 hours for critical service restoration.

## Operational Run Schedule
- Daily:
  - Run backup script.
  - Run backup verification script.
  - Review critical alerts (error rate, API latency, dead-letter queue).
- Weekly:
  - Review failed notifications and dead letters.
  - Validate backup retention and storage health.
- Monthly:
  - Execute full restore drill in staging.
  - Review SLO/SLA compliance and tune thresholds.

## Environment Variables
- DATABASE_URL
- BACKEND_DEPLOY_WEBHOOK_URL (GitHub secret)
- FRONTEND_DEPLOY_WEBHOOK_URL (GitHub secret)
- BACKUP_DIR (optional override)
- NOTIFICATION_DISPATCHER_ENABLED
- NOTIFICATION_DISPATCH_INTERVAL_SECONDS
- NOTIFICATION_DISPATCH_BATCH_SIZE
- NOTIFICATION_MAX_ATTEMPTS
- NOTIFICATION_RETRY_BASE_SECONDS

## Acceptance Criteria
- CI/CD workflow runs build, test, and deploy stages successfully on main.
- Daily backup artifacts are created and checksum-verified.
- Restore scripts can recover database, documents, and configuration.
- Monitoring dashboards and alerts cover application, API, and error tracking.
- Logging streams exist for frontend, backend, database, and AI categories.

## Alert Matrix
- Production alert definitions and escalation map: ALERT_MATRIX.md
