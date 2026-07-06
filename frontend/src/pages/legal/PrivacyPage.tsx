import { Link } from 'react-router-dom'

const privacySections = [
  {
    title: '1. Overview',
    paragraphs: [
      'This Privacy Policy describes how FILSCORE handles information when users access credit-scoring, loan-origination, document-management, subscription, and AI-assisted workflow features.',
      'This policy is intended to reflect the current application behavior verified in the codebase for this release. If the product adds new data practices, this page should be updated before those changes are published.',
    ],
  },
  {
    title: '2. Information We Collect',
    paragraphs: [
      'Depending on the features you use, the application may collect and process the following categories of information:',
    ],
    bullets: [
      'Account and identity information such as username, email address, password-derived authentication credentials, role assignments, and account status.',
      'Profile and contact information such as full name, phone number, address, government ID references, and user preferences.',
      'Loan, borrower, collateral, and credit-evaluation information such as income, debt obligations, requested loan terms, risk scores, credit review notes, and approval workflow status.',
      'Uploaded document metadata and document contents, including borrower-supporting documents and AI-assisted document parsing results where those features are used.',
      'Audio recordings and generated transcripts or meeting summaries when users explicitly upload or record audio for meeting-assistant workflows.',
      'Operational and security records such as audit-log entries, login activity, password-reset requests, session records, and permission checks.',
      'Technical request data such as IP address, user agent, and basic service diagnostics generated when the backend processes requests.',
    ],
  },
  {
    title: '3. Information We Do Not Currently Request',
    paragraphs: [
      'The current application build does not request precise location access and does not include a verified geolocation feature path in the mobile clients inspected for this review.',
      'The application is not currently presented as an advertising product and does not include in-app third-party ad SDKs in the verified frontend dependency set for this release.',
    ],
  },
  {
    title: '4. How We Use Information',
    paragraphs: [
      'FILSCORE may use collected information to operate and secure the service, including to:',
    ],
    bullets: [
      'Authenticate users, manage sessions, enforce permissions, and protect accounts.',
      'Store, review, score, and process borrower, loan, collateral, and supporting-document records.',
      'Generate credit, fraud, social, and AI-assisted workflow outputs requested by authorized users.',
      'Provide account maintenance features such as password reset, account deletion, role management, and subscription administration.',
      'Maintain audit trails, investigate abuse or fraud, monitor service health, and satisfy compliance or legal obligations.',
    ],
  },
  {
    title: '5. Third-Party Services and Data Sharing',
    paragraphs: [
      'The application may rely on third-party processors or platform providers to deliver specific features.',
      'Based on the verified code paths, third-party sharing may occur in these situations:',
    ],
    bullets: [
      'Google Sign-In and Apple Sign-In flows when the user chooses those login options.',
      'OpenAI-backed AI processing for features such as audio transcription, meeting-minute generation, and document parsing when authorized users invoke those features.',
      'SMTP email delivery when email-related features or password-reset notifications are configured on the backend.',
      'Infrastructure, database, and operational service providers that host, route, or store application data on behalf of the service operator.',
      'Legal, security, fraud-prevention, or regulatory disclosures when required by law or necessary to protect the service or affected parties.',
    ],
  },
  {
    title: '6. Data Retention and Deletion',
    paragraphs: [
      'Account, workflow, document, and audit data may be retained for operational, legal, security, and compliance purposes for as long as necessary to support the service and related recordkeeping obligations.',
      'Users can request account removal through the in-app account settings flow where available. Additional deletion requests and privacy inquiries can be sent to the contact address below.',
      'Operational backups and recovery copies may persist for a limited period after deletion requests, subject to backup rotation and disaster-recovery controls.',
    ],
  },
  {
    title: '7. Security Measures',
    paragraphs: [
      'The application includes authentication controls, password hashing, role-based permissions, audit logging, and API-level security protections intended to reduce unauthorized access.',
      'No internet-connected system can guarantee absolute security, so users and operators should apply strong credentials, least-privilege access, and appropriate operational controls.',
    ],
  },
  {
    title: '8. Children and Sensitive Data',
    paragraphs: [
      'This application is not designed for children and is intended for business, lending, fleet, and credit operations use.',
      'Because the platform may handle financial, identity, document, and audio data, users should only upload or process information they are authorized to collect and manage under applicable law and internal policy.',
    ],
  },
  {
    title: '9. Policy Updates',
    paragraphs: [
      'This Privacy Policy may be updated as product functionality, legal requirements, or service providers change. Material updates should be reflected before the related feature is publicly released.',
    ],
  },
  {
    title: '10. Contact',
    paragraphs: [
      'For privacy requests, account deletion support, or questions about data handling, contact:',
    ],
  },
] as const

export default function PrivacyPage() {
  return (
    <div className="standalone-card auth-screen">
      <h1>Privacy Disclosures</h1>
      <p className="intro">
        Effective Date: July 6, 2026
        <br />
        Application: FILSCORE / FMS Mobile
        <br />
        Service Provider: Quantech.International Solutions OPC
        <br />
        Contact Email:{' '}
        <a href="mailto:admin@quantech.international">admin@quantech.international</a>
      </p>

      <div className="stack-panel">
        {privacySections.map((section) => (
          <section key={section.title} className="card auth-helper-card">
            <h3>{section.title}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {'bullets' in section && section.bullets ? (
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
            {section.title === '10. Contact' ? (
              <p>
                <a href="mailto:admin@quantech.international">admin@quantech.international</a>
              </p>
            ) : null}
          </section>
        ))}
        <section className="card auth-helper-card">
          <h3>Related Help</h3>
          <p>
            For support, reviewer access coordination, or account follow-up, visit the public support page.
          </p>
          <p>
            <Link to="/support">Support</Link>
          </p>
        </section>
      </div>
    </div>
  )
}
