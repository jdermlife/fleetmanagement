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
- `google-play-go-live-blockers.md`
  Strict blocker-only gate for deciding whether Google Play production submission is allowed.
- `google-play-console-answers-draft.md`
  Ready-to-paste working draft for Play Console Data safety and content-rating completion.
- `android-gp06-gp07-device-qa-checklist.md`
  Android release QA checklist focused on closing GP-06 and GP-07 with evidence.
- `google-play-blocker-owner-tracker.md`
  Owner, date, and evidence tracker for open Google Play blockers GP-03 through GP-08.
- `google-play-closure-plan-2026-07-24-to-2026-08-02.md`
  Day-by-day execution plan to close remaining Google Play blockers through 2026-08-02.
- `gp03-gp04-stakeholder-signoff-pack.md`
  Approval capture sheet for Product, Legal, Compliance, and Engineering to close GP-03 and GP-04.
- `gp03-gp04-console-capture-checklist.md`
  Console-entry and screenshot-capture checklist for completing GP-03 and GP-04 evidence.
- `../release-evidence/gp03-gp04-screenshot-index.md`
  Canonical screenshot status tracker for GP-03 and GP-04 closure evidence.
- `gp05-gp08-execution-checklist.md`
  Unified execution checklist for closing remaining Google Play blockers GP-05 through GP-08.
- `google-play-command-center.md`
  One-page run sheet for GP-03 through GP-08 execution and closeout updates.
- `google-play-daily-ops-log.md`
  Daily execution log for blocker status, risks, and next checkpoint tracking.
- `google-play-status-update-playbook.md`
  Standard operating playbook for consistent blocker status updates across all tracking docs.
- `google-play-2026-07-26-kickoff-brief.md`
  Next-session kickoff brief with owners, run order, and status transition targets.
- `google-play-single-source-map.md`
  Authoritative mapping of which file controls blocker state, ownership, procedure, and evidence.
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
- Android signed release evidence now exists locally:
  - `frontend/android/app/build/outputs/bundle/release/app-release.aab`
  - `documents/release-evidence/signed-build-evidence.md`
- Backend verification currently includes passing modern suites for:
  - security permissions
  - credit risk / scoring
  - fraud scoring
  - social scoring
  - loan repository import/export
  - subscription authorization
  - subscription endpoint smoke coverage

## Known Blockers Still Outside This Package

1. No proven iOS release archive or TestFlight upload exists in the repo yet.
2. Real-device QA evidence is still missing.
3. Public store metadata assets are still incomplete: screenshots, review notes, age-rating answers, and final content-rating questionnaires.
4. Privacy declarations in Play Console and App Store Connect still need human
   confirmation against legal, infrastructure, and third-party vendor behavior.

## Recommended Order

1. Finalize `privacy-data-inventory.md` with legal/product review.
2. Complete GP-03 and GP-04 stakeholder approvals and Play Console evidence capture.
3. Create the first iOS/TestFlight release artifact.
4. Run Android and iPhone device QA and record results in the release-evidence package.
5. Close remaining blockers in `google-play-go-live-blockers.md` with evidence paths.
