# Apple AP-03 TestFlight Handoff Packet

Date: 2026-07-25
Scope: execute AP-03 on a macOS machine with Xcode access and return evidence updates.

## Objective

Close AP-03 by completing:

- iOS release archive in Xcode
- TestFlight upload to App Store Connect
- evidence updates in repo documentation

## Required Inputs

- Repo branch containing current submission docs
- Apple Developer account with distribution permissions
- Xcode access on macOS
- Correct signing team/provisioning for bundle ID com.fms.mobile

## Execution Steps

1. Open and run:
   - documents/release-evidence/ios-testflight-release-runbook.md
2. Complete and verify:
   - documents/release-evidence/ios-testflight-upload-status-checklist.md
3. Record evidence:
   - documents/release-evidence/signed-build-evidence.md

## Exact Fields To Return

Provide values for all fields below:

- Archive date
- Built by
- Signing/provisioning verified: yes/no
- Archive or IPA path
- Artifact hash (SHA256), if exported
- TestFlight upload status (Uploaded / Processing / Ready for Internal Testing)
- Build number uploaded
- Any validation warnings/errors encountered

## Status Update Rules After Run

If upload succeeds:

1. Set AP-03 to Closed in:
   - documents/store-submission/apple-app-store-go-live-blockers.md
   - documents/store-submission/apple-app-store-blocker-owner-tracker.md
2. Update Apple row in:
   - documents/store-submission/submission-readiness-matrix.md

If upload fails:

1. Keep AP-03 as In Progress.
2. Add blocker reason and next owner action in:
   - documents/store-submission/apple-app-store-blocker-owner-tracker.md
3. Log retry window in:
   - documents/store-submission/apple-app-store-command-center.md

## Handoff Return Template

Copy and fill this block after execution:

- AP-03 run date/time:
- Operator:
- Result: Success / Blocked
- Archive created: Yes / No
- Upload completed: Yes / No
- TestFlight state:
- Evidence files updated: Yes / No
- Follow-up required:
- Notes:
