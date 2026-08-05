import { Link } from 'react-router-dom'

const serviceTopics = [
  'Account access, password reset, social sign-in, and account settings.',
  'Subscription plans, billing questions, payment confirmation, cancellation, and refund requests.',
  'Financial-health, credit, lending, document, and AI-assisted workflow questions.',
  'Privacy, account deletion, security concerns, and suspected unauthorized activity.',
  'Formal complaints, disputes, and follow-up on an existing case reference.',
] as const

export default function CustomerServicePage() {
  return (
    <div className="standalone-card auth-screen">
      <h1>Customer Service and Contact Information</h1>
      <p className="intro">
        Public assistance for FILSCORE account, subscription, payment, privacy, and service concerns.
      </p>

      <div className="stack-panel">
        <section className="card auth-helper-card">
          <h3>Service Provider</h3>
          <p>Quantech.International Solutions OPC</p>
          <p>
            Service: FILSCORE / FMS Mobile
            <br />
            Website:{' '}
            <a href="https://filscore-ai.quantech.international">
              filscore-ai.quantech.international
            </a>
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>Primary Customer Service Channel</h3>
          <p>
            Email:{' '}
            <a href="mailto:admin@quantech.international">admin@quantech.international</a>
          </p>
          <p>
            Requests are monitored on Philippine business days. FILSCORE aims to acknowledge a
            complete request within two business days and resolve ordinary requests within five
            business days. Complex technical, payment, privacy, or fraud reviews may require more
            time, in which case a status update will be provided.
          </p>
          <p>
            This email channel is not an emergency service. Suspected account compromise or
            unauthorized payment activity should be reported as soon as possible and may also need
            to be reported directly to the relevant bank, wallet, card issuer, or payment provider.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>What We Can Help With</h3>
          <ul>
            {serviceTopics.map((topic) => <li key={topic}>{topic}</li>)}
          </ul>
        </section>

        <section className="card auth-helper-card">
          <h3>Information To Include</h3>
          <ul>
            <li>Your full name and the email address associated with the account.</li>
            <li>A concise description of the affected page, feature, transaction, or record.</li>
            <li>Relevant dates, transaction or case references, and the resolution requested.</li>
            <li>Screenshots or error messages where helpful, with unrelated personal data removed.</li>
          </ul>
          <p>
            Do not send passwords, one-time codes, PINs, full payment credentials, or personal
            information that is not necessary to investigate the request. Information submitted to
            customer service is handled under the Privacy Disclosures.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>Escalations</h3>
          <p>
            If an ordinary support request remains unresolved, send a follow-up using the subject
            “Formal Dispute” and include the earlier email thread or case reference. The request will
            follow the published dispute-resolution process.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>Related Pages</h3>
          <div className="form-actions">
            <Link className="auth-link-button" to="/return-refund-policy">Return and Refund Policy</Link>
            <Link className="auth-link-button" to="/dispute-resolution">Dispute Resolution</Link>
            <Link className="auth-link-button" to="/privacy">Privacy Disclosures</Link>
            <Link className="auth-link-button" to="/terms">Terms &amp; Consent</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
