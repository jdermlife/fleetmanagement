# Android First Signed Build QA Checklist

Use this checklist immediately after generating the first signed Android `AAB`.

This is the short, practical sanity pass before a broader QA cycle.

For the full script, use:

- `documents/release-evidence/device-qa-execution-script.md`

Record final results in:

- `documents/release-evidence/android-qa-session-sheet.md`
- `documents/release-evidence/device-qa-matrix.md`
- `documents/release-evidence/signed-build-evidence.md`

## Preconditions

- Signed Android `AAB` exists
- Artifact path and hash are recorded
- Internal testing track upload completed or device-installable validation build exists
- Reviewer/demo credentials are available

## Device To Use

Record:

- Device model:
- Android version:
- Build tested:
- Tester:
- Date:

## First-Pass Checks

### 1. Install / Open

- [ ] Build installs successfully
- [ ] App opens without crash
- [ ] Login screen or expected landing screen appears

### 2. Public Links

- [ ] `/support` page is reachable from a browser
- [ ] `/privacy` page is reachable from a browser
- [ ] `/terms` page is reachable from a browser

### 3. Authentication

- [ ] Email/password login succeeds
- [ ] Session remains valid while navigating
- [ ] Logout succeeds

### 4. Core Functional Path

- [ ] Open lending / loan workflow
- [ ] Save or load a representative application
- [ ] Protected routes respect role access

### 5. Audio / AI Path

- [ ] Microphone permission prompt appears when expected
- [ ] Audio recording or upload path opens
- [ ] Transcription succeeds
- [ ] Meeting-minute generation succeeds

### 6. Account Safety Path

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
- whether the issue blocks Play internal testing

## After This Checklist

If the result is `Pass`, continue with:

- `documents/release-evidence/device-qa-execution-script.md`

If the result is `Fail`, do not promote the build until:

- issue is logged
- fix is applied
- signed build is regenerated
- this checklist is rerun
