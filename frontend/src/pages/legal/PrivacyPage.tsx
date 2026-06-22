export default function PrivacyPage() {
  return (
    <div className="standalone-card auth-screen">
      <h1>Privacy Disclosures</h1>
      <p className="intro">
        This screen summarizes the current data practices that users should be able to review in
        the product before account creation or sign-in.
      </p>

      <div className="stack-panel">
        <section className="card auth-helper-card">
          <h3>Data We Collect</h3>
          <p>
            The platform can process account details, borrower and collateral records, uploaded
            supporting documents, workflow actions, and audit trail entries needed for fleet and
            lending operations.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>Why We Use It</h3>
          <p>
            Data is used to authenticate users, manage fleet and loan workflows, support document
            review, generate scoring outputs, and maintain compliance and audit visibility.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>Sharing and Retention</h3>
          <p>
            Operational data may be shared with internal reviewers, approvers, auditors, and
            supporting service providers required to deliver the platform. Retention periods should
            be finalized based on your lending, employment, and jurisdictional compliance rules.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>User Controls</h3>
          <p>
            Users should be able to change passwords, request password resets, review account
            status, and submit account deletion requests from inside the application.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>Contact</h3>
          <p>
            Replace this placeholder with your official privacy contact email, mailing address, and
            support escalation path before store submission.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>Related Disclosures</h3>
          <p>
            Pair this page with your registration consent flow and your terms screen so users can
            review both before creating an account.
          </p>
        </section>
      </div>
    </div>
  )
}
