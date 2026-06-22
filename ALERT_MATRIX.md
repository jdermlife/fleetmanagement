# Production Alert Matrix

## Severity Levels
- P1 Critical: Immediate business impact, data integrity risk, outage.
- P2 High: Major degradation with workaround.
- P3 Medium: Partial degradation or elevated risk.
- P4 Low: Informational or early warning.

## Routing
- Primary channel: ALERT_WEBHOOK_URL target (Slack/Teams/Pager bridge).
- Escalation:
  - P1: On-call engineer immediately, manager in 15 minutes.
  - P2: On-call within 15 minutes.
  - P3: Business hours triage.
  - P4: Daily review.

## Alert Definitions

| Area | Signal | Threshold | Severity | Action |
|------|--------|-----------|----------|--------|
| Application Monitoring | API health check failure | 3 consecutive failed checks (1 min intervals) | P1 | Trigger incident, fail over if available |
| Application Monitoring | Pod/service restart loop | > 5 restarts in 10 min | P2 | Investigate crash logs and rollback if needed |
| API Monitoring | p95 latency | > 300 ms for 5 min on core endpoints | P2 | Scale service and inspect slow queries |
| API Monitoring | 5xx error rate | > 1% for 5 min | P1 | Incident response and recent deploy rollback check |
| Error Tracking | Unhandled exceptions | > 20 in 5 min | P2 | Check stack traces and hotfix/rollback |
| Error Tracking | Authentication failures spike | > 5x baseline in 10 min | P2 | Investigate attack/brute force, tune rate limits |
| Logging Backend | Log ingestion halted | No backend logs for 10 min | P2 | Validate logger pipeline and agent health |
| Logging Database | Deadlock/lock wait | > 10 deadlocks in 10 min | P2 | Query tuning and transaction review |
| Logging AI | AI error ratio | > 10% AI request failures over 15 min | P3 | Check provider latency/quota, enable fallback |
| Notification Framework | Dead letters growth | > 50 new dead letters in 1 hour | P2 | Requeue after fix; validate destination endpoints |
| Backup | Backup run missing | No daily backup in 26 hours | P1 | Execute manual backup and investigate scheduler |
| Backup | Backup checksum mismatch | Any mismatch in latest run | P1 | Quarantine artifact and re-run full backup |
| DR Verification | Restore drill failure | Any failed monthly drill step | P1 | Correct playbook and repeat drill |

## Core Endpoint Coverage
- /health
- /auth/login
- /api/loan-applications
- /workflows/loans/{id}/transition
- /documents/upload
- /notifications/dispatch

## Runbook Links
- DevOps requirements: DEVOPS_REQUIREMENTS.md
- Backup scripts: ops/backup/run_daily_backup.sh, ops/backup/run_daily_backup.ps1
- Backup verification: ops/backup/verify_backups.py
- Restore scripts: ops/dr/restore_from_backup.sh, ops/dr/restore_from_backup.ps1
