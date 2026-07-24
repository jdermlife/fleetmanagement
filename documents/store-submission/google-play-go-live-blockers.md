# Google Play Go-Live Blockers (Strict)

Last reviewed: 2026-07-25

Purpose: this is a blocker-only checklist for moving from internal readiness to
Google Play submission readiness. If any item is open, do not submit for
production review.

## Current Decision

- Submission to Internal Testing track: Allowed
- Submission as production-ready release: Blocked

## Blockers Only

| ID | Blocker | Current state | Exit criteria (must be true) | Owner | Evidence to attach |
| --- | --- | --- | --- | --- | --- |
| GP-01 | Public policy and support URLs still placeholders | Closed (2026-07-24) | Real public HTTPS URLs replace placeholders for support, marketing, privacy, and terms | Product + Web + Legal | Updated metadata: frontend/store-metadata.template.json |
| GP-02 | Public domain deployment not confirmed | Closed (2026-07-24) | publicDomainDeployed is true and pages load without auth on Android and desktop browsers | Web + QA | Verified live pages: /support, /privacy, /terms on fleetmanagement-flame.vercel.app |
| GP-03 | Play Console Data safety not finalized | In Progress (2026-07-25) | Data safety form completed and approved by legal/product based on real behavior | Product + Legal + Engineering | documents/release-evidence/data-safety-final-answers.md |
| GP-04 | Content rating questionnaire not completed | In Progress (2026-07-25) | Play content rating questionnaire completed with final rating applied | Product | documents/release-evidence/content-rating-final-evidence.md |
| GP-05 | Store listing asset package incomplete | Open | Final phone screenshots, listing copy, category checks, and any required feature graphic uploaded | Product + Design | documents/release-evidence/screenshot-asset-checklist.md |
| GP-06 | Real-device Android QA evidence missing | Open | Critical flows pass on physical Android device matrix with release AAB build | QA + Mobile | documents/release-evidence/device-qa-matrix.md |
| GP-07 | Permission disclosure validation incomplete | Open | Microphone usage and prompt behavior validated against declared permission scope | QA + Mobile | documents/release-evidence/android-permission-prompt-evidence.md |
| GP-08 | Review environment and reviewer path not finalized | Open | Stable backend plus reviewer notes and demo path verified for app review | Ops + Backend + Product | documents/release-evidence/reviewer-demo-account-evidence.md |

## Already Satisfied (Not blockers)

- Signed release AAB exists locally.
- Android release signing guard is enforced in Gradle.
- Application ID, target SDK, min SDK, and app version are set.
- In-app support, privacy, and terms routes exist.
- In-app account deletion flow exists.

## Go/No-Go Rule

Go only when GP-01 through GP-08 are all closed and evidence is archived in the
store-submission and release-evidence folders.

## Working Artifacts

- Play Console answer draft for GP-03 and GP-04:
	documents/store-submission/google-play-console-answers-draft.md
- Android QA checklist for GP-06 and GP-07:
	documents/store-submission/android-gp06-gp07-device-qa-checklist.md
- Owner/date tracker for GP-03 through GP-08:
	documents/store-submission/google-play-blocker-owner-tracker.md
- Day-by-day closure plan through 2026-08-02:
	documents/store-submission/google-play-closure-plan-2026-07-24-to-2026-08-02.md
- GP-03/GP-04 stakeholder sign-off pack:
	documents/store-submission/gp03-gp04-stakeholder-signoff-pack.md
- GP-03/GP-04 console capture checklist:
	documents/store-submission/gp03-gp04-console-capture-checklist.md
- GP-03/GP-04 screenshot tracker:
	documents/release-evidence/gp03-gp04-screenshot-index.md
- GP-05 to GP-08 execution checklist:
	documents/store-submission/gp05-gp08-execution-checklist.md
- Google Play command center run sheet:
	documents/store-submission/google-play-command-center.md
- Daily operations log:
	documents/store-submission/google-play-daily-ops-log.md
- Status update playbook:
	documents/store-submission/google-play-status-update-playbook.md
- Single source-of-truth map:
	documents/store-submission/google-play-single-source-map.md

## Suggested Close Order

1. Close GP-01 and GP-02 together (public URLs and deployment proof).
2. Close GP-03 and GP-04 together (console policy forms).
3. Close GP-05 (final listing assets and copy).
4. Close GP-06 and GP-07 together (device QA and permission proof).
5. Close GP-08 last (reviewer journey on stable backend).
