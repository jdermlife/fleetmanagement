# Android Device QA Checklist (GP-06 and GP-07)

Last reviewed: 2026-07-24
Purpose: close GP-06 and GP-07 with repeatable, evidence-backed Android release QA.

## Build Under Test

- AAB path: frontend/android/app/build/outputs/bundle/release/app-release.aab
- Application ID: com.fms.mobile
- Version: set from frontend/android/app/build.gradle

## Device Matrix Minimum

Test at least 3 physical devices:

- 1 low/mid-tier Android device
- 1 current-generation Android device
- 1 alternate OEM device

Target OS spread:

- Android 10 or 11
- Android 13
- Android 14 or newer

## GP-06 Critical Flow Set

For each device, mark Pass or Fail and capture evidence.

- [ ] Install app from internal testing and first launch succeeds
- [ ] Login with username/password succeeds
- [ ] Session remains valid during normal navigation
- [ ] Password reset request path works
- [ ] Account deletion flow works end-to-end
- [ ] Loan workflow create, save, and reload works
- [ ] Document upload succeeds
- [ ] AI document parsing returns output
- [ ] Audio transcription workflow succeeds
- [ ] Meeting-minutes generation succeeds
- [ ] Protected routes enforce role-based access
- [ ] Logout returns to unauthenticated state

## GP-07 Permission and Disclosure Validation

Confirm declared Android permissions match runtime behavior.

Declared permission focus:

- android.permission.RECORD_AUDIO

Validation steps:

- [ ] Microphone permission prompt appears only when audio feature is invoked
- [ ] Prompt context matches user action and expected app behavior
- [ ] Deny path is handled gracefully with clear user guidance
- [ ] Allow path enables recording/transcription workflow
- [ ] No unexpected permission prompts (for example location) appear

## Evidence Package (Required)

Store all evidence under documents/release-evidence.

- [ ] device-qa-matrix.md filled per device and per flow
- [ ] reviewer-demo-account-evidence.md includes tested credentials and role
- [ ] Screenshot bundle for failures and permission prompts
- [ ] Build identifier and test timestamp on each result row

## Exit Criteria to Close Blockers

Close GP-06 when:

- All critical flows pass across required physical device matrix
- Failures are either fixed and retested, or explicitly accepted by product owner

Close GP-07 when:

- Permission prompt behavior is validated on physical devices
- Evidence confirms runtime permission usage matches declared scope

## Hand-off Updates

When complete:

1. Update documents/store-submission/google-play-go-live-blockers.md:
   - GP-06 -> Closed (date)
   - GP-07 -> Closed (date)
2. Append evidence paths in blocker table Evidence column.
