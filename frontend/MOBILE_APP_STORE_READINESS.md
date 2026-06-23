# Mobile App Store Readiness (Google Play + Apple App Store)

## Scope
This checklist covers the remaining non-code submission steps after Capacitor mobile conversion.

## 1. App Identity and Versioning
- [ ] Set final Android application ID in frontend/android/app/build.gradle (default: com.fms.mobile)
- [ ] Set final iOS bundle ID in Xcode project settings (default: com.fms.mobile)
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

## Notes
- iOS App Store uploads require macOS + Xcode.
- Current project already supports mobile sync via: npm run mobile:sync
