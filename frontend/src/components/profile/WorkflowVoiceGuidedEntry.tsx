import { useState } from 'react'

import BuildProfileVoiceAssistant from './BuildProfileVoiceAssistant'

type EntryMode = 'manual' | 'voice'

type WorkflowVoiceGuidedEntryProps = {
  ariaLabel: string
  currentStep: number
  rootSelector: string
  subjectLabel: string
}

export default function WorkflowVoiceGuidedEntry({
  ariaLabel,
  currentStep,
  rootSelector,
  subjectLabel,
}: WorkflowVoiceGuidedEntryProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>('manual')

  return (
    <div className="workflow-voice-entry-panel">
      <div className="build-profile-entry-modes" aria-label={`${subjectLabel} entry mode`}>
        <button
          type="button"
          className={entryMode === 'manual' ? 'build-profile-entry-mode-active' : undefined}
          aria-label="Manual Entry"
          aria-pressed={entryMode === 'manual'}
          onClick={() => setEntryMode('manual')}
        >Manual<br />Entry</button>
        <button
          type="button"
          className={entryMode === 'voice' ? 'build-profile-entry-mode-active' : undefined}
          aria-label="Voice Guided Entry"
          aria-pressed={entryMode === 'voice'}
          onClick={() => setEntryMode('voice')}
        >Voice Guided<br />Entry</button>
      </div>
      {entryMode === 'voice' ? (
        <BuildProfileVoiceAssistant
          ariaLabel={ariaLabel}
          currentStep={currentStep}
          rootSelector={rootSelector}
          subjectLabel={subjectLabel}
        />
      ) : null}
    </div>
  )
}