import { useMemo } from 'react';

import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { buildLoanMonitoringSnapshot } from './liveTrackerMetrics';

function formatMetricValue(value: number, unit: 'percent' | 'days' | 'score') {
  if (unit === 'days') {
    return `${value.toFixed(1)} days`;
  }

  if (unit === 'score') {
    return value.toFixed(1);
  }

  return `${value.toFixed(0)}%`;
}

function getStatusLabel(status: 'maintain' | 'watch' | 'attention') {
  if (status === 'maintain') {
    return 'Maintain';
  }
  if (status === 'watch') {
    return 'Watch';
  }
  return 'Needs Attention';
}

export default function LoanMonitoringPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const snapshot = useMemo(
    () => buildLoanMonitoringSnapshot(applications),
    [applications],
  );

  return (
    <div className="psychometric-page loan-monitoring-dashboard-page">
      <section className="psychometric-hero loan-monitoring-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Loan Performance Oversight</span>
          <h1>Loan Monitoring</h1>
          <p>
            Period: <strong>{snapshot.periodLabel}</strong> | Date: <strong>{snapshot.dateLabel}</strong>
          </p>
          <p>
            Built from live loan statuses, DSR, LTV, decision outcomes, and pipeline aging indicators
            using portfolio-monitoring best practices.
          </p>
        </div>

        <div className="psychometric-hero-metric loan-monitoring-dashboard-scorecard">
          <span>Portfolio Health Score</span>
          <strong>{snapshot.healthScore.toFixed(1)}</strong>
          <small>{snapshot.performanceBand}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid loan-monitoring-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Monitored Accounts</span>
          <strong>{snapshot.portfolioCount}</strong>
          <small>Total loan records in the live portfolio view</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Open Pipeline</span>
          <strong>{snapshot.openPipelineCount}</strong>
          <small>Submitted and review-stage applications</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Watchlist</span>
          <strong>{snapshot.watchlistCount + snapshot.attentionCount}</strong>
          <small>Records needing closer monitoring or escalation</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Performance Band</span>
          <strong>{snapshot.performanceBand}</strong>
          <small>{snapshot.healthScore} / 100 weighted score</small>
        </article>
      </section>

      <section className="budget-dashboard-layout">
        <div className="budget-dashboard-main">
          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Pipeline Distribution</span>
                <h2>Portfolio stage mix and operational queue balance</h2>
              </div>
              <button
                type="button"
                className="psychometric-reset-button"
                onClick={reload}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>

            {error ? (
              <p className="psychometric-section-note" role="alert">
                {error}
              </p>
            ) : null}

            <p className="psychometric-section-note">
              {snapshot.sourceLabel} | {snapshot.sourceApplicationNo}
              {lastUpdated ? ` | Updated ${lastUpdated.toLocaleString()}` : ''}
            </p>

            <div className="budget-dashboard-card-grid">
              {snapshot.pipelineItems.map((item) => (
                <article key={item.id} className={`budget-dashboard-card budget-dashboard-status-${item.status}`}>
                  <div className="budget-dashboard-card-header">
                    <span>{item.label}</span>
                    <strong>{item.share.toFixed(0)}%</strong>
                  </div>
                  <div className="budget-dashboard-card-value">{item.count}</div>
                  <div className="psychometric-progress-track budget-dashboard-progress-track" aria-hidden="true">
                    <div className="psychometric-progress-bar" style={{ width: `${item.share}%` }} />
                  </div>
                  <p>{item.note}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Policy Control</span>
                <h2>Actual vs target monitoring controls</h2>
              </div>
            </div>

            <div className="psychometric-scale-table-wrap">
              <table className="psychometric-scale-table">
                <thead>
                  <tr>
                    <th>Control</th>
                    <th>Actual</th>
                    <th>Target</th>
                    <th>Variance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.controlItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      <td>{formatMetricValue(item.actual, item.unit)}</td>
                      <td>{formatMetricValue(item.target, item.unit)}</td>
                      <td>{formatMetricValue(item.variance, item.unit)}</td>
                      <td>{getStatusLabel(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="budget-dashboard-comparison-grid">
              {snapshot.controlItems.map((item) => (
                <article key={item.id} className={`budget-dashboard-comparison-card budget-dashboard-status-${item.status}`}>
                  <div className="budget-dashboard-card-header">
                    <span>{item.label}</span>
                    <strong>{getStatusLabel(item.status)}</strong>
                  </div>
                  <div className="budget-dashboard-comparison-values">
                    <div>
                      <small>Actual</small>
                      <strong>{formatMetricValue(item.actual, item.unit)}</strong>
                    </div>
                    <div>
                      <small>Target</small>
                      <strong>{formatMetricValue(item.target, item.unit)}</strong>
                    </div>
                  </div>
                  <div className="psychometric-progress-track budget-dashboard-progress-track" aria-hidden="true">
                    <div className="psychometric-progress-bar" style={{ width: `${Math.min(item.attainment, 100)}%` }} />
                  </div>
                  <p>{item.note}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Early Warning Indicators</span>
                <h2>Indicators to maintain and escalate</h2>
              </div>
            </div>

            <div className="budget-dashboard-indicator-row">
              {snapshot.indicators.map((indicator) => (
                <article key={indicator.id} className={`budget-dashboard-indicator budget-dashboard-status-${indicator.status}`}>
                  <span>{indicator.label}</span>
                  <strong>
                    {indicator.id === 'avg-open-age' || indicator.id === 'average-final-score'
                      ? indicator.id === 'avg-open-age'
                        ? `${indicator.value.toFixed(1)} days`
                        : indicator.value.toFixed(1)
                      : `${indicator.value.toFixed(0)}%`}
                  </strong>
                  <small>
                    Target {indicator.id === 'avg-open-age' || indicator.id === 'average-final-score'
                      ? indicator.id === 'avg-open-age'
                        ? `${indicator.target.toFixed(1)} days`
                        : indicator.target.toFixed(1)
                      : `${indicator.target.toFixed(0)}%`}
                  </small>
                  <p>{indicator.note}</p>
                </article>
              ))}
            </div>
          </article>
        </div>

        <aside className="budget-dashboard-side">
          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Action</span>
            <h2>{snapshot.actionLabel}</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Open pipeline</span>
                <strong>{snapshot.openPipelineCount}</strong>
              </li>
              <li>
                <span>Average open age</span>
                <strong>{snapshot.averageOpenAgeDays.toFixed(1)} days</strong>
              </li>
              <li>
                <span>Released</span>
                <strong>{snapshot.releasedCount}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Risk Posture</span>
            <h2>{snapshot.performanceBand}</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Watchlist</span>
                <strong>{snapshot.watchlistCount}</strong>
              </li>
              <li>
                <span>Needs attention</span>
                <strong>{snapshot.attentionCount}</strong>
              </li>
              <li>
                <span>Average final score</span>
                <strong>{snapshot.averageFinalScore.toFixed(1)}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Monitoring Notes</span>
            <h2>Best-practice focus</h2>
            <p className="psychometric-section-note">
              This page prioritizes pipeline aging, underwriting policy compliance, concentration control,
              and early-warning watchlist signals instead of only headline approval percentages.
            </p>
          </article>
        </aside>
      </section>
    </div>
  );
}
