# Submission Readiness Matrix

This matrix is intended to answer one practical question:

`What still blocks Google Play, Apple App Store, and global production launch?`

Legend:

- `Green`: verified or materially complete in the repo
- `Amber`: partially complete, needs human validation or missing evidence
- `Red`: blocking gap still open

## Google Play

| Item | Current status | Owner | Evidence needed | Current repo evidence | Blocker | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| Android target API policy | Green | Mobile engineer | Signed release build targeting compliant API | `targetSdkVersion = 36` in `frontend/android/variables.gradle` | No | Keep target level current before release |
| Signed Android release artifact | Green | Mobile engineer / Release manager | Signed `.aab` built from release config | Signed `app-release.aab` now exists locally and is recorded in `documents/release-evidence/signed-build-evidence.md` | No | Upload the signed build to Google Play internal testing and begin Android device QA |
| Debug signing fallback removed | Green | Mobile engineer | Release build should fail without real signing config | `frontend/android/app/build.gradle` now refuses release builds without keystore | No | Verify with actual release build |
| Android permission disclosures | Amber | Mobile engineer / Product | Real-device proof that prompts and behavior match declared permissions | `RECORD_AUDIO` declared; no location permission declared | Maybe | Test microphone flow on device and confirm no undeclared permission usage |
| Data safety draft | Amber | Product / Legal / Engineering | Final Play Console answers approved by product/legal | Draft in `documents/store-submission/google-play-submission-draft.md` and `privacy-data-inventory.md` | Yes | Convert draft into final console submission answers |
| Public privacy policy URL | Amber | Product / Web / Legal | Public live privacy-policy URL | In-app `/privacy` route exists, but public domain URL is still a placeholder in `frontend/store-metadata.template.json` | Yes | Publish the `/privacy` page on a real public domain |
| Support URL and contact metadata | Amber | Product / Ops | Public support URL and verified contact workflow | In-app `/support` route exists, but public support URL is still a placeholder in `frontend/store-metadata.template.json` | Yes | Publish the `/support` page and confirm response process |
| Store listing assets | Red | Product / Design / Marketing | Screenshots, icon checks, short/full descriptions, content rating | Draft metadata exists; no screenshots/assets package | Yes | Produce Play listing assets and track them in `documents/release-evidence/screenshot-asset-checklist.md` |
| Physical Android QA evidence | Red | QA / Mobile engineer | Device matrix with pass/fail evidence | No completed QA evidence in repo | Yes | Run Android device QA and record results in `documents/release-evidence/device-qa-matrix.md` |
| Backend functionality during review | Amber | Backend engineer / Ops | Stable review backend and demo credentials | Auth/document/AI flows improved; reviewer package still draft | Yes | Stand up review-ready environment and demo account |

## Apple App Store

| Item | Current status | Owner | Evidence needed | Current repo evidence | Blocker | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| Bundle ID and iOS metadata base | Green | Mobile engineer | Xcode archive with matching metadata | `com.fms.mobile`, `MARKETING_VERSION`, `CURRENT_PROJECT_VERSION` in Xcode project | No | Increment versions before submission |
| Microphone usage disclosure | Green | Mobile engineer | Device prompt matches declared usage string | `NSMicrophoneUsageDescription` present in `Info.plist` | No | Validate on real iPhone |
| Sign in with Apple availability | Green | Mobile engineer / Product | Reviewable Apple sign-in flow | Apple sign-in path exists alongside Google sign-in | No | Validate with Apple test account |
| In-app account deletion | Amber | Backend engineer / QA | Real-device evidence that deletion works end-to-end | Delete-account flow now exists in app and backend | Yes | Verify on device and include in reviewer notes |
| Signed iOS/TestFlight build | Red | Mobile engineer / Release manager | Release archive and TestFlight upload | No `.ipa`, `.xcarchive`, or TestFlight evidence in repo | Yes | Follow `documents/release-evidence/ios-testflight-release-runbook.md`, then log the result in `documents/release-evidence/signed-build-evidence.md` |
| App Privacy answers | Amber | Product / Legal / Engineering | Final App Store Connect privacy answers | Draft data inventory and App Store notes exist | Yes | Finalize App Privacy responses from verified flows |
| Privacy manifest / SDK manifest review | Amber | iOS engineer | Confirm whether `PrivacyInfo.xcprivacy` is needed for final SDK set | No `PrivacyInfo.xcprivacy` file found in repo | Maybe | Audit SDK requirements and add manifest if needed |
| Public privacy policy URL | Amber | Product / Web / Legal | Live policy URL | In-app `/privacy` route exists, but public URL is still a placeholder | Yes | Publish `/privacy` on a public domain |
| Support URL | Amber | Product / Ops | Live support URL | In-app `/support` route exists, but public URL is still a placeholder | Yes | Publish `/support` on a public domain |
| App Review notes and demo account | Red | Product / QA / Ops | Final review note text plus working credentials | Draft exists in `public-facing-submission-metadata-draft.md` | Yes | Finalize reviewer package and validate access in `documents/release-evidence/reviewer-demo-account-evidence.md` |
| Real iPhone / TestFlight QA evidence | Red | QA / Mobile engineer | Device/OS matrix with pass/fail evidence | No real-device QA evidence in repo | Yes | Run TestFlight QA and record results in `documents/release-evidence/device-qa-matrix.md` |
| Store screenshots and metadata assets | Red | Product / Design / Marketing | iPhone screenshots and final listing copy | Draft copy exists; no final assets | Yes | Produce App Store asset package and track completion in `documents/release-evidence/screenshot-asset-checklist.md` |

## Global Production Launch

| Item | Current status | Owner | Evidence needed | Current repo evidence | Blocker | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| Frontend typecheck/lint/build | Green | Frontend engineer | Passing CI-quality local verification | `tsc`, `lint`, and `build` all pass | No | Keep green in CI |
| Core backend business-rule tests | Green | Backend engineer | Passing logic and authorization suites | modern security/credit/fraud/social/subscription tests passed | No | Expand coverage over time |
| Loan repository import/export pytest suite | Green | Backend engineer | Passing repository import/export coverage | `test_loan_repository_io.py` now passes | No | Keep aligned with schema evolution |
| Backend test strategy consistency | Green | Backend engineer / Engineering lead | Single supported testing story for current backend | Rewritten backend tests and CI now target modern FastAPI/service coverage | No | Keep CI aligned with the FastAPI runtime |
| Supported runtime verification | Amber | Backend engineer / Ops | Test results in supported production runtime (3.11/3.12) | Local venvs are 3.14; one smoke suite skips by design | Yes | Run full backend suite in 3.11/3.12 CI or staging |
| Production secrets and infrastructure | Amber | DevOps / Infra | Verified prod config for DB, Redis, secrets, origins | Checklists exist, but no evidence bundle in repo | Yes | Complete launch checklist sections 1-5 with evidence |
| Monitoring and alerting | Amber | Ops / SRE | Sentry, metrics, alerts, and dashboards verified | Docs mention them, but no evidence of final prod setup | Yes | Complete checklist sections 6-7 |
| Backup and disaster recovery | Amber | Ops / Infra | Verified backup runs and restore drill | Scripts/docs exist; no completed evidence attached | Yes | Perform restore drill and attach outputs |
| Legal/privacy alignment | Amber | Legal / Product / Engineering | Final legal sign-off on privacy and terms | In-app privacy/terms are now more accurate, but still need public publication and legal sign-off | Yes | Legal review plus public-hosted URLs |
| Real-device and end-to-end QA | Red | QA / Engineering | Device matrix and critical-flow evidence | No completed QA evidence package in repo | Yes | Run Android/iPhone QA and fill `documents/release-evidence/device-qa-matrix.md` |
| Load/stability validation | Red | QA / Ops | Load test report and pass/fail summary | Launch checklist requires it; no evidence present | Yes | Run staged load test |
| Operational ownership | Amber | Engineering lead / Ops | Named on-call, escalation contacts, runbooks | Checklist templates exist; no completed sign-off evidence | Yes | Fill operational runbooks and on-call matrix |

## Practical Readiness Summary

### What would make store submission materially closer?

1. Signed Android `AAB`
2. TestFlight build
3. Public privacy/support URLs
4. Real-device QA evidence
5. Final store-console privacy answers

### What still keeps this from a true global production launch?

1. Missing production evidence for infrastructure, monitoring, and backup drills
2. Missing real-device and load-test evidence

## Suggested Ownership Pass

- `Mobile engineer`
  Signed builds, device QA, store binaries, permission validation
- `Backend engineer`
  Test modernization, failing test fix, review backend reliability
- `Product / Legal`
  Final privacy, terms, support URLs, store copy, content rating
- `Ops / SRE`
  Monitoring, alerts, backups, reviewer environment, on-call readiness
- `Design / Marketing`
  Screenshots, icons, listing assets
