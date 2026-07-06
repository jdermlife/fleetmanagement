# Android QA Session Sheet

Use this sheet when starting the first real-device Android validation pass for
the signed release artifact already built in this workspace.

This is a convenience layer on top of:

- `documents/release-evidence/android-first-signed-build-qa-checklist.md`
- `documents/release-evidence/device-qa-execution-script.md`
- `documents/release-evidence/device-qa-matrix.md`

## Current Signed Build Metadata

- Build type:
  `Release`
- Artifact type:
  `AAB`
- Version name:
  `1.0.1`
- Version code:
  `2`
- Package name:
  `com.fms.mobile`
- Build date:
  `2026-07-06`
- Artifact path:
  `frontend/android/app/build/outputs/bundle/release/app-release.aab`
- SHA256:
  `CCC8C98EC6A2EA6C4876F9E6D057352A5E76088CD0FA151D0B6E7E69EFE5D93C`
- Upload status:
  `Not uploaded yet`

## Tester To Fill

- Device model:
- Android version:
- Installer source:
  - `Play internal track`
  - `Internal validation build`
- Tester:
- Test date:

## Immediate Checks

- [ ] Signed build source confirmed
- [ ] Correct build version confirmed as `1.0.1 (2)`
- [ ] Reviewer/demo credentials available
- [ ] Public `/support` URL available
- [ ] Public `/privacy` URL available
- [ ] Public `/terms` URL available

## Run In This Order

1. `android-first-signed-build-qa-checklist.md`
2. `device-qa-execution-script.md`
3. `device-qa-matrix.md`

## Fail Capture

If anything fails, record:

- failing step
- screenshot path or filename
- exact error text
- timestamp
- whether the failure blocks Play internal testing

## Finish Condition

This session sheet is complete when:

- the short Android sanity checklist is marked
- the full QA script has been run as far as applicable
- the device matrix is updated
- any blocker screenshots are saved and referenced
