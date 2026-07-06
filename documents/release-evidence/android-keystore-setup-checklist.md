# Android Keystore Setup Checklist

Use this checklist before running the Android signed release build.

## Files Involved

- `frontend/android/keystore.properties.example`
- `frontend/android/keystore.properties`
- release keystore file such as `frontend/android/release-keystore.jks`

## Goal

Confirm the signing inputs are complete and valid before `bundleRelease`.

## Checklist

- [ ] Release keystore file exists
- [ ] Keystore file is stored outside git history
- [ ] `keystore.properties` exists in `frontend/android/`
- [ ] `storeFile` points to the correct keystore path
- [ ] `storePassword` is filled and is not a placeholder
- [ ] `keyAlias` is filled and is not a placeholder
- [ ] `keyPassword` is filled and is not a placeholder
- [ ] `keystore.properties` is not staged for commit
- [ ] The keystore file itself is not staged for commit

## Values To Record Securely Outside The Repo

- Keystore path
- Store password
- Key alias
- Key password
- Owner / custodian of the signing key

## Safe Local Validation

From `frontend/android/`:

```powershell
Test-Path .\keystore.properties
Test-Path .\release-keystore.jks
Get-Content .\keystore.properties
```

Expected result:

- all required fields present
- no placeholder strings left
- file paths resolve correctly

## Before Continuing

If every checkbox above is complete, continue with:

- `documents/release-evidence/android-signed-release-runbook.md`
