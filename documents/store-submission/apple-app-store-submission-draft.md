# Apple App Store Submission Draft

Official references:

- App privacy details:
  `https://developer.apple.com/app-store/app-privacy-details/`
- App Review Guidelines:
  `https://developer.apple.com/app-store/review/guidelines/`

## Current Repo Position

- Bundle ID: `com.fms.mobile`
- App name: `FMS Mobile`
- Microphone usage description is present
- Apple login path exists
- In-app account deletion flow exists
- `ITSAppUsesNonExemptEncryption` is set to `false`

Observed in:

- `frontend/ios/App/App/Info.plist`
- `frontend/ios/App/App.xcodeproj/project.pbxproj`
- `frontend/src/pages/auth/LoginPage.tsx`
- `frontend/src/api.ts`
- `backend/app/routes/security.py`

## Must Complete Before Submission

1. Archive and validate a real Release build from Xcode.
2. Upload a TestFlight build and test on physical iPhone hardware.
3. Provide App Review access:
   - live backend
   - demo account or reviewable account path
   - notes for protected AI/document/subscription workflows
4. Complete App Privacy answers in App Store Connect from
   `privacy-data-inventory.md`.
5. Publish a public privacy-policy URL and support URL.
6. Prepare screenshots for required Apple device sizes.
7. Confirm whether any SDK privacy manifests are still required; no
   `PrivacyInfo.xcprivacy` file is currently present in the repo.

## App Review Risk Areas To Explain

- login required for most authenticated features
- Google and Apple sign-in coexist
- account deletion exists in-app
- audio recording is used for meeting workflows
- AI-backed document parsing and transcription are restricted to authorized flows
- backend services must be available during review

## Draft App Privacy Working Notes

Likely data categories to review carefully:

- Contact Info:
  - name
  - email
  - phone number
  - address
- Financial Info:
  - income
  - debt
  - loan and credit-related data
- User Content:
  - uploaded documents
  - audio data
  - meeting transcripts / summaries
- Identifiers:
  - user ID / account ID
- Diagnostics / Security:
  - IP, user agent, audit and session data at the service layer

Possible purposes:

- App Functionality
- Analytics / diagnostics only if actually enabled in production
- Security / fraud prevention
- Product personalization only if you truly use it

Do not mark tracking or ad-related categories unless production behavior and
third-party integrations really justify them.

## App Review Guideline Notes To Confirm

- If account creation is supported, in-app deletion must remain functional.
- If third-party sign-in is used for the primary account, the Apple-equivalent
  option must remain available unless an exception truly applies.
- Metadata, screenshots, and descriptions must match the real feature set.

## Missing Repo Artifacts

- No TestFlight evidence
- No public metadata package with screenshots
- No `PrivacyInfo.xcprivacy`
- No final App Review notes package
