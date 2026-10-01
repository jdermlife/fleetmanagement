# Security Policy

## Supported Versions

The latest main branch release is the supported production line.

| Version | Supported |
| ------- | --------- |
| main (latest) | Yes |
| older branches | No |

## Reporting a Vulnerability

Do not open public issues for security vulnerabilities.

Report vulnerabilities privately to the maintainers with:
- Affected component and version
- Steps to reproduce
- Impact assessment
- Proof of concept (if available)
- Suggested mitigation (optional)

Acknowledgement target: within 3 business days.

Initial triage target: within 7 business days.

Fix timeline depends on severity:
- Critical: target patch or mitigation within 48 hours
- High: target patch or mitigation within 7 days
- Medium/Low: patch in next planned maintenance cycle

## Security Response Process

1. Validate report and assign severity.
2. Implement and review fix with tests.
3. Deploy mitigation to production.
4. Publish post-fix advisory summary.

## Content Security Policy Rollout

The Vercel frontend sends `Content-Security-Policy-Report-Only` on all routes. Reports are posted to the same-origin FastAPI collector, which records only normalized directive and origin metadata.

Review production violations by directive and blocked origin before changing the allowlist. Promote the policy to `Content-Security-Policy` only after core authentication, payment, challenge, reporting, and media workflows have no unexplained violations. Remove `'unsafe-inline'` from `style-src` only after inline React styles have been migrated or a compatible nonce/hash strategy is in place.

## Browser Token Storage

The current Web Storage token implementation is scheduled for a coordinated frontend and FastAPI migration. The target uses an HttpOnly refresh cookie and a memory-only access token; authentication tokens must not be relocated to another JavaScript-readable persistent store. The rollout contract, native-client constraints, release gates, and rollback strategy are maintained in `TOKEN_STORAGE_MIGRATION_PLAN.md`.
