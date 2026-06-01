import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'

export default function MeetingDetails() {
  const { id } = useParams()

  const [meeting, setMeeting] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMeeting()
  }, [id])

  const loadMeeting = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/ai/meetings/${id}`
      )

      setMeeting(response.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        Loading meeting...
      </div>
    )
  }

  if (!meeting) {
    return (
      <div style={{ padding: '24px' }}>
        Meeting not found.
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <Link
        to="/meeting-history"
        style={{
          textDecoration: 'none',
          color: '#0891b2',
          fontWeight: 'bold',
        }}
      >
        ← Back to Meeting History
      </Link>

      <h1 style={{ marginTop: '20px' }}>
        📋 {meeting.meeting_title}
      </h1>

      <p>
        <strong>Meeting Date:</strong> {meeting.meeting_date}
      </p>

      <p>
        <strong>Created:</strong> {meeting.created_at}
      </p>

      <div
        style={{
          background: '#f8fafc',
          padding: '20px',
          borderRadius: '12px',
          marginTop: '20px',
        }}
      >
        <h2>📝 Summary</h2>

        <pre
          style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
          }}
        >
          {meeting.summary}
        </pre>
      </div>

      <div
        style={{
          background: '#ecfeff',
          padding: '20px',
          borderRadius: '12px',
          marginTop: '20px',
        }}
      >
        <h2>✅ Action Items</h2>

        <pre
          style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
          }}
        >
          {meeting.action_items}
        </pre>
      </div>

      <div
        style={{
          background: '#fafafa',
          padding: '20px',
          borderRadius: '12px',
          marginTop: '20px',
          marginBottom: '40px',
        }}
      >
        <h2>🎤 Transcript</h2>

        <pre
          style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
          }}
        >
          {meeting.transcript}
        </pre>
      </div>
    </div>
  )
}