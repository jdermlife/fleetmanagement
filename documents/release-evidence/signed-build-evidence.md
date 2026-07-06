# Signed Build Evidence

Use this file to record the exact signed artifacts used for store submission.

## Android

- Build type:
  `Release`
- Artifact type:
  - `AAB`
  - `APK` (internal only, if applicable)
- Version name:
  `1.0.1`
- Version code:
  `2`
- Package name:
  - `com.fms.mobile`
- Build date:
  `2026-07-06`
- Built by:
  `Codex local workspace session`
- Signing config verified:
  - [x] yes
- Keystore file location:
  `frontend/android/release-keystore.jks`
- Key alias:
  `release_key_alias`
- Artifact path:
  `frontend/android/app/build/outputs/bundle/release/app-release.aab`
- Artifact hash (SHA256):
  `CCC8C98EC6A2EA6C4876F9E6D057352A5E76088CD0FA151D0B6E7E69EFE5D93C`
- Internal track / upload status:
  `Not uploaded yet`

## iOS

- Build type:
  `Release`
- Distribution method:
  - `TestFlight`
  - `App Store`
- Bundle ID:
  - `com.fms.mobile`
- Marketing version:
  `1.0.1`
- Build number:
  `2`
- Archive date:
- Built by:
- Signing/provisioning verified:
  - [ ] yes
- Archive / IPA path:
- Artifact hash (SHA256):
- TestFlight upload status:
  `Not uploaded yet`

## Validation Checklist

- [x] Android signed `AAB` generated successfully
- [ ] Android release build installs or uploads successfully
- [ ] iOS archive validates successfully in Xcode
- [x] Version numbers match store metadata
- [x] Signing identity is correct
- [x] Artifact hashes are recorded

## TestFlight Status Checklist

- [ ] Archive visible in Xcode Organizer
- [ ] Bundle ID matches `com.fms.mobile`
- [ ] Marketing version matches `1.0.1`
- [ ] Build number matches `2`
- [ ] Upload to App Store Connect completed
- [ ] TestFlight processing started

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
