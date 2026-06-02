import { useState } from 'react'
import axios from 'axios'

export default function SendEmail() {
  const [recipient, setRecipient] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const sendEmail = async () => {
    try {
      setLoading(true)
      setMessage('')

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/ai/send-minutes`,
        {
          recipient,
          subject,
          body,
        }
      )

      setMessage(response.data.message)
    } catch (error) {
      console.error(error)

      setMessage(
        'Failed to send email.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1>📧 Send Meeting Minutes</h1>

      <div
        style={{
          maxWidth: '700px',
          marginTop: '20px',
        }}
      >
        <label>
          Recipient Email
        </label>

        <input
          type="email"
          value={recipient}
          onChange={(e) =>
            setRecipient(e.target.value)
          }
          placeholder="example@gmail.com"
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '6px',
            marginBottom: '16px',
          }}
        />

        <label>
          Subject
        </label>

        <input
          type="text"
          value={subject}
          onChange={(e) =>
            setSubject(e.target.value)
          }
          placeholder="Meeting Minutes"
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '6px',
            marginBottom: '16px',
          }}
        />

        <label>
          Message
        </label>

        <textarea
          rows={10}
          value={body}
          onChange={(e) =>
            setBody(e.target.value)
          }
          placeholder="Type your message here..."
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '6px',
            marginBottom: '16px',
          }}
        />

        <button
          onClick={sendEmail}
          disabled={loading}
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
          {loading
            ? 'Sending...'
            : 'Send Email'}
        </button>

        {message && (
          <div
            style={{
              marginTop: '20px',
              padding: '12px',
              background: '#ecfeff',
              borderRadius: '8px',
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  )
}