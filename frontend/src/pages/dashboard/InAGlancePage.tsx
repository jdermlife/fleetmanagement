import { useEffect, useState } from 'react'
import {
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Gauge,
  Landmark,
  ReceiptText,
  TrendingUp,
} from 'lucide-react'

import { getErrorMessage } from '../../api'
import { useSelectedAnalysisEntity } from '../../hooks/useSelectedAnalysisEntity'
import {
  fetchLatestMonthlyProfileSnapshot,
  type MonthlyProfileSnapshotRecord,
} from '../../services/profilemonthlysnapshotcalculator'
import {
  loadLiveFinancialHealthSummary,
} from '../scoring/financialHealthLiveSummary'
import type { FinancialHealthSummaryResult } from '../scoring/financialHealthSummaryEngine'

const snapshotItems = [
  { key: 'credit_health_score', summaryKey: 'credit_health_summary', kind: 'credit', label: 'Credit Health', path: '/lending-scorecard', Icon: CreditCard },
  { key: 'net_worth_positioning_score', summaryKey: 'net_worth_summary', kind: 'wealth', label: 'Wealth Building', path: '/net-worth-positioning', Icon: TrendingUp },
  { key: 'budget_tracking_score', summaryKey: 'budget_tracking_summary', kind: 'budget', label: 'Budget Tracking', path: '/budget-expense-tracker', Icon: CircleDollarSign },
  { key: 'loan_monitoring_score', summaryKey: 'loan_monitoring_summary', kind: 'loan', label: 'Resource Optimizer', path: '/loan-monitoring', Icon: Landmark },
  { key: 'bill_reminder_score', summaryKey: 'bill_reminder_summary', kind: 'bills', label: 'Bill Manager', path: '/bill-reminder', Icon: ReceiptText },
] as const

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function numericValue(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function boundedScore(value: number | null, fallback = 0) {
  return Math.max(0, Math.min(100, value ?? fallback))
}

function FinancialHealthReflection({ score, summary }: { score: number | null; summary: JsonRecord }) {
  const groups = Array.isArray(summary.groups) ? summary.groups : []
  const fallback = boundedScore(score === null ? null : score / 10)
  const ringScores = [0, 1, 2].map((index) => {
    const group = asRecord(groups[index])
    return boundedScore(numericValue(group.value, fallback))
  })

  return (
    <div className="in-a-glance-financial-visual" role="img" aria-label={`Financial Health ${displayScore(score)} out of 1000`}>
      <svg viewBox="0 0 220 220" aria-hidden="true">
        {ringScores.map((ringScore, index) => (
          <g key={index} transform="rotate(-90 110 110)">
            <circle className="in-a-glance-ring-track" cx="110" cy="110" r={82 - index * 19} pathLength="100" />
            <circle
              className={`in-a-glance-ring-value in-a-glance-ring-value-${index + 1}`}
              cx="110"
              cy="110"
              r={82 - index * 19}
              pathLength="100"
              strokeDasharray={`${ringScore} ${100 - ringScore}`}
            />
          </g>
        ))}
      </svg>
      <div className="in-a-glance-financial-score">
        <strong>{displayScore(score)}</strong>
        {score === null ? null : <span>/ 1000</span>}
      </div>
      <div className="in-a-glance-financial-legend" aria-hidden="true">
        <span><i />Foundation</span><span><i />Controls</span><span><i />Future</span>
      </div>
    </div>
  )
}

function CreditReflection({ value, summary }: { value: number | null; summary: JsonRecord }) {
  const scores = [
    numericValue(summary.creditScore, value ?? 0),
    numericValue(summary.psychometricScore, value ?? 0),
    numericValue(summary.socialScore, value ?? 0),
    numericValue(summary.nonStarterScore, value ?? 0),
  ].map((score) => boundedScore(score))

  return (
    <div className="in-a-glance-credit-visual" role="img" aria-label={`Credit Health ${displayScore(value)} out of 100`}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        {scores.map((score, index) => (
          <g key={index} transform="rotate(-90 100 100)">
            <circle className="in-a-glance-mini-ring-track" cx="100" cy="100" r={76 - index * 13} pathLength="100" />
            <circle
              className={`in-a-glance-mini-ring-value in-a-glance-credit-ring-${index + 1}`}
              cx="100"
              cy="100"
              r={76 - index * 13}
              pathLength="100"
              strokeDasharray={`${score} ${100 - score}`}
            />
          </g>
        ))}
      </svg>
      <span>FILSCORE</span>
    </div>
  )
}

function WealthReflection({ value, summary }: { value: number | null; summary: JsonRecord }) {
  const building = asRecord(summary.netWorthBuilding)
  const components = asRecord(building.componentScores)
  const fallback = boundedScore(value)
  const scores = [
    numericValue(components.netWorthStrength, fallback),
    numericValue(components.cashFlowStrength, fallback),
    numericValue(components.investmentReadiness, fallback),
    numericValue(components.goalMomentum, fallback),
  ].map((score) => boundedScore(score))
  const center = 100
  const radius = 70
  const point = (index: number, scale: number) => {
    const angle = -Math.PI / 2 + index * Math.PI / 2
    return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`
  }

  return (
    <div className="in-a-glance-wealth-visual" role="img" aria-label={`Wealth Building ${displayScore(value)} out of 100`}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <polygon key={level} className="in-a-glance-radar-grid" points={scores.map((_score, index) => point(index, level)).join(' ')} />
        ))}
        {scores.map((_score, index) => <line key={index} className="in-a-glance-radar-axis" x1="100" y1="100" x2={point(index, 1).split(',')[0]} y2={point(index, 1).split(',')[1]} />)}
        <polygon className="in-a-glance-radar-score" points={scores.map((score, index) => point(index, score / 100)).join(' ')} />
        {scores.map((score, index) => {
          const [x, y] = point(index, score / 100).split(',')
          return <circle key={index} cx={x} cy={y} r="4" />
        })}
      </svg>
    </div>
  )
}

function BudgetReflection({ value, summary }: { value: number | null; summary: JsonRecord }) {
  const metrics = asRecord(summary.metrics)
  const budgetScore = boundedScore(value)
  const variance = numericValue(metrics.variancePercent)
  return (
    <div className="in-a-glance-budget-visual" role="img" aria-label={`Budget Tracking ${displayScore(value)} out of 100`}>
      <span>Budget performance</span>
      <div className="in-a-glance-budget-heading"><strong>Saved budget score</strong><b>{displayScore(value)}</b></div>
      <div className="in-a-glance-budget-bar"><i style={{ width: `${budgetScore}%` }} /></div>
      <div className="in-a-glance-budget-scale"><span>0</span><span>{variance > 0 ? `${variance.toFixed(1)}% variance` : '100'}</span></div>
    </div>
  )
}

function LoanReflection({ value }: { value: number | null }) {
  const score = boundedScore(value)
  return (
    <div className="in-a-glance-loan-visual" role="img" aria-label={`Resource Optimizer ${displayScore(value)} out of 100`}>
      <svg viewBox="0 0 220 145" aria-hidden="true">
        <path className="in-a-glance-gauge-track" pathLength="100" d="M30 120A80 80 0 0 1 190 120" />
        <path className="in-a-glance-gauge-low" pathLength="100" d="M30 120A80 80 0 0 1 190 120" />
        <path className="in-a-glance-gauge-value" pathLength="100" strokeDasharray={`${score} ${100 - score}`} d="M30 120A80 80 0 0 1 190 120" />
        <line x1="110" y1="120" x2="110" y2="48" transform={`rotate(${score * 1.8 - 90} 110 120)`} />
        <circle cx="110" cy="120" r="8" />
      </svg>
      <strong>{displayScore(value)}{value === null ? '' : '%'}</strong>
    </div>
  )
}

function BillsReflection({ value, summary, month }: { value: number | null; summary: JsonRecord; month: string }) {
  const date = new Date(`${month.slice(0, 7)}-01T00:00:00Z`)
  const firstDay = date.getUTCDay()
  const days = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  const metrics = asRecord(summary.metrics)
  const lateCount = numericValue(metrics.latePaymentCount)
  const calendarCellCount = Math.ceil((firstDay + days) / 7) * 7
  const cells = Array.from({ length: calendarCellCount }, (_, index) => {
    const day = index - firstDay + 1
    return day > 0 && day <= days ? day : null
  })
  return (
    <div className="in-a-glance-bills-visual" role="img" aria-label={`Bill Manager ${displayScore(value)} out of 100; ${lateCount} late payments`}>
      <div className="in-a-glance-calendar-heading"><strong>{date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}</strong><span>{lateCount} late</span></div>
      <div className="in-a-glance-calendar-weekdays">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="in-a-glance-calendar-grid">{cells.map((day, index) => <span className={day === days ? 'is-cutoff' : ''} key={index}>{day}</span>)}</div>
    </div>
  )
}

function SnapshotReflection({ kind, value, summary, month }: { kind: string; value: number | null; summary: JsonRecord; month: string }) {
  if (kind === 'credit') return <CreditReflection value={value} summary={summary} />
  if (kind === 'wealth') return <WealthReflection value={value} summary={summary} />
  if (kind === 'budget') return <BudgetReflection value={value} summary={summary} />
  if (kind === 'loan') return <LoanReflection value={value} />
  return <BillsReflection value={value} summary={summary} month={month} />
}

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
})

function formatMonth(value: string) {
  return monthFormatter.format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
}

function displayScore(value: number | null) {
  return value === null ? 'NA' : Math.round(value).toString()
}

export default function InAGlancePage() {
  const { selectedApplicationNo, entityKey, isIdentityReady } = useSelectedAnalysisEntity()
  const [snapshot, setSnapshot] = useState<MonthlyProfileSnapshotRecord | null>(null)
  const [liveSummary, setLiveSummary] = useState<FinancialHealthSummaryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [liveLoading, setLiveLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [liveMessage, setLiveMessage] = useState('')

  useEffect(() => {
    let disposed = false

    const loadSnapshot = async () => {
      try {
        const latestSnapshot = await fetchLatestMonthlyProfileSnapshot()
        if (!disposed) setSnapshot(latestSnapshot)
      } catch (error) {
        if (!disposed) setMessage(getErrorMessage(error, 'Unable to load the latest saved snapshot.'))
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    void loadSnapshot()
    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (!isIdentityReady) return

    let disposed = false
    let requestInFlight = false

    const loadLiveSummary = async () => {
      if (requestInFlight) return
      requestInFlight = true
      try {
        const summary = await loadLiveFinancialHealthSummary(
          entityKey || 'identity-pending',
          selectedApplicationNo || 'new',
        )
        if (!disposed) {
          setLiveSummary(summary)
          setLiveMessage('')
        }
      } catch (error) {
        if (!disposed) setLiveMessage(getErrorMessage(error, 'Unable to load the current Financial Health score.'))
      } finally {
        requestInFlight = false
        if (!disposed) setLiveLoading(false)
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadLiveSummary()
    }

    void loadLiveSummary()
    const intervalId = window.setInterval(refreshWhenVisible, 15000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [entityKey, isIdentityReady, selectedApplicationNo])

  const financialHealthScore = liveSummary?.score ?? snapshot?.financial_health_score ?? null
  const financialHealthSummary = liveSummary
    ? asRecord(liveSummary)
    : asRecord(snapshot?.financial_health_summary)
  const hasFinancialHealth = liveSummary !== null || snapshot !== null

  return (
    <main className="in-a-glance-page">
      <header className="in-a-glance-header">
        <div>
          <span className="in-a-glance-kicker">Financial snapshot</span>
          <h1>In A Glance</h1>
          <p>Latest scores already saved from your financial pages.</p>
        </div>
        {snapshot ? (
          <span className="in-a-glance-month"><CalendarDays aria-hidden="true" />{formatMonth(snapshot.snapshot_month)}</span>
        ) : null}
      </header>

      {loading || liveLoading ? <p className="status-message" role="status">Loading current financial data...</p> : null}
      {message ? <p className="status-message error" role="alert">{message}</p> : null}
      {liveMessage && !snapshot ? <p className="status-message error" role="alert">{liveMessage}</p> : null}
      {!loading && !liveLoading && !message && !liveMessage && !hasFinancialHealth ? (
        <section className="in-a-glance-empty">
          <Gauge aria-hidden="true" />
          <h2>No financial data yet</h2>
          <p>Complete your financial tools to display your current Financial Health score.</p>
          <a href="/financial-health-summary">Open Financial Health</a>
        </section>
      ) : null}

      {hasFinancialHealth ? (
        <>
          <section className="in-a-glance-hero" aria-label="Current Financial Health score">
            <FinancialHealthReflection score={financialHealthScore} summary={financialHealthSummary} />
            <div>
              <span>Financial Health</span>
              <h2>Your current financial position</h2>
              <p>{liveSummary
                ? 'Synchronized with the latest autosaved data used by Financial Health.'
                : 'Showing the latest saved result until current financial data is available.'}</p>
              <a href="/financial-health-summary">View Financial Health</a>
            </div>
          </section>

          {snapshot ? <section className="in-a-glance-grid" aria-label="Saved component scores">
            {snapshotItems.map(({ key, summaryKey, kind, label, path, Icon }) => {
              const value = snapshot[key]
              return (
                <a key={key} href={path} className="in-a-glance-card">
                  <span className="in-a-glance-card-heading"><Icon aria-hidden="true" /><strong>{label}</strong></span>
                  <SnapshotReflection kind={kind} value={value} summary={asRecord(snapshot[summaryKey])} month={snapshot.snapshot_month} />
                  <span className="in-a-glance-card-score">{displayScore(value)}<small>{value === null ? '' : ' / 100'}</small></span>
                </a>
              )
            })}
          </section> : null}
        </>
      ) : null}
    </main>
  )
}