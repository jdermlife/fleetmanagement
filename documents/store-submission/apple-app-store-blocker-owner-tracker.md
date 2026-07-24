# Apple App Store Blocker Owner Tracker (AP-03 to AP-08)

Last reviewed: 2026-07-25
Purpose: operational tracker for open Apple App Store blockers with owners, target dates, and status.

## Tracker

| ID | Blocker | Owner | Backup Owner | Target Date | Status | Evidence Path | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AP-03 | Signed iOS archive and TestFlight upload missing | Mobile Engineer | Release Manager | 2026-07-25 | In Progress | documents/release-evidence/signed-build-evidence.md | Highest priority today. Run documents/release-evidence/ios-testflight-release-runbook.md and record upload status. Handoff packet prepared in documents/store-submission/apple-ap03-testflight-handoff.md. |
| AP-04 | Real iPhone/TestFlight QA evidence missing | QA Lead | Mobile Engineer | 2026-07-25 | Open | documents/release-evidence/device-qa-matrix.md | Run first pass using documents/release-evidence/ios-first-testflight-build-qa-checklist.md after AP-03 upload. |
| AP-05 | App Review notes and reviewer/demo package not finalized | Product Lead | Ops Lead | 2026-07-25 | Open | documents/release-evidence/reviewer-demo-account-evidence.md | Validate credentials and reviewer note against signed build and live backend. |
| AP-06 | App Privacy answers not finalized | Product Lead | Legal Lead | 2026-07-25 | In Progress | documents/store-submission/apple-app-store-submission-draft.md | Complete final App Store Connect privacy declarations from verified runtime behavior. |
| AP-07 | App Store listing assets package incomplete | Design Lead | Product Marketing | 2026-07-25 | Open | documents/release-evidence/screenshot-asset-checklist.md | Capture required iPhone screenshot set and finalize listing copy. |
| AP-08 | Privacy manifest/SDK declaration review incomplete | iOS Engineer | Mobile Engineer | 2026-07-25 | Open | documents/store-submission/apple-app-store-submission-draft.md | Confirm whether PrivacyInfo.xcprivacy is required by SDK set and add if needed. |

## Daily Update Fields

Update at least once per day until all AP blockers are closed:

- Last updated by: GitHub Copilot (execution support)
- Last updated at: 2026-07-25
- Risks today: AP-03 delay blocks AP-04 and AP-05 execution.
- Help needed: mobile + product + legal coordination in the same day for AP-03 through AP-06 closure.

Status snapshot (baseline sync):

- AP-03: In Progress
- AP-04: Open
- AP-05: Open
- AP-06: In Progress
- AP-07: Open
- AP-08: Open

Working coordination doc:

- documents/store-submission/apple-app-store-command-center.md

## Closure Rule

A blocker can be marked Closed only if:

- Status is changed to Closed
- Evidence path contains completed artifact
- Closing owner and date are recorded in notes

## Sync Rule

Any status change here must also be reflected in:

- documents/store-submission/apple-app-store-go-live-blockers.md
- documents/store-submission/submission-readiness-matrix.md
