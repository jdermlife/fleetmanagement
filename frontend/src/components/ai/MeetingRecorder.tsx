import { useRef, useState } from 'react'

import { getApiBaseUrl, getAuthToken } from '../../api'
import ThirdPartyAiConsent, {
  AI_PROCESSING_CONSENT_VERSION,
} from './ThirdPartyAiConsent'

export default function MeetingRecorder() {
  const [recording, setRecording] = useState(false)
  const [hasAiProcessingConsent, setHasAiProcessingConsent] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  const startRecording = async () => {
    if (!hasAiProcessingConsent) return

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    })

    const recorder = new MediaRecorder(stream)
    chunksRef.current = []

    recorder.ondataavailable = (event) => {
      chunksRef.current.push(event.data)
    }

    recorder.start()

    mediaRecorderRef.current = recorder

    setRecording(true)
  }

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) {
      return
    }

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: 'audio/webm',
      })

      const formData = new FormData()
      const token = getAuthToken()

      formData.append('audio', blob)
      formData.append('ai_processing_consent', 'true')
      formData.append('consent_version', AI_PROCESSING_CONSENT_VERSION)

      try {
        await fetch(`${getApiBaseUrl()}/ai/transcribe`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        })
      } finally {
        recorder.stream.getTracks().forEach((track) => {
          track.stop()
        })
        setHasAiProcessingConsent(false)
      }
    }

    recorder.stop()

    setRecording(false)
  }

  return (
    <div>
      <ThirdPartyAiConsent
        checked={hasAiProcessingConsent}
        disabled={recording}
        onChange={setHasAiProcessingConsent}
      />
      {!recording ? (
        <button onClick={startRecording} disabled={!hasAiProcessingConsent}>
          Start Recording
        </button>
      ) : (
        <button onClick={stopRecording}>
          Stop Recording
        </button>
      )}
    </div>
  )
}
