# Data Safety Final Answers (Google Play)

Last updated: 2026-07-25
Blocker: GP-03
Status: Prefilled draft, pending product/legal approval

## Submission Context

- App: FMS Mobile
- Application ID: com.fms.mobile
- Console environment: Google Play Console
- Prepared by: Release Engineering (draft prefill)
- Reviewed by Product:
- Reviewed by Legal:
- Reviewed by Engineering:
- Approved for submission: No

## Data Safety Final Answers Snapshot

Copy the final selected console answers here after completion.

### Data collection categories selected

- Personal info:
  - [x] Name
  - [x] Email address
  - [x] Phone number
  - [x] User IDs
- Financial info:
  - [x] Income/debt information
  - [x] Loan/credit workflow information
- User content:
  - [x] Uploaded documents
  - [x] Audio recordings
  - [x] Transcripts and generated summaries
- App activity/diagnostics:
  - [x] Security and audit events
  - [x] Technical request metadata

### Data sharing declaration selected

- Data shared with third parties: [x] Yes [ ] No
- If Yes, list sharing categories and providers as entered in console:
  - Authentication providers: Google, Apple
  - AI processing provider: OpenAI-backed transcription/parsing workflows
  - Email provider: SMTP service (when configured)
  - Infrastructure providers: backend hosting and operational service providers

### Security and deletion declaration selected

- Data encrypted in transit: [x] Yes [ ] No
- Users can request deletion: [x] Yes [ ] No
- Deletion path declared in console:
  - In-app account deletion flow and support contact at admin@quantech.international

### Purpose mapping selected

For each collected category, note final selected purpose labels:

- Personal info purposes:
  - Account management, authentication, and app functionality
- Financial info purposes:
  - Loan and credit workflow functionality
- User content purposes:
  - Document processing, audio transcription, and meeting workflow outputs
- App activity purposes:
  - Security, abuse prevention, compliance, and troubleshooting

## Approval Record

- Product approval date:
- Legal approval date:
- Engineering confirmation date:
- Final approver:

## Stakeholder Comment Log (2026-07-25)

- Product comments:
  - Pending
- Legal comments:
  - Pending
- Engineering comments:
  - Pending
- Consolidated actions before Play Console entry:
  - Confirm final category wording for shared third-party processing.
  - Confirm retention/deletion wording alignment with legal policy.

## Reviewer Prompts For Sign-Off

Product confirmation prompts:

- Confirm all declared collected categories are required for current production functionality.
- Confirm declared processing purposes match customer-facing disclosures.

Legal confirmation prompts:

- Confirm data-sharing wording is accurate and appropriately scoped.
- Confirm deletion and retention language is compliant for target launch jurisdictions.

Engineering confirmation prompts:

- Confirm no additional analytics, telemetry, or SDK data flows exist beyond this declaration.
- Confirm transport encryption posture for all production API paths.

## Evidence Attachments

- Screenshot path(s):
- Screenshot capture tracker:
  - documents/release-evidence/gp03-gp04-screenshot-index.md
- Export/print of final console page:
- Related draft used:
  - documents/store-submission/google-play-console-answers-draft.md
  - documents/store-submission/gp03-gp04-console-capture-checklist.md

## Completion Checklist

- [ ] Final console selections copied exactly
- [ ] Product sign-off captured
- [ ] Legal sign-off captured
- [ ] Engineering confirmation captured
- [ ] Evidence screenshots attached
- [ ] GP-03 updated to Closed in documents/store-submission/google-play-go-live-blockers.md
