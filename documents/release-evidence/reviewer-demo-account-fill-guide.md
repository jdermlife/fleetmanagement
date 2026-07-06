# Reviewer And Demo Account Fill Guide

Use this guide when completing:

- `documents/release-evidence/reviewer-demo-account-evidence.md`

This file helps you prepare the review package needed for:

- Google Play review
- Apple App Review
- internal reviewer/demo validation

## What Reviewers Need

Reviewers should be able to:

1. sign in successfully
2. access the intended protected flows
3. understand role limitations
4. reach public support, privacy, and terms pages
5. test deletion, password reset, and AI/audio workflows if they are part of the review scope

## Recommended Reviewer Account Profile

Use one account that can reach most flows without requiring special internal setup.

Recommended role:

- `admin`

Why:

- broadest access to protected pages
- easiest way to reduce review friction
- lets the reviewer inspect most workflow surfaces without repeated authorization failures

If you cannot use an admin reviewer:

- provide a second account and explain which flows require which role

## Fields To Fill In `reviewer-demo-account-evidence.md`

### Review Contact

Fill:

- Contact name
- Contact email
- Contact phone
- Time zone

Use:

- the real person available to answer store reviewer questions

### Demo Account

Fill:

- Username
- Password
- Role
- MFA required
- Account creation date
- Last validated date
- Validated by

Recommended notes:

- if MFA is required, include exact instructions
- if no MFA is required, explicitly state that

### Review Environment

Fill:

- Public frontend URL
- Public support URL
- Public privacy URL
- Public terms URL
- Backend health URL
- Backend ready URL

These should be real reachable URLs, not placeholders.

## Suggested Reviewer Notes

Use a version of this note in store consoles:

> This app contains authenticated business workflows for fleet, lending, and
> credit operations. Please review using the provided demo account. The broadest
> workflow access is available through the supplied reviewer role. Core review
> flows include sign-in, password reset, account deletion, lending workflow
> access, supporting-document handling, and AI meeting workflows such as audio
> transcription and meeting-minute generation. Public support, privacy, and
> terms pages are available without authentication.

## High-Value Flows To Mention Explicitly

- email/password login
- Google Sign-In if configured in the review environment
- Sign in with Apple if configured in the review environment
- account deletion from account settings
- password reset flow
- lending or loan workflow page
- document upload / AI parsing
- meeting audio / transcription / minutes

## Review Access Validation Checklist

Before filling the evidence file, confirm:

- [ ] credentials work on a clean device/session
- [ ] account lands on a valid post-login route
- [ ] protected routes are reachable for the supplied role
- [ ] public `/support`, `/privacy`, and `/terms` URLs are live
- [ ] deletion and password-reset messaging is understandable
- [ ] reviewer notes match the actual build and environment

## If Multiple Accounts Are Needed

Record both:

- primary reviewer account
- secondary restricted-role account

And explain:

- which flows require which account
- why the split exists

## Do Not Store

Do not place any of the following in public docs:

- production admin credentials outside the protected evidence file
- personal staff passwords reused elsewhere
- secrets that are not intended for the review environment

## After Filling The Evidence File

Use alongside:

- `documents/store-submission/public-facing-submission-metadata-draft.md`
- `documents/release-evidence/device-qa-execution-script.md`
- `documents/release-evidence/device-qa-matrix.md`
