# iOS Version And Build Number Checklist

Use this checklist before running the iOS/TestFlight release runbook.

## File To Update

- `frontend/ios/App/App.xcodeproj/project.pbxproj`

## Fields To Change

- `MARKETING_VERSION`
- `CURRENT_PROJECT_VERSION`

## Rules

- `CURRENT_PROJECT_VERSION` must increase on every uploaded build
- `MARKETING_VERSION` should match the user-facing release number
- The App Store / TestFlight build number must be unique for the version

## Checklist

- [ ] Current `MARKETING_VERSION` recorded
- [ ] New `MARKETING_VERSION` chosen
- [ ] Current `CURRENT_PROJECT_VERSION` recorded
- [ ] New `CURRENT_PROJECT_VERSION` chosen
- [ ] Xcode project file updated
- [ ] Change reviewed before archive/upload

## Record

- Previous `MARKETING_VERSION`:
- New `MARKETING_VERSION`:
- Previous `CURRENT_PROJECT_VERSION`:
- New `CURRENT_PROJECT_VERSION`:
- Updated by:
- Date:

## After Updating

Continue with:

- `documents/release-evidence/ios-testflight-release-runbook.md`
