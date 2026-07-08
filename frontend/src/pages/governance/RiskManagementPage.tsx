import { useEffect, useMemo, useState } from 'react'

import { api, getErrorMessage } from '../../api'
import type { AuditLog } from '../../types'

type RiskLevel = 'maintain' | 'watch' | 'attention'

type RiskRule = {
  id: string
  label: string
  note: string
  matcher: (log: AuditLog) => boolean
}

type RiskSummary = {
  id: string
  label: string
  note: string
  count: number
  level: RiskLevel
  attainment: number
  sample: string
}

const riskRules: RiskRule[] = [
  {
    id: 'duplicate-identities',
    label: 'Duplicate Identities',
    note: 'Monitors duplicate borrower, user, or account creation patterns.',
    matcher: (log) =>
      /duplicate account|double account|multiple account|same borrower|same user|duplicate user/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'insecure-api',
    label: 'Insecure API Endpoints',
    note: 'Flags insecure transport, missing auth, bypasses, and unsafe endpoint access.',
    matcher: (log) =>
      /http:|insecure api|missing auth|token exposed|unsafe endpoint|bypass|unauthorized/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'double-apis',
    label: 'Double APIs',
    note: 'Looks for replayed, duplicate, or overlapping API activity.',
    matcher: (log) =>
      /duplicate api|double api|repeated api|same endpoint|duplicate request|api replay/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'foreign-sources',
    label: 'Out-of-Country Sources',
    note: 'Tracks foreign IPs, VPN hints, or geographic source anomalies.',
    matcher: (log) =>
      /out of country|foreign ip|foreign source|geo anomaly|country mismatch|international source|vpn/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'privilege-abuse',
    label: 'Privilege Abuse Risk',
    note: 'Highlights sensitive role, permission, and elevated-admin changes.',
    matcher: (log) =>
      /role|permission|admin|elevated|privilege|superuser/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'bulk-mutations',
    label: 'Bulk Mutation Risk',
    note: 'Monitors imports, exports, batch changes, and mass data movement.',
    matcher: (log) =>
      /import|export|bulk|batch|mass update|download/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'failed-actions',
    label: 'Failed or Rejected Actions',
    note: 'Tracks denied, failed, blocked, and rejected actions.',
    matcher: (log) =>
      /failed|rejected|denied|forbidden|error|blocked|unauthorized/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'after-hours',
    label: 'After-Hours Operations',
    note: 'Marks risk events occurring outside standard monitoring hours.',
    matcher: (log) => {
      const eventTime = new Date(log.createdAt)
      if (Number.isNaN(eventTime.getTime())) {
        return false
      }
      const hour = eventTime.getHours()
      return hour < 6 || hour >= 22
    },
  },
]

function computeRiskLevel(count: number): RiskLevel {
  if (count === 0) {
    return 'maintain'
  }
  if (count === 1) {
    return 'watch'
  }
  return 'attention'
}

function computeAttainment(count: number): number {
  if (count === 0) {
    return 100
  }
  if (count === 1) {
    return 65
  }
  return 25
}

function getPerformanceBand(score: number) {
  if (score >= 90) {
    return 'Controlled'
  }
  if (score >= 75) {
    return 'Stable'
  }
  if (score >= 55) {
    return 'Watchlist'
  }
  return 'High Attention'
}

function getRiskSample(logs: AuditLog[]): string {
  if (!logs.length) {
    return 'No matching events detected in the current audit set.'
  }

  const detail = logs[0]?.details?.trim() || logs[0]?.action || 'No details'
  return detail.length > 120 ? `${detail.slice(0, 117)}...` : detail
}

