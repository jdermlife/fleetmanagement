import { Link } from 'react-router-dom'

const supportChannels = [
  {
    title: 'General Support',
    details: 'Questions about access, workflows, subscriptions, and day-to-day use.',
    contact: 'admin@quantech.international',
  },
  {
    title: 'Privacy and Deletion Requests',
    details: 'Requests related to account deletion, privacy concerns, and data-handling follow-up.',
    contact: 'admin@quantech.international',
  },
  {
    title: 'Technical Review Support',
    details: 'Support for reviewer access, demo credentials, and release validation coordination.',
    contact: 'admin@quantech.international',
  },
] as const

const supportSteps = [
  'Include your full name, organization, and the email address tied to your account.',
  'Describe the affected workflow, page, or record as precisely as possible.',
  'For urgent account issues, include screenshots or error text when available.',
  'For deletion requests, specify the account or user record to be disabled or reviewed.',
] as const

export default function SupportPage() {
  return (
    <div className="standalone-card auth-screen">
      <h1>Support</h1>
      <p className="intro">
        Use this page as the public support destination for account help, privacy requests,
        and reviewer or release-related coordination.
      </p>

      <div className="stack-panel">
        <section className="card auth-helper-card">
          <h3>Primary Contact</h3>
          <p>
            Email:{' '}
            <a href="mailto:admin@quantech.international">admin@quantech.international</a>
          </p>
          <p>
            Service Provider: Quantech.International Solutions OPC
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>Support Channels</h3>
          {supportChannels.map((channel) => (
            <div key={channel.title} style={{ marginBottom: '16px' }}>
              <p><strong>{channel.title}</strong></p>
              <p>{channel.details}</p>
              <p>
                Contact:{' '}
                <a href={`mailto:${channel.contact}`}>{channel.contact}</a>
              </p>
            </div>
          ))}
        </section>

        <section className="card auth-helper-card">
          <h3>What To Include In A Request</h3>
          <ul>
            {supportSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </section>

        <section className="card auth-helper-card">
          <h3>Related Pages</h3>
          <p>
            Review the current legal disclosures before submitting support or reviewer requests.
          </p>
          <div className="form-actions">
            <Link className="auth-link-button" to="/privacy">
              Privacy Disclosures
            </Link>
            <Link className="auth-link-button" to="/terms">
              Terms &amp; Consent
            </Link>
            <Link className="auth-link-button" to="/subscription-fees">
              Subscription Fees
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
