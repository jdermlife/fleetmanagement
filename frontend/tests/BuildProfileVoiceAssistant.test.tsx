import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import BuildProfileVoiceAssistant from '../src/components/profile/BuildProfileVoiceAssistant'

class MockSpeechRecognition {
  static current: MockSpeechRecognition | null = null
  continuous = false
  interimResults = false
  lang = ''
  onend: (() => void) | null = null
  onerror: ((event: Event & { error: string }) => void) | null = null
  onresult: ((event: Event & { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null = null

  constructor() {
    MockSpeechRecognition.current = this
  }

  start = vi.fn()
  stop = vi.fn()

  respond(transcript: string) {
    this.onresult?.({ results: [{ 0: { transcript } }] } as unknown as Event & { results: ArrayLike<{ 0: { transcript: string } }> })
  }
}

function VoiceForm() {
  return <>
    <BuildProfileVoiceAssistant currentStep={1} />
    <article className="build-profile-form-panel">
      <div className="build-profile-step-content">
        <label>Full Name<input /></label>
        <label>Gender<select><option value="">Select gender</option><option value="Female">Female</option></select></label>
      </div>
    </article>
  </>
}

describe('BuildProfileVoiceAssistant', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    MockSpeechRecognition.current = null
  })

  it('reviews a spoken response before applying it to the next incomplete field', async () => {
    vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition)
    const user = userEvent.setup()
    render(<VoiceForm />)

    await user.click(screen.getByRole('button', { name: 'Answer profile questions by voice' }))
    expect(MockSpeechRecognition.current?.start).toHaveBeenCalled()

    act(() => MockSpeechRecognition.current?.respond('Jordan Santos'))
    expect(screen.getByText('Jordan Santos', { selector: 'blockquote' })).toBeTruthy()
    expect((screen.getByLabelText('Full Name') as HTMLInputElement).value).toBe('')

    await user.click(screen.getByRole('button', { name: 'Apply Response' }))
    expect((screen.getByLabelText('Full Name') as HTMLInputElement).value).toBe('Jordan Santos')
    expect(screen.getByText(/Full Name updated/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Answer profile questions by voice' }))
    act(() => MockSpeechRecognition.current?.respond('Female'))
    await user.click(screen.getByRole('button', { name: 'Apply Response' }))
    expect((screen.getByLabelText('Gender') as HTMLSelectElement).value).toBe('Female')
  })

  it('explains when browser speech recognition is unavailable', async () => {
    const user = userEvent.setup()
    render(<VoiceForm />)

    await user.click(screen.getByRole('button', { name: 'Answer profile questions by voice' }))
    expect(screen.getByText(/not supported by this browser/)).toBeTruthy()
  })
})