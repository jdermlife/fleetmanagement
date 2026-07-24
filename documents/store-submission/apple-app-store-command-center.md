# Apple App Store Command Center

Purpose: one-page run sheet for closing AP-03 through AP-08 with minimal context switching.

## Current State

- Closed: AP-01, AP-02
- In Progress: AP-03, AP-06
- Open: AP-04, AP-05, AP-07, AP-08

## Execution Order

1. AP-03 iOS archive and TestFlight upload
2. AP-04 iPhone/TestFlight device QA
3. AP-05 reviewer/demo account validation and review notes
4. AP-06 App Privacy completion and approval
5. AP-07 App Store screenshots and listing package
6. AP-08 privacy manifest/SDK declaration audit

## Immediate Action Queue (Today)

1. Execute documents/release-evidence/ios-testflight-release-runbook.md.
2. Update documents/release-evidence/signed-build-evidence.md and confirm TestFlight status.
3. Run documents/release-evidence/ios-first-testflight-build-qa-checklist.md and capture results in documents/release-evidence/device-qa-matrix.md.
4. Validate and finalize documents/release-evidence/reviewer-demo-account-evidence.md.
5. Complete App Privacy answers in App Store Connect using documents/store-submission/apple-app-store-submission-draft.md.
6. Complete iPhone screenshot set in documents/release-evidence/screenshot-asset-checklist.md.
7. Resolve PrivacyInfo.xcprivacy requirement and record outcome in documents/store-submission/apple-app-store-submission-draft.md.

## Same-Day Execution Log (2026-07-25)

Use this as the working timestamp log while executing AP-03 through AP-08.

| Time (Asia/Manila) | Blocker | Action | Owner | Result | Evidence Updated | Next Step |
| --- | --- | --- | --- | --- | --- | --- |
| 09:00 | AP-03 | Start iOS archive and TestFlight upload runbook | Mobile Engineer | In Progress (handoff issued) | documents/release-evidence/signed-build-evidence.md | Execute handoff in documents/store-submission/apple-ap03-testflight-handoff.md |
| 10:30 | AP-03 | Verify TestFlight processing state | Release Manager | Pending | documents/release-evidence/signed-build-evidence.md | If ready, handoff to AP-04 QA |
| 11:00 | AP-04 | Execute first TestFlight iPhone QA pass | QA Lead | Pending | documents/release-evidence/device-qa-matrix.md | Log pass/fail and blocker notes |
| 12:00 | AP-05 | Validate reviewer account and notes on signed build | Product Lead + Ops Lead | Pending | documents/release-evidence/reviewer-demo-account-evidence.md | Confirm reviewer route coverage |
| 13:30 | AP-06 | Finalize App Privacy answers with legal/product review | Product Lead + Legal Lead | Pending | documents/store-submission/apple-app-store-submission-draft.md | Mark approved answer set |
| 15:00 | AP-07 | Complete iPhone screenshot asset package | Design Lead | Pending | documents/release-evidence/screenshot-asset-checklist.md | Confirm all required sizes |
| 16:00 | AP-08 | Complete privacy manifest/SDK requirement audit | iOS Engineer | Pending | documents/store-submission/apple-app-store-submission-draft.md | Decide if PrivacyInfo.xcprivacy is required |
| 17:00 | AP-03..AP-08 | Sync statuses across all trackers | Release Manager | Pending | blocker sheet + owner tracker + readiness matrix | Run end-of-day go/no-go check |

## Status Transition Targets (2026-07-25)

- AP-03:
  - Start state: In Progress
  - Target by 10:30: In Progress
  - Close condition today: TestFlight upload complete and processing started with evidence recorded
- AP-04:
  - Start state: Open
  - Target by 11:00: In Progress
  - Close condition today: first real-iPhone QA pass recorded with critical flows validated or issues logged
- AP-05:
  - Start state: Open
  - Target by 12:00: In Progress
  - Close condition today: reviewer account validated on signed iOS build and final reviewer note confirmed
- AP-06:
  - Start state: In Progress
  - Target by 13:30: In Review
  - Close condition today: final App Privacy declarations approved by Product + Legal + Engineering
- AP-07:
  - Start state: Open
  - Target by 15:00: In Progress
  - Close condition today: required iPhone screenshot set captured and checklist marked complete
- AP-08:
  - Start state: Open
  - Target by 16:00: In Progress
  - Close condition today: SDK/privacy manifest requirement decision recorded; if required, manifest file created and referenced

If any close condition cannot be met by target time, update affected blockers to
`In Progress` with blocker reason and carryover owner before end-of-day sync.

## Run Sheet

### AP-03

- Run:
  - documents/release-evidence/ios-testflight-release-runbook.md
  - documents/release-evidence/ios-testflight-upload-status-checklist.md
- Update evidence:
  - documents/release-evidence/signed-build-evidence.md

### AP-04

- Run:
  - documents/release-evidence/ios-first-testflight-build-qa-checklist.md
  - documents/release-evidence/device-qa-execution-script.md
- Update evidence:
  - documents/release-evidence/device-qa-matrix.md

### AP-05

- Run:
  - documents/release-evidence/reviewer-demo-account-fill-guide.md
- Update evidence:
  - documents/release-evidence/reviewer-demo-account-evidence.md

### AP-06

- Run:
  - documents/store-submission/apple-app-store-submission-draft.md
  - documents/store-submission/privacy-data-inventory.md
- Update evidence:
  - documents/store-submission/apple-app-store-submission-draft.md

### AP-07

- Run:
  - documents/store-submission/public-facing-submission-metadata-draft.md
- Update evidence:
  - documents/release-evidence/screenshot-asset-checklist.md

### AP-08

- Run:
  - documents/store-submission/apple-app-store-submission-draft.md
- Update evidence:
  - documents/store-submission/apple-app-store-submission-draft.md

## Closeout Actions (Every Blocker)

- Update state in:
  - documents/store-submission/apple-app-store-go-live-blockers.md
  - documents/store-submission/apple-app-store-blocker-owner-tracker.md
  - documents/store-submission/submission-readiness-matrix.md
- Record:
  - closure date
  - owner
  - evidence path

## Daily Cadence

- Start of day:
  - Review documents/store-submission/apple-app-store-go-live-blockers.md
  - Review documents/store-submission/apple-app-store-blocker-owner-tracker.md
  - Review documents/store-submission/submission-readiness-matrix.md
- End of day:
  - Sync blocker and owner tracker statuses
  - Update readiness matrix Apple section if any AP status changed
