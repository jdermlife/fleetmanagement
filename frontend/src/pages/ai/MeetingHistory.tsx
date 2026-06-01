import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

export default function MeetingHistory() {
  const [meetings, setMeetings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMeetings()
  }, [])

  const loadMeetings = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/ai/meetings`
      )

      setMeetings(response.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1>📋 Meeting History</h1>

      <p>
        View all AI-generated meeting minutes.
      </p>

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
              <th style={{ padding: '12px' }}>
                Meeting Title
              </th>
              <th style={{ padding: '12px' }}>
                Meeting Date
              </th>
              <th style={{ padding: '12px' }}>
                Created
              </th>
              <th style={{ padding: '12px' }}>
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {meetings.map((meeting) => (
              <tr
                key={meeting.id}
                style={{
                  borderBottom:
                    '1px solid #ddd',
                }}
              >
                <td style={{ padding: '12px' }}>
                  {meeting.id}
                </td>

                <td style={{ padding: '12px' }}>
                  {meeting.meeting_title}
                </td>

                <td style={{ padding: '12px' }}>
                  {meeting.meeting_date}
                </td>

                <td style={{ padding: '12px' }}>
                  {meeting.created_at}
                </td>

                <td style={{ padding: '12px' }}>
                  <Link
                    to={`/ai/history/${meeting.id}`}
                    style={{
                      background:
                        '#0891b2',
                      color: '#fff',
                      padding:
                        '8px 12px',
                      borderRadius: '6px',
                      textDecoration:
                        'none',
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