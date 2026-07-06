import { useRef, useState } from 'react'

import { getApiBaseUrl, getAuthToken } from '../../api'

export default function MeetingRecorder() {
  const [recording, setRecording] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  const startRecording = async () => {
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

      await fetch(
        `${getApiBaseUrl()}/ai/transcribe`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        }
      )

      recorder.stream.getTracks().forEach((track) => {
        track.stop()
      })
    }

    recorder.stop()

    setRecording(false)
  }

  return (
    <div>
      {!recording ? (
        <button onClick={startRecording}>
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