export default function RiskManagementPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadAuditLogs()
  }, [])

  async function loadAuditLogs() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.get('/audit-logs')
      const logsData = response.data?.data || response.data?.logs || response.data || []
      setAuditLogs(Array.isArray(logsData) ? logsData : [])
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Unable to load risk monitoring data right now.'))
    } finally {
      setIsLoading(false)
    }
  }

  const safeAuditLogs = useMemo(
    () => (Array.isArray(auditLogs) ? auditLogs : []),
    [auditLogs],
  )

  const riskSummaries = useMemo<RiskSummary[]>(
    () =>
      riskRules.map((rule) => {
        const matchingLogs = safeAuditLogs.filter(rule.matcher)
        const count = matchingLogs.length

        return {
          id: rule.id,
          label: rule.label,
          note: rule.note,
          count,
          level: computeRiskLevel(count),
          attainment: computeAttainment(count),
          sample: getRiskSample(matchingLogs),
        }
      }),
    [safeAuditLogs],
  )

  const averageAttainment = useMemo(() => {
    if (!riskSummaries.length) {
      return 0
    }

    return riskSummaries.reduce((sum, risk) => sum + risk.attainment, 0) / riskSummaries.length
  }, [riskSummaries])

  const watchlistCount = riskSummaries.filter((risk) => risk.level === 'watch').length
  const attentionCount = riskSummaries.filter((risk) => risk.level === 'attention').length
  const issueCount = riskSummaries.reduce((sum, risk) => sum + risk.count, 0)
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
          <span className="psychometric-eyebrow">Application Risk Oversight</span>
          <h1>Risk Management Monitoring</h1>
          <p>
            Monitor application risk indicators and issue patterns including duplicate identities,
            insecure API endpoints, duplicate APIs, out-of-country sources, privilege abuse,
            bulk mutations, failed actions, and after-hours operations.
          </p>
        </div>

        <div className="psychometric-hero-metric">
          <span>Risk Integrity Score</span>
          <strong>{averageAttainment.toFixed(1)}</strong>
          <small>{performanceBand}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Events Reviewed</span>
          <strong>{safeAuditLogs.length}</strong>
          <small>Audit events available for monitoring</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Risk Indicators</span>
          <strong>{riskSummaries.length}</strong>
          <small>Configured issue-monitoring domains</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Watchlist Risks</span>
          <strong>{watchlistCount}</strong>
          <small>Risk areas needing closer review</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Critical Risks</span>
          <strong>{attentionCount}</strong>
          <small>Risk areas requiring immediate attention</small>
        </article>
      </section>

      <section className="psychometric-layout">
        <div className="psychometric-main">
          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Risk Matrix</span>
                <h2>Indicators and issue monitoring</h2>
              </div>
              <button
                type="button"
                className="psychometric-reset-button"
                onClick={() => void loadAuditLogs()}
                disabled={isLoading}
              >
                {isLoading ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>

            {error ? (
              <p className="psychometric-section-note" role="alert">
                {error}
              </p>
            ) : null}

            <div className="psychometric-scale-table-wrap">
              <table className="psychometric-scale-table">
                <thead>
                  <tr>
                    <th>Risk Indicator</th>
                    <th>Hits</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {riskSummaries.map((risk) => (
                    <tr key={risk.id}>
                      <td>{risk.label}</td>
                      <td>{risk.count}</td>
                      <td>{risk.level === 'maintain' ? 'Controlled' : risk.level === 'watch' ? 'Watch' : 'Attention'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <div className="psychometric-sections">
            {riskSummaries.map((risk) => (
              <article key={risk.id} className="psychometric-section-card">
                <div className="psychometric-section-header">
                  <div>
                    <span className="psychometric-section-code">Risk {risk.id.toUpperCase()}</span>
                    <h3>{risk.label}</h3>
                    <p>{risk.note}</p>
                  </div>

                  <div className="psychometric-section-score">
                    <strong>{risk.count}</strong>
                    <span>{risk.level === 'maintain' ? 'controlled' : risk.level}</span>
                  </div>
                </div>

                <div className="psychometric-progress-track" aria-hidden="true">
                  <div className="psychometric-progress-bar" style={{ width: `${risk.attainment}%` }} />
                </div>

                <div className="psychometric-formula-grid">
                  <div className="psychometric-formula-card">
                    <span>Issue count</span>
                    <strong>{risk.count}</strong>
                  </div>
                  <div className="psychometric-formula-card">
                    <span>Risk level</span>
                    <strong>{risk.level === 'maintain' ? 'Controlled' : risk.level === 'watch' ? 'Watch' : 'Attention'}</strong>
                  </div>
                  <div className="psychometric-formula-card psychometric-formula-card-accent">
                    <span>Sample trigger</span>
                    <strong style={{ fontSize: '0.95rem', lineHeight: 1.45 }}>{risk.sample}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="psychometric-side-panel">
          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Overall Computation</span>
            <h2>Risk score snapshot</h2>

            <div className="psychometric-score-ring" style={scoreRingStyle}>
              <strong>{averageAttainment.toFixed(1)}</strong>
              <span>/ 100</span>
            </div>

            <ul className="psychometric-breakdown-list">
              <li>
                <span>Risk integrity score</span>
                <strong>{averageAttainment.toFixed(1)}</strong>
              </li>
              <li>
                <span>Performance band</span>
                <strong>{performanceBand}</strong>
              </li>
              <li>
                <span>Total issue hits</span>
                <strong>{issueCount}</strong>
              </li>
              <li>
                <span>Critical risks</span>
                <strong>{attentionCount}</strong>
              </li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  )
}
