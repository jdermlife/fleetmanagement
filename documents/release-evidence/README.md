# Release Evidence Package

This folder is the evidence counterpart to `documents/store-submission/`.

Use it to store proof for the remaining red blockers before:

- Google Play submission
- Apple App Store submission
- broader global production launch

## Suggested Contents

- `android-keystore-fill-guide.md`
  Line-by-line explanation of how to fill `frontend/android/keystore.properties`.
- `android-keystore-setup-checklist.md`
  Pre-build checklist for confirming keystore and `keystore.properties` values.
- `android-version-bump-checklist.md`
  Pre-build checklist for updating Android `versionCode` and `versionName`.
- `android-signed-release-runbook.md`
  Step-by-step process for creating the first signed Android `AAB`.
- `android-artifact-verification-and-evidence-fill-guide.md`
  Post-build commands and field-by-field instructions for recording Android build evidence.
- `ios-version-bump-checklist.md`
  Pre-build checklist for updating iOS `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`.
- `ios-testflight-release-runbook.md`
  Step-by-step process for creating the first iOS archive and TestFlight upload.
- `ios-artifact-verification-and-evidence-fill-guide.md`
  Post-build instructions for verifying the iOS archive/TestFlight upload and recording evidence.
- `ios-testflight-upload-status-checklist.md`
  Short post-upload status capture for the first TestFlight submission.
- `ios-qa-session-sheet.md`
  Prefilled iPhone/TestFlight QA starter sheet using the expected build metadata.
- `signed-build-evidence.md`
  Record Android and iOS release build details and artifact locations.
- `screenshot-asset-checklist.md`
  Track screenshot and listing-asset completion.
- `device-qa-matrix.md`
  Record real-device QA results for Android and iPhone.
- `device-qa-execution-script.md`
  Step-by-step tester script for running and recording the device QA pass.
- `android-first-signed-build-qa-checklist.md`
  Short sanity pass for the first signed Android build before broader QA.
- `android-qa-session-sheet.md`
  Prefilled Android QA starter sheet using the current signed release artifact metadata.
- `ios-first-testflight-build-qa-checklist.md`
  Short sanity pass for the first TestFlight build before broader QA.
- `reviewer-demo-account-evidence.md`
  Capture reviewer/demo credentials, access notes, and validation status.
- `reviewer-demo-account-fill-guide.md`
  Step-by-step guide for preparing the reviewer/demo-account package.

## What This Folder Should Eventually Hold

- signed build filenames and hashes
- build dates and version numbers
- screenshot inventory and ownership
- device/OS/browser validation results
- TestFlight / internal track rollout evidence
- reviewer account validation notes

## Current Status

At creation time, this folder contains templates only.

Nothing in this folder should be treated as proof until it is filled out with
actual release evidence.
