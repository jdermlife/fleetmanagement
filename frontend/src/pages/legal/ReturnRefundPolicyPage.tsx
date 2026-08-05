import { Link } from 'react-router-dom'

export default function ReturnRefundPolicyPage() {
  return (
    <div className="standalone-card auth-screen">
      <h1>Return and Refund Policy</h1>
      <p className="intro">
        Effective Date: August 5, 2026
        <br />
        Service: FILSCORE / FMS Mobile
        <br />
        Service Provider: Quantech.International Solutions OPC
      </p>

      <div className="stack-panel">
        <section className="card auth-helper-card">
          <h3>1. Digital Services</h3>
          <p>
            FILSCORE provides digital subscriptions, financial-health tools, credit and lending
            workflows, document services, and AI-assisted features. Because no physical goods are
            delivered, there is no physical item to return. Requests involving an imperfect,
            unavailable, or incorrectly billed digital service are handled under this refund policy.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>2. Refund Eligibility</h3>
          <p>A refund or billing correction may be approved when:</p>
          <ul>
            <li>The same transaction was charged more than once.</li>
            <li>The amount or subscription plan charged differs from the confirmed purchase.</li>
            <li>An unauthorized transaction is reported and verified through a reasonable review.</li>
            <li>
              A paid service was materially unavailable because of a FILSCORE issue and was not
              restored or otherwise remedied within a reasonable period.
            </li>
            <li>A refund is required by applicable law or the rules of the payment provider.</li>
          </ul>
          <p>
            This policy does not limit remedies for defective or imperfect services or any other
            non-waivable consumer right under applicable law.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>3. Requests That Are Generally Not Refundable</h3>
          <p>Subject to applicable law, refunds are generally not provided for:</p>
          <ul>
            <li>A change of mind after access to the purchased digital service has begun.</li>
            <li>Unused time or partial billing periods when the service remained available.</li>
            <li>Failure to request cancellation before a future billing date.</li>
            <li>Suspension or termination resulting from unlawful, fraudulent, or abusive use.</li>
            <li>Bank, card, wallet, foreign-exchange, or other third-party processing charges.</li>
          </ul>
        </section>

        <section className="card auth-helper-card">
          <h3>4. Cancellation and Future Billing</h3>
          <p>
            To request cancellation or prevent a future renewal, contact customer service before
            the next billing date. Unless a refund is approved or applicable law requires
            otherwise, cancellation normally stops future billing and does not retroactively refund
            the current paid period.
          </p>
          <p>
            Published plans and billing amounts are shown through the Fees option on the login page
            and within the subscription features available to authorized users.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>5. How To Request a Refund</h3>
          <p>
            Send the request promptly, preferably within seven calendar days after the charge or
            discovery of the issue, to{' '}
            <a href="mailto:admin@quantech.international">admin@quantech.international</a>.
            Requests received later will still be considered when required by law or justified by
            the circumstances.
          </p>
          <p>Include:</p>
          <ul>
            <li>Your name and the email address associated with the account.</li>
            <li>The transaction reference, date, amount, currency, and payment channel.</li>
            <li>The reason for the request and the resolution you are seeking.</li>
            <li>Relevant receipts, screenshots, or error details.</li>
          </ul>
          <p>Never send a password, one-time code, PIN, or complete card or wallet credentials.</p>
        </section>

        <section className="card auth-helper-card">
          <h3>6. Review and Refund Timing</h3>
          <p>
            FILSCORE aims to acknowledge a complete request within two business days and provide a
            decision within ten business days. Complex, fraudulent, or payment-provider reviews may
            take longer; the customer will be given a status update when additional time or
            information is needed.
          </p>
          <p>
            Approved refunds are normally sent to the original payment method. Posting may take
            approximately five to fifteen business days after approval, depending on the bank,
            wallet, card network, or payment provider. Any approved alternative method will be
            confirmed with the customer first.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>7. Related Policies</h3>
          <div className="form-actions">
            <Link className="auth-link-button" to="/customer-service">Customer Service</Link>
            <Link className="auth-link-button" to="/dispute-resolution">Dispute Resolution</Link>
            <Link className="auth-link-button" to="/terms">Terms &amp; Consent</Link>
            <Link className="auth-link-button" to="/privacy">Privacy Disclosures</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
