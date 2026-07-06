# Android Version Bump Checklist

Use this checklist before running the Android signed release runbook.

## File To Update

- `frontend/android/app/build.gradle`

## Fields To Change

- `versionCode`
- `versionName`

## Rules

- `versionCode` must increase on every Play submission
- `versionName` should match the human-facing release number
- `versionCode` must be unique in Google Play Console

## Checklist

- [ ] Current `versionCode` recorded
- [ ] New `versionCode` chosen
- [ ] Current `versionName` recorded
- [ ] New `versionName` chosen
- [ ] `build.gradle` updated
- [ ] Change reviewed before `bundleRelease`

## Record

- Previous `versionCode`:
- New `versionCode`:
- Previous `versionName`:
- New `versionName`:
- Updated by:
- Date:

## After Updating

Continue with:

- `documents/release-evidence/android-signed-release-runbook.md`
