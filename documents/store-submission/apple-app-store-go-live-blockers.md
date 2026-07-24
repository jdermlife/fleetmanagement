# Apple App Store Go-Live Blockers (Strict)

Last reviewed: 2026-07-25

Purpose: this is a blocker-only checklist for moving from internal readiness to
Apple App Store submission readiness. If any item is open, do not submit for
App Review.

## Current Decision

- Submission to TestFlight Internal Testing: Allowed
- Submission to App Review as production-ready release: Blocked

## Status Sync Checkpoint

- Synced at: 2026-07-25 (baseline)
- AP-01: Closed
- AP-02: Closed
- AP-03: In Progress
- AP-04: Open
- AP-05: Open
- AP-06: In Progress
- AP-07: Open
- AP-08: Open

## Blockers Only

| ID | Blocker | Current state | Exit criteria (must be true) | Owner | Evidence to attach |
| --- | --- | --- | --- | --- | --- |
| AP-01 | Public privacy and support URLs not validated for App Review flow | Closed (2026-07-24) | Public `/support`, `/privacy`, and `/terms` URLs are live over HTTPS and reachable without authentication | Product + Web + Legal | documents/store-submission/public-facing-submission-metadata-draft.md |
| AP-02 | Base iOS metadata consistency not confirmed | Closed (2026-07-24) | Bundle ID, marketing version, build number, and Info.plist policy keys are aligned with submission metadata | Mobile Engineer | documents/store-submission/apple-app-store-submission-draft.md |
| AP-03 | Signed iOS release archive and TestFlight upload missing | In Progress (2026-07-25) | Xcode archive succeeds and build is uploaded to TestFlight with processing started | Mobile Engineer + Release Manager | documents/release-evidence/signed-build-evidence.md |
| AP-04 | Real iPhone/TestFlight QA evidence missing | Open | Critical flows pass on physical iPhone matrix using the TestFlight build | QA Lead + Mobile Engineer | documents/release-evidence/device-qa-matrix.md |
| AP-05 | App Review notes and reviewer/demo account package not finalized | Open | Reviewer note is finalized and reviewer credentials are validated on the signed iOS build | Product + QA + Ops | documents/release-evidence/reviewer-demo-account-evidence.md |
| AP-06 | App Privacy answers not finalized in App Store Connect | In Progress (2026-07-25) | App Privacy declarations are completed and approved by Product/Legal/Engineering from verified behavior | Product + Legal + Engineering | documents/store-submission/apple-app-store-submission-draft.md |
| AP-07 | App Store listing assets package incomplete | Open | Required iPhone screenshots and final listing copy are prepared and reviewed | Product + Design + Marketing | documents/release-evidence/screenshot-asset-checklist.md |
| AP-08 | Privacy manifest/SDK declaration review incomplete | Open | SDK/privacy manifest requirements are audited; `PrivacyInfo.xcprivacy` is added if required | iOS Engineer | documents/store-submission/apple-app-store-submission-draft.md |

## Already Satisfied (Not blockers)

- Bundle ID and iOS project metadata base exist for `com.fms.mobile`.
- `NSMicrophoneUsageDescription` is present.
- Sign in with Apple path exists.
- In-app account deletion flow exists.
- Public support, privacy, and terms URLs are deployed.

## Go/No-Go Rule

Go only when AP-01 through AP-08 are all closed and evidence is archived in the
store-submission and release-evidence folders.

## Working Artifacts

- Apple submission baseline and policy notes:
  documents/store-submission/apple-app-store-submission-draft.md
- iOS archive and TestFlight runbook:
  documents/release-evidence/ios-testflight-release-runbook.md
- TestFlight upload status checklist:
  documents/release-evidence/ios-testflight-upload-status-checklist.md
- First TestFlight QA checklist:
  documents/release-evidence/ios-first-testflight-build-qa-checklist.md
- Device QA evidence matrix:
  documents/release-evidence/device-qa-matrix.md
- Reviewer account and notes evidence:
  documents/release-evidence/reviewer-demo-account-evidence.md
- Listing screenshots and asset tracker:
  documents/release-evidence/screenshot-asset-checklist.md
- Apple command center run sheet:
  documents/store-submission/apple-app-store-command-center.md
- AP-03 execution handoff:
  documents/store-submission/apple-ap03-testflight-handoff.md

## Suggested Close Order

1. Close AP-03 first (archive + TestFlight upload).
2. Close AP-04 and AP-05 together (device QA + reviewer validation).
3. Close AP-06 (final App Privacy answers).
4. Close AP-07 (screenshots/listing package).
5. Close AP-08 last (manifest audit evidence before final App Review submission).
