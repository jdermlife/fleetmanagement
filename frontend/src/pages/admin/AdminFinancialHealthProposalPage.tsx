import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, RefreshCw, X } from 'lucide-react'

import { APP_NAME, brandLogoDataUri } from '../../brand'
import { readReplicatedBuildProfile, type ReplicatedBuildProfile } from '../scoring/buildProfileReplication'
import type { FinancialHealthSummaryResult } from '../scoring/financialHealthSummaryEngine'
import { getFinancialHealthBand } from '../scoring/financialHealthModel'

import { NET_WORTH_STATEMENT_ENTRIES } from '../scoring/NetWorthPositioningPage'
import { computeNetWorthBuildingScore } from '../scoring/netWorthBuildingEngine'
import WealthBalanceRadar from '../scoring/WealthBalanceRadar'
import { computeWealthFoundationScore } from '../scoring/wealthFoundationEngine'

import './AdminFinancialHealthProposalPage.css'

type PaperSize = 'a4' | 'letter'

type FinancialHealthProposalProps = {
  financialHealthSummary: FinancialHealthSummaryResult
  onClose: () => void
}

type ProposalMetric = {
  label: string
  value: number
}

const amount = (value: string | undefined) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const profileValue = (profile: ReplicatedBuildProfile | null, ...keys: string[]) => {
  for (const key of keys) {
    const value = profile?.values[key]?.trim()
    if (value) return value
  }
  return ''
}

const PROPOSAL_FINANCIAL_HEALTH_RING_STROKES = [
  'url(#proposal-financial-health-ring-gold)',
  'url(#proposal-financial-health-ring-silver)',
  'url(#proposal-financial-health-ring-bronze)',
] as const

const PROPOSAL_FINANCIAL_HEALTH_RING_LEGEND = [
  'Liquidity & Credit',
  'Protection & Budget',
  'Goals & Investments',
] as const

const PROPOSAL_FINANCIAL_HEALTH_RING_RADII = [76, 58, 40] as const

function indicatorRecommendation(id: string, score: number) {
  const actionById: Record<string, string> = {
    credit: 'Maintain on-time payments, control revolving balances, and review credit records before new borrowing.',
    'cash-flow': 'Build a recurring monthly surplus and preserve an emergency reserve equal to essential expenses.',
    wealth: 'Increase productive assets while reducing liabilities that do not support long-term value creation.',
    budget: 'Set monthly category limits, compare actual spending with plan, and redirect favorable variances.',
    payment: 'Automate due-date reminders and keep operating cash available before every scheduled obligation.',
    protection: 'Review life, health, property, disability, and income protection for material coverage gaps.',
    investment: 'Use regular contributions and an allocation aligned with the client risk profile and time horizon.',
    goal: 'Assign every major goal a target amount, deadline, monthly funding requirement, and review date.',
  }
  const action = actionById[id] ?? 'Review the underlying profile data and establish a measurable improvement action.'
  if (score >= 90) return `Maintain the strong result and review it at least annually. ${action}`
  if (score >= 75) return `Strengthen consistency to move this area above 90. ${action}`
  if (score >= 60) return `Include this area in the next 90-day improvement plan. ${action}`
  return `Treat this as an immediate planning priority. ${action}`
}

function resolveRiskProfile(profile: ReplicatedBuildProfile | null) {
  const answers = Array.from({ length: 8 }, (_, index) =>
    Number(profile?.suitabilityAnswers[`suitability-q${index + 1}`]),
  )
  if (answers.some((answer) => answer < 1 || answer > 4)) return 'Pending assessment'
  const score = answers.reduce((sum, answer) => sum + answer, 0)
  if (score <= 8) return 'Risk Averse'
  if (score <= 16) return 'Conservative'
  if (score <= 27) return 'Moderate'
  return 'Aggressive'
}

function riskAllocation(riskProfile: string) {
  if (riskProfile === 'Risk Averse') return { defensive: 80, growth: 20 }
  if (riskProfile === 'Conservative') return { defensive: 65, growth: 35 }
  if (riskProfile === 'Aggressive') return { defensive: 25, growth: 75 }
  return { defensive: 45, growth: 55 }
}

