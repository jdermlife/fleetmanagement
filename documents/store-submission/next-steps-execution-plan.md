# Next Steps Execution Plan

This is the shortest practical real-world execution plan from the repo's
current state.

## Right Now

### 1. Upload the Android `AAB` to Google Play internal testing

Inputs already ready:

- `frontend/android/app/build/outputs/bundle/release/app-release.aab`
- `documents/release-evidence/signed-build-evidence.md`

After upload:

- update Android upload status in `signed-build-evidence.md`

### 2. Run the first Android device pass

Use:

- `documents/release-evidence/android-qa-session-sheet.md`
- `documents/release-evidence/android-first-signed-build-qa-checklist.md`
- `documents/release-evidence/device-qa-execution-script.md`
- `documents/release-evidence/device-qa-matrix.md`

## Next

### 3. Produce the first iOS archive and TestFlight upload

Use:

- `documents/release-evidence/ios-version-bump-checklist.md`
- `documents/release-evidence/ios-testflight-release-runbook.md`
- `documents/release-evidence/ios-artifact-verification-and-evidence-fill-guide.md`
- `documents/release-evidence/signed-build-evidence.md`

### 4. Run the first iPhone device pass

Use:

- `documents/release-evidence/ios-qa-session-sheet.md`
- `documents/release-evidence/ios-testflight-upload-status-checklist.md`
- `documents/release-evidence/ios-first-testflight-build-qa-checklist.md`
- `documents/release-evidence/device-qa-execution-script.md`
- `documents/release-evidence/device-qa-matrix.md`

## After Both Platform Builds Exist

### 5. Finalize the reviewer/demo-account package

Use:

- `documents/release-evidence/reviewer-demo-account-evidence.md`
- `documents/release-evidence/reviewer-demo-account-fill-guide.md`

### 6. Publish the public legal/support pages

Routes already exist in the app:

- `/support`
- `/privacy`
- `/terms`

What remains:

- deploy them to a real HTTPS domain
- update `frontend/store-metadata.template.json`

Use:

- `documents/store-submission/public-page-deployment-checklist.md`

### 7. Finalize store privacy answers

Use:

- `documents/store-submission/privacy-data-inventory.md`
- `documents/store-submission/google-play-submission-draft.md`
- `documents/store-submission/apple-app-store-submission-draft.md`

## Final Pre-Launch Work

### 8. Complete operational launch evidence

Use:

- `LAUNCH_CHECKLIST.md`

Highest-value unfinished items:

- production secrets and infra validation
- monitoring / alerting proof
- backup restore proof
- load/stability validation
- on-call / runbook sign-off

## Definition Of "Submission Ready"

You are materially ready to submit when all of these are true:

- signed Android `AAB` exists and is uploaded to internal testing
- first TestFlight build exists
- Android and iPhone QA evidence is recorded
- public support/privacy/terms URLs are live
- reviewer/demo account package is validated
- final privacy/data-safety answers are approved

## Definition Of "Global Launch Ready"

You are materially ready for broader launch when all of these are true:

- submission-ready conditions are met
- operational checklist evidence is complete
- monitoring, backup, and rollback evidence is recorded
- load/stability validation has passed
