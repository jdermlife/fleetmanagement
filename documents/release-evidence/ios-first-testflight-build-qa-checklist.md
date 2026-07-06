# iOS First TestFlight Build QA Checklist

Use this checklist immediately after the first TestFlight build becomes
available to testers.

This is the short sanity pass before a broader iPhone QA cycle.

For the full script, use:

- `documents/release-evidence/device-qa-execution-script.md`

Record final results in:

- `documents/release-evidence/device-qa-matrix.md`
- `documents/release-evidence/signed-build-evidence.md`
- `documents/release-evidence/reviewer-demo-account-evidence.md`

## Preconditions

- TestFlight build is visible and installable
- reviewer/demo credentials are available
- public `/support`, `/privacy`, and `/terms` URLs are available or ready to validate

## Device To Use

Record:

- Device model:
- iOS version:
- Build tested:
- Tester:
- Date:

## First-Pass Checks

### 1. Install / Open

- [ ] TestFlight build installs successfully
- [ ] App opens without crash
- [ ] Login screen or expected landing screen appears

### 2. Public Links

- [ ] `/support` page is reachable from Safari
- [ ] `/privacy` page is reachable from Safari
- [ ] `/terms` page is reachable from Safari

### 3. Authentication

- [ ] Email/password login succeeds
- [ ] Session remains valid while navigating
- [ ] Logout succeeds

### 4. Apple-Specific Validation

- [ ] Sign in with Apple succeeds
- [ ] Apple account returns to the app correctly
- [ ] Bundle/build metadata appears correct in TestFlight

### 5. Core Functional Path

- [ ] Open lending / loan workflow
- [ ] Save or load a representative application
- [ ] Protected routes respect role access

### 6. Audio / AI Path

- [ ] Microphone permission prompt appears when expected
- [ ] Audio recording or upload path opens
- [ ] Transcription succeeds
- [ ] Meeting-minute generation succeeds

### 7. Account Safety Path

- [ ] Password reset request path is accessible
- [ ] Account deletion flow is reachable and understandable

## Result

- Overall result:
  - [ ] Pass
  - [ ] Fail
  - [ ] Needs Review

## If Failed

Capture:

- screenshot
- failing screen
- exact error text
- timestamp
- whether the issue blocks TestFlight review or App Review readiness

## After This Checklist

If the result is `Pass`, continue with:

- `documents/release-evidence/device-qa-execution-script.md`

If the result is `Fail`, do not promote the build until:

- issue is logged
- fix is applied
- a new TestFlight build is uploaded
- this checklist is rerun
