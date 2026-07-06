# Device QA Execution Script

Use this script to run a consistent release-validation pass on Android, iPhone,
and the public support/privacy/terms pages.

This file is the step-by-step procedure.

Record final results in:

- `documents/release-evidence/device-qa-matrix.md`
- `documents/release-evidence/reviewer-demo-account-evidence.md`

## Before You Start

Prepare:

- signed Android build or internal test build
- TestFlight build or iOS release build
- reviewer/demo account credentials
- public frontend URL
- public `/support`, `/privacy`, and `/terms` URLs
- network connection stable enough for login and AI features

Record first:

- tester name
- date
- device model
- OS version
- build identifier

## Pass / Fail Rule

- Mark `Pass` only if the feature works end-to-end without workaround.
- Mark `Fail` if the flow is blocked, crashes, or produces the wrong result.
- Mark `Needs Review` if behavior is ambiguous or policy-sensitive.

For every failure, capture:

- screenshot
- exact screen
- exact error text
- timestamp

## Test Order

### 1. Install And Launch

Steps:

1. Install the signed build.
2. Launch the app.
3. Confirm the app reaches the expected landing or login screen.

Expected result:

- no install failure
- no startup crash
- branding and navigation load correctly

### 2. Public Page Validation

Validate in a mobile browser and desktop browser:

- `/support`
- `/privacy`
- `/terms`

Expected result:

- page loads over HTTPS
- no login required
- page content is readable
- support email and legal text render correctly

### 3. Email / Password Login

Steps:

1. Open the login screen.
2. Enter valid reviewer/demo credentials.
3. Sign in.

Expected result:

- login succeeds
- user lands on the correct post-login page for the role

### 4. Google Sign-In

Steps:

1. Trigger Google Sign-In.
2. Complete account selection and consent.

Expected result:

- sign-in succeeds
- user returns to the app in authenticated state

### 5. Sign in with Apple

Steps:

1. Trigger Apple Sign-In.
2. Complete Apple auth flow.

Expected result:

- sign-in succeeds
- user returns to the app in authenticated state

### 6. Password Reset Request

Steps:

1. Open forgot-password screen.
2. Submit a valid email or username.

Expected result:

- request succeeds
- user receives the expected success message

### 7. Password Reset Confirm

Steps:

1. Use the provided reset token flow.
2. Submit a new valid password.

Expected result:

- reset succeeds
- user can sign in with the new password

### 8. Session Refresh And Logout

Steps:

1. Stay signed in while navigating across protected pages.
2. Confirm the app does not unexpectedly drop the session.
3. Trigger sign out.

Expected result:

- protected pages continue to load while authenticated
- logout clears access and returns user to login flow

### 9. Account Deletion

Steps:

1. Open account settings.
2. Trigger the delete/disable account flow.
3. Confirm the required password/confirmation step.

Expected result:

- request succeeds
- user is logged out or access is revoked
- account-deletion support path remains understandable

### 10. Loan Application Save / Load

Steps:

1. Open the lending or loan workflow.
2. Create or update a representative application.
3. Save it.
4. Reload and confirm it can be reopened.

Expected result:

- save succeeds
- updated data persists
- application can be reloaded correctly

### 11. Supporting Document Upload

Steps:

1. Open the document upload flow.
2. Upload a supported image/document file.

Expected result:

- upload succeeds
- status updates correctly in the UI

### 12. AI Document Parsing

Steps:

1. Trigger AI parsing on an uploaded document.
2. Review extracted suggestions.

Expected result:

- parse request succeeds
- extracted values or parsing summary appear for review

### 13. Audio Permission Prompt

Steps:

1. Open the meeting/audio feature.
2. Trigger microphone access.

Expected result:

- permission prompt appears when expected
- permission text matches the intended behavior

### 14. Meeting Transcription

Steps:

1. Record or upload audio.
2. Trigger transcription.

Expected result:

- transcription request succeeds
- transcript appears in the UI

### 15. Meeting Minutes Generation

Steps:

1. Use a successful transcript.
2. Trigger minutes generation.

Expected result:

- minutes generation succeeds
- summary/minutes appear in the UI

### 16. Subscription Pages

Steps:

1. Open subscription fee and payment flows.
2. Confirm the visible content matches the current role and state.

Expected result:

- public fee page loads
- payment/subscription pages behave correctly for the signed-in role

### 17. Admin / Protected Pages

Steps:

1. Visit role-restricted pages using the demo account.
2. Confirm allowed pages load and disallowed pages stay blocked.

Expected result:

- authorization is enforced correctly

## After The Run

Update:

- `documents/release-evidence/device-qa-matrix.md`
- `documents/release-evidence/reviewer-demo-account-evidence.md`

Attach:

- screenshots for any failures
- short notes for any `Needs Review` result

## Final Output Per Device

Each tested device should end with:

- overall result: `Pass`, `Fail`, or `Needs Review`
- list of failed steps, if any
- tester name
- date/time
