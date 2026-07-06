# Google Play Submission Draft

Official references:

- Play app setup and bundles:
  `https://support.google.com/googleplay/android-developer/answer/9859152`
- Target API policy:
  `https://support.google.com/googleplay/android-developer/answer/11926878`
- Data safety:
  `https://support.google.com/googleplay/android-developer/answer/10787469`

## Current Repo Position

- Application ID: `com.fms.mobile`
- `targetSdkVersion = 36`
- `minSdkVersion = 24`
- Release build no longer falls back to debug signing
- `RECORD_AUDIO` permission is declared
- Android backup/data extraction is explicitly disabled

Observed in:

- `frontend/android/app/build.gradle`
- `frontend/android/variables.gradle`
- `frontend/android/app/src/main/AndroidManifest.xml`

## Must Complete Before Submission

1. Create a real signed release `AAB`.
2. Configure Play App Signing.
3. Replace placeholder support/privacy/marketing URLs in
   `frontend/store-metadata.template.json`.
4. Complete Data safety declarations from `privacy-data-inventory.md`.
5. Complete the content rating questionnaire.
6. Prepare screenshots, app icon validation, short description, full
   description, category, and support details.
7. Validate the signed release on physical Android devices.

## Draft Data Safety Working Notes

Use this as a draft only. Final answers must be confirmed by legal/product.

### Likely data collected

- Personal info:
  - name
  - email
  - phone number
  - user IDs / account identifiers
- Financial info:
  - income
  - debt obligations
  - loan details
  - credit/risk-related outputs
- User content:
  - uploaded documents
  - audio recordings
  - meeting transcripts / summaries
- App activity / diagnostics:
  - audit/security events
  - request metadata
  - IP and user agent at the backend layer

### Likely answers to confirm

- Data encrypted in transit:
  - likely `Yes`, but verify transport/security configuration in deployment
- Users can request deletion:
  - `Yes`, via account settings flow and contact email
- Required to collect data for app functionality:
  - likely `Yes`
- Data shared with third parties:
  - likely `Yes`, where Google/Apple login, OpenAI, email providers, and hosting
    providers are involved

## Missing Repo Artifacts

- No signed `.aab` in repo
- No Play listing screenshots in repo
- No final support URL
- No final public privacy-policy URL
- No completed Data safety export or worksheet

## Recommended Console Attachments

- app description copy
- support email and URL
- privacy-policy URL
- internal test notes
- reviewer notes for login, AI, and protected features
