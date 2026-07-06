export default function AboutFilscorePage() {
  return (
    <div className="standalone-card auth-screen">
      <h1>About FILSCORE</h1>
      <p className="intro">
        FILSCORE is the lending and credit workflow experience inside the broader FMS Mobile
        workspace.
      </p>

      <div className="stack-panel">
        <section className="card auth-helper-card">
          <h3>What FILSCORE Does</h3>
          <p>
            FILSCORE helps authorized teams manage borrower intake, credit workflow decisions,
            supporting documents, scorecard analysis, and audit-aware lending operations from a
            single application.
          </p>
        </section>

        <section className="card auth-helper-card">
          <h3>Core Capabilities</h3>
          <ul>
            <li>Borrower and loan workflow management</li>
            <li>Document upload and AI-assisted parsing support</li>
            <li>Credit, fraud, and operational review workflows</li>
            <li>Meeting audio transcription and minutes generation for authorized users</li>
            <li>Role-based access, session controls, and audit-conscious operations</li>
          </ul>
        </section>

        <section className="card auth-helper-card">
          <h3>Who It Is For</h3>
          <p>
            The current product is intended for authorized business, fleet, lending, and
            credit-operations use cases rather than general consumer use.
          </p>
        </section>
      </div>
    </div>
  )
}
