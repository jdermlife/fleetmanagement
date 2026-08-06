import { useEffect, useRef, useState } from 'react'

type SpeechRecognitionResultEvent = Event & {
  results: ArrayLike<{ 0: { transcript: string } }>
}

type SpeechRecognitionErrorEvent = Event & {
  error: string
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onend: (() => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

interface BuildProfileVoiceAssistantProps {
  currentStep: number
}

type VoiceField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

type RecordedAnswer = {
  field: VoiceField
  label: string
  transcript: string
  value: string
}

function isVisible(element: HTMLElement): boolean {
  if (element.hidden || element.closest('[hidden]')) return false
  if (element.closest('details:not([open])')) return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

function getVoiceFields(): VoiceField[] {
  const root = document.querySelector('.build-profile-form-panel .build-profile-step-content')
  if (!root) return []

  return Array.from(root.querySelectorAll<VoiceField>('input, select, textarea')).filter((field) => {
    if (!isVisible(field) || field.disabled) return false
    if (!(field instanceof HTMLSelectElement) && field.readOnly) return false
    if (field instanceof HTMLInputElement) {
      return !['button', 'checkbox', 'date', 'file', 'hidden', 'radio', 'reset', 'submit'].includes(field.type)
    }
    return true
  })
}

function fieldLabel(field: VoiceField): string {
  const ariaLabel = field.getAttribute('aria-label')?.trim()
  if (ariaLabel) return ariaLabel

  const label = field.labels?.[0]
  if (label) {
    const labelCopy = label.cloneNode(true) as HTMLLabelElement
    labelCopy.querySelectorAll('input, select, textarea, button').forEach((control) => control.remove())
    const labelText = labelCopy.textContent?.trim()
    if (labelText) return labelText
  }

  return field.getAttribute('placeholder')?.trim() || 'this field'
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function resolveSelectValue(field: HTMLSelectElement, transcript: string): string | null {
  const spoken = normalizeText(transcript)
  const ordinalMatch = spoken.match(/(?:option|choice)\s+(\d+)/)
  if (ordinalMatch) {
    const option = Array.from(field.options).filter((item) => item.value)[Number(ordinalMatch[1]) - 1]
    return option?.value ?? null
  }

  const option = Array.from(field.options).find((item) => {
    if (!item.value) return false
    const label = normalizeText(item.textContent || item.value)
    return label === spoken || label.includes(spoken) || spoken.includes(label)
  })
  return option?.value ?? null
}

function resolveFieldValue(field: VoiceField, transcript: string): string | null {
  let value = transcript.trim()
  if (field instanceof HTMLSelectElement) {
    const selectedValue = resolveSelectValue(field, transcript)
    if (selectedValue === null) return null
    value = selectedValue
  } else if (field instanceof HTMLInputElement && (field.type === 'number' || field.inputMode === 'decimal')) {
    value = value.replace(/[^\d.-]/g, '')
    if (!value) return null
  }

  return value || null
}

function applyNativeValue(field: VoiceField, value: string): void {
  const prototype = field instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  valueSetter?.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.dispatchEvent(new Event('change', { bubbles: true }))
  field.focus()
}

export default function BuildProfileVoiceAssistant({ currentStep }: BuildProfileVoiceAssistantProps) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const queueRef = useRef<VoiceField[]>([])
  const recordedAnswersRef = useRef<RecordedAnswer[]>([])
  const sessionActiveRef = useRef(false)
  const [fieldName, setFieldName] = useState('')
  const [message, setMessage] = useState('Select the microphone to answer all incomplete fields in this step.')
  const [recordedAnswers, setRecordedAnswers] = useState<RecordedAnswer[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const Recognition = typeof window === 'undefined'
    ? undefined
    : window.SpeechRecognition || window.webkitSpeechRecognition

  const stopRecognition = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    window.speechSynthesis?.cancel()
    setIsListening(false)
  }

  const resetInterview = (nextMessage = 'Select the microphone to answer all incomplete fields in this step.') => {
    stopRecognition()
    sessionActiveRef.current = false
    queueRef.current = []
    recordedAnswersRef.current = []
    setRecordedAnswers([])
    setIsReviewing(false)
    setFieldName('')
    setMessage(nextMessage)
  }

  useEffect(() => {
    resetInterview()
  }, [currentStep])

  useEffect(() => () => {
    recognitionRef.current?.stop()
    window.speechSynthesis?.cancel()
  }, [])

  const speak = (text: string, onEnd?: () => void) => {
    if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      const prompt = new SpeechSynthesisUtterance(text)
      prompt.onend = () => onEnd?.()
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(prompt)
      return
    }
    onEnd?.()
  }

  const finishInterview = () => {
    sessionActiveRef.current = false
    recognitionRef.current = null
    setIsListening(false)
    setIsReviewing(true)
    setFieldName('Review recorded answers')
    setMessage('All voice-compatible questions are answered. Verify every response, then apply all answers before moving to the next workflow step.')
    speak('All questions in this workflow step have been answered. Please verify and apply all answers before moving to the next workflow step.')
  }

  const askQuestion = (index: number) => {
    if (!sessionActiveRef.current) return
    const field = queueRef.current[index]
    if (!field) {
      finishInterview()
      return
    }

    stopRecognition()
    const label = fieldLabel(field)
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = document.documentElement.lang || 'en-US'
    recognition.onresult = (event) => {
      const response = event.results[0]?.[0]?.transcript?.trim() || ''
      setIsListening(false)
      recognitionRef.current = null
      if (!response) {
        setMessage(`No response was detected for ${label}. Listening again...`)
        askQuestion(index)
        return
      }

      const value = resolveFieldValue(field, response)
      if (value === null) {
        setMessage(`${label} did not match an available option or number. Listening again...`)
        speak(`That response was not valid for ${label}. Please try again.`, () => askQuestion(index))
        return
      }

      const answer = { field, label, transcript: response, value }
      const nextAnswers = [...recordedAnswersRef.current, answer]
      recordedAnswersRef.current = nextAnswers
      setRecordedAnswers(nextAnswers)
      setMessage(`${label} recorded. Moving to the next question.`)
      askQuestion(index + 1)
    }
    recognition.onerror = (event) => {
      const denied = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      setIsListening(false)
      recognitionRef.current = null
      if (denied) {
        sessionActiveRef.current = false
        setMessage('Microphone access was denied. Allow access in your browser settings and try again.')
        return
      }
      setMessage(`The response for ${label} could not be captured. Listening again...`)
      speak(`I could not capture ${label}. Please try again.`, () => askQuestion(index))
    }
    recognition.onend = () => setIsListening(false)

    const listen = () => {
      try {
        recognition.start()
        setIsListening(true)
        setMessage(`Listening for ${label}...`)
      } catch {
        setMessage('The microphone is already in use. Stop listening and try again.')
      }
    }

    setFieldName(label)
    field.focus()
    speak(`Please provide ${label}.`, listen)
  }

  const beginInterview = () => {
    if (!Recognition) {
      setMessage('Voice entry is not supported by this browser. Use Chrome or Edge and allow microphone access.')
      return
    }

    const fields = getVoiceFields().filter((field) => !field.value.trim())
    if (!fields.length) {
      setMessage('All voice-compatible fields in this step already have answers.')
      speak('All voice-compatible fields in this workflow step already have answers. Please verify them before moving to the next step.')
      return
    }

    resetInterview('Starting the voice interview...')
    queueRef.current = fields
    sessionActiveRef.current = true
    askQuestion(0)
  }

  const applyAllAnswers = () => {
    recordedAnswersRef.current.forEach(({ field, value }) => applyNativeValue(field, value))
    const appliedCount = recordedAnswersRef.current.length
    resetInterview(`${appliedCount} answers applied. Review the fields, then move to the next workflow step.`)
    speak(`${appliedCount} answers have been applied. Please review the fields before moving to the next workflow step.`)
  }

  return (
    <section className="build-profile-voice-assistant" aria-label="Voice-guided profile entry">
      <button
        type="button"
        className={`build-profile-voice-button${isListening ? ' build-profile-voice-button-listening' : ''}`}
        onClick={isListening ? () => resetInterview('Voice interview stopped. Select the microphone to start again.') : beginInterview}
        aria-label={isListening ? 'Stop listening' : 'Answer profile questions by voice'}
        title={isListening ? 'Stop listening' : 'Answer profile questions by voice'}
      >
        <span className="build-profile-microphone-icon" aria-hidden="true"><span /></span>
      </button>
      <div className="build-profile-voice-copy">
        <strong>{isListening ? 'Listening' : fieldName || 'Voice-guided entry'}</strong>
        <small role="status">{message}</small>
        {recordedAnswers.length > 0 ? <ol className="build-profile-voice-review-list">
          {recordedAnswers.map((answer, index) => <li key={`${answer.label}-${index}`}>
            <strong>{answer.label}</strong>
            <span>{answer.transcript}</span>
          </li>)}
        </ol> : null}
        {isReviewing ? <div className="build-profile-voice-actions">
          <button type="button" onClick={applyAllAnswers}>Apply All Answers</button>
          <button type="button" onClick={() => resetInterview('Answers discarded. Select the microphone to start again.')}>Discard and Restart</button>
        </div> : null}
        <small className="build-profile-voice-privacy">FILSCORE does not store microphone audio. Your browser speech service may process it.</small>
      </div>
    </section>
  )
}