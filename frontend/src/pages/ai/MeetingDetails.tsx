import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  downloadMeetingPdf,
  fetchMeetingDetails,
  getErrorMessage,
  type MeetingDetailsRecord,
} from '../../api'

export default function MeetingDetails() {
  const { id } = useParams<{ id: string }>()
  const [meeting, setMeeting] = useState<MeetingDetailsRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const loadMeeting = async () => {
      if (!id) {
        setMessage('Meeting not found.')
        setLoading(false)
        return
      }

      try {
        setMessage('')
        const response = await fetchMeetingDetails(id)
        setMeeting(response)
      } catch (error) {
        setMeeting(null)
        setMessage(getErrorMessage(error, 'Failed to load meeting details.'))
      } finally {
        setLoading(false)
      }
    }

    void loadMeeting()
  }, [id])

  const handleExportPdf = async () => {
    if (!id) {
      setMessage('Meeting not found.')
      return
    }

    try {
      setIsExporting(true)
      setMessage('')
      const downloadUrl = await downloadMeetingPdf(id)
      window.open(downloadUrl, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000)
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to export the meeting PDF.'))
    } finally {
      setIsExporting(false)
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
        {message || 'Meeting not found.'}
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
        Back to Meeting History
      </Link>

      <h1 style={{ marginTop: '20px' }}>
        {meeting.meeting_title}
      </h1>

      <div
        style={{
          marginTop: '12px',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => void handleExportPdf()}
          disabled={isExporting}
          style={{
            background: '#0891b2',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold',
            border: 'none',
            cursor: isExporting ? 'wait' : 'pointer',
          }}
        >
          {isExporting ? 'Exporting PDF...' : 'Export PDF'}
        </button>
      </div>

      {message ? <p className="status-message">{message}</p> : null}

      <p>
        <strong>Meeting Date:</strong>{' '}
        {meeting.meeting_date || 'N/A'}
      </p>

      <p>
        <strong>Created:</strong>{' '}
        {meeting.created_at || 'N/A'}
      </p>

      <div
        style={{
          background: '#f8fafc',
          padding: '20px',
          borderRadius: '12px',
          marginTop: '20px',
        }}
      >
        <h2>Summary</h2>
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
        <h2>Action Items</h2>
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
        <h2>Transcript</h2>
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
