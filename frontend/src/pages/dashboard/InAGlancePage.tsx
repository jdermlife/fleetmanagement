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
import {
  fetchLatestMonthlyProfileSnapshot,
  type MonthlyProfileSnapshotRecord,
} from '../../services/profilemonthlysnapshotcalculator'

const snapshotItems = [
  { key: 'credit_health_score', label: 'Credit Health', path: '/lending-scorecard', Icon: CreditCard },
  { key: 'net_worth_positioning_score', label: 'Wealth Building', path: '/net-worth-positioning', Icon: TrendingUp },
  { key: 'budget_tracking_score', label: 'Budget Tracking', path: '/budget-expense-tracker', Icon: CircleDollarSign },
  { key: 'loan_monitoring_score', label: 'Resource Optimizer', path: '/loan-monitoring', Icon: Landmark },
  { key: 'bill_reminder_score', label: 'Bill Manager', path: '/bill-reminder', Icon: ReceiptText },
] as const

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
})

function formatMonth(value: string) {
  return monthFormatter.format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
}

function displayScore(value: number | null) {
  return value === null ? 'Pending' : Math.round(value).toString()
}

export default function InAGlancePage() {
  const [snapshot, setSnapshot] = useState<MonthlyProfileSnapshotRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

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

      {loading ? <p className="status-message" role="status">Loading saved snapshot...</p> : null}
      {message ? <p className="status-message error" role="alert">{message}</p> : null}
      {!loading && !message && !snapshot ? (
        <section className="in-a-glance-empty">
          <Gauge aria-hidden="true" />
          <h2>No saved snapshot yet</h2>
          <p>Save a monthly snapshot from Financial Health to display it here.</p>
          <a href="/financial-health-summary">Open Financial Health</a>
        </section>
      ) : null}

      {snapshot ? (
        <>
          <section className="in-a-glance-hero" aria-label="Saved Financial Health score">
            <div className="in-a-glance-score-ring">
              <Gauge aria-hidden="true" />
              <strong>{displayScore(snapshot.financial_health_score)}</strong>
              <span>/ 1000</span>
            </div>
            <div>
              <span>Financial Health</span>
              <h2>Your saved monthly position</h2>
              <p>This view reflects the latest saved result. Scores are not recalculated on this page.</p>
              <a href="/financial-health-summary">View Financial Health</a>
            </div>
          </section>

          <section className="in-a-glance-grid" aria-label="Saved component scores">
            {snapshotItems.map(({ key, label, path, Icon }) => {
              const value = snapshot[key]
              return (
                <a key={key} href={path} className="in-a-glance-card">
                  <span className="in-a-glance-card-icon"><Icon aria-hidden="true" /></span>
                  <span>{label}</span>
                  <strong>{displayScore(value)}<small>{value === null ? '' : ' / 100'}</small></strong>
                  <span className="in-a-glance-track" aria-hidden="true">
                    <span style={{ width: `${value ?? 0}%` }} />
                  </span>
                </a>
              )
            })}
          </section>
        </>
      ) : null}
    </main>
  )
}