# Store Submission Package

This folder collects the minimum working artifacts needed to move the current
repo toward Google Play, Apple App Store, and broader production-launch
readiness.

Related evidence folder:

- `documents/release-evidence/`
  Templates and eventual proof for signed builds, screenshots, real-device QA,
  and reviewer/demo-account validation.
  Includes `android-signed-release-runbook.md` for the first signed `AAB`.
  Includes `ios-testflight-release-runbook.md` for the first TestFlight upload.
  Includes `device-qa-execution-script.md` for running the release QA pass.

## Files

- `privacy-data-inventory.md`
  Repo-specific inventory of data types and flows verified in code.
- `submission-readiness-matrix.md`
  Current status matrix for store submission and global production launch.
- `backend-test-modernization-plan.md`
  Action plan to unify backend verification around the current FastAPI stack.
- `google-play-submission-draft.md`
  Draft checklist and declaration notes for Play Console.
- `apple-app-store-submission-draft.md`
  Draft checklist and declaration notes for App Store Connect and App Review.
- `reviewer-access-and-qa-template.md`
  Template for review credentials, TestFlight / Play test evidence, and device QA.
- `public-page-deployment-checklist.md`
  Deploy-ready checklist for publishing support, privacy, and terms pages on a public domain.

## Current Repo Evidence

- Frontend verification passes:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run build`
- Verified mobile auth/audio/privacy hardening exists in:
  - `frontend/src/api.ts`
  - `frontend/src/components/ai/MeetingRecorder.tsx`
  - `frontend/android/app/build.gradle`
  - `frontend/android/app/src/main/AndroidManifest.xml`
  - `frontend/ios/App/App/Info.plist`
- Backend verification currently includes passing modern suites for:
  - security permissions
  - credit risk / scoring
  - fraud scoring
  - social scoring
  - loan repository import/export
  - subscription authorization
  - subscription endpoint smoke coverage

## Known Blockers Still Outside This Package

1. No proven signed Android `AAB` or iOS release archive exists in the repo.
2. Real-device QA evidence is still missing.
3. Public store metadata assets are still incomplete:
   screenshots, support URL, published privacy-policy URL, review notes,
   age-rating answers, and final content-rating questionnaires.
4. Privacy declarations in Play Console and App Store Connect still need human
   confirmation against legal, infrastructure, and third-party vendor behavior.

## Recommended Order

1. Finalize `privacy-data-inventory.md` with legal/product review.
2. Replace placeholder public URLs in `frontend/store-metadata.template.json`.
3. Create signed Android and iOS release artifacts.
4. Run device QA and record results in `reviewer-access-and-qa-template.md`.
5. Copy the approved answers into Play Console and App Store Connect.
