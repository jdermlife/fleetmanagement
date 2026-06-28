import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { api, getErrorMessage } from '../../api'

type DashboardStats = {
  emails_sent: number
  minutes_generated: number
  pdf_exports: number
  total_meetings: number
}

const emptyStats: DashboardStats = {
  total_meetings: 0,
  minutes_generated: 0,
  emails_sent: 0,
  pdf_exports: 0,
}

const quickLinks = [
  { href: '/meeting-history', label: 'Meeting History', note: 'Review prior sessions and exports' },
  { href: '/attend-meeting', label: 'Attend Meeting', note: 'Start capture and live note-taking' },
  { href: '/chat-assistant', label: 'Chat Assistant', note: 'Ask questions and draft responses' },
  { href: '/voice-reports', label: 'Voice Reports', note: 'Turn spoken updates into report-ready summaries' },
  { href: '/ocr-scanner', label: 'OCR Scanner', note: 'Extract text from supporting documents' },
  { href: '/pdf-summarizer', label: 'PDF Summarizer', note: 'Generate concise summaries from files' },
  { href: '/risk-analysis', label: 'Risk Analysis', note: 'Review AI-assisted portfolio and exposure insights' },
  { href: '/compliance-ai', label: 'Compliance AI', note: 'Prepare governance and compliance outputs' },
]

export default function AIDashboard() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true)
      setMessage('')

      try {
        const response = await api.get<DashboardStats>('/ai/dashboard/stats')
        setStats(response.data)
      } catch (error) {
        setMessage(getErrorMessage(error, 'Failed to load AI dashboard statistics.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadStats()
  }, [])

  const statCards = [
    { label: 'Meetings', value: stats.total_meetings, tone: '#0f766e' },
    { label: 'Minutes Generated', value: stats.minutes_generated, tone: '#2563eb' },
    { label: 'Emails Sent', value: stats.emails_sent, tone: '#7c3aed' },
    { label: 'PDF Exports', value: stats.pdf_exports, tone: '#c2410c' },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: '24px' }}>
      <div style={{ margin: '0 auto', maxWidth: '1200px' }}>
        <section
          style={{
            background:
              'radial-gradient(circle at top left, rgba(15,118,110,0.18), transparent 28%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid rgba(148,163,184,0.18)',
            borderRadius: '24px',
            boxShadow: '0 16px 40px rgba(15,23,42,0.08)',
            marginBottom: '20px',
            padding: '24px',
          }}
        >
          <div style={{ alignItems: 'flex-start', display: 'flex', gap: '16px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ maxWidth: '760px' }}>
              <p style={{ color: '#0f766e', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.14em', margin: 0, textTransform: 'uppercase' }}>
                AI Workspace
              </p>
              <h1 style={{ color: '#0f172a', fontSize: '2rem', lineHeight: 1.1, margin: '10px 0 0' }}>
                AI Operations Center
              </h1>
              <p style={{ color: '#475569', fontSize: '0.96rem', lineHeight: 1.7, margin: '12px 0 0' }}>
                Manage meeting capture, voice-to-report workflows, OCR extraction, PDF summaries, and AI-assisted risk and compliance operations from one workspace.
              </p>
            </div>

            <div
              style={{
                background: '#ecfeff',
                border: '1px solid #a5f3fc',
                borderRadius: '999px',
                color: '#155e75',
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '10px 14px',
              }}
            >
              {isLoading ? 'Refreshing statistics' : 'Connected to AI services'}
            </div>
          </div>
        </section>

        {message ? (
          <div
            style={{
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '16px',
              color: '#be123c',
              marginBottom: '20px',
              padding: '14px 16px',
            }}
          >
            {message}
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gap: '16px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            marginBottom: '24px',
          }}
        >
          {statCards.map((card) => (
            <div
              key={card.label}
              style={{
                background: '#fff',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '18px',
                boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
                padding: '18px',
              }}
            >
              <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', margin: 0, textTransform: 'uppercase' }}>
                {card.label}
              </p>
              <p style={{ color: card.tone, fontSize: '2rem', fontWeight: 700, lineHeight: 1.1, margin: '12px 0 0' }}>
                {isLoading ? '...' : card.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <section
          style={{
            background: '#fff',
            border: '1px solid rgba(148,163,184,0.18)',
            borderRadius: '22px',
            boxShadow: '0 14px 28px rgba(15,23,42,0.05)',
            padding: '22px',
          }}
        >
          <div style={{ marginBottom: '18px' }}>
            <h2 style={{ color: '#0f172a', fontSize: '1.2rem', margin: 0 }}>AI Tools</h2>
            <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: 1.6, margin: '8px 0 0' }}>
              Jump directly into the workflow you need.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '16px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            }}
          >
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                style={{
                  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                  border: '1px solid rgba(148,163,184,0.18)',
                  borderRadius: '18px',
                  color: '#0f172a',
                  display: 'block',
                  minHeight: '120px',
                  padding: '18px',
                  textDecoration: 'none',
                }}
              >
                <p style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{item.label}</p>
                <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.6, margin: '10px 0 0' }}>
                  {item.note}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
