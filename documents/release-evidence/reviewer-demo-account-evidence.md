# Reviewer And Demo Account Evidence

Use this file to track the actual review credentials and review-environment proof
used for Play Console and App Store Connect.

Fill this with help from:

- `documents/release-evidence/reviewer-demo-account-fill-guide.md`

## Review Contact

- Contact name:
  `Jorge Dioneda`
- Contact email:
  `jdioneda@gmail.com`
- Contact phone:
  `+63 998 547 2359`
- Time zone:
  `Asia/Manila`

## Demo Account

- Username:
  `Admin123`
- Password:
  `Configured in reviewer environment`
- Role:
  `admin`
- MFA required:
  `No`
- Account creation date:
  `Pending confirmation`
- Last validated date:
  `Not yet validated on signed mobile build`
- Validated by:
  `Pending QA run`

## Review Environment

- Public frontend URL:
  `https://fleetmanagement-flame.vercel.app`
- Public support URL:
  `https://fleetmanagement-flame.vercel.app/support`
- Public privacy URL:
  `https://fleetmanagement-flame.vercel.app/privacy`
- Public terms URL:
  `https://fleetmanagement-flame.vercel.app/terms`
- Backend health URL:
  `https://fleetmanagement-dq9t.onrender.com/health`
- Backend ready URL:
  `https://fleetmanagement-dq9t.onrender.com/ready`

Backend endpoint verification status:

- `GET /health` returned `{"status":"healthy"}` on 2026-07-24
- `GET /ready` returned `{"status":"ready"}` on 2026-07-24

## Reviewer Scope

- Primary review account type:
  `Single admin reviewer account`
- Intended review surfaces:
  - login / session handling
  - password reset
  - account deletion
  - lending / loan workflow access
  - document upload and AI parsing
  - meeting audio / transcription / minutes
  - protected admin and operational pages
- Public pages reviewers should be able to open without authentication:
  - `/support`
  - `/privacy`
  - `/terms`

## Review Notes Checklist

- [ ] Reviewer credentials tested successfully
- [ ] Protected routes accessible with provided role
- [ ] Audio / AI flows are testable
- [ ] Account deletion path is testable
- [ ] Support contact is monitored
- [ ] Privacy and terms links are public and accessible

## Submission Notes Used

Draft reviewer note:

> This app contains authenticated business workflows for fleet, lending, and
> credit operations. Please review using the provided demo account. The supplied
> reviewer account uses the admin role so protected workflow surfaces can be
> tested without repeated authorization failures. Core review flows include
> sign-in, password reset, account deletion, lending workflow access,
> supporting-document handling, and AI meeting workflows such as audio
> transcription and meeting-minute generation. Public support, privacy, and
> terms pages are available without authentication once the public deployment
> URLs are live.

Final submission note status:

- `Draft prepared`
- `Public URL confirmation complete`
- `Backend health and ready endpoints verified`
- `Needs signed-build validation`
