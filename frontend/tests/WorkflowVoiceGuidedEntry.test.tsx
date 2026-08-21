import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import WorkflowVoiceGuidedEntry from '../src/components/profile/WorkflowVoiceGuidedEntry'

class MockSpeechRecognition {
  static current: MockSpeechRecognition | null = null
  continuous = false
  interimResults = false
  lang = ''
  onend: (() => void) | null = null
  onerror: ((event: Event & { error: string }) => void) | null = null
  onresult: ((event: Event & { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null = null
  start = vi.fn()
  stop = vi.fn()

  constructor() {
    MockSpeechRecognition.current = this
  }

  respond(transcript: string) {
    this.onresult?.({ results: [{ 0: { transcript } }] } as unknown as Event & { results: ArrayLike<{ 0: { transcript: string } }> })
  }
}

describe('WorkflowVoiceGuidedEntry', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    MockSpeechRecognition.current = null
  })

  it('applies voice answers only to the configured workflow form', async () => {
    vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition)
    class MockSpeechSynthesisUtterance {
      onend: (() => void) | null = null
      constructor(public text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance)
    vi.stubGlobal('speechSynthesis', {
      cancel: vi.fn(),
      speak: (prompt: MockSpeechSynthesisUtterance) => prompt.onend?.(),
    })
    const user = userEvent.setup()

    render(<>
      <WorkflowVoiceGuidedEntry
        ariaLabel="Voice-guided budget and expense entry"
        currentStep={2}
        rootSelector=".target-workflow"
        subjectLabel="budget and expense"
      />
      <label>Outside field<input /></label>
      <div className="target-workflow"><label>Salary<input type="number" /></label></div>
    </>)

    expect(screen.getByRole('button', { name: 'Manual Entry' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Voice Guided Entry' }))
    expect(screen.getByRole('region', { name: 'Voice-guided budget and expense entry' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Answer budget and expense questions by voice' }))

    act(() => MockSpeechRecognition.current?.respond('50000'))
    await user.click(screen.getByRole('button', { name: 'Apply All Answers' }))

    expect((screen.getByLabelText('Salary') as HTMLInputElement).value).toBe('50000')
    expect((screen.getByLabelText('Outside field') as HTMLInputElement).value).toBe('')
  })
})