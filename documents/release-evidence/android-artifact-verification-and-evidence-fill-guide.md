# Android Artifact Verification And Evidence Fill Guide

Use this guide immediately after:

- `.\gradlew.bat bundleRelease`

This guide tells you:

1. what commands to run
2. what output to check
3. what exact fields to fill in

## Expected Artifact

After a successful signed release build, the expected artifact is:

```text
frontend\android\app\build\outputs\bundle\release\app-release.aab
```

## Step 1: Confirm The File Exists

From `frontend/android/`:

```powershell
Test-Path .\app\build\outputs\bundle\release\app-release.aab
```

Expected result:

```text
True
```

If the result is `False`, do not fill the evidence file yet. The build did not
produce the expected artifact in the right location.

## Step 2: Get The SHA256 Hash

From `frontend/android/`:

```powershell
Get-FileHash .\app\build\outputs\bundle\release\app-release.aab -Algorithm SHA256
```

Record:

- the `Hash` value

## Step 3: Confirm Version Values

From the repo:

- read `versionCode` and `versionName` from:
  - `frontend/android/app/build.gradle`

Current repo values are:

- `versionCode 2`
- `versionName "1.0.1"`

If you change these before building, record the actual values used for the
artifact, not the defaults shown above.

## Step 4: Fill The Android Section In `signed-build-evidence.md`

Use:

- `documents/release-evidence/signed-build-evidence.md`

Fill these fields:

- Build type:
  `Release`
- Artifact type:
  `AAB`
- Version name:
  Example: `1.0.1`
- Version code:
  Example: `2`
- Package name:
  `com.fms.mobile`
- Build date:
  The actual date you created the artifact
- Built by:
  Your name
- Signing config verified:
  mark checked after confirming `keystore.properties` and keystore values were correct
- Keystore file location:
  Example: `frontend/android/release-keystore.jks`
- Key alias:
  Example: `release_key_alias`
- Artifact path:
  `frontend/android/app/build/outputs/bundle/release/app-release.aab`
- Artifact hash (SHA256):
  paste the hash from `Get-FileHash`
- Internal track / upload status:
  Example: `Not uploaded yet` or `Uploaded to Google Play internal track`

## Example Filled Android Entry

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
  `PASTE_REAL_HASH_HERE`
- Internal track / upload status:
  `Not uploaded yet`

## Step 5: Decide The Next Action

If the artifact exists and the evidence file is filled:

- upload it to Google Play internal testing
- then run:
  - `documents/release-evidence/android-first-signed-build-qa-checklist.md`

If the artifact does not exist or the build failed:

- do not fill the evidence as complete
- fix the signing/build issue first

## Minimum Proof Standard

For the Android signed build blocker to count as materially resolved, you should
have all of the following:

- confirmed artifact path
- SHA256 hash recorded
- version name and version code recorded
- build date and builder recorded
- signing confirmation recorded
- upload status recorded
