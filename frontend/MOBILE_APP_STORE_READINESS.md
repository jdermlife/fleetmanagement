# Mobile App Store Readiness (Google Play + Apple App Store)

## Scope
This checklist covers the remaining non-code submission steps after Capacitor mobile conversion.

## 1. App Identity and Versioning
- [ ] Set final Android application ID in frontend/android/app/build.gradle (default: com.fms.mobile)
- [x] Set final iOS bundle ID in Xcode project settings (`com.quantech.filscore`)
- [ ] Set release version and build number:
  - Android: versionName + versionCode in frontend/android/app/build.gradle
  - iOS: MARKETING_VERSION + CURRENT_PROJECT_VERSION in Xcode target Build Settings

## 2. Branding Assets
- [ ] Replace app icon and splash assets for Android
- [ ] Replace app icon and splash assets for iOS at frontend/ios/App/App/Assets.xcassets
- [ ] Verify icon requirements:
  - Play: 512x512, 32-bit PNG, no alpha for listing icon
  - App Store: 1024x1024 App Store icon

## 3. Android Release Build (AAB)
- [ ] Create release keystore (if not existing)
- [ ] Copy frontend/android/keystore.properties.example to frontend/android/keystore.properties
- [ ] Fill real keystore values in keystore.properties
- [ ] Build release bundle:
  - cd frontend/android
  - ./gradlew bundleRelease (macOS/Linux)
  - .\\gradlew.bat bundleRelease (Windows)
- [ ] Output artifact: frontend/android/app/build/outputs/bundle/release/app-release.aab

## 4. iOS Release Build (IPA)
- [ ] Open Xcode project: frontend/ios/App/App.xcodeproj
- [ ] Configure Team, Signing Certificate, and Provisioning Profile
- [ ] Archive app from Product > Archive
- [ ] Upload via Organizer to App Store Connect

## 5. Privacy, Legal, and Policy Compliance
- [ ] Publish Privacy Policy URL and Terms URL reachable from app settings/legal page
- [ ] Ensure account deletion flow exists if accounts are created in-app (Apple requirement)
- [ ] Complete Play Console Data Safety form
- [ ] Complete App Store Connect Privacy Nutrition Labels
- [ ] Declare permissions usage accurately (camera/microphone/location/notifications only if used)
- [ ] Confirm no hardcoded secrets in app package

## 6. Store Listing Content
- [ ] Fill metadata template in frontend/store-metadata.template.json
- [ ] Prepare store screenshots:
  - Play: phone screenshots minimum
  - App Store: iPhone screenshots, iPad screenshots if iPad supported
- [ ] Prepare promotional graphics and app description copy

## 7. Pre-Submission QA
- [ ] Validate login, logout, token refresh, and session expiry behavior on real devices
- [ ] Validate deep links (if configured)
- [ ] Validate keyboard behavior and safe-area rendering on notch devices
- [ ] Validate API connectivity over HTTPS only
- [ ] Validate crash-free startup on both Android and iOS

## 8. Submission and Rollout
- [ ] Submit AAB to Play Console internal testing
- [ ] Submit iOS build to TestFlight internal testing
- [ ] Resolve reviewer feedback and policy warnings
- [ ] Promote staged rollout:
  - Play: 5% -> 25% -> 100%
  - iOS: phased release recommended

## 9. Native Subscription Billing
- [ ] Create matching subscription products in Google Play Console and App Store Connect.
- [ ] Configure backend `STORE_PRODUCT_MAPPINGS_JSON`, for example:
  `[{"platform":"ANDROID","plan_code":"SINGLE_PROFILE","product_id":"filscore_single_monthly","base_plan_id":"monthly"},{"platform":"IOS","plan_code":"SINGLE_PROFILE","product_id":"com.quantech.filscore.single.monthly"}]`
- [ ] Configure `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` as service-account JSON or a secret-file path.
- [ ] Configure `GOOGLE_PLAY_PACKAGE_NAME=com.quantech.filscore`.
- [ ] Configure Google Play Real-time Developer Notifications to push to `/api/subscriptions/store-notifications/google` with OIDC authentication.
- [ ] Configure `GOOGLE_PUBSUB_AUDIENCE` to the full notification endpoint URL and `GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL` to the push service account.
- [ ] Provision Apple Root CA G3 as a backend secret file and configure `APPLE_ROOT_CA_PATH`.
- [ ] Configure `APPLE_BUNDLE_ID=com.quantech.filscore` and `APPLE_STORE_ENVIRONMENT=Production`.
- [ ] Configure App Store Server Notifications V2 to `/api/subscriptions/store-notifications/apple`.
- [ ] Run `migrate_store_billing.py`, then verify product titles and localized prices on physical test devices.

## Notes
- iOS App Store uploads require macOS + Xcode.
- Run `npm run mobile:sync` before every Android or iOS release. The command now:
  - requires production `VITE_API_URL=https://fleetmanagement-dq9t.onrender.com`;
  - rejects malformed or non-HTTPS API hostnames;
  - builds and synchronizes Capacitor assets;
  - verifies the API URL in both Android and iOS bundles.
- Capacitor 8 Android builds require Java 21. On Windows with Android Studio installed:
  `$env:JAVA_HOME="$env:ProgramFiles\Android\Android Studio\jbr"; Set-Location android; .\gradlew.bat :app:bundleRelease`
- Upload `android/app/build/outputs/bundle/release/app-release.aab` to the Play internal testing track before production rollout.
- Release builds use R8 optimization and resource shrinking. Keep the matching `android/app/build/outputs/mapping/release/mapping.txt` for every uploaded version; Play can also read the mapping embedded in the AAB metadata.
- Confirm `https://fleetmanagement-dq9t.onrender.com/health` returns HTTP 200 before submission.
- Android requires `INTERNET` and `com.android.vending.BILLING`; iOS uses the trusted HTTPS certificate without an ATS exception.
- Test email login on a physical release-build device, close and reopen the app, and confirm the authenticated session is restored before promoting the Play/App Store release.
