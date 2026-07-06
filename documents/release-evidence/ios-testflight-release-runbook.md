# iOS TestFlight Release Runbook

Use this runbook to produce the first iOS release archive and upload it to
TestFlight.

## Repo Files Involved

- iOS project:
  `frontend/ios/App/App.xcodeproj/project.pbxproj`
- iOS app metadata:
  `frontend/ios/App/App/Info.plist`
- Build evidence target:
  `documents/release-evidence/signed-build-evidence.md`
- Submission status tracker:
  `documents/store-submission/submission-readiness-matrix.md`

## Current Repo Metadata

- Bundle ID:
  `com.fms.mobile`
- Marketing version:
  `1.0.1`
- Build number:
  `2`
- Deployment target:
  `iOS 15.0`

## Preconditions

- macOS machine available
- Xcode installed
- Apple Developer account access available
- Signing certificate and provisioning access available
- App Store Connect app record exists for `com.fms.mobile`
- Frontend build already passes:
  - `npm run build`

## Step 1: Bump iOS Version

Update the iOS project values in:

- `frontend/ios/App/App.xcodeproj/project.pbxproj`

Use checklist:

- `documents/release-evidence/ios-version-bump-checklist.md`

Fields to update:

- `MARKETING_VERSION`
- `CURRENT_PROJECT_VERSION`

Recommended:

- increment `CURRENT_PROJECT_VERSION` every build
- increment `MARKETING_VERSION` for user-facing releases

## Step 2: Sync Web Assets Into iOS Project

From `frontend/`:

```powershell
npm run mobile:sync
```

This ensures the latest web build is copied into the Capacitor iOS project.

## Step 3: Open The iOS Project In Xcode

From `frontend/`:

```powershell
npm run mobile:ios
```

Or open manually:

```text
frontend/ios/App/App.xcodeproj
```

## Step 4: Verify Signing

In Xcode:

1. Select the `App` target
2. Open `Signing & Capabilities`
3. Confirm:
   - team is correct
   - bundle ID is `com.fms.mobile`
   - signing certificate is valid
   - provisioning is valid for App Store distribution

## Step 5: Archive The Release Build

In Xcode:

1. Select a generic iOS device target
2. Choose:
   - `Product` -> `Archive`
3. Wait for the archive to complete

Expected result:

- archive appears in Xcode Organizer

## Step 6: Validate And Upload To TestFlight

In Organizer:

1. Select the new archive
2. Choose `Distribute App`
3. Select `App Store Connect`
4. Select `Upload`
5. Complete validation and upload

Record:

- upload date
- archive identifier
- uploaded build number
- TestFlight processing status

## Step 7: Record Evidence

Fill in the iOS section of:

- `documents/release-evidence/signed-build-evidence.md`
- `documents/release-evidence/ios-artifact-verification-and-evidence-fill-guide.md`

Record at minimum:

- bundle ID
- marketing version
- build number
- archive date
- who built it
- signing/provisioning verified
- archive or IPA path
- SHA256 hash if exported
- TestFlight upload status

## Step 8: Begin TestFlight QA

Once the build is visible in TestFlight:

1. add internal testers
2. install on real iPhone hardware
3. start recording results in:
   - `documents/release-evidence/ios-testflight-upload-status-checklist.md`
   - `documents/release-evidence/ios-first-testflight-build-qa-checklist.md`
   - `documents/release-evidence/device-qa-matrix.md`

## Done Criteria

- Xcode archive created successfully
- build uploaded to TestFlight
- signed-build evidence recorded
- real-device TestFlight QA can start

## Common Failure Modes

- bundle ID mismatch
- stale version/build number
- signing or provisioning mismatch
- Apple Sign-In or capability configuration mismatch
- archived build not using the latest synced web assets
- missing reviewer/demo account package after TestFlight is ready
