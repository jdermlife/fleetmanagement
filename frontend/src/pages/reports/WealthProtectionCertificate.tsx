import { ShieldCheck } from 'lucide-react'

const protectionComponents = [
  { label: 'Liquidity & emergency reserves', weight: 20 },
  { label: 'Insurance coverage adequacy', weight: 40 },
  { label: 'Debt and interest-rate exposure', weight: 15 },
  { label: 'Portfolio diversification and concentration risk', weight: 11 },
  { label: 'Retirement and income continuity', weight: 10 },
  { label: 'Estate, beneficiary, and legal readiness', weight: 2 },
  { label: 'Tax and fraud/security resilience', weight: 2 },
] as const

const scoreBands = [
  { range: '80–100', label: 'Strong protection' },
  { range: '60–79', label: 'Generally protected' },
  { range: '40–59', label: 'Material gaps' },
  { range: '0–39', label: 'High vulnerability' },
] as const

export default function WealthProtectionCertificate() {
  return (
    <article className="wealth-protection-certificate" aria-label="Wealth Protection Score Certificate">
      <header className="wealth-protection-certificate-header">
        <div className="wealth-protection-certificate-mark" aria-hidden="true">
          <ShieldCheck />
        </div>
        <div>
          <span>FILSCORE verified assessment framework</span>
          <h2>Wealth Protection Score Certificate</h2>
          <p>Financial resilience against foreseeable shocks, independent of total wealth.</p>
        </div>
        <div className="wealth-protection-certificate-score" aria-label="Score status">
          <strong>0–100</strong>
          <span>Assessment pending</span>
        </div>
      </header>

      <section className="wealth-protection-certificate-section" aria-labelledby="wealth-protection-components-title">
        <div className="wealth-protection-certificate-section-heading">
          <span>Assessment model</span>
          <h3 id="wealth-protection-components-title">Protection components</h3>
        </div>
        <div className="wealth-protection-component-list">
          {protectionComponents.map((component) => (
            <div className="wealth-protection-component" key={component.label}>
              <div>
                <strong>{component.label}</strong>
                <span>{component.weight}% of total score</span>
              </div>
              <div className="wealth-protection-component-bar" aria-hidden="true">
                <span style={{ width: `${component.weight}%` }} />
              </div>
              <strong>{component.weight}%</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="wealth-protection-certificate-section" aria-labelledby="wealth-protection-bands-title">
        <div className="wealth-protection-certificate-section-heading">
          <span>Interpretation</span>
          <h3 id="wealth-protection-bands-title">Score bands</h3>
        </div>
        <div className="wealth-protection-band-list">
          {scoreBands.map((band) => (
            <div key={band.range}>
              <strong>{band.range}</strong>
              <span>{band.label}</span>
            </div>
          ))}
        </div>
      </section>

      <footer>
        A score is certified only after all seven components are evaluated from verified client data.
      </footer>
    </article>
  )
}