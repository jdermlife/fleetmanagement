# iOS Artifact Verification And Evidence Fill Guide

Use this guide immediately after:

- creating the Release archive in Xcode
- uploading the build to TestFlight

This guide tells you:

1. what to verify in Xcode / Organizer / TestFlight
2. what exact fields to fill in
3. what minimum proof is needed for the first iOS build evidence entry

## Expected Outcome

After a successful iOS release pass, you should have:

- a valid Xcode archive
- a matching bundle ID
- a known marketing version and build number
- a TestFlight upload status

## Step 1: Confirm Archive Exists

In Xcode Organizer, confirm:

- the archive is visible
- the app name is correct
- the bundle ID is correct
- the build number matches the intended release

Record:

- archive date
- archive identifier or visible archive label

## Step 2: Confirm Version Values

Read the actual values used from:

- `frontend/ios/App/App.xcodeproj/project.pbxproj`

Expected current repo defaults:

- `MARKETING_VERSION = 1.0.1`
- `CURRENT_PROJECT_VERSION = 2`

If you changed them before archiving, record the actual archived values, not the
defaults shown above.

## Step 3: Confirm Signing / Provisioning

In Xcode Organizer or Signing settings, confirm:

- correct Apple Team
- bundle ID is `com.fms.mobile`
- signing certificate is valid
- provisioning is valid for TestFlight / App Store distribution

Record:

- signing/provisioning verified: `yes`

## Step 4: Confirm TestFlight Upload Result

After upload, record:

- upload date
- uploaded build number
- TestFlight status
  - `Uploaded`
  - `Processing`
  - `Ready for Internal Testing`
  - `Ready for External Testing`

## Step 5: Fill The iOS Section In `signed-build-evidence.md`

Use:

- `documents/release-evidence/signed-build-evidence.md`

Fill these fields:

- Build type:
  `Release`
- Distribution method:
  `TestFlight`
- Bundle ID:
  `com.fms.mobile`
- Marketing version:
  Example: `1.0.1`
- Build number:
  Example: `2`
- Archive date:
  actual archive date
- Built by:
  your name
- Signing/provisioning verified:
  mark checked after confirmation in Xcode
- Archive / IPA path:
  local archive path or exported artifact path
- Artifact hash (SHA256):
  optional if you exported an IPA or packaged artifact locally
- TestFlight upload status:
  Example: `Uploaded and processing in TestFlight`

## Example Filled iOS Entry

- Build type:
  `Release`
- Distribution method:
  `TestFlight`
- Bundle ID:
  `com.fms.mobile`
- Marketing version:
  `1.0.1`
- Build number:
  `2`
- Archive date:
  `2026-07-06`
- Built by:
  `Your Name`
- Signing/provisioning verified:
  - [x] yes
- Archive / IPA path:
  `path/to/archive/or/export`
- Artifact hash (SHA256):
  `paste hash here if exported`
- TestFlight upload status:
  `Uploaded and processing in TestFlight`

## Step 6: Decide The Next Action

If the archive and TestFlight upload are successful:

- run:
  - `documents/release-evidence/ios-first-testflight-build-qa-checklist.md`

If the upload fails:

- do not mark the iOS build blocker resolved
- fix the signing/provisioning/build issue first

## Minimum Proof Standard

For the iOS/TestFlight blocker to count as materially resolved, you should
have all of the following:

- archive exists
- bundle ID recorded
- marketing version and build number recorded
- signing/provisioning confirmation recorded
- TestFlight upload status recorded
