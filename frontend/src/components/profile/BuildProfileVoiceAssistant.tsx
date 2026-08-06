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

function applyNativeValue(field: VoiceField, transcript: string): boolean {
  let value = transcript.trim()
  if (field instanceof HTMLSelectElement) {
    const selectedValue = resolveSelectValue(field, transcript)
    if (selectedValue === null) return false
    value = selectedValue
  } else if (field instanceof HTMLInputElement && (field.type === 'number' || field.inputMode === 'decimal')) {
    value = value.replace(/[^\d.-]/g, '')
    if (!value) return false
  }

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
  return true
}

export default function BuildProfileVoiceAssistant({ currentStep }: BuildProfileVoiceAssistantProps) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const activeFieldRef = useRef<VoiceField | null>(null)
  const [fieldName, setFieldName] = useState('')
  const [message, setMessage] = useState('Select the microphone to answer the next incomplete field.')
  const [transcript, setTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const Recognition = typeof window === 'undefined'
    ? undefined
    : window.SpeechRecognition || window.webkitSpeechRecognition

  const stopListening = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    window.speechSynthesis?.cancel()
    setIsListening(false)
  }

  useEffect(() => {
    stopListening()
    activeFieldRef.current = null
    setFieldName('')
    setTranscript('')
    setMessage('Select the microphone to answer the next incomplete field.')
  }, [currentStep])

  useEffect(() => () => {
    recognitionRef.current?.stop()
    window.speechSynthesis?.cancel()
  }, [])

  const beginListening = () => {
    if (!Recognition) {
      setMessage('Voice entry is not supported by this browser. Use Chrome or Edge and allow microphone access.')
      return
    }

    const fields = getVoiceFields()
    const nextField = fields.find((field) => !field.value.trim()) ?? fields[0]
    if (!nextField) {
      setMessage('This step has no voice-compatible fields to complete.')
      return
    }

    stopListening()
    const label = fieldLabel(nextField)
    const recognition = new Recognition()
    activeFieldRef.current = nextField
    recognitionRef.current = recognition
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = document.documentElement.lang || 'en-US'
    recognition.onresult = (event) => {
      const response = event.results[0]?.[0]?.transcript?.trim() || ''
      setTranscript(response)
      setMessage(response ? 'Review the response, then apply it to the field.' : 'No response was detected. Try again.')
      setIsListening(false)
    }
    recognition.onerror = (event) => {
      const denied = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      setMessage(denied ? 'Microphone access was denied. Allow access in your browser settings and try again.' : 'The response could not be captured. Try again.')
      setIsListening(false)
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
    setTranscript('')
    nextField.focus()
    if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      const prompt = new SpeechSynthesisUtterance(`Please provide ${label}.`)
      prompt.onend = listen
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(prompt)
    } else {
      listen()
    }
  }

  const applyResponse = () => {
    const field = activeFieldRef.current
    if (!field || !transcript) return
    if (!applyNativeValue(field, transcript)) {
      setMessage('The response did not match an available option. Say the option label or option number and try again.')
      return
    }
    setTranscript('')
    activeFieldRef.current = null
    setMessage(`${fieldName} updated. Review the field, then continue with the next question.`)
  }

  return (
    <section className="build-profile-voice-assistant" aria-label="Voice-guided profile entry">
      <button
        type="button"
        className={`build-profile-voice-button${isListening ? ' build-profile-voice-button-listening' : ''}`}
        onClick={isListening ? stopListening : beginListening}
        aria-label={isListening ? 'Stop listening' : 'Answer profile questions by voice'}
        title={isListening ? 'Stop listening' : 'Answer profile questions by voice'}
      >
        <span className="build-profile-microphone-icon" aria-hidden="true"><span /></span>
      </button>
      <div className="build-profile-voice-copy">
        <strong>{isListening ? 'Listening' : fieldName || 'Voice-guided entry'}</strong>
        <small role="status">{message}</small>
        {transcript ? <blockquote>{transcript}</blockquote> : null}
        {transcript ? <div className="build-profile-voice-actions">
          <button type="button" onClick={applyResponse}>Apply Response</button>
          <button type="button" onClick={beginListening}>Try Again</button>
        </div> : null}
        <small className="build-profile-voice-privacy">FILSCORE does not store microphone audio. Your browser speech service may process it.</small>
      </div>
    </section>
  )
}