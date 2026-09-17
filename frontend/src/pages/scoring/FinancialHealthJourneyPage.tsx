import { ArrowRight, CheckCircle2, ChevronDown, Compass, Gauge } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import {
  FINANCIAL_HEALTH_JOURNEY_DETAILS,
  FINANCIAL_HEALTH_JOURNEY_STEPS,
} from '../../components/financial-health/FinancialJourneyGuide'

const JOURNEY_MENU_GROUPS = [
  {
    title: 'Journey Overview',
    links: [
      { label: 'Financial Health Journey', route: '/financial-health-journey' },
      { label: 'Financial Health Summary', route: '/financial-health-summary' },
    ],
  },
  {
    title: 'Build Your Foundation',
    links: [
      { label: 'Personalize / Build Profile', route: '/build-profile' },
      { label: 'Loan & Wealth Readiness', route: '/lending-scorecard' },
      { label: 'Wealth Builder', route: '/net-worth-positioning' },
    ],
  },
  {
    title: 'Manage Your Finances',
    links: [
      { label: 'Budget & Expense Tracker', route: '/budget-expense-tracker' },
      { label: 'Resource Optimizer', route: '/loan-monitoring' },
      { label: 'Bill Manager', route: '/bill-reminder' },
    ],
  },
  {
    title: 'Track Progress',
    links: [
      { label: 'Financial Health Dashboard', route: '/financial-health-summary' },
      { label: 'Financial Decisions & Action Plan', route: '/financial-decisions' },
    ],
  },
] as const

export default function FinancialHealthJourneyPage() {
  const navigate = useNavigate()
  const financialHealthDetail = FINANCIAL_HEALTH_JOURNEY_DETAILS.financialHealth

  return (
    <main className="psychometric-page financial-health-journey-page">
      <section className="psychometric-hero financial-health-journey-page-hero" aria-labelledby="financial-health-journey-page-title">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">FILSCORE Guided Assessment</span>
          <h1 id="financial-health-journey-page-title">Your Financial Health Journey</h1>
          <p>GREETINGS! We wish you well today.</p>
          <p>Complete these steps to unlock the full power of your profile and receive more accurate financial recommendations.</p>
        </div>
        <div className="financial-health-journey-page-mark" aria-hidden="true">
          <Compass />
          <strong>6</strong>
          <span>guided stages</span>
        </div>
      </section>

      <details className="financial-health-journey-menu">
        <summary>
          <span>
            <Compass aria-hidden="true" />
            Financial Health Journey Menu
          </span>
          <ChevronDown className="financial-health-journey-menu-chevron" aria-hidden="true" />
        </summary>
        <nav className="financial-health-journey-menu-panel" aria-label="Financial Health Journey pages">
          {JOURNEY_MENU_GROUPS.map((group) => (
            <section key={group.title} className="financial-health-journey-menu-group">
              <h2>{group.title}</h2>
              {group.links.map((link) => (
                <Link key={`${group.title}-${link.label}`} to={link.route}>
                  <span>{link.label}</span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
            </section>
          ))}
        </nav>
      </details>

      <section className="psychometric-summary-grid financial-health-journey-page-summary" aria-label="Journey overview">
        <article className="psychometric-summary-card">
          <span>Journey Structure</span>
          <strong>6 Steps</strong>
          <small>From personalization to bill management</small>
        </article>
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Connected Outcome</span>
          <strong>1 Score</strong>
          <small>Your complete Financial Health view</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Recommended Path</span>
          <strong>In Order</strong>
          <small>Each stage strengthens the next assessment</small>
        </article>
      </section>

      <section className="psychometric-panel financial-health-journey-page-overview">
        <div className="financial-health-journey-page-overview-copy">
          <span className="psychometric-panel-kicker">Your Connected Outcome</span>
          <h2>{financialHealthDetail.title}</h2>
          <ul>
            {financialHealthDetail.points.map((point) => <li key={point}><CheckCircle2 aria-hidden="true" /> <span>{point}</span></li>)}
          </ul>
        </div>
        <Link className="financial-health-journey-page-dashboard-link" to="/financial-health-summary?register=1">
          <Gauge aria-hidden="true" />
          <span>Open Financial Health Dashboard</span>
        </Link>
      </section>

      <section className="psychometric-panel financial-health-journey-page-path" aria-labelledby="financial-health-journey-path-title">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">Financial Health Journey</span>
            <h2 id="financial-health-journey-path-title">Follow Your Assessment Path</h2>
          </div>
          <span className="financial-health-journey-page-sequence">01 - 06</span>
        </div>

        <div className="financial-health-journey-page-steps">
          {FINANCIAL_HEALTH_JOURNEY_STEPS.map((step, index) => {
            const detail = FINANCIAL_HEALTH_JOURNEY_DETAILS[step.id]
            return (
              <article key={step.id} className="financial-health-journey-page-step">
                <div className="financial-health-journey-page-step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
                <div className="financial-health-journey-page-step-copy">
                  <span className="psychometric-section-code">Stage {index + 1}</span>
                  <h3>{step.label}</h3>
                  <p>{step.description}</p>
                  <div className="financial-health-journey-page-detail">
                    <strong>{detail.title}</strong>
                    <ul>{detail.points.map((point) => <li key={point}>{point}</li>)}</ul>
                  </div>
                </div>
                <button type="button" className="financial-health-journey-page-action" onClick={() => navigate(step.route)}>
                  <span>{step.launchLabel}</span>
                  <ArrowRight aria-hidden="true" />
                </button>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}