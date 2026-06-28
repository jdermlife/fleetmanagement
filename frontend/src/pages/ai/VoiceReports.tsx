import { Link } from 'react-router-dom'

const workflows = [
  {
    href: '/attend-meeting',
    label: 'Capture Meeting Audio',
    note: 'Start a live meeting workflow and prepare the transcript source.',
  },
  {
    href: '/meeting-history',
    label: 'Review Existing Sessions',
    note: 'Open prior recordings, summaries, and generated minutes.',
  },
  {
    href: '/send-email',
    label: 'Distribute Outputs',
    note: 'Send minutes and report summaries to stakeholders.',
  },
]

const reportTypes = [
  'Executive borrower update',
  'Collections follow-up summary',
  'Credit committee briefing',
  'Operations standup digest',
  'Compliance review memo',
  'Portfolio exception report',
]

export default function VoiceReports() {
  return (
    <div style={{ minHeight: '100vh', padding: '24px' }}>
      <div style={{ margin: '0 auto', maxWidth: '1120px' }}>
        <section
          style={{
            background:
              'radial-gradient(circle at top left, rgba(37,99,235,0.16), transparent 26%), linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)',
            border: '1px solid rgba(148,163,184,0.18)',
            borderRadius: '24px',
            boxShadow: '0 18px 40px rgba(15,23,42,0.06)',
            marginBottom: '22px',
            padding: '24px',
          }}
        >
          <p style={{ color: '#2563eb', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.14em', margin: 0, textTransform: 'uppercase' }}>
            Voice Workflow
          </p>
          <h1 style={{ color: '#0f172a', fontSize: '2rem', lineHeight: 1.08, margin: '10px 0 0' }}>
            Voice Reports
          </h1>
          <p style={{ color: '#475569', fontSize: '0.96rem', lineHeight: 1.7, margin: '12px 0 0', maxWidth: '760px' }}>
            Convert spoken updates, meetings, and borrower discussions into structured reports that are ready for review, escalation, and distribution.
          </p>
        </section>

        <div
          style={{
            display: 'grid',
            gap: '18px',
            gridTemplateColumns: 'minmax(0, 1.45fr) minmax(280px, 0.95fr)',
          }}
        >
          <section
            style={{
              background: '#fff',
              border: '1px solid rgba(148,163,184,0.18)',
              borderRadius: '22px',
              boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
              padding: '22px',
            }}
          >
            <div style={{ marginBottom: '18px' }}>
              <h2 style={{ color: '#0f172a', fontSize: '1.15rem', margin: 0 }}>Suggested Workflow</h2>
              <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: 1.6, margin: '8px 0 0' }}>
                Use these entry points to move from raw audio to a shareable report.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '14px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              {workflows.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  style={{
                    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                    border: '1px solid rgba(148,163,184,0.18)',
                    borderRadius: '18px',
                    color: '#0f172a',
                    display: 'block',
                    minHeight: '128px',
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

          <aside
            style={{
              background: '#fff',
              border: '1px solid rgba(148,163,184,0.18)',
              borderRadius: '22px',
              boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
              padding: '22px',
            }}
          >
            <h2 style={{ color: '#0f172a', fontSize: '1.15rem', margin: 0 }}>Report Formats</h2>
            <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: 1.6, margin: '8px 0 0 0' }}>
              Common voice-to-report outputs used across operations and credit teams.
            </p>

            <div style={{ display: 'grid', gap: '10px', marginTop: '18px' }}>
              {reportTypes.map((item) => (
                <div
                  key={item}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid rgba(148,163,184,0.18)',
                    borderRadius: '14px',
                    color: '#334155',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    padding: '12px 14px',
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
