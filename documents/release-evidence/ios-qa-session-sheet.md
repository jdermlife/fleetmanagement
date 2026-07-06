# iOS QA Session Sheet

Use this sheet when starting the first real-device iPhone validation pass for
the TestFlight build.

This is a convenience layer on top of:

- `documents/release-evidence/ios-testflight-upload-status-checklist.md`
- `documents/release-evidence/ios-first-testflight-build-qa-checklist.md`
- `documents/release-evidence/device-qa-execution-script.md`
- `documents/release-evidence/device-qa-matrix.md`

## Current Expected Build Metadata

- Build type:
  `Release`
- Distribution method:
  `TestFlight`
- Marketing version:
  `1.0.1`
- Build number:
  `2`
- Bundle ID:
  `com.fms.mobile`
- Upload status:
  `Not uploaded yet`

## Tester To Fill

- Device model:
- iOS version:
- Build tested:
- Tester:
- Test date:

## Immediate Checks

- [ ] TestFlight build is visible
- [ ] Correct build version confirmed as `1.0.1 (2)`
- [ ] Reviewer/demo credentials available
- [ ] Public `/support` URL available
- [ ] Public `/privacy` URL available
- [ ] Public `/terms` URL available

## Run In This Order

1. `ios-testflight-upload-status-checklist.md`
2. `ios-first-testflight-build-qa-checklist.md`
3. `device-qa-execution-script.md`
4. `device-qa-matrix.md`

## Fail Capture

If anything fails, record:

- failing step
- screenshot path or filename
- exact error text
- timestamp
- whether the failure blocks TestFlight review or App Review readiness

## Finish Condition

This session sheet is complete when:

- the TestFlight upload-status checklist is marked
- the short iOS sanity checklist is marked
- the full QA script has been run as far as applicable
- the device matrix is updated
- any blocker screenshots are saved and referenced
