# Privacy Data Inventory

This inventory is based on verified code paths in the current repo and is meant
to support:

- Google Play Data safety answers
- Apple App Privacy responses
- public privacy policy review
- App Review / Play Console submission notes

It is a technical draft, not final legal advice.

## Verified Data Categories

### Account and authentication data

Observed in:

- `frontend/src/api.ts`
- `frontend/src/pages/auth/LoginPage.tsx`
- `backend/app/routes/security.py`

Includes:

- username
- email address
- password-derived credentials
- JWT access and refresh tokens
- role and permission data
- account status
- password reset token flow
- account deletion flow

Primary use:

- sign in
- account recovery
- authorization
- session management
- security monitoring

### Contact and profile data

Observed in:

- `frontend/src/pages/scoring/LendingScorecard.tsx`
- `frontend/src/pages/scoring/LoanRepository.tsx`
- `backend/app/models/users.py`
- `backend/app/models/loan_application.py`

Includes:

- full name
- phone number
- email
- address
- government ID references
- borrower contact details

Primary use:

- borrower profiling
- loan processing
- communications and account management

### Financial and lending data

Observed in:

- `frontend/src/pages/scoring/LendingScorecard.tsx`
- `frontend/src/pages/scoring/CreditScoreForm.tsx`
- `backend/app/services/credit_scoring_engine.py`
- `backend/app/services/credit_risk_engine.py`
- `backend/app/services/fraud_scoring_engine.py`
- `backend/app/services/social_scoring_engine.py`

Includes:

- monthly income
- other income
- debt obligations
- requested loan amount
- loan term
- interest rate
- collateral data
- appraised value
- credit, fraud, and social score outputs
- committee remarks and workflow status

Primary use:

- credit evaluation
- loan origination
- underwriting
- fraud checks
- workflow approval and release

### Document and uploaded file data

Observed in:

- `frontend/src/pages/scoring/LendingScorecard.tsx`
- `backend/app/routes/documents.py`
- `backend/app/routes/ai.py`

Includes:

- uploaded supporting documents
- document metadata
- AI document parsing results
- document type classification
- OCR / extracted values

Primary use:

- supporting-document management
- credit review
- AI-assisted extraction and workflow completion

### Audio data

Observed in:

- `frontend/src/components/ai/MeetingRecorder.tsx`
- `frontend/src/pages/ai/AttendMeeting.tsx`
- `backend/app/routes/ai.py`
- `frontend/ios/App/App/Info.plist`
- `frontend/android/app/src/main/AndroidManifest.xml`

Includes:

- user-selected or user-recorded audio
- generated transcripts
- generated meeting summaries / minutes

Primary use:

- transcription
- meeting-minute generation
- internal operations workflows

### Subscription and billing administration data

Observed in:

- `frontend/src/api.ts`
- `frontend/src/pages/subscriptions/SubscriptionPaymentPage.tsx`
- `backend/app/routes/subscriptions.py`
- `backend/app/models/subscription.py`

Includes:

- plan identifiers
- subscription status
- invoice records
- payment references
- usage and entitlement records

Primary use:

- subscription management
- access control
- billing operations

### Audit, security, and technical request data

Observed in:

- `backend/main.py`
- `backend/app/routes/security.py`
- `backend/app/services/audit_log_service.py`
- `backend/app/models/users.py`

Includes:

- audit-log entries
- request path and method
- IP address
- user agent
- login counters
- lockout state
- session metadata

Primary use:

- security
- fraud review
- compliance
- troubleshooting

## Verified Third-Party / External Service Use

### Google Sign-In

Observed in:

- `frontend/src/pages/auth/LoginPage.tsx`
- `frontend/src/main.tsx`
- `backend/app/routes/security.py`

### Sign in with Apple

Observed in:

- `frontend/src/pages/auth/LoginPage.tsx`
- `frontend/src/appleAuth.ts`
- `backend/app/routes/security.py`

### OpenAI-backed AI services

Observed in:

- `backend/app/routes/ai.py`

Used for:

- audio transcription
- meeting-minute generation
- loan-document parsing

### SMTP email delivery

Observed in:

- `backend/app/services/email_service.py`
- `backend/app/routes/security.py`
- `backend/app/routes/ai.py`

Used for:

- password reset delivery when configured
- email sending features when configured

## Verified Non-Use / Not Yet Verified

### Precise location

Not verified in current mobile/frontend code paths.

### Geolocation permission prompts

Not verified in current mobile/frontend code paths.

### Third-party ad SDKs

Not verified in current frontend dependency/runtime review.

### In-app marketing SDK behavior

Not verified in current dependency/runtime review.

## Human Confirmation Still Needed

Before copying these answers into store consoles, confirm:

1. Whether infrastructure providers retain IP, request, or document data beyond
   the application layer.
2. Whether OpenAI requests contain any production personal data in live use.
3. Whether SMTP or notification workflows send personal or financial content.
4. Whether any deployment-time SDKs add analytics, crash reporting, or device
   fingerprinting not obvious from the repo.
5. Whether internal policy or law requires narrower retention/deletion wording
   than the current app screens state.
