# Google Play Blocker Owner Tracker (GP-03 to GP-08)

Last reviewed: 2026-07-25
Purpose: operational tracker for open Google Play blockers with owners, target dates, and status.

## Tracker

| ID | Blocker | Owner | Backup Owner | Target Date | Status | Evidence Path | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GP-03 | Data safety not finalized | Product Lead | Legal Lead | 2026-07-29 | In Progress | documents/release-evidence/data-safety-final-answers.md | Prefilled draft prepared; product/legal review comments due 2026-07-25 EOD |
| GP-04 | Content rating questionnaire not completed | Product Lead | Compliance Lead | 2026-07-29 | In Progress | documents/release-evidence/content-rating-final-evidence.md | Prefilled rating baseline prepared; Product/Compliance to confirm final questionnaire selections |
| GP-05 | Store listing asset package incomplete | Design Lead | Product Marketing | 2026-07-31 | Open | documents/release-evidence/screenshot-asset-checklist.md | Final screenshots and listing assets pending |
| GP-06 | Real-device Android QA evidence missing | QA Lead | Mobile Engineer | 2026-08-01 | Open | documents/release-evidence/device-qa-matrix.md | Physical device matrix execution pending |
| GP-07 | Permission disclosure validation incomplete | QA Lead | Mobile Engineer | 2026-08-01 | Open | documents/release-evidence/android-permission-prompt-evidence.md | RECORD_AUDIO prompt validation pending |
| GP-08 | Review environment and reviewer path not finalized | Ops Lead | Backend Lead | 2026-08-02 | Open | documents/release-evidence/reviewer-demo-account-evidence.md | Backend /health and /ready endpoints verified; signed-build reviewer validation still pending |

## Weekly Update Fields

Update at least once per week:

- Last updated by: GitHub Copilot (execution support)
- Last updated at: 2026-07-25
- Risks this week: Product/legal approvals for GP-03 and GP-04 may slip the 2026-07-29 close target if not completed by 2026-07-28.
- Help needed: Product, Legal, Compliance, and Engineering to complete GP-03/GP-04 approvals and console evidence, then execute GP-05 through GP-08 via documents/store-submission/gp05-gp08-execution-checklist.md.

Working coordination docs:

- documents/store-submission/google-play-command-center.md
- documents/store-submission/google-play-daily-ops-log.md
- documents/store-submission/google-play-status-update-playbook.md

## Closure Rule

A blocker can be marked Closed only if:

- Status is changed to Closed
- Evidence path contains completed artifact
- Closing owner and date are recorded in notes

## Sync Rule

Any status change here must also be reflected in:

- documents/store-submission/google-play-go-live-blockers.md
