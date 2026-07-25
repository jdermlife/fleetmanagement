import { computeFinancialHealthSummary } from '../scoring/financialHealthSummaryEngine'

type VitalReference = {
  id: string
  source: string
  basis: string
  formula: string
  scoring: string
}

const vitalReferences: readonly VitalReference[] = [
  {
    id: 'credit',
    source: 'Loan Application draft',
    basis: 'Government ID, debt service ratio, other income, loan-to-value ratio, and loan purpose.',
    formula: 'clamp((Character + Capacity + Capital + Collateral + Conditions) x 2, 0, 100)',
    scoring: 'Character: 8/5; Capacity: 10/7/4 at DSR <30%/<40%/40%+; Capital: 8/5; Collateral: 10/7/4 at LTV <80%/<90%/90%+; Conditions: 8/5.',
  },
  {
    id: 'cash-flow',
    source: 'Net Worth Positioning draft',
    basis: 'Recurring monthly income less recurring monthly expenses, measured relative to income.',
    formula: 'Savings rate = max(monthly income - monthly expenses, 0) / monthly income',
    scoring: '100/92/84/74/64/52 at savings rate >=35%/25%/18%/10%/5%/0%; fallback 18.',
  },
  {
    id: 'wealth',
    source: 'Net Worth Positioning draft',
    basis: 'The normalized Net Worth Building index across ten wealth components.',
    formula: '22% net worth + 14% liquidity + 14% cash flow + 12% leverage + 10% emergency + 8% investment + 7% retirement + 5% independence + 5% goal + 3% protection',
    scoring: 'Each component is scored from financial ratios, then the weighted result is used directly on the 0-100 vital-sign scale.',
  },
  {
    id: 'budget',
    source: 'Net Worth Positioning draft',
    basis: 'Positive cash flow as a share of monthly income. The Budget Tracker draft is not currently used in this score.',
    formula: 'Budget ratio = (monthly income - monthly expenses) / monthly income; vital score = foundation points x 20',
    scoring: '100/80/60/40/20 at budget ratio >=50%/35%/20%/5%/0%; otherwise 0.',
  },
  {
    id: 'payment',
    source: 'Net Worth Positioning draft',
    basis: 'Debt leverage relative to assets. This currently measures leverage control, not historical payment behavior.',
    formula: 'Debt-to-asset ratio = total liabilities / total assets',
    scoring: '100/92/84/74/64/52/40 at ratio <=10%/20%/35%/50%/65%/80%/100%; fallback 20.',
  },
  {
    id: 'protection',
    source: 'Net Worth Positioning draft',
    basis: 'Count of populated life, health, HMO, critical illness, accident, disability, property, vehicle, and business insurance entries.',
    formula: 'Coverage ratio = populated insurance categories / 9',
    scoring: '100/88/76/62/48 at coverage >=90%/70%/50%/30%/10%; fallback 30.',
  },
  {
    id: 'investment',
    source: 'Net Worth Positioning draft',
    basis: 'Average of investment readiness, retirement readiness, and financial independence.',
    formula: '(investment readiness + retirement readiness + financial independence) / 3',
    scoring: 'Investment readiness uses investment and retirement assets / total assets; retirement uses retirement assets / annual expenses; independence uses passive income / monthly expenses.',
  },
  {
    id: 'goal',
    source: 'Net Worth Positioning draft',
    basis: 'Projected net worth at the goal date compared with the saved target amount.',
    formula: 'Goal ratio = (net worth + max(monthly cash flow, 0) x target months) / target amount',
    scoring: '100/92/78/66/52/38 at ratio >=110%/100%/80%/60%/40%/20%; fallback 20. A named goal without a target uses 55; no goal uses 45.',
  },
] as const

const healthBands = [
  { score: '840-1000', label: 'Excellent' },
  { score: '760-839', label: 'Very Good' },
  { score: '680-759', label: 'Good' },
  { score: '600-679', label: 'Fair' },
  { score: 'Below 600', label: 'Needs Attention' },
] as const

export default function CalculationPage() {
  const summary = computeFinancialHealthSummary()
  const indicatorById = new Map(summary.indicators.map((indicator) => [indicator.id, indicator]))

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

      <section className="psychometric-panel calculation-reference-panel" aria-labelledby="financial-vital-reference-title">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">Model reference</span>
            <h2 id="financial-vital-reference-title">Financial Vital Signs: Basis and Formulas</h2>
            <p className="financial-health-panel-intro">
              The dashboard starts with the default model below. Saved workflow values replace available defaults only when the user selects Compute Latest Financial Health; missing values retain their defaults and are not reweighted.
            </p>
          </div>
        </div>

        <div className="calculation-source-notes">
          <div>
            <strong>Primary saved sources</strong>
            <span>Loan Application / new and Net Worth Positioning / primary</span>
          </div>
          <div>
            <strong>Scale and target</strong>
            <span>Each vital is 0-100. The dashboard target is 80 or higher.</span>
          </div>
          <div>
            <strong>Publication control</strong>
            <span>Loading a draft does not publish new scores; the compute button performs the update.</span>
          </div>
        </div>

        <div className="calculation-reference-table-wrap">
          <table className="calculation-reference-table">
            <thead>
              <tr>
                <th scope="col">Vital sign</th>
                <th scope="col">Default</th>
                <th scope="col">Weight</th>
                <th scope="col">Source and basis</th>
                <th scope="col">Formula and scoring reference</th>
              </tr>
            </thead>
            <tbody>
              {vitalReferences.map((reference) => {
                const indicator = indicatorById.get(reference.id)
                if (!indicator) return null

                return (
                  <tr key={reference.id}>
                    <th scope="row">{indicator.label}</th>
                    <td><strong>{indicator.score}</strong></td>
                    <td><strong>{indicator.weight}%</strong></td>
                    <td>
                      <strong>{reference.source}</strong>
                      <span>{reference.basis}</span>
                    </td>
                    <td>
                      <code>{reference.formula}</code>
                      <span>{reference.scoring}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
          <code>Index = sum(vital score x weight) / 100</code>
          <small>Financial Health Score = round(Index x 10). The eight weights total 100%.</small>
        </div>
      </section>

      <section className="psychometric-panel calculation-band-panel" aria-labelledby="financial-health-band-reference-title">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">Interpretation reference</span>
            <h2 id="financial-health-band-reference-title">Financial Health Score Bands</h2>
          </div>
        </div>
        <div className="calculation-band-list">
          {healthBands.map((band) => (
            <div key={band.label}>
              <strong>{band.label}</strong>
              <span>{band.score}</span>
            </div>
          ))}
        </div>
        <p className="calculation-governance-note">
          This is a transparent wellness index. The weights and score thresholds should be calibrated against validated outcomes before the model is used for credit decisions.
        </p>
      </section>
    </div>
  )
}
