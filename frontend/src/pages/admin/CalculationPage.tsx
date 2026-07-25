import { computeFinancialHealthSummary } from '../scoring/financialHealthSummaryEngine'

export default function CalculationPage() {
  const summary = computeFinancialHealthSummary()

  return (
    <div className="psychometric-page financial-health-page">
      <section className="psychometric-hero financial-health-hero" aria-labelledby="calculation-page-title">
        <div className="psychometric-hero-copy financial-health-hero-copy">
          <span className="psychometric-eyebrow">Administration</span>
          <h1 id="calculation-page-title">Calculation Models</h1>
          <p>
            Review the formulas and default model values used to produce the Financial Health summary.
          </p>
        </div>

        <div className="psychometric-hero-metric">
          <span>Default Financial Health</span>
          <strong>{summary.score}</strong>
          <small>{summary.index.toFixed(1)} weighted index</small>
        </div>
      </section>

      <section className="psychometric-panel financial-health-summary-engine" aria-labelledby="financial-health-summary-engine-title">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">Calculation model</span>
            <h2 id="financial-health-summary-engine-title">Financial Health Summary Engine</h2>
            <p className="financial-health-panel-intro">
              Each section is a weighted average of its indicators. The overall index uses all eight indicator weights.
            </p>
          </div>
        </div>

        <div className="financial-health-engine-grid">
          {summary.groups.map((group) => (
            <article key={group.id} className="financial-health-engine-card">
              <span>{group.label}</span>
              <strong>{group.displayValue}</strong>
              <small>{group.description}</small>
              <code>{group.formula}</code>
            </article>
          ))}
        </div>

        <div className="financial-health-engine-total">
          <span>Overall Financial Health</span>
          <strong>{summary.index.toFixed(1)} x 10 = {summary.score}</strong>
          <small>Sum of each indicator score x weight, divided by 100, then scaled to 1000.</small>
        </div>
      </section>
    </div>
  )
}
