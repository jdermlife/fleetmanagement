import { useMemo } from 'react'

type ComplianceDomain = {
  id: string
  title: string
  lawLabel: string
  lawLink: string
  scope: string
  monitorItems: string[]
  level: 'maintain' | 'watch' | 'attention'
}

const complianceDomains: ComplianceDomain[] = [
  {
    id: 'truth-in-lending',
    title: 'Truth in Lending',
    lawLabel: 'Truth in Lending Act (Republic Act No. 3765)',
    lawLink: 'https://lawphil.net/statutes/repacts/ra1963/ra_3765_1963.html',
    scope: 'Disclosure of finance charges, costs, and material loan terms before commitment.',
    monitorItems: [
      'APR / interest-rate disclosure',
      'Loan amount, term, and payment schedule clarity',
      'Fee and charge disclosure',
      'Readable borrower consent and acceptance records',
    ],
    level: 'maintain',
  },
  {
    id: 'financial-consumer-protection',
    title: 'Consumer Financial Protection',
    lawLabel: 'Financial Products and Services Consumer Protection Act (Republic Act No. 11765)',
    lawLink: 'https://www.officialgazette.gov.ph/2022/05/06/republic-act-no-11765/',
    scope: 'Fair treatment, product suitability, transparent sales, and complaint handling.',
    monitorItems: [
      'Fair marketing and suitability checks',
      'Complaints, disputes, and remediation handling',
      'No misleading fees or hidden conditions',
      'Accessible disclosures and borrower notices',
    ],
    level: 'watch',
  },
  {
    id: 'data-privacy',
    title: 'Data Privacy',
    lawLabel: 'Data Privacy Act of 2012 (Republic Act No. 10173)',
    lawLink: 'https://www.officialgazette.gov.ph/2012/08/15/republic-act-no-10173/',
    scope: 'Protection of borrower personal information, lawful processing, and security controls.',
    monitorItems: [
      'Consent and lawful basis for data processing',
      'Sensitive financial and identity data protection',
      'Access control and least-privilege enforcement',
      'Data retention and disposal practices',
    ],
    level: 'watch',
  },
  {
    id: 'aml-kyc',
    title: 'AML / KYC',
    lawLabel: 'Anti-Money Laundering Act (Republic Act No. 9160, as amended)',
    lawLink: 'http://www.amlc.gov.ph/laws/money-laundering/2015-10-16-02-50-56/republic-act-9160',
    scope: 'Identity verification, customer due diligence, suspicious activity handling, and recordkeeping.',
    monitorItems: [
      'KYC identity checks and beneficial ownership',
      'Out-of-country / unusual-source monitoring',
      'Suspicious transaction escalation',
      'Audit-ready documentation for due diligence',
    ],
    level: 'attention',
  },
  {
    id: 'credit-information',
    title: 'Credit Information',
    lawLabel: 'Credit Information System Act (Republic Act No. 9510)',
    lawLink: 'https://lawphil.net/statutes/repacts/ra2008/ra_9510_2008.html',
    scope: 'Responsible handling, sharing, and correction of credit information.',
    monitorItems: [
      'Accuracy of credit-related records',
      'Correction and dispute handling workflow',
      'Responsible sharing of bureau-facing data',
      'Traceability of score-affecting changes',
    ],
    level: 'watch',
  },
  {
    id: 'cybersecurity',
    title: 'Cybersecurity and Incident Response',
    lawLabel: 'Cybercrime Prevention Act of 2012 (Republic Act No. 10175)',
    lawLink: 'https://www.officialgazette.gov.ph/2012/09/12/republic-act-no-10175/',
    scope: 'Protection of systems, communications, and digital records from misuse or breach.',
    monitorItems: [
      'Insecure API endpoint monitoring',
      'Credential, token, and access abuse detection',
      'Incident logging and breach-response readiness',
      'Monitoring of duplicate or replayed API activity',
    ],
    level: 'attention',
  },
]

function getLevelAttainment(level: ComplianceDomain['level']) {
  if (level === 'maintain') {
    return 90
  }
  if (level === 'watch') {
    return 65
  }
  return 35
}

function getPerformanceBand(score: number) {
  if (score >= 85) {
    return 'Controlled'
  }
  if (score >= 70) {
    return 'Stable'
  }
  if (score >= 55) {
    return 'Watchlist'
  }
  return 'Needs Attention'
}

