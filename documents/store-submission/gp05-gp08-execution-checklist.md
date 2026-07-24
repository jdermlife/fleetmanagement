# GP-05 to GP-08 Execution Checklist

Date: 2026-07-25
Purpose: provide one operational checklist to close the remaining non-policy blockers after GP-03 and GP-04.

## Scope

- GP-05: Store listing asset package
- GP-06: Real-device Android QA evidence
- GP-07: Permission disclosure validation
- GP-08: Reviewer environment and demo-account validation

## GP-05 Listing Assets

Required evidence target:

- documents/release-evidence/screenshot-asset-checklist.md

Checklist:

- [ ] Final Play screenshots exported and quality-checked
- [ ] Final App Store screenshots exported and quality-checked
- [ ] App icon source and exports confirmed
- [ ] Listing short/full descriptions approved
- [ ] Asset owner and approval date filled in evidence file

## GP-06 Device QA

Required evidence target:

- documents/release-evidence/device-qa-matrix.md

Checklist:

- [ ] Android device matrix executed on physical devices
- [ ] Critical flows marked Pass/Fail with tester/date/build
- [ ] Browser validation rows completed for support/privacy/terms
- [ ] QA owner and product sign-off fields completed

## GP-07 Permission Validation

Required evidence target:

- documents/release-evidence/android-permission-prompt-evidence.md

Checklist:

- [ ] Microphone prompt behavior captured on physical devices
- [ ] Deny/allow behavior documented with screenshots
- [ ] No unrelated permission prompts observed during test flows
- [ ] Final assessment recorded as Yes/No with follow-up owner if needed

## GP-08 Reviewer Path Validation

Required evidence target:

- documents/release-evidence/reviewer-demo-account-evidence.md

Checklist:

- [ ] Reviewer credentials validated on signed mobile build
- [ ] Protected routes verified for reviewer role
- [ ] Audio/AI/deletion flows confirmed testable
- [ ] Final reviewer note confirmed ready for console submission

## Closeout Rules

After checklist completion:

1. Update blocker states in documents/store-submission/google-play-go-live-blockers.md.
2. Update status and notes in documents/store-submission/google-play-blocker-owner-tracker.md.
3. Record closure date, owner, and evidence path for each blocker.
