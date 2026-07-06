# Signed Build Evidence

Use this file to record the exact signed artifacts used for store submission.

## Android

- Build type:
- Artifact type:
  - `AAB`
  - `APK` (internal only, if applicable)
- Version name:
- Version code:
- Package name:
  - `com.fms.mobile`
- Build date:
- Built by:
- Signing config verified:
  - [ ] yes
- Keystore file location:
- Key alias:
- Artifact path:
- Artifact hash (SHA256):
- Internal track / upload status:

## iOS

- Build type:
  - `Release`
- Distribution method:
  - `TestFlight`
  - `App Store`
- Bundle ID:
  - `com.fms.mobile`
- Marketing version:
- Build number:
- Archive date:
- Built by:
- Signing/provisioning verified:
  - [ ] yes
- Archive / IPA path:
- Artifact hash (SHA256):
- TestFlight upload status:

## Validation Checklist

- [ ] Android release build installs or uploads successfully
- [ ] iOS archive validates successfully in Xcode
- [ ] Version numbers match store metadata
- [ ] Signing identity is correct
- [ ] Artifact hashes are recorded

## Notes

- Do not store private signing secrets here.
- Store only paths, hashes, dates, and status evidence.

## Example Entry Format

Example Android entry:

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
- Built by:
  `Your Name`
- Signing config verified:
  - [x] yes
- Keystore file location:
  `frontend/android/release-keystore.jks`
- Key alias:
  `release_key_alias`
- Artifact path:
  `frontend/android/app/build/outputs/bundle/release/app-release.aab`
- Artifact hash (SHA256):
  `paste hash here`
- Internal track / upload status:
  `Uploaded to Google Play internal track`

Example iOS entry:

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
