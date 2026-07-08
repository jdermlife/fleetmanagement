import { useEffect, useMemo, useState } from 'react'

import { api, getErrorMessage } from '../../api'
import type { AuditLog } from '../../types'

type ConcernLevel = 'maintain' | 'watch' | 'attention'

type ConcernConfig = {
  id: string
  label: string
  note: string
  matcher: (log: AuditLog) => boolean
}

type ConcernSummary = {
  id: string
  label: string
  note: string
  count: number
  level: ConcernLevel
  attainment: number
  sample: string
}

const concernConfigs: ConcernConfig[] = [
  {
    id: 'double-accounts',
    label: 'Double Accounts',
    note: 'Detects logs that suggest duplicate user or borrower account creation.',
    matcher: (log) =>
      /duplicate account|double account|multiple account|same borrower|same user|duplicate user/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'insecure-api-endpoints',
    label: 'Insecure API Endpoints',
    note: 'Looks for logs mentioning insecure transport, missing auth, token exposure, or unsafe access.',
    matcher: (log) =>
      /http:|insecure api|missing auth|token exposed|unsafe endpoint|bypass|unauthorized/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'duplicate-apis',
    label: 'Double APIs',
    note: 'Highlights repeated or duplicate API activity patterns that can imply conflicting integrations.',
    matcher: (log) =>
      /duplicate api|double api|repeated api|same endpoint|duplicate request|api replay/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'out-of-country',
    label: 'Out of the Country Sources',
    note: 'Flags records mentioning foreign-source, geo-anomaly, VPN, or country mismatch signals.',
    matcher: (log) =>
      /out of country|foreign ip|foreign source|geo anomaly|country mismatch|international source|vpn/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'privilege-changes',
    label: 'Privilege Changes',
    note: 'Tracks role, permission, and admin-scope changes that deserve closer review.',
    matcher: (log) =>
      /role|permission|admin|elevated|privilege/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'bulk-data',
    label: 'Bulk Import or Export',
    note: 'Monitors mass data movement such as imports, exports, or batch updates.',
    matcher: (log) =>
      /import|export|bulk|batch|mass update|download/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'failed-actions',
    label: 'Failed or Rejected Actions',
    note: 'Surfaces denial, rejection, or error-like mutations that may indicate control friction or abuse.',
    matcher: (log) =>
      /failed|rejected|denied|forbidden|error|blocked|unauthorized/i.test(
        `${log.action} ${log.details} ${log.entityType}`,
      ),
  },
  {
    id: 'after-hours',
    label: 'After-Hours Activity',
    note: 'Marks events happening outside standard monitoring hours for manual review.',
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

function computeConcernLevel(count: number): ConcernLevel {
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

  return 30
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
  return 'Needs Attention'
}

function getConcernSample(logs: AuditLog[]): string {
  if (!logs.length) {
    return 'No matching events detected in the loaded audit set.'
  }

  const firstLog = logs[0]
  const detail = firstLog.details?.trim() || firstLog.action
  return detail.length > 120 ? `${detail.slice(0, 117)}...` : detail
}

function AuditTrailPanel() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [severityFilter, setSeverityFilter] = useState<'all' | ConcernLevel>('all')
  const [selectedConcernId, setSelectedConcernId] = useState<string>('all')

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
      setError(getErrorMessage(loadError, 'Unable to load audit logs right now.'))
    } finally {
      setIsLoading(false)
    }
  }

  const safeAuditLogs = useMemo(
    () => (Array.isArray(auditLogs) ? auditLogs : []),
    [auditLogs],
  )

  const concernSummaries = useMemo<ConcernSummary[]>(
    () =>
      concernConfigs.map((config) => {
        const matchingLogs = safeAuditLogs.filter(config.matcher)
        const count = matchingLogs.length

        return {
          id: config.id,
          label: config.label,
          note: config.note,
          count,
          level: computeConcernLevel(count),
          attainment: computeAttainment(count),
          sample: getConcernSample(matchingLogs),
        }
      }),
    [safeAuditLogs],
  )

  const filteredConcernSummaries = useMemo(() => {
    return concernSummaries.filter((concern) => {
      const matchesSeverity = severityFilter === 'all' || concern.level === severityFilter
      const matchesConcern = selectedConcernId === 'all' || concern.id === selectedConcernId
      return matchesSeverity && matchesConcern
    })
  }, [concernSummaries, severityFilter, selectedConcernId])

  const averageAttainment = useMemo(() => {
    if (!filteredConcernSummaries.length) {
      return 0
    }

    return (
      filteredConcernSummaries.reduce((sum, concern) => sum + concern.attainment, 0) /
      filteredConcernSummaries.length
    )
  }, [filteredConcernSummaries])

  const watchlistCount = filteredConcernSummaries.filter((concern) => concern.level === 'watch').length
  const attentionCount = filteredConcernSummaries.filter((concern) => concern.level === 'attention').length
  const flaggedIssueCount = filteredConcernSummaries.reduce((sum, concern) => sum + concern.count, 0)
  const performanceBand = getPerformanceBand(averageAttainment)
  const scoreRingDegrees = Math.max(0, Math.min(360, (averageAttainment / 100) * 360))
  const scoreRingStyle = {
    background: `
      radial-gradient(circle at center, #fffef7 0 54%, transparent 55%),
      conic-gradient(#0f766e 0deg ${scoreRingDegrees}deg, rgba(226, 232, 240, 0.9) ${scoreRingDegrees}deg 360deg)
    `,
  }

  const filteredAuditLogs = useMemo(() => {
    const concernMatcher =
      selectedConcernId === 'all'
        ? () => true
        : concernConfigs.find((config) => config.id === selectedConcernId)?.matcher ?? (() => true)

    return safeAuditLogs.filter((log) => {
      if (!concernMatcher(log)) {
        return false
      }

      if (severityFilter === 'all') {
        return true
      }

      if (severityFilter === 'attention') {
        return concernConfigs.some((config) => config.matcher(log))
      }

      if (severityFilter === 'watch') {
        return concernConfigs.some((config) => config.matcher(log))
      }

      return true
    })
  }, [safeAuditLogs, selectedConcernId, severityFilter])

  return (
    <div className="psychometric-page">
      <section className="psychometric-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Governance Monitoring</span>
          <h1>Audit Issues and Concerns</h1>
          <p>
            Monitor high-risk audit themes such as double accounts, insecure API endpoints,
            duplicate APIs, out-of-country sources, and related control concerns from the
            loaded audit event stream.
          </p>
        </div>

        <div className="psychometric-hero-metric">
          <span>Audit Integrity Score</span>
          <strong>{averageAttainment.toFixed(1)}</strong>
          <small>{performanceBand}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Events Reviewed</span>
          <strong>{safeAuditLogs.length}</strong>
          <small>Loaded audit log records</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Issues Flagged</span>
          <strong>{flaggedIssueCount}</strong>
          <small>Total concern hits across monitoring rules</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Watchlist</span>
          <strong>{watchlistCount}</strong>
          <small>Concern areas requiring closer review</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Critical Concerns</span>
          <strong>{attentionCount}</strong>
          <small>Concern areas needing immediate attention</small>
        </article>
      </section>

      <section className="psychometric-layout">
        <div className="psychometric-main">
          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Concern Matrix</span>
                <h2>Issue groups and trigger counts</h2>
              </div>
              <button
                type="button"
                className="psychometric-reset-button"
                onClick={() => void loadAuditLogs()}
                disabled={isLoading}
              >
                {isLoading ? 'Refreshing...' : 'Refresh Logs'}
              </button>
            </div>

            {error ? (
              <p className="psychometric-section-note" role="alert">
                {error}
              </p>
            ) : null}

            <div className="psychometric-question-list">
              <div className="psychometric-question-card">
                <div className="psychometric-question-copy">
                  <span className="psychometric-question-number">1</span>
                  <p>Filter by severity so critical or watchlist issues surface first.</p>
                </div>
                <div className="psychometric-option-grid">
                  {[
                    { id: 'all', label: 'All', note: 'Every level' },
                    { id: 'attention', label: 'Critical', note: 'Immediate review' },
                    { id: 'watch', label: 'Watchlist', note: 'Closer review' },
                    { id: 'maintain', label: 'Controlled', note: 'Low concern' },
                  ].map((option) => {
                    const isActive = severityFilter === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`psychometric-option-button${isActive ? ' psychometric-option-button-active' : ''}`}
                        onClick={() => setSeverityFilter(option.id as 'all' | ConcernLevel)}
                      >
                        <span>{option.label}</span>
                        <strong>{option.note}</strong>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="psychometric-question-card">
                <div className="psychometric-question-copy">
                  <span className="psychometric-question-number">2</span>
                  <p>Focus on one concern family when you want a tighter audit review.</p>
                </div>
                <div className="psychometric-option-grid">
                  <button
                    type="button"
                    className={`psychometric-option-button${selectedConcernId === 'all' ? ' psychometric-option-button-active' : ''}`}
                    onClick={() => setSelectedConcernId('all')}
                  >
                    <span>All Concerns</span>
                    <strong>Full view</strong>
                  </button>
                  {concernConfigs.map((config) => {
                    const isActive = selectedConcernId === config.id
                    return (
                      <button
                        key={config.id}
                        type="button"
                        className={`psychometric-option-button${isActive ? ' psychometric-option-button-active' : ''}`}
                        onClick={() => setSelectedConcernId(config.id)}
                      >
                        <span>{config.label}</span>
                        <strong>Focus</strong>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="psychometric-scale-table-wrap">
              <table className="psychometric-scale-table">
                <thead>
                  <tr>
                    <th>Concern</th>
                    <th>Hits</th>
                    <th>Level</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConcernSummaries.map((concern) => (
                    <tr key={concern.id}>
                      <td>{concern.label}</td>
                      <td>{concern.count}</td>
                      <td>{concern.level === 'maintain' ? 'Controlled' : concern.level === 'watch' ? 'Watch' : 'Attention'}</td>
                    </tr>
                  ))}
                  {filteredConcernSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={3}>No concerns match the selected filters.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>

          <div className="psychometric-sections">
            {filteredConcernSummaries.map((concern) => (
              <article key={concern.id} className="psychometric-section-card">
                <div className="psychometric-section-header">
                  <div>
                    <span className="psychometric-section-code">Concern {concern.id.toUpperCase()}</span>
                    <h3>{concern.label}</h3>
                    <p>{concern.note}</p>
                  </div>

                  <div className="psychometric-section-score">
                    <strong>{concern.count}</strong>
                    <span>{concern.level === 'maintain' ? 'controlled' : concern.level}</span>
                  </div>
                </div>

                <div className="psychometric-progress-track" aria-hidden="true">
                  <div className="psychometric-progress-bar" style={{ width: `${concern.attainment}%` }} />
                </div>

                <div className="psychometric-formula-grid">
                  <div className="psychometric-formula-card">
                    <span>Issue count</span>
                    <strong>{concern.count}</strong>
                  </div>
                  <div className="psychometric-formula-card">
                    <span>Monitoring level</span>
                    <strong>{concern.level === 'maintain' ? 'Controlled' : concern.level === 'watch' ? 'Watch' : 'Attention'}</strong>
                  </div>
                  <div className="psychometric-formula-card psychometric-formula-card-accent">
                    <span>Sample trigger</span>
                    <strong style={{ fontSize: '0.95rem', lineHeight: 1.45 }}>{concern.sample}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Raw Audit Trail</span>
                <h2>Recent mutation and control events</h2>
              </div>
            </div>

            {isLoading ? (
              <p>Loading audit history...</p>
            ) : filteredAuditLogs.length === 0 ? (
              <p className="empty-state">No audit events have been recorded yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLogs.map((auditLog) => (
                      <tr key={auditLog.id}>
                        <td>{auditLog.createdAt}</td>
                        <td>
                          {auditLog.actorUsername
                            ? `${auditLog.actorUsername} (${auditLog.actorRole})`
                            : 'System'}
                        </td>
                        <td>{auditLog.action}</td>
                        <td>
                          {auditLog.entityType}
                          {auditLog.entityId !== null ? ` #${auditLog.entityId}` : ''}
                        </td>
                        <td>{auditLog.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>

        <aside className="psychometric-side-panel">
          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Overall Computation</span>
            <h2>Audit score snapshot</h2>

            <div className="psychometric-score-ring" style={scoreRingStyle}>
              <strong>{averageAttainment.toFixed(1)}</strong>
              <span>/ 100</span>
            </div>

            <ul className="psychometric-breakdown-list">
              <li>
                <span>Audit integrity score</span>
                <strong>{averageAttainment.toFixed(1)}</strong>
              </li>
              <li>
                <span>Performance band</span>
                <strong>{performanceBand}</strong>
              </li>
              <li>
                <span>Watchlist concerns</span>
                <strong>{watchlistCount}</strong>
              </li>
              <li>
                <span>Critical concerns</span>
                <strong>{attentionCount}</strong>
              </li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  )
}

export default AuditTrailPanel