export default function AdminFinancialHealthProposalPage({
  financialHealthSummary,
  onClose,
}: FinancialHealthProposalProps) {
  const [profile, setProfile] = useState(() => readReplicatedBuildProfile())
  const [paperSize, setPaperSize] = useState<PaperSize>('a4')
  const [fontSize, setFontSize] = useState(10)

  useEffect(() => {
    setProfile(readReplicatedBuildProfile())
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const currency = profileValue(profile, 'wealthCurrency') || 'PHP'
  const money = useMemo(() => new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }), [currency])
  const proposalDate = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long' }).format(new Date())
  const clientName = profileValue(profile, 'fullName', 'borrowerName', 'clientName') || 'Profile Customer'
  const riskProfile = resolveRiskProfile(profile)
  const allocation = riskAllocation(riskProfile)
  const financialHealthBand = getFinancialHealthBand(financialHealthSummary.score)
  const netWorthDraft = useMemo(() => ({
    amounts: Object.fromEntries(NET_WORTH_STATEMENT_ENTRIES
      .filter((entry) => !entry.autoGenerated)
      .map((entry) => [entry.id, profile?.values[entry.id] ?? ''])),
  }), [profile])
  const netWorthBuilding = useMemo(() => computeNetWorthBuildingScore(netWorthDraft), [netWorthDraft])
  const wealthFoundation = useMemo(() => computeWealthFoundationScore(netWorthDraft).score, [netWorthDraft])
  const suitabilityScores = Object.values(profile?.suitabilityAnswers ?? {}).map(Number).filter(Number.isFinite)
  const wealthBehaviour = suitabilityScores.length > 0
    ? Math.round((suitabilityScores.reduce((sum, score) => sum + score, 0) / suitabilityScores.length / 4) * 100)
    : 0
  const declaredEntries = NET_WORTH_STATEMENT_ENTRIES.filter((entry) => !entry.autoGenerated)
  const completedEntries = declaredEntries.filter((entry) => amount(profile?.values[entry.id]) > 0).length
  const wealthAuthenticity = declaredEntries.length > 0
    ? Math.round((completedEntries / declaredEntries.length) * 100)
    : 0

  const sectionTotal = (section: string, desired = false) => NET_WORTH_STATEMENT_ENTRIES
    .filter((entry) => entry.section === section && !entry.autoGenerated)
    .reduce((sum, entry) => {
      const key = desired ? `wealthActual.${entry.id}` : entry.id
      return sum + amount(profile?.values[key])
    }, 0)

  const totalAssets = sectionTotal('assets')
  const totalLiabilities = sectionTotal('liabilities')
  const netWorth = totalAssets - totalLiabilities
  const monthlyIncome = sectionTotal('monthly-income')
  const monthlyExpenses = sectionTotal('monthly-expenses')
  const monthlySurplus = monthlyIncome - monthlyExpenses
  const protectionValue = sectionTotal('insurance-coverage')
  const targetAmount = amount(profile?.values.targetAmount)
  const targetMonths = Math.max(0, Number(profile?.values.targetMonths) || 0)
  const monthlyGoalFunding = targetMonths > 0 ? targetAmount / targetMonths : 0

  const categoryTotals = (section: string): ProposalMetric[] => {
    const totals = new Map<string, number>()
    NET_WORTH_STATEMENT_ENTRIES
      .filter((entry) => entry.section === section && !entry.autoGenerated)
      .forEach((entry) => {
        totals.set(entry.category, (totals.get(entry.category) ?? 0) + amount(profile?.values[entry.id]))
      })
    return [...totals.entries()]
      .map(([label, value]) => ({ label: label.replace(/^\d+\.\s*/, ''), value }))
      .filter((entry) => entry.value > 0)
      .sort((left, right) => right.value - left.value)
  }

  const assetMix = categoryTotals('assets')
  const liabilityMix = categoryTotals('liabilities')
  const incomeMix = categoryTotals('monthly-income')
  const expenseMix = categoryTotals('monthly-expenses')
  const weakestIndicators = [...financialHealthSummary.indicators]
    .sort((left, right) => left.score - right.score)
    .slice(0, 4)
  const riskIndicators = financialHealthSummary.indicators.filter((indicator) => indicator.score < 80)
  const riskNarration = riskIndicators.length === 0
    ? 'Well positioned. No Financial Vital Sign is currently below the 80-point target.'
    : `${riskIndicators.map((indicator) => indicator.label).join(', ')} ${riskIndicators.length === 1 ? 'is' : 'are'} below the 80-point target and may hold back overall Financial Health.`
  const strongestIndicators = [...financialHealthSummary.indicators]
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
  const investmentAssets = assetMix
    .filter((entry) => /investment|retirement|business|insurance/i.test(entry.label))
    .reduce((sum, entry) => sum + entry.value, 0)
  const liquidAssets = assetMix
    .filter((entry) => /cash|bank/i.test(entry.label))
    .reduce((sum, entry) => sum + entry.value, 0)
  const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0
  const savingsRate = monthlyIncome > 0 ? Math.max(0, (monthlySurplus / monthlyIncome) * 100) : 0
  const monthsOfExpenses = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0

  const sheetClass = `admin-proposal-sheet admin-proposal-sheet-${paperSize}`
  const pageHeader = (page: number, title: string) => (
    <header className="admin-proposal-page-heading">
      <div>
        <span>Financial Health Proposal · Page {page}</span>
        <h1>{title}</h1>
      </div>
      <div>
        <strong>{clientName}</strong>
        <small>{proposalDate} · Profile {profile?.profileId || 'Not selected'}</small>
      </div>
    </header>
  )

  const financialHealthRing = (
    <figure
      className="financial-health-ring-figure admin-proposal-financial-health-ring"
      aria-label={`Financial Health score ${financialHealthSummary.score} out of 1000, rated ${financialHealthBand}`}
    >
      <div className="financial-health-ring-visual">
        <svg viewBox="0 0 184 184" aria-hidden="true">
          <defs>
            <linearGradient id="proposal-financial-health-ring-gold" x1="22" y1="20" x2="162" y2="164" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#7b5008" />
              <stop offset="0.24" stopColor="#f4c54f" />
              <stop offset="0.43" stopColor="#ffe99a" />
              <stop offset="0.68" stopColor="#d69a1e" />
              <stop offset="1" stopColor="#845508" />
            </linearGradient>
            <linearGradient id="proposal-financial-health-ring-silver" x1="22" y1="20" x2="162" y2="164" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#656b73" />
              <stop offset="0.24" stopColor="#d5d9de" />
              <stop offset="0.43" stopColor="#f7f8f9" />
              <stop offset="0.68" stopColor="#adb3ba" />
              <stop offset="1" stopColor="#686e76" />
            </linearGradient>
            <linearGradient id="proposal-financial-health-ring-bronze" x1="22" y1="20" x2="162" y2="164" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#663213" />
              <stop offset="0.24" stopColor="#c67a3b" />
              <stop offset="0.43" stopColor="#f0ad70" />
              <stop offset="0.68" stopColor="#a95726" />
              <stop offset="1" stopColor="#653012" />
            </linearGradient>
          </defs>
          {financialHealthSummary.groups.map((group, index) => (
            <g key={group.id} transform="rotate(-90 92 92)">
              <circle
                className="financial-health-ring-track"
                cx="92"
                cy="92"
                r={PROPOSAL_FINANCIAL_HEALTH_RING_RADII[index]}
                pathLength="100"
              />
              <circle
                className="financial-health-ring-progress"
                cx="92"
                cy="92"
                r={PROPOSAL_FINANCIAL_HEALTH_RING_RADII[index]}
                pathLength="100"
                stroke={PROPOSAL_FINANCIAL_HEALTH_RING_STROKES[index]}
                strokeDasharray={`${group.value} ${100 - group.value}`}
              />
            </g>
          ))}
        </svg>
        <div className="financial-health-ring-score">
          <strong>{financialHealthSummary.score}</strong>
          <span>/ 1000</span>
        </div>
      </div>
      <figcaption className="financial-health-ring-legend">
        {financialHealthSummary.groups.map((group, index) => (
          <span key={group.id}>
            <i
              style={{ background: index === 0 ? '#e0ad2f' : index === 1 ? '#d2d6db' : '#c57b3c' }}
              aria-hidden="true"
            />
            {PROPOSAL_FINANCIAL_HEALTH_RING_LEGEND[index]}
          </span>
        ))}
      </figcaption>
    </figure>
  )

  const metricRows = (rows: ProposalMetric[], emptyLabel: string) => rows.length > 0
    ? rows.slice(0, 8).map((row) => (
      <div className="admin-proposal-data-row" key={row.label}>
        <span>{row.label}</span>
        <strong>{money.format(row.value)}</strong>
      </div>
    ))
    : <p className="admin-proposal-empty">{emptyLabel}</p>

  return createPortal(
    <div
      className="admin-financial-proposal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="financial-health-proposal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="admin-financial-proposal-page">
        <div className="admin-proposal-toolbar" aria-label="Proposal display controls">
          <label>
            Paper
            <select value={paperSize} onChange={(event) => setPaperSize(event.target.value as PaperSize)}>
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
            </select>
          </label>
          <label>
            Font size
            <input type="range" min="8" max="12" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />
            <output>{fontSize} pt</output>
          </label>
          <button type="button" onClick={() => setProfile(readReplicatedBuildProfile())}><RefreshCw aria-hidden="true" /> Refresh</button>
          <button type="button" onClick={() => window.print()}><Printer aria-hidden="true" /> Print</button>
          <button type="button" aria-label="Close proposal" onClick={onClose}><X aria-hidden="true" /></button>
        </div>

        <div className="admin-proposal-pages" style={{ '--proposal-font-size': `${fontSize}pt` } as React.CSSProperties}>
          <main className={`${sheetClass} admin-proposal-cover`}>
            <div className="admin-proposal-cover-brand">
              <img src={brandLogoDataUri} alt={`${APP_NAME} logo`} />
              <span>{APP_NAME} · Financial Health Tracker</span>
            </div>
            <div className="admin-proposal-cover-title">
              <span>Prepared exclusively for</span>
              <h1 id="financial-health-proposal-title">Financial Health<br />Wealth Management Proposal</h1>
              <strong>{clientName}</strong>
              <small>{proposalDate}</small>
            </div>
            <section className="admin-proposal-executive-summary">
              <span>Executive Summary</span>
              <p>
                This proposal consolidates the active customer profile, Financial Health assessment,
                balance-sheet position, cash flow, goals, risk profile, protection data, and existing
                wealth information into a practical planning framework.
              </p>
              <div>
                <article><span>Financial Health</span><strong>{financialHealthSummary.score} / 1000</strong><small>{financialHealthBand}</small></article>
                <article><span>Current Net Worth</span><strong>{money.format(netWorth)}</strong><small>Assets less liabilities</small></article>
                <article><span>Monthly Surplus</span><strong>{money.format(monthlySurplus)}</strong><small>{savingsRate.toFixed(1)}% savings rate</small></article>
              </div>
            </section>
            <footer>Confidential proposal generated from the active Build Profile and Financial Health records.</footer>
          </main>

          <main className={sheetClass}>
            {pageHeader(2, 'Client Profile & Financial Position')}
            <div className="admin-proposal-two-column">
              <section className="admin-proposal-panel">
                <span className="admin-proposal-kicker">Personal Information</span>
                <dl className="admin-proposal-profile-grid">
                  <div><dt>Client</dt><dd>{clientName}</dd></div>
                  <div><dt>Date of Birth</dt><dd>{profileValue(profile, 'dateOfBirth') || 'Not provided'}</dd></div>
                  <div><dt>Civil Status</dt><dd>{profileValue(profile, 'civilStatus', 'maritalStatus') || 'Not provided'}</dd></div>
                  <div><dt>Dependents</dt><dd>{(profile?.dependents?.length ?? profileValue(profile, 'dependents')) || '0'}</dd></div>
                  <div><dt>Employment</dt><dd>{profileValue(profile, 'employmentStatus') || 'Not provided'}</dd></div>
                  <div><dt>Occupation</dt><dd>{profileValue(profile, 'occupation', 'position') || 'Not provided'}</dd></div>
                  <div><dt>Email</dt><dd>{profileValue(profile, 'email') || 'Not provided'}</dd></div>
                  <div><dt>Mobile</dt><dd>{profileValue(profile, 'mobileNumber') || 'Not provided'}</dd></div>
                  <div className="admin-proposal-profile-wide"><dt>Address</dt><dd>{profileValue(profile, 'address', 'permanentAddress') || 'Not provided'}</dd></div>
                </dl>
              </section>
              <section className="admin-proposal-panel admin-proposal-position-panel">
                <span className="admin-proposal-kicker">Current Position</span>
                <div className="admin-proposal-position-score">
                  <strong>{money.format(netWorth)}</strong>
                  <span>Net Worth</span>
                </div>
                <div className="admin-proposal-stat-grid">
                  <article><span>Total Assets</span><strong>{money.format(totalAssets)}</strong></article>
                  <article><span>Total Liabilities</span><strong>{money.format(totalLiabilities)}</strong></article>
                  <article><span>Monthly Income</span><strong>{money.format(monthlyIncome)}</strong></article>
                  <article><span>Monthly Expenses</span><strong>{money.format(monthlyExpenses)}</strong></article>
                </div>
                <div className="admin-proposal-ratio">
                  <span>Debt-to-asset ratio</span>
                  <strong>{debtToAssetRatio.toFixed(1)}%</strong>
                  <i><b style={{ width: `${Math.min(100, debtToAssetRatio)}%` }} /></i>
                </div>
              </section>
            </div>
            <section className="admin-proposal-panel admin-proposal-wide-panel">
              <span className="admin-proposal-kicker">Position Summary</span>
              <p>
                The active profile reports {money.format(totalAssets)} in assets and {money.format(totalLiabilities)}
                {' '}in liabilities. Monthly cash flow is {monthlySurplus >= 0 ? 'positive' : 'negative'} by
                {' '}{money.format(Math.abs(monthlySurplus))}. These figures form the basis of the recommendations in this proposal.
              </p>
            </section>

            <footer>Profile information should be reviewed and updated before implementing recommendations.</footer>
          </main>

          <main className={sheetClass}>
            {pageHeader(3, 'Financial Health Risk & Wealth Building Scores')}
            <section className={`admin-proposal-financial-risk${riskIndicators.length > 0 ? ' has-alerts' : ''}`}>
              <div>
                <span>Financial Health Risk</span>
                <strong>{riskIndicators.length}</strong>
                <small>{riskIndicators.length === 1 ? 'Vital Sign below target' : 'Vital Signs below target'}</small>
              </div>
              <p>{riskNarration}</p>
            </section>
            <div className="admin-proposal-risk-indicators">
              {riskIndicators.length > 0 ? riskIndicators.map((indicator) => (
                <article key={indicator.id} style={{ '--proposal-risk-accent': indicator.accent } as React.CSSProperties}>
                  <span>{indicator.label}</span>
                  <strong>{indicator.score.toFixed(1)} / 100</strong>
                  <small>{indicatorRecommendation(indicator.id, indicator.score)}</small>
                </article>
              )) : (
                <article className="admin-proposal-no-risk">
                  <span>No active Financial Health alerts</span>
                  <strong>{financialHealthBand}</strong>
                  <small>Continue monitoring all Vital Signs and refresh the profile when financial circumstances change.</small>
                </article>
              )}
            </div>
            <div className="admin-proposal-graph-grid">
              <section className="admin-proposal-graph-panel admin-proposal-financial-health-panel">
                <header><span>Financial Health Position</span><h2>Financial Health Ring</h2></header>
                {financialHealthRing}
              </section>
              <section className="admin-proposal-graph-panel admin-proposal-wealth-panel">
                <header><span>Wealth Building Score</span><h2>Wealth Balance Radar</h2></header>
                <WealthBalanceRadar
                  netWorthPositioning={netWorthBuilding.score}
                  wealthBehaviour={wealthBehaviour}
                  wealthFoundation={wealthFoundation}
                  wealthAuthenticity={wealthAuthenticity}
                />
              </section>
            </div>
            <footer>Risk alerts use the same below-80 threshold shown on the Financial Health Summary page.</footer>
          </main>

          <main className={sheetClass}>
            {pageHeader(4, 'Objectives, Time Horizon & Risk Assessment')}
            <section className="admin-proposal-goal-hero">
              <div><span>Primary Financial Goal</span><h2>{profileValue(profile, 'financialGoal', 'loanPurpose') || 'Goal not selected'}</h2></div>
              <div><span>Target Amount</span><strong>{money.format(targetAmount)}</strong></div>
              <div><span>Target Horizon</span><strong>{targetMonths > 0 ? `${targetMonths} months` : 'Not set'}</strong></div>
              <div><span>Monthly Funding</span><strong>{money.format(monthlyGoalFunding)}</strong></div>
            </section>
            <div className="admin-proposal-two-column">
              <section className="admin-proposal-panel">
                <span className="admin-proposal-kicker">Planning Objectives</span>
                <ul className="admin-proposal-check-list">
                  <li>Preserve sufficient liquidity for essential expenses and emergencies.</li>
                  <li>Improve the weakest Financial Vital Signs through measurable actions.</li>
                  <li>Reduce unproductive debt and protect monthly cash flow.</li>
                  <li>Fund the selected goal within the stated time horizon.</li>
                  <li>Align investment risk with the completed suitability assessment.</li>
                  <li>Close material life, health, property, and income protection gaps.</li>
                </ul>
              </section>
              <section className="admin-proposal-panel admin-proposal-risk-panel">
                <span className="admin-proposal-kicker">Risk Assessment</span>
                <div className="admin-proposal-risk-result">
                  <strong>{riskProfile}</strong>
                  <span>Build Profile suitability result</span>
                </div>
                <div className="admin-proposal-allocation-bar">
                  <i style={{ width: `${allocation.defensive}%` }}>Defensive {allocation.defensive}%</i>
                  <b style={{ width: `${allocation.growth}%` }}>Growth {allocation.growth}%</b>
                </div>
                <p>
                  Proposed strategic allocation is an initial planning range. Product suitability,
                  liquidity needs, capacity for loss, and regulatory requirements require review before implementation.
                </p>
              </section>
            </div>
            <section className="admin-proposal-panel admin-proposal-wide-panel">
              <span className="admin-proposal-kicker">Investment Horizon</span>
              <div className="admin-proposal-horizon">
                {['Less than 3 years', '3–5 years', '5–10 years', 'More than 10 years'].map((label, index) => {
                  const activeIndex = targetMonths <= 0 ? -1 : targetMonths < 36 ? 0 : targetMonths <= 60 ? 1 : targetMonths <= 120 ? 2 : 3
                  return <div key={label} className={activeIndex === index ? 'is-active' : ''}><i />{label}</div>
                })}
              </div>
            </section>
            <footer>Risk assessment is based on the saved suitability responses in the active customer profile.</footer>
          </main>

          <main className={sheetClass}>
            {pageHeader(5, 'Financial Health Diagnosis')}
            <section className="admin-proposal-health-overview">
              <div><span>Overall Financial Health</span><strong>{financialHealthSummary.score}</strong><small>/ 1000 · {financialHealthBand}</small></div>
              <p>Eight weighted Financial Vital Signs identify current strengths and planning priorities.</p>
            </section>
            <div className="admin-proposal-vitals-grid">
              {financialHealthSummary.indicators.map((indicator) => (
                <article key={indicator.id} style={{ '--proposal-accent': indicator.accent, '--proposal-soft': indicator.softAccent } as React.CSSProperties}>
                  <header><span>{indicator.label}</span><strong>{indicator.score.toFixed(1)}</strong></header>
                  <div><i style={{ width: `${indicator.score}%` }} /></div>
                  <small>Weight {indicator.weight}%</small>
                  <p>{indicatorRecommendation(indicator.id, indicator.score)}</p>
                </article>
              ))}
            </div>
            <section className="admin-proposal-strength-priority">
              <div><span>Current Strengths</span>{strongestIndicators.map((indicator) => <strong key={indicator.id}>{indicator.label} · {indicator.score.toFixed(1)}</strong>)}</div>
              <div><span>Priority Areas</span>{weakestIndicators.map((indicator) => <strong key={indicator.id}>{indicator.label} · {indicator.score.toFixed(1)}</strong>)}</div>
            </section>
            <footer>Scores summarize available profile and tool data; missing or stale information can affect results.</footer>
          </main>

          <main className={sheetClass}>
            {pageHeader(6, 'Balance-Sheet Strategy')}
            <div className="admin-proposal-three-column">
              <section className="admin-proposal-data-panel">
                <header><span>Assets</span><strong>{money.format(totalAssets)}</strong></header>
                {metricRows(assetMix, 'No asset amounts entered.')}
              </section>
              <section className="admin-proposal-data-panel admin-proposal-liability-panel">
                <header><span>Liabilities</span><strong>{money.format(totalLiabilities)}</strong></header>
                {metricRows(liabilityMix, 'No liability amounts entered.')}
              </section>
              <section className="admin-proposal-panel admin-proposal-strategy-panel">
                <span className="admin-proposal-kicker">Recommended Strategy</span>
                <ol>
                  <li>Maintain accessible liquidity before committing funds to long-term assets.</li>
                  <li>Prioritize high-cost and unsecured liabilities while preserving required installment performance.</li>
                  <li>Review concentration in property, vehicles, business interests, and individual securities.</li>
                  <li>Direct recurring surplus toward the selected goal and diversified productive assets.</li>
                  <li>Recalculate net worth quarterly using current market values and loan balances.</li>
                </ol>
              </section>
            </div>
            <section className="admin-proposal-balance-callout">
              <div><span>Productive / long-term assets</span><strong>{money.format(investmentAssets)}</strong></div>
              <div><span>Liquid assets</span><strong>{money.format(liquidAssets)}</strong></div>
              <div><span>Net worth</span><strong>{money.format(netWorth)}</strong></div>
            </section>
            <footer>Balance-sheet recommendations use declared values and do not represent independent asset valuations.</footer>
          </main>

          <main className={sheetClass}>
            {pageHeader(7, 'Cash Flow, Liquidity & Protection Strategy')}
            <div className="admin-proposal-two-column">
              <section className="admin-proposal-data-panel">
                <header><span>Monthly Income</span><strong>{money.format(monthlyIncome)}</strong></header>
                {metricRows(incomeMix, 'No monthly income entered.')}
              </section>
              <section className="admin-proposal-data-panel admin-proposal-expense-panel">
                <header><span>Monthly Expenses</span><strong>{money.format(monthlyExpenses)}</strong></header>
                {metricRows(expenseMix, 'No monthly expenses entered.')}
              </section>
            </div>
            <section className="admin-proposal-cashflow-summary">
              <article><span>Monthly Surplus</span><strong>{money.format(monthlySurplus)}</strong><small>{monthlySurplus >= 0 ? 'Available for reserves, goals, debt, and investment' : 'Expense or income action required'}</small></article>
              <article><span>Savings Rate</span><strong>{savingsRate.toFixed(1)}%</strong><small>Monthly surplus ÷ monthly income</small></article>
              <article><span>Liquidity Coverage</span><strong>{monthsOfExpenses.toFixed(1)} months</strong><small>Liquid assets ÷ monthly expenses</small></article>
              <article><span>Declared Protection</span><strong>{money.format(protectionValue)}</strong><small>Insurance and protection entries</small></article>
            </section>
            <section className="admin-proposal-panel admin-proposal-wide-panel">
              <span className="admin-proposal-kicker">Protection Recommendations</span>
              <div className="admin-proposal-recommendation-columns">
                <p><strong>Emergency readiness</strong>Build and preserve an accessible reserve appropriate to essential monthly expenses and income stability.</p>
                <p><strong>Life and income risk</strong>Review coverage against dependents, liabilities, replacement-income needs, and the selected financial goal.</p>
                <p><strong>Health and property risk</strong>Confirm current policy limits, exclusions, deductibles, beneficiaries, and renewal dates.</p>
              </div>
            </section>
            <footer>Coverage adequacy requires policy-level review; declared amounts alone do not confirm effective protection.</footer>
          </main>

          <main className={sheetClass}>
            {pageHeader(8, 'Wealth Building & Investment Proposal')}
            <section className="admin-proposal-investment-hero">
              <div><span>Risk Profile</span><strong>{riskProfile}</strong></div>
              <div><span>Defensive Allocation</span><strong>{allocation.defensive}%</strong></div>
              <div><span>Growth Allocation</span><strong>{allocation.growth}%</strong></div>
              <div><span>Current Investment Assets</span><strong>{money.format(investmentAssets)}</strong></div>
            </section>
            <div className="admin-proposal-two-column">
              <section className="admin-proposal-panel">
                <span className="admin-proposal-kicker">Proposed Portfolio Framework</span>
                <div className="admin-proposal-allocation-list">
                  <div><i style={{ width: `${allocation.defensive}%` }} /><span>Defensive allocation</span><strong>{allocation.defensive}%</strong></div>
                  <div><i style={{ width: `${allocation.growth}%` }} /><span>Growth allocation</span><strong>{allocation.growth}%</strong></div>
                  <div><i style={{ width: `${Math.min(100, Math.max(10, savingsRate))}%` }} /><span>Recurring contribution capacity</span><strong>{money.format(Math.max(0, monthlySurplus))}</strong></div>
                </div>
              </section>
              <section className="admin-proposal-panel">
                <span className="admin-proposal-kicker">Implementation Principles</span>
                <ul className="admin-proposal-check-list">
                  <li>Keep short-term goal funds outside volatile long-term investments.</li>
                  <li>Diversify across issuers, asset classes, sectors, and time horizons.</li>
                  <li>Use regular contributions instead of relying on market timing.</li>
                  <li>Review fees, liquidity, tax treatment, and product risks before purchase.</li>
                  <li>Rebalance after major life changes or material allocation drift.</li>
                </ul>
              </section>
            </div>
            <section className="admin-proposal-panel admin-proposal-wide-panel">
              <span className="admin-proposal-kicker">Goal Funding Test</span>
              <p>
                Required monthly funding is {money.format(monthlyGoalFunding)}. Current declared monthly surplus is
                {' '}{money.format(monthlySurplus)}. The profile currently {monthlySurplus >= monthlyGoalFunding
                  ? 'shows sufficient monthly capacity before investment risk and product costs.'
                  : 'shows a funding gap that should be addressed through income, expense, target, or timeline adjustments.'}
              </p>
            </section>
            <footer>This proposal is strategic guidance and is not a recommendation to purchase a specific security or product.</footer>
          </main>

          <main className={sheetClass}>
            {pageHeader(9, 'Priority Action Plan & Review')}
            <section className="admin-proposal-action-plan">
              {weakestIndicators.map((indicator, index) => (
                <article key={indicator.id}>
                  <span>{index + 1}</span>
                  <div><strong>{indicator.label}</strong><small>Current score {indicator.score.toFixed(1)} / 100</small></div>
                  <p>{indicatorRecommendation(indicator.id, indicator.score)}</p>
                  <b>{index === 0 ? '0–30 days' : index === 1 ? '30–60 days' : index === 2 ? '60–90 days' : 'Quarterly review'}</b>
                </article>
              ))}
            </section>
            <section className="admin-proposal-review-grid">
              <div><span>Monthly</span><p>Update income, expenses, savings, debt payments, and goal contributions.</p></div>
              <div><span>Quarterly</span><p>Refresh Financial Health scores, net worth, asset allocation, and priority actions.</p></div>
              <div><span>Annually</span><p>Review risk profile, protection, beneficiaries, goals, tax position, and investment strategy.</p></div>
            </section>
            <section className="admin-proposal-disclosure">
              <h2>Important Information</h2>
              <p>
                This proposal is generated from customer-provided and system-recorded information. It is intended
                for financial planning and decision support only. It does not replace regulated investment,
                insurance, tax, legal, accounting, or credit advice. Assumptions, values, scores, and recommendations
                should be independently reviewed before any transaction or commitment.
              </p>
              <div>
                <span>Client acknowledgement</span><i />
                <span>Adviser / reviewer</span><i />
                <span>Date</span><i />
              </div>
            </section>
            <footer>{APP_NAME} Financial Health Wealth Management Proposal · Confidential</footer>
          </main>
        </div>
      </div>
    </div>,
    document.body,
  )
}
