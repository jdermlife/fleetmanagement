import { Link } from 'react-router-dom'

export default function DisputeResolutionPage() {
  return (
    <div className="standalone-card auth-screen">
      <h1>Dispute Resolution</h1>
      <p className="intro">
        Effective Date: August 5, 2026
        <br />
        This process covers disputes relating to FILSCORE accounts, subscriptions, payments,
        privacy, and digital services.
      </p>

      <div className="stack-panel">
        <section className="card auth-helper-card">
          <h3>1. Contact Customer Service First</h3>
          <p>
            Start by emailing{' '}
            <a href="mailto:admin@quantech.international">admin@quantech.international</a> with a
            clear explanation of the concern and the outcome requested. Include relevant account,
            transaction, and prior-support references, but never include passwords, one-time codes,
            PINs, or complete payment credentials.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>2. Submit a Formal Dispute</h3>
          <p>
            If the concern is not resolved through ordinary support, reply to the same email thread
            with the subject “Formal Dispute – [account or transaction reference].” Include:
          </p>
          <ul>
            <li>Your name and the email address associated with the account.</li>
            <li>A chronological summary of the relevant facts.</li>
            <li>Copies of receipts, notices, screenshots, or correspondence.</li>
            <li>The specific correction, refund, explanation, or other resolution requested.</li>
          </ul>
        </section>

        <section className="card auth-helper-card">
          <h3>3. Internal Review</h3>
          <p>
            FILSCORE aims to acknowledge a complete formal dispute within two business days and
            provide a written outcome within ten business days. A matter involving a payment
            provider, suspected fraud, significant technical investigation, or third-party records
            may take longer. The customer will receive a status update and, where possible, a new
            target date.
          </p>
          <p>
            The review may result in an explanation, service correction, billing adjustment,
            approved refund, request for additional information, or denial with the reason stated.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>4. Good-Faith Resolution</h3>
          <p>
            The parties may agree to continue discussions or use a mutually acceptable mediation or
            other lawful alternative-dispute process. No customer is required by this page to waive
            a non-waivable consumer, privacy, contractual, or statutory right.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>5. External Remedies</h3>
          <p>
            If the internal process does not resolve the matter, a customer may use any remedy
            available under applicable Philippine law or contact the government agency with
            jurisdiction over the issue.
          </p>
          <ul>
            <li>
              General consumer-service concerns may be referred to the{' '}
              <a href="https://www.dti.gov.ph/dti-consumer-space/dti-complaints/" target="_blank" rel="noreferrer">
                Department of Trade and Industry consumer complaints service
              </a>.
            </li>
            <li>
              Personal-data concerns may be referred to the{' '}
              <a href="https://privacy.gov.ph/file-a-complaint-2/" target="_blank" rel="noreferrer">
                National Privacy Commission complaint process
              </a>.
            </li>
            <li>
              A dispute involving a bank, e-wallet, card issuer, or other BSP-supervised institution
              may be escalated through the{' '}
              <a href="https://www.bsp.gov.ph/Pages/Forms/DispForm.aspx?ID=1870" target="_blank" rel="noreferrer">
                BSP Consumer Assistance channels
              </a> after first complaining to that institution. This reference does not represent
              FILSCORE or Quantech.International Solutions OPC as a BSP-supervised institution.
            </li>
          </ul>
        </section>

        <section className="card auth-helper-card">
          <h3>6. Privacy and Records</h3>
          <p>
            Dispute records may be retained for case handling, audit, fraud prevention, security,
            legal, and compliance purposes as described in the Privacy Disclosures. Only information
            reasonably necessary for the review should be submitted.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>Related Policies</h3>
          <div className="form-actions">
            <Link className="auth-link-button" to="/customer-service">Customer Service</Link>
            <Link className="auth-link-button" to="/return-refund-policy">Return and Refund Policy</Link>
            <Link className="auth-link-button" to="/terms">Terms &amp; Consent</Link>
            <Link className="auth-link-button" to="/privacy">Privacy Disclosures</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
