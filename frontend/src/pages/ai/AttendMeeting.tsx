import { useState } from 'react'

import {
  generateMeetingMinutes,
  getErrorMessage,
  transcribeMeetingAudio,
} from '../../api'
import { useAutosaveDraft } from '../../autosave/useAutosaveDraft'

export default function AttendMeeting(): JSX.Element {
  const [meetingTitle, setMeetingTitle] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [transcript, setTranscript] = useState('')
  const [minutes, setMinutes] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  useAutosaveDraft({
    scope: 'attend-meeting',
    entityKey: 'default',
    value: { meetingTitle, transcript, minutes },
    defaults: { meetingTitle: '', transcript: '', minutes: '' },
    onHydrate: (draft) => {
      setMeetingTitle(draft.meetingTitle)
      setTranscript(draft.transcript)
      setMinutes(draft.minutes)
    },
  })

  const generateMinutes = async (): Promise<void> => {
    if (!audioFile) {
      setMessage('Please select an audio file.')
      return
    }

    try {
      setLoading(true)
      setMessage('')

      const transcriptResponse = await transcribeMeetingAudio(audioFile)
      setTranscript(transcriptResponse.transcript)

      const minutesResponse = await generateMeetingMinutes({
        meetingTitle: meetingTitle.trim() || 'Meeting',
        meetingDate: new Date().toISOString(),
        transcript: transcriptResponse.transcript,
      })

      setMinutes(minutesResponse.summary || '')
      setMessage(minutesResponse.message || 'Meeting minutes generated successfully.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to generate meeting minutes.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h1>AI Meeting Assistant</h1>

      <div style={{ marginBottom: '20px' }}>
        <label>Meeting Title</label>
        <input
          type="text"
          value={meetingTitle}
          onChange={(event) => setMeetingTitle(event.target.value)}
          placeholder="Operations Weekly Meeting"
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>Upload Recording</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(event) => setAudioFile(event.target.files?.[0] || null)}
        />
      </div>

      <button onClick={() => void generateMinutes()} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Minutes'}
      </button>

      {message ? <p className="status-message">{message}</p> : null}

      {transcript ? (
        <div style={{ marginTop: '30px' }}>
          <h2>Transcript</h2>
          <textarea
            value={transcript}
            readOnly
            rows={10}
            style={{ width: '100%' }}
          />
        </div>
      ) : null}

      {minutes ? (
        <div style={{ marginTop: '30px' }}>
          <h2>Meeting Minutes</h2>
          <textarea
            value={minutes}
            readOnly
            rows={15}
            style={{ width: '100%' }}
          />
        </div>
      ) : null}
    </div>
  )
}
