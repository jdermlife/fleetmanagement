import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { fetchAutosaveDraft } from '../../autosave/draftApi'

import {
  buildFinancialHealthGroupRings,
  calculateFinancialHealthIndex,
  calculateWeightedContribution,
  financialHealthIndicators,
  getFinancialHealthBand,
  scaleFinancialHealthIndex,
} from './financialHealthModel'
import {
  computeNetWorthBuildingScore,
  type NetWorthBuildingDraftInput,
  type NetWorthBuildingScoreResult,
} from './netWorthBuildingEngine'

type IndicatorStyle = CSSProperties & {
  '--health-accent': string
  '--health-soft': string
}

const healthBands = [
  { label: 'Excellent', range: '840–1000', className: 'financial-health-band-excellent' },
  { label: 'Very Good', range: '760–839', className: 'financial-health-band-healthy' },
  { label: 'Good', range: '680–759', className: 'financial-health-band-good' },
  { label: 'Fair', range: '600–679', className: 'financial-health-band-building' },
  { label: 'Needs Attention', range: 'Below 600', className: 'financial-health-band-attention' },
] as const

function indicatorStyle(accent: string, softAccent: string): IndicatorStyle {
  return {
    '--health-accent': accent,
    '--health-soft': softAccent,
  }
}

export default function FinancialHealthSummaryPage() {
  const [netWorthBuildingScore, setNetWorthBuildingScore] = useState<NetWorthBuildingScoreResult | null>(null)

  useEffect(() => {
    let disposed = false

    const loadNetWorthDraft = async () => {
      try {
        const remoteDraft = await fetchAutosaveDraft<NetWorthBuildingDraftInput>('net-worth-positioning', 'primary')
        if (disposed || !remoteDraft?.payload) {
          return
        }

        setNetWorthBuildingScore(computeNetWorthBuildingScore(remoteDraft.payload))
      } catch {
        if (!disposed) {
          setNetWorthBuildingScore(null)
        }
      }
    }

    void loadNetWorthDraft()

    return () => {
      disposed = true
    }
  }, [])

  const groupRings = useMemo(
    () => buildFinancialHealthGroupRings(financialHealthIndicators),
    [],
  )
  const index = calculateFinancialHealthIndex(financialHealthIndicators)

  if (index === null) {
    return (
      <div className="psychometric-page financial-health-page">
        <section className="psychometric-panel financial-health-provisional">
          <span className="psychometric-panel-kicker">Financial Health</span>
          <h1>Provisional result</h1>
          <p>All eight weighted indicators are required before a Financial Health score can be shown.</p>
        </section>
      </div>
    )
  }

  const score = scaleFinancialHealthIndex(index)
  const band = getFinancialHealthBand(score)
  const strongestIndicator = financialHealthIndicators.reduce((strongest, indicator) =>
    indicator.score > strongest.score ? indicator : strongest,
  )
  const priorityIndicator = financialHealthIndicators.reduce((priority, indicator) =>
    indicator.score < priority.score ? indicator : priority,
  )

  return (
    <div className="psychometric-page financial-health-page">
      <section className="psychometric-hero financial-health-hero" aria-labelledby="financial-health-title">
        <div className="psychometric-hero-copy financial-health-hero-copy">
          <span className="psychometric-eyebrow">FILSCORE Financial Vital Signs</span>
          <h1 id="financial-health-title">Financial Health</h1>
          <p>
            One clear view of your financial stability, control, and future progress—calculated
            from eight weighted health indicators.
          </p>

          <div className="financial-health-status-row">
            <span className="financial-health-status-dot" aria-hidden="true" />
            <strong>{band}</strong>
            <span>Top health band</span>
          </div>
        </div>

        <figure
          className="financial-health-ring-figure"
          aria-label={`Financial Health score ${score} out of 1000, rated ${band}`}
        >
          <div className="financial-health-ring-visual">
            <svg viewBox="0 0 184 184" aria-hidden="true">
              {groupRings.map((ring) => (
                <g key={ring.label} transform="rotate(-90 92 92)">
                  <circle
                    className="financial-health-ring-track"
                    cx="92"
                    cy="92"
                    r={ring.radius}
                    pathLength="100"
                  />
                  <circle
                    className="financial-health-ring-progress"
                    cx="92"
                    cy="92"
                    r={ring.radius}
                    pathLength="100"
                    stroke={ring.color}
                    strokeDasharray={`${ring.value} ${100 - ring.value}`}
                  />
                </g>
              ))}
            </svg>
            <div className="financial-health-ring-score">
              <strong>{score}</strong>
              <span>/ 1000</span>
            </div>
          </div>

          <figcaption className="financial-health-ring-legend">
            {groupRings.map((ring) => (
              <span key={ring.label}>
                <i style={{ background: ring.color }} aria-hidden="true" />
                {ring.label} {ring.displayValue}
              </span>
            ))}
          </figcaption>
        </figure>
      </section>

      <section className="financial-health-summary-grid" aria-label="Financial Health highlights">
        <article className="financial-health-summary-tile financial-health-summary-tile-primary">
          <span>Foundation & reliability</span>
          <strong>91.0</strong>
          <small>Credit, cash flow, and payment</small>
        </article>
        <article className="financial-health-summary-tile">
          <span>Control & resilience</span>
          <strong>80.5</strong>
          <small>Budget, wealth, and protection</small>
        </article>
        <article className="financial-health-summary-tile">
          <span>Future progress</span>
          <strong>77.3</strong>
          <small>Investment and goal health</small>
        </article>
        <article className="financial-health-summary-tile">
          <span>Strongest vital</span>
          <strong>{strongestIndicator.score}</strong>
          <small>{strongestIndicator.label}</small>
        </article>
      </section>

      <section className="psychometric-panel" aria-labelledby="net-worth-building-summary-title">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">Additional Summary Item</span>
            <h2 id="net-worth-building-summary-title">Net Worth Building Score</h2>
            <p className="financial-health-panel-intro">
              Added below the existing Financial Health summary without changing the original health indicators.
            </p>
          </div>
        </div>

        <section className="financial-health-summary-grid" aria-label="Net Worth Building highlights">
          <article className="financial-health-summary-tile financial-health-summary-tile-primary">
            <span>Net Worth Building Score</span>
            <strong>{netWorthBuildingScore ? netWorthBuildingScore.score : 'Pending'}</strong>
            <small>{netWorthBuildingScore ? `${netWorthBuildingScore.grade} - ${netWorthBuildingScore.rating}` : 'Loads from the saved Net Worth workflow'}</small>
          </article>
          <article className="financial-health-summary-tile">
            <span>Range Score</span>
            <strong>{netWorthBuildingScore ? netWorthBuildingScore.rangeScore : 'Pending'}</strong>
            <small>10-tier band from 200 to 900</small>
          </article>
          <article className="financial-health-summary-tile">
            <span>Net Worth</span>
            <strong>{netWorthBuildingScore ? netWorthBuildingScore.metrics.netWorth.toLocaleString() : 'Pending'}</strong>
            <small>Computed from saved workflow inputs</small>
          </article>
          <article className="financial-health-summary-tile">
            <span>Monthly Cash Flow</span>
            <strong>{netWorthBuildingScore ? netWorthBuildingScore.metrics.monthlyCashFlow.toLocaleString() : 'Pending'}</strong>
            <small>Supports the wealth-building position</small>
          </article>
        </section>
      </section>

      <section className="psychometric-panel financial-health-vitals-panel" aria-labelledby="health-vitals-title">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">Health indicators</span>
            <h2 id="health-vitals-title">Your financial vital signs</h2>
            <p className="financial-health-panel-intro">
              Each ring is measured on a 0–100 scale. Scores at 80 or above are in the excellent zone.
            </p>
          </div>
          <span className="financial-health-target-chip">Target 80+</span>
        </div>

        <div className="financial-health-vitals-grid">
          {financialHealthIndicators.map((indicator) => (
            <article
              key={indicator.id}
              className="financial-health-vital-card"
              style={indicatorStyle(indicator.accent, indicator.softAccent)}
            >
              <div
                className="financial-health-mini-ring"
                role="progressbar"
                aria-label={`${indicator.label}: ${indicator.score} out of 100`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={indicator.score}
              >
                <svg viewBox="0 0 52 52" aria-hidden="true">
                  <circle className="financial-health-mini-track" cx="26" cy="26" r="21" pathLength="100" />
                  <circle
                    className="financial-health-mini-progress"
                    cx="26"
                    cy="26"
                    r="21"
                    pathLength="100"
                    strokeDasharray={`${indicator.score} ${100 - indicator.score}`}
                  />
                </svg>
                <strong>{indicator.score}</strong>
              </div>

              <div className="financial-health-vital-copy">
                <h3>{indicator.label}</h3>
                <span>{indicator.score >= 80 ? 'Excellent zone' : 'Build next'}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="financial-health-detail-layout">
        <article className="psychometric-panel financial-health-chart-panel" aria-labelledby="health-profile-title">
          <div className="psychometric-panel-header">
            <div>
              <span className="psychometric-panel-kicker">Comparative graph</span>
              <h2 id="health-profile-title">Health profile and weighted contribution</h2>
              <p className="financial-health-panel-intro">
                Bar length shows the indicator score. The marker shows the recommended 80-point target.
              </p>
            </div>
          </div>

          <div className="financial-health-chart-head" aria-hidden="true">
            <span>Indicator</span>
            <span>Score profile</span>
            <span>Score</span>
            <span>Weight</span>
            <span>Points</span>
          </div>

          <div className="financial-health-chart" role="list" aria-label="Indicator score comparison">
            {financialHealthIndicators.map((indicator) => (
              <div
                key={indicator.id}
                className="financial-health-chart-row"
                role="listitem"
                style={indicatorStyle(indicator.accent, indicator.softAccent)}
              >
                <strong className="financial-health-chart-label">{indicator.label}</strong>
                <div
                  className="financial-health-bar-track"
                  role="progressbar"
                  aria-label={`${indicator.label} score`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={indicator.score}
                >
                  <span className="financial-health-target-line" aria-hidden="true" />
                  <span className="financial-health-bar-fill" style={{ width: `${indicator.score}%` }} />
                </div>
                <strong className="financial-health-chart-value">{indicator.score}</strong>
                <span className="financial-health-chart-weight">{indicator.weight}%</span>
                <span className="financial-health-chart-points">
                  {calculateWeightedContribution(indicator).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </article>

        <aside className="financial-health-side-stack">
          <article className="psychometric-panel financial-health-formula-panel">
            <span className="psychometric-panel-kicker">Recommended formula</span>
            <h2>Transparent weighted index</h2>
            <p>
              Give more influence to recurring liquidity, payment behavior, and goal progress while
              keeping every financial vital represented.
            </p>
            <div className="financial-health-equation">
              <span>Σ (indicator score × weight)</span>
              <strong>{index.toFixed(1)} × 10 = {score}</strong>
              <small>Weights total 100%</small>
            </div>
            <p className="financial-health-method-note">
              Recommended as a transparent wellness index. Calibrate weights against real outcomes
              before using it for credit decisions. Model FHI v1.0 does not reweight missing data.
            </p>
          </article>

          <article className="psychometric-panel financial-health-band-panel">
            <span className="psychometric-panel-kicker">Interpretation</span>
            <h2>Health bands</h2>
            <ul className="financial-health-band-list">
              {healthBands.map((healthBand) => (
                <li
                  key={healthBand.label}
                  className={healthBand.label === band ? 'financial-health-band-current' : undefined}
                >
                  <i className={healthBand.className} aria-hidden="true" />
                  <span>{healthBand.label}</span>
                  <strong>{healthBand.range}</strong>
                </li>
              ))}
            </ul>
          </article>

          <article className="psychometric-panel financial-health-focus-panel">
            <span className="psychometric-panel-kicker">Focus next</span>
            <h2>{priorityIndicator.label}</h2>
            <div className="financial-health-focus-score">
              <strong>{priorityIndicator.score}</strong>
              <span>/ 100</span>
            </div>
            <p>
              Build investment consistency first, then strengthen Protection Health at 76. These are
              the clearest opportunities to lift Future Progress and resilience.
            </p>
          </article>

          <article className="psychometric-panel financial-health-graph-guide">
            <span className="psychometric-panel-kicker">Graph style</span>
            <h2>Apple Health–inspired system</h2>
            <ul>
              <li><strong>Activity rings</strong> for the overall glance.</li>
              <li><strong>Vital cards</strong> for the eight current readings.</li>
              <li><strong>Horizontal bars</strong> for accurate comparison and weights.</li>
              <li><strong>Trend lines</strong> once three or more reporting periods exist.</li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  )
}
