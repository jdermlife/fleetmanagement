# Global Launch Readiness

Audit date: July 2, 2026

This document answers one practical question for this repository:

Is the system already deployed as a real production web system and as a published Google Play / Apple App Store app?

Current answer:

- Web/system production: not confirmed live from repository evidence alone
- Google Play production: not ready for store release yet
- Apple App Store production: not ready for store release yet

## Executive Verdict

The project has strong production-oriented building blocks:

- backend/frontend CI and security checks exist in `.github/workflows/ci-cd-deploy.yml`
- Vercel linkage exists in `.vercel/project.json`
- Capacitor Android and iOS projects exist under `frontend/android` and `frontend/ios`
- production deployment and mobile readiness documents already exist

However, the repository still shows release-blocking defaults and uncompleted store steps, so this should be treated as a pre-launch system, not a globally released production app.

## Evidence Snapshot

### Web / System

What exists:

- CI/CD deploy workflow: `.github/workflows/ci-cd-deploy.yml`
- production deployment checklist: `PRODUCTION_DEPLOYMENT.md`
- frontend linked to a Vercel project: `.vercel/project.json`
- backend/frontend production docs and environment guidance: `README.md`, `PRODUCTION_DEPLOYMENT.md`

What is not proven from repo evidence:

- live production URL
- successful production deployment history
- configured deploy secrets in GitHub Actions
- completed staging-to-production signoff
- verified monitoring, backups, incident response, and runbooks in actual use

### Android

Current repo state:

- Capacitor app id: `com.fms.mobile` in `frontend/capacitor.config.ts`
- Android namespace/applicationId: `com.fms.mobile` in `frontend/android/app/build.gradle`
- Android release version: `versionCode 1`, `versionName "1.0"` in `frontend/android/app/build.gradle`
- release signing falls back to debug signing if release keystore is absent in `frontend/android/app/build.gradle`
- app-store readiness checklist still has open items in `frontend/MOBILE_APP_STORE_READINESS.md`

Conclusion:

- Android can be built as a mobile project
- Android is not yet demonstrated as a signed, production-ready Play Store release

### iOS

Current repo state:

- iOS bundle identifier is still `com.fms.mobile` in `frontend/ios/App/App.xcodeproj/project.pbxproj`
- iOS marketing/build version still `1.0` / `1`
- app-store readiness checklist still has open items in `frontend/MOBILE_APP_STORE_READINESS.md`
- no evidence of Xcode archive, TestFlight upload, or App Store Connect submission

Conclusion:

- iOS project exists
- iOS is not yet demonstrated as a TestFlight or App Store release

## Launch Blockers

These are the main blockers visible in the repository today.

### Identity and Release Defaults

- Android package id still uses default-style value: `com.fms.mobile`
- iOS bundle id still uses default-style value: `com.fms.mobile`
- app name in Capacitor config is still `FMS Mobile`
- Android and iOS versioning is still at initial release values

### Signing and Store Artifacts

- no committed evidence of signed Android AAB output
- no committed evidence of configured release keystore
- no committed evidence of iOS archive/IPA/TestFlight flow

### Store Compliance and Submission

- privacy/data-safety submission steps remain open in `frontend/MOBILE_APP_STORE_READINESS.md`
- screenshots, listing assets, and store metadata are not shown as finalized
- Apple account deletion requirement is listed as pending

### Production Operations

- repository shows deployment automation, but not proof of a live production environment
- deploy webhooks are required by CI/CD and may still need secret configuration
- no repo evidence confirms production DNS, HTTPS, backup restore drills, or live alerting ownership

## Repo-Specific Go-Live Checklist

### Phase 1: Confirm Web Production

- Set and verify GitHub secrets for:
  - `BACKEND_DEPLOY_WEBHOOK_URL`
  - `FRONTEND_DEPLOY_WEBHOOK_URL`
- Confirm actual production URLs for frontend and backend
- Verify production environment variables for backend and frontend
- Run the go-live checks in `PRODUCTION_DEPLOYMENT.md`
- Perform a live smoke test:
  - login
  - borrower registration
  - lender registration
  - loan creation
  - certification page
  - logout/session-expiry behavior

### Phase 2: Android Production Readiness

- Replace `com.fms.mobile` with final Play Store application id
- Set final app display name
- Set final `versionCode` and `versionName`
- Generate release keystore and create `frontend/android/keystore.properties`
- Build signed release AAB
- Validate on physical Android devices
- Complete Play Console listing, screenshots, privacy forms, and internal testing

### Phase 3: iOS Production Readiness

- Replace `com.fms.mobile` with final iOS bundle id
- Set final marketing version and build number
- Configure Apple signing team and provisioning
- Archive the app from Xcode
- Upload to TestFlight
- Complete App Store Connect privacy labels and listing assets
- Pass App Review requirements, including account deletion if accounts are created in-app

## Recommended Next Actions

Do these in order:

1. Confirm the real production frontend URL and backend API URL.
2. Finalize app identity:
   - app name
   - Android package id
   - iOS bundle id
3. Complete Android signed AAB generation.
4. Complete iOS TestFlight upload.
5. Close every open item in `frontend/MOBILE_APP_STORE_READINESS.md`.

## Final Status

As of July 2, 2026:

- The repository is production-oriented
- The repository is not enough evidence to claim a global production deployment
- The mobile app is not yet evidenced as published in Google Play or Apple App Store
- The most realistic next milestone is:
  - verified web production deployment
  - Android internal testing AAB
  - iOS TestFlight build
