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
        <label>Gender<select><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option></select></label>
        <label>Number of Dependents<input type="number" /></label>
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

  it('records every response continuously and applies only after final review', async () => {
    vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition)
    const spokenPrompts: string[] = []
    class MockSpeechSynthesisUtterance {
      onend: (() => void) | null = null
      constructor(public text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance)
    vi.stubGlobal('speechSynthesis', {
      cancel: vi.fn(),
      speak: (prompt: MockSpeechSynthesisUtterance) => {
        spokenPrompts.push(prompt.text)
        prompt.onend?.()
      },
    })
    const user = userEvent.setup()
    render(<VoiceForm />)

    await user.click(screen.getByRole('button', { name: 'Answer profile questions by voice' }))
    expect(MockSpeechRecognition.current?.start).toHaveBeenCalled()

    act(() => MockSpeechRecognition.current?.respond('Jordan Santos'))
    expect(screen.getByText('Jordan Santos')).toBeTruthy()
    expect(spokenPrompts).toContain('Please provide Gender. Your choices are Male or Female.')
    expect(screen.getByText('Listening for Gender. Available choices: Male or Female.')).toBeTruthy()
    expect((screen.getByLabelText('Full Name') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Gender') as HTMLSelectElement).value).toBe('')

    act(() => MockSpeechRecognition.current?.respond('male'))
    expect(screen.getByText('Listening for Number of Dependents...')).toBeTruthy()
    act(() => MockSpeechRecognition.current?.respond('zero'))
    expect(screen.getByText(/All voice-compatible questions are answered/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply All Answers' })).toBeTruthy()
    expect(spokenPrompts.at(-1)).toMatch(/verify and apply all answers before moving to the next workflow step/i)
    expect((screen.getByLabelText('Full Name') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Gender') as HTMLSelectElement).value).toBe('')
    expect((screen.getByLabelText('Number of Dependents') as HTMLInputElement).value).toBe('')

    await user.click(screen.getByRole('button', { name: 'Apply All Answers' }))
    expect((screen.getByLabelText('Full Name') as HTMLInputElement).value).toBe('Jordan Santos')
    expect((screen.getByLabelText('Gender') as HTMLSelectElement).value).toBe('Male')
    expect((screen.getByLabelText('Number of Dependents') as HTMLInputElement).value).toBe('0')
    expect(screen.getByText(/3 answers applied/)).toBeTruthy()
  })

  it('moves on after two invalid responses and requests manual entry', async () => {
    vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition)
    const spokenPrompts: string[] = []
    class MockSpeechSynthesisUtterance {
      onend: (() => void) | null = null
      constructor(public text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance)
    vi.stubGlobal('speechSynthesis', {
      cancel: vi.fn(),
      speak: (prompt: MockSpeechSynthesisUtterance) => {
        spokenPrompts.push(prompt.text)
        prompt.onend?.()
      },
    })
    const user = userEvent.setup()
    render(<VoiceForm />)
    await user.type(screen.getByLabelText('Full Name'), 'Jordan Santos')

    await user.click(screen.getByRole('button', { name: 'Answer profile questions by voice' }))
    act(() => MockSpeechRecognition.current?.respond('unknown'))
    expect(spokenPrompts).toContain('That response was not valid for Gender. Please try again.')
    expect(spokenPrompts.filter((prompt) => prompt === 'Please provide Gender. Your choices are Male or Female.')).toHaveLength(2)
    expect(screen.getByText('Listening for Gender. Available choices: Male or Female.')).toBeTruthy()

    act(() => MockSpeechRecognition.current?.respond('still unknown'))
    expect(spokenPrompts).toContain('Please manual entry the response')
    expect(screen.getByText('Listening for Number of Dependents...')).toBeTruthy()

    act(() => MockSpeechRecognition.current?.respond('zero'))
    expect(screen.getByRole('button', { name: 'Apply All Answers' })).toBeTruthy()
    expect((screen.getByLabelText('Gender') as HTMLSelectElement).value).toBe('')

    await user.click(screen.getByRole('button', { name: 'Apply All Answers' }))
    expect((screen.getByLabelText('Number of Dependents') as HTMLInputElement).value).toBe('0')
  })

  it('explains when browser speech recognition is unavailable', async () => {
    const user = userEvent.setup()
    render(<VoiceForm />)

    await user.click(screen.getByRole('button', { name: 'Answer profile questions by voice' }))
    expect(screen.getByText(/not supported by this browser/)).toBeTruthy()
  })
})