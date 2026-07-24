# Google Play Single Source of Truth Map

Date: 2026-07-25
Purpose: define exactly which file is authoritative for each execution concern.

## Authoritative Files By Concern

- Blocker status source of truth:
  - documents/store-submission/google-play-go-live-blockers.md
- Owner and target-date source of truth:
  - documents/store-submission/google-play-blocker-owner-tracker.md
- Daily progress source of truth:
  - documents/store-submission/google-play-daily-ops-log.md
- Execution run-order source of truth:
  - documents/store-submission/google-play-command-center.md
- Status-update procedure source of truth:
  - documents/store-submission/google-play-status-update-playbook.md
- Timeline/milestones source of truth:
  - documents/store-submission/google-play-closure-plan-2026-07-24-to-2026-08-02.md

## Evidence Sources

- GP-03 Data Safety evidence:
  - documents/release-evidence/data-safety-final-answers.md
- GP-04 Content Rating evidence:
  - documents/release-evidence/content-rating-final-evidence.md
- GP-03/GP-04 screenshot capture index:
  - documents/release-evidence/gp03-gp04-screenshot-index.md
- GP-05 listing assets evidence:
  - documents/release-evidence/screenshot-asset-checklist.md
- GP-06 device QA evidence:
  - documents/release-evidence/device-qa-matrix.md
- GP-07 permission validation evidence:
  - documents/release-evidence/android-permission-prompt-evidence.md
- GP-08 reviewer/demo evidence:
  - documents/release-evidence/reviewer-demo-account-evidence.md

## Execution Checklists

- GP-03/GP-04 sign-off checklist:
  - documents/store-submission/gp03-gp04-stakeholder-signoff-pack.md
- GP-03/GP-04 console capture checklist:
  - documents/store-submission/gp03-gp04-console-capture-checklist.md
- GP-05 to GP-08 execution checklist:
  - documents/store-submission/gp05-gp08-execution-checklist.md
- GP-06/GP-07 Android QA deep checklist:
  - documents/store-submission/android-gp06-gp07-device-qa-checklist.md

## Conflict-Resolution Rule

If two files disagree:

1. Follow google-play-go-live-blockers.md for blocker state.
2. Follow google-play-blocker-owner-tracker.md for owner/date.
3. Follow google-play-status-update-playbook.md for update procedure.
4. Log the correction in google-play-daily-ops-log.md.
