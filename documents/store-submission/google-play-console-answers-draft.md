# Google Play Console Answers Draft (GP-03 and GP-04)

Last reviewed: 2026-07-24
Purpose: ready-to-paste working draft for Play Console Data safety and Content rating.
Status: draft only. Product and legal approval required before submission.

## Scope and Evidence Sources

- Technical inventory: documents/store-submission/privacy-data-inventory.md
- App metadata: frontend/store-metadata.template.json
- Live policy/support pages:
  - https://fleetmanagement-flame.vercel.app/privacy
  - https://fleetmanagement-flame.vercel.app/terms
  - https://fleetmanagement-flame.vercel.app/support

## GP-03: Data Safety Draft

Use this section to fill the Play Console Data safety questionnaire.

### Data collected (working draft)

Mark as collected for this app:

- Personal info:
  - Name
  - Email address
  - Phone number
  - User IDs / account identifiers
- Financial info:
  - Income and debt details
  - Loan application and collateral details
  - Credit and risk workflow outputs
- User content:
  - Uploaded documents
  - Audio recordings
  - Generated transcripts and meeting summaries
- App activity / technical diagnostics:
  - Audit and security events
  - Request metadata (for security and operations)

### Data sharing with third parties (working draft)

Likely Yes, depending on enabled features and providers:

- Authentication providers (Google, Apple)
- AI processing provider for transcription and parsing workflows
- SMTP/email delivery provider (if enabled)
- Infrastructure/service providers required to host and operate backend services

### Security and deletion declarations (working draft)

- Data encrypted in transit: Yes (confirm production transport and reverse-proxy settings)
- User can request deletion: Yes (in-app account deletion flow plus support contact)

### Collection purpose mapping (working draft)

- App functionality:
  - Login and account access
  - Loan and credit workflow operations
  - Document and audio processing workflows
- Security and fraud prevention:
  - Session, audit, and abuse detection controls
- Account management:
  - Password reset
  - Account deletion
  - Subscription/access control

### Approval checklist before console submission

- [ ] Product approves category mapping and wording
- [ ] Legal approves data-sharing and retention wording
- [ ] Engineering confirms no hidden SDK telemetry outside this draft
- [ ] Ops confirms production encryption-in-transit posture
- [ ] Final console answers exported and archived in release-evidence

## GP-04: Content Rating Draft

Use this section to complete the Play content rating questionnaire.

### Category and audience baseline

- App type: business operations / productivity workflows
- Primary audience: adult professional users
- Not intended for children

### Sensitive-area quick screen (working draft)

Answer No unless product/legal confirms otherwise:

- Gambling features
- Real-money gaming mechanics
- Sexual content
- Graphic violence
- Hate/extremism content
- Illegal drug promotion

Potentially Yes, but contextual:

- User-generated content: limited to authorized business records and uploads
- Financial subject matter: Yes (loan and credit workflow data)
- Audio capture capability: Yes (meeting workflows where user initiates recording/upload)

### Rating completion checklist

- [ ] Product owner completes questionnaire in Play Console
- [ ] Legal reviews final assigned rating and descriptors
- [ ] Screenshot evidence of completed rating is saved
- [ ] frontend/store-metadata.template.json contentRating updated from Pending questionnaire to final value

## Required post-update repo actions

After final console completion:

1. Update frontend/store-metadata.template.json with final values for:
   - googlePlay.contentRating
2. Save evidence artifacts in documents/release-evidence:
   - data-safety-final-answers.md
   - content-rating-final-evidence.md
3. Mark GP-03 and GP-04 Closed in documents/store-submission/google-play-go-live-blockers.md
