# Android Permission Prompt Evidence

Last updated: 2026-07-24
Blocker: GP-07
Status: Template ready, evidence pending QA run

## Scope

Validate runtime permission behavior against declared Android permission scope.

Declared permission in manifest:

- android.permission.RECORD_AUDIO

## Test Matrix

| Device | Android version | Build tested | Tester | Date | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

## Prompt Behavior Checks

- [ ] Prompt appears only when meeting/audio feature is invoked
- [ ] Prompt text and context match intended microphone usage
- [ ] Denied permission path shows clear user guidance
- [ ] Allowed permission path enables recording/transcription workflow
- [ ] No unrelated permission prompts appear during tested flows

## Evidence Attachments

- Screenshot path for first prompt appearance:
- Screenshot path for denied state behavior:
- Screenshot path for granted state behavior:
- Screen recording path (optional):

## Final Assessment

- Runtime behavior matches declared permission scope: [ ] Yes [ ] No
- If No, issue summary:
- Follow-up owner:
- Retest date:

## Completion Checklist

- [ ] At least 3 physical Android devices tested
- [ ] Prompt evidence attached
- [ ] Any issues documented and retested
- [ ] GP-07 ready to close in blocker sheet