export default function CompliancePage() {
  const summaries = useMemo(
    () =>
      complianceDomains.map((domain) => ({
        ...domain,
        attainment: getLevelAttainment(domain.level),
      })),
    [],
  )

  const averageAttainment = useMemo(
    () => summaries.reduce((sum, item) => sum + item.attainment, 0) / summaries.length,
    [summaries],
  )

  const watchCount = summaries.filter((item) => item.level === 'watch').length
  const attentionCount = summaries.filter((item) => item.level === 'attention').length
  const performanceBand = getPerformanceBand(averageAttainment)
  const scoreRingDegrees = Math.max(0, Math.min(360, (averageAttainment / 100) * 360))
  const scoreRingStyle = {
    background: `
      radial-gradient(circle at center, #fffef7 0 54%, transparent 55%),
      conic-gradient(#0f766e 0deg ${scoreRingDegrees}deg, rgba(226, 232, 240, 0.9) ${scoreRingDegrees}deg 360deg)
    `,
  }

  return (
    <div className="psychometric-page">
      <section className="psychometric-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Credit Compliance Framework</span>
          <h1>Compliance Monitoring</h1>
          <p>
            Track the most relevant credit-related compliance domains for the app, including
            borrower disclosures, financial consumer protection, privacy, AML/KYC, credit
            information handling, and cybersecurity obligations.
          </p>
        </div>

        <div className="psychometric-hero-metric">
          <span>Compliance Readiness Score</span>
          <strong>{averageAttainment.toFixed(1)}</strong>
          <small>{performanceBand}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Compliance Domains</span>
          <strong>{summaries.length}</strong>
          <small>Core regulatory areas tracked on this page</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Controlled</span>
          <strong>{summaries.filter((item) => item.level === 'maintain').length}</strong>
          <small>Domains currently in lower-concern posture</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Watchlist</span>
          <strong>{watchCount}</strong>
          <small>Domains that need closer governance review</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Critical</span>
          <strong>{attentionCount}</strong>
          <small>High-priority domains to monitor tightly</small>
        </article>
      </section>

      <section className="psychometric-layout">
        <div className="psychometric-main">
          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Compliance Matrix</span>
                <h2>Relevant regulations on credit and app monitoring focus</h2>
              </div>
            </div>

            <div className="psychometric-scale-table-wrap">
              <table className="psychometric-scale-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Reference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((item) => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>
                        <a href={item.lawLink} target="_blank" rel="noreferrer">
                          {item.lawLabel}
                        </a>
                      </td>
                      <td>{item.level === 'maintain' ? 'Controlled' : item.level === 'watch' ? 'Watch' : 'Attention'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <div className="psychometric-sections">
            {summaries.map((item) => (
              <article key={item.id} className="psychometric-section-card">
                <div className="psychometric-section-header">
                  <div>
                    <span className="psychometric-section-code">Domain {item.id.toUpperCase()}</span>
                    <h3>{item.title}</h3>
                    <p>{item.scope}</p>
                  </div>

                  <div className="psychometric-section-score">
                    <strong>{item.attainment}%</strong>
                    <span>{item.level === 'maintain' ? 'controlled' : item.level}</span>
                  </div>
                </div>

                <div className="psychometric-progress-track" aria-hidden="true">
                  <div className="psychometric-progress-bar" style={{ width: `${item.attainment}%` }} />
                </div>

                <div className="psychometric-formula-grid">
                  <div className="psychometric-formula-card">
                    <span>Legal basis</span>
                    <strong style={{ fontSize: '0.95rem', lineHeight: 1.4 }}>{item.lawLabel}</strong>
                  </div>
                  <div className="psychometric-formula-card">
                    <span>Monitoring posture</span>
                    <strong>{item.level === 'maintain' ? 'Controlled' : item.level === 'watch' ? 'Watch' : 'Attention'}</strong>
                  </div>
                  <div className="psychometric-formula-card psychometric-formula-card-accent">
                    <span>Reference link</span>
                    <strong style={{ fontSize: '0.95rem', lineHeight: 1.45 }}>
                      <a href={item.lawLink} target="_blank" rel="noreferrer">
                        Open regulation reference
                      </a>
                    </strong>
                  </div>
                </div>

                <div className="psychometric-question-list">
                  {item.monitorItems.map((monitorItem, index) => (
                    <div key={`${item.id}-${index}`} className="psychometric-question-card">
                      <div className="psychometric-question-copy">
                        <span className="psychometric-question-number">{index + 1}</span>
                        <p>{monitorItem}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="psychometric-side-panel">
          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Overall Computation</span>
            <h2>Compliance score snapshot</h2>

            <div className="psychometric-score-ring" style={scoreRingStyle}>
              <strong>{averageAttainment.toFixed(1)}</strong>
              <span>/ 100</span>
            </div>

            <ul className="psychometric-breakdown-list">
              <li>
                <span>Compliance readiness</span>
                <strong>{averageAttainment.toFixed(1)}</strong>
              </li>
              <li>
                <span>Performance band</span>
                <strong>{performanceBand}</strong>
              </li>
              <li>
                <span>Watchlist domains</span>
                <strong>{watchCount}</strong>
              </li>
              <li>
                <span>Critical domains</span>
                <strong>{attentionCount}</strong>
              </li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  )
}
