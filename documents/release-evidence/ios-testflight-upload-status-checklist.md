# iOS TestFlight Upload Status Checklist

Use this checklist immediately after uploading the first iOS build to
App Store Connect / TestFlight.

This is the short status-capture step before broader device QA.

Record final results in:

- `documents/release-evidence/signed-build-evidence.md`
- `documents/release-evidence/reviewer-demo-account-evidence.md`

## Checks

- [ ] Archive is visible in Xcode Organizer
- [ ] Bundle ID shown is `com.fms.mobile`
- [ ] Marketing version shown is `1.0.1`
- [ ] Build number shown is `2`
- [ ] Upload to App Store Connect completed successfully
- [ ] TestFlight processing started
- [ ] No signing or provisioning validation errors remain

## Status To Record

- Archive date:
- Uploaded build number:
- Upload date:
- TestFlight status:
  - `Uploaded`
  - `Processing`
  - `Ready for Internal Testing`
  - `Ready for External Testing`
- Built by:
- Signing/provisioning verified by:

## If This Passes

Continue with:

- `documents/release-evidence/ios-first-testflight-build-qa-checklist.md`

## If This Fails

Capture:

- screenshot of the failing Xcode Organizer or App Store Connect status
- exact validation message
- timestamp
- whether the issue blocks all TestFlight testing
