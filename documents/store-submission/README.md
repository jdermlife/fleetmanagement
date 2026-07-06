# Store Submission Package

This folder collects the minimum working artifacts needed to move the current
repo toward Google Play, Apple App Store, and broader production-launch
readiness.

## Files

- `privacy-data-inventory.md`
  Repo-specific inventory of data types and flows verified in code.
- `google-play-submission-draft.md`
  Draft checklist and declaration notes for Play Console.
- `apple-app-store-submission-draft.md`
  Draft checklist and declaration notes for App Store Connect and App Review.
- `reviewer-access-and-qa-template.md`
  Template for review credentials, TestFlight / Play test evidence, and device QA.

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
  - subscription authorization
  - subscription endpoint smoke coverage

## Known Blockers Still Outside This Package

1. No proven signed Android `AAB` or iOS release archive exists in the repo.
2. The backend test story is still split between current FastAPI coverage and
   stale Flask-era tests.
3. Real-device QA evidence is still missing.
4. Public store metadata assets are still incomplete:
   screenshots, support URL, published privacy-policy URL, review notes,
   age-rating answers, and final content-rating questionnaires.
5. Privacy declarations in Play Console and App Store Connect still need human
   confirmation against legal, infrastructure, and third-party vendor behavior.

## Recommended Order

1. Finalize `privacy-data-inventory.md` with legal/product review.
2. Replace placeholder public URLs in `frontend/store-metadata.template.json`.
3. Create signed Android and iOS release artifacts.
4. Run device QA and record results in `reviewer-access-and-qa-template.md`.
5. Copy the approved answers into Play Console and App Store Connect.
