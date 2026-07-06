# Android Signed Release Runbook

Use this runbook to produce the first signed Android release artifact for
Google Play.

This repo is already configured to refuse a `release` build if
`frontend/android/keystore.properties` is missing or incomplete.

## Repo Files Involved

- Gradle release config:
  `frontend/android/app/build.gradle`
- Keystore template:
  `frontend/android/keystore.properties.example`
- Build evidence target:
  `documents/release-evidence/signed-build-evidence.md`
- Submission status tracker:
  `documents/store-submission/submission-readiness-matrix.md`

## Preconditions

- Java / Android Studio installed
- Android SDK installed
- Node dependencies installed in `frontend/`
- Web build already passes:
  - `npm run build`
- Release metadata decided:
  - version name
  - version code

## Step 1: Bump Release Version

Update Android release version fields in:

- `frontend/android/app/build.gradle`

Use checklist:

- `documents/release-evidence/android-version-bump-checklist.md`

Current fields:

- `versionCode`
- `versionName`

Recommended:

- increment `versionCode` every release
- set `versionName` to the human-facing release number

## Step 2: Create Release Keystore

Recommended command from `frontend/android/`:

```powershell
keytool -genkeypair -v -keystore release-keystore.jks -alias release_key_alias -keyalg RSA -keysize 2048 -validity 10000
```

Record securely outside the repo:

- keystore filename/path
- store password
- key alias
- key password

Do not commit the generated keystore file.

Recommended placement:

- put `release-keystore.jks` inside `frontend/android/`
- or store it in a secure local path and reference the absolute path in
  `keystore.properties`

## Step 3: Create `keystore.properties`

From `frontend/android/`:

1. Copy `keystore.properties.example` to `keystore.properties`
2. Replace placeholders with the real values

Optional local starting point:

- `frontend/android/keystore.properties.local.template`

Use checklist:

- `documents/release-evidence/android-keystore-fill-guide.md`
- `documents/release-evidence/android-keystore-setup-checklist.md`

Expected keys:

- `storeFile`
- `storePassword`
- `keyAlias`
- `keyPassword`

Example:

```properties
storeFile=release-keystore.jks
storePassword=your_store_password
keyAlias=release_key_alias
keyPassword=your_key_password
```

Validation:

- confirm the file exists at `frontend/android/keystore.properties`
- confirm the `storeFile` value points to a real keystore path
- confirm no placeholder values remain

## Step 4: Build The Signed Release

From `frontend/`:

```powershell
npm run build
```

Then from `frontend/android/`:

```powershell
.\gradlew.bat bundleRelease
```

Expected artifact:

```text
frontend\android\app\build\outputs\bundle\release\app-release.aab
```

If you need an APK for internal validation only:

```powershell
.\gradlew.bat assembleRelease
```

If Gradle reports that the Android SDK location is missing:

1. create `frontend/android/local.properties`
2. set `sdk.dir` to the real Android SDK path

Example:

```properties
sdk.dir=C:\\Users\\YOUR_USER\\AppData\\Local\\Android\\Sdk
```

Starter template:

- `frontend/android/local.properties.example`

## Step 5: Validate The Artifact

Confirm:

- the build finishes successfully
- the artifact exists
- release build did not fall back to debug signing

Optional local verification:

```powershell
Get-FileHash .\app\build\outputs\bundle\release\app-release.aab -Algorithm SHA256
```

Optional artifact existence check:

```powershell
Test-Path .\app\build\outputs\bundle\release\app-release.aab
```

## Step 6: Record Evidence

Fill in:

- `documents/release-evidence/signed-build-evidence.md`
- `documents/release-evidence/android-artifact-verification-and-evidence-fill-guide.md`

Record at minimum:

- artifact type: `AAB`
- version name
- version code
- package name: `com.fms.mobile`
- build date
- artifact path
- SHA256 hash
- who built it
- upload / internal track status

Suggested copy source:

- `frontend/android/app/build.gradle`
- `documents/release-evidence/android-keystore-setup-checklist.md`
- `documents/release-evidence/android-version-bump-checklist.md`
- `Get-FileHash` output from the signed artifact

## Step 7: Upload To Google Play

Use the Google Play Console:

- App bundle upload
- Internal testing track first

After upload, record:

- upload date
- track name
- rollout %
- upload status

## Step 8: Link QA Evidence

Once the signed build is installed on a real Android device, record the test run
in:

- `documents/release-evidence/android-first-signed-build-qa-checklist.md`
- `documents/release-evidence/device-qa-matrix.md`

## Done Criteria

- `app-release.aab` exists
- hash is recorded
- `signed-build-evidence.md` is filled
- build uploaded to at least an internal track
- real-device QA begins from the signed artifact

## Common Failure Modes

- Missing `keystore.properties`
  - the release build will fail by design
- Wrong `storeFile` path
  - Gradle will not find the keystore
- Version not bumped
  - Play Console may reject reuse of an existing version code
- Unsaved placeholder metadata
  - store submission still blocked even if the `AAB` is valid
