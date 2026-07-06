import { Link } from 'react-router-dom'

export default function TermsPage() {
  return (
    <div className="standalone-card auth-screen">
      <h1>Terms & Consent</h1>
      <p className="intro">
        This screen gives users the product-facing terms summary and consent language typically
        expected before registration or submission of sensitive operational data.
      </p>

      <div className="stack-panel">
        <section className="card auth-helper-card">
          <h3>Acceptable Use</h3>
          <p>
            Users are responsible for accurate, lawful, and authorized use of fleet, borrower,
            collateral, and supporting document records entered into the platform.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>Operational Consent</h3>
          <p>
            By using the system, users acknowledge that workflow actions, account activity, and
            record updates may be logged for audit, fraud review, compliance, and security
            monitoring.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>Document and Data Handling</h3>
          <p>
            Uploaded files and borrower information should only be submitted where the operator has
            the right to collect, review, and retain them under internal policy and applicable
            regulations.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>AI and Audio Features</h3>
          <p>
            AI-assisted features may process uploaded images, borrower documents, meeting audio, and
            related text content to generate summaries, parsing suggestions, or operational outputs.
            Use these tools only for information you are authorized to submit and review.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>Account Deletion and Support</h3>
          <p>
            Users can manage account access from the in-app account settings flow where available.
            Privacy, deletion, and support requests may also be sent to{' '}
            <a href="mailto:admin@quantech.international">admin@quantech.international</a>.
          </p>
          <p>
            Public support page:{' '}
            <Link to="/support">Support</Link>
          </p>
        </section>
      </div>
    </div>
  )
}
