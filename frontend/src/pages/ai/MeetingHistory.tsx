import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  getErrorMessage,
  listMeetings,
  searchMeetingsByTitle,
  type MeetingRecord,
} from '../../api'

export default function MeetingHistory() {
  const [search, setSearch] = useState('')
  const [meetings, setMeetings] = useState<MeetingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadInitialMeetings = async () => {
      try {
        const rows = await listMeetings()
        setMeetings(rows)
      } catch (error) {
        setMessage(getErrorMessage(error, 'Unable to load meeting history.'))
      } finally {
        setLoading(false)
      }
    }

    void loadInitialMeetings()
  }, [])

  const handleSearch = async () => {
    try {
      setLoading(true)
      setMessage('')

      if (!search.trim()) {
        setMeetings(await listMeetings())
        return
      }

      setMeetings(await searchMeetingsByTitle(search))
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to search meeting history.'))
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    try {
      setLoading(true)
      setMessage('')
      setSearch('')
      setMeetings(await listMeetings())
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to reload meeting history.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1>Meeting History</h1>

      <p>
        View all AI-generated meeting minutes.
      </p>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
        }}
      >
        <input
          type="text"
          placeholder="Search meeting title..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #ccc',
          }}
        />

        <button
          onClick={() => void handleSearch()}
          style={{
            background: '#0891b2',
            color: '#fff',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Search
        </button>

        <button
          onClick={() => void handleReset()}
          style={{
            background: '#64748b',
            color: '#fff',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Reset
        </button>
      </div>

      {message ? <p className="status-message">{message}</p> : null}

      {loading ? (
        <p>Loading meetings...</p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '20px',
          }}
        >
          <thead>
            <tr
              style={{
                background: '#0f766e',
                color: '#fff',
              }}
            >
              <th style={{ padding: '12px' }}>ID</th>
              <th style={{ padding: '12px' }}>Meeting Title</th>
              <th style={{ padding: '12px' }}>Meeting Date</th>
              <th style={{ padding: '12px' }}>Created</th>
              <th style={{ padding: '12px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((meeting) => (
              <tr
                key={meeting.id}
                style={{
                  borderBottom: '1px solid #ddd',
                }}
              >
                <td style={{ padding: '12px' }}>{meeting.id}</td>
                <td style={{ padding: '12px' }}>{meeting.meeting_title}</td>
                <td style={{ padding: '12px' }}>{meeting.meeting_date || 'N/A'}</td>
                <td style={{ padding: '12px' }}>{meeting.created_at || 'N/A'}</td>
                <td style={{ padding: '12px' }}>
                  <Link
                    to={`/ai/history/${meeting.id}`}
                    style={{
                      background: '#0891b2',
                      color: '#fff',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      textDecoration: 'none',
                    }}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
