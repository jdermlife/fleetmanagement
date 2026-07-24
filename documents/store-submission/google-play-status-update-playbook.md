# Google Play Status Update Playbook

Date: 2026-07-25
Purpose: provide one repeatable method to update blocker status consistently across all tracking documents.

## When To Use

Use this playbook every time any blocker changes state:

- Open -> In Progress
- In Progress -> Closed
- Closed -> Reopened

## Source-Of-Truth Files

Update these files in the same session:

- documents/store-submission/google-play-go-live-blockers.md
- documents/store-submission/google-play-blocker-owner-tracker.md
- documents/store-submission/google-play-daily-ops-log.md

Optional updates when relevant:

- documents/store-submission/google-play-closure-plan-2026-07-24-to-2026-08-02.md
- documents/store-submission/google-play-command-center.md

## Required Fields Per Status Change

For each blocker changed:

- New status value
- Effective date
- Owner responsible for update
- Evidence path
- Short note describing what changed

## Update Sequence

1. Update blocker state in google-play-go-live-blockers.md.
2. Update matching tracker row in google-play-blocker-owner-tracker.md.
3. Append a dated entry in google-play-daily-ops-log.md.
4. If milestone-level progress changed, update closure plan execution log.

## Closure Rules

A blocker can be Closed only if:

- Exit criteria are satisfied
- Evidence file is filled with real results
- Closure note includes date and owner

## Reopen Rules

Reopen a blocker when:

- Evidence is incomplete or invalidated
- Regression is discovered in QA or review
- Policy/legal sign-off is revoked or changed

## Daily Review Checklist

- [ ] Blocker sheet and tracker statuses match
- [ ] Evidence paths are valid and current
- [ ] Daily ops log contains today update
- [ ] Risks and next checkpoint are current

## Suggested Entry Format For Daily Ops Log

- Blocker updated:
- Previous status:
- New status:
- Evidence file:
- Updated by:
- Notes:
