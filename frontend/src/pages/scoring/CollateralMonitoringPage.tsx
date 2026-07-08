import { useMemo } from 'react';

import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { buildCollateralMonitoringSnapshot } from './liveTrackerMetrics';

function formatPercent(value: number) {
  return `${value.toFixed(0)}%`;
}

function formatMetric(value: number, unit: 'percent' | 'days' | 'score' | 'currency' | 'count') {
  if (unit === 'currency') {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (unit === 'count') {
    return value.toFixed(0);
  }
  if (unit === 'days') {
    return `${value.toFixed(1)} days`;
  }
  if (unit === 'score') {
    return value.toFixed(1);
  }
  return formatPercent(value);
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

export default function CollateralMonitoringPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const snapshot = useMemo(
    () => buildCollateralMonitoringSnapshot(applications),
    [applications],
  );

  return (
    <div className="psychometric-page collateral-dashboard-page">
      <section className="psychometric-hero collateral-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Collateral Governance</span>
          <h1>Collateral Monitoring</h1>
          <p>
            Period: <strong>{snapshot.periodLabel}</strong> | Date: <strong>{snapshot.dateLabel}</strong>
          </p>
          <p>
            Built from live LTV, insurance, marketability, and asset-quality signals to support secured-lending
            monitoring and exception handling.
          </p>
        </div>

        <div className="psychometric-hero-metric collateral-dashboard-scorecard">
          <span>Collateral Integrity Score</span>
          <strong>{snapshot.healthScore.toFixed(1)}</strong>
          <small>{snapshot.performanceBand}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Collateralized Records</span>
          <strong>{snapshot.collateralizedCount}</strong>
          <small>Records with collateral valuation or LTV data</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Insured</span>
          <strong>{snapshot.insuredCount}</strong>
          <small>Collateral records with insurance support captured</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Watchlist</span>
          <strong>{snapshot.watchlistCount + snapshot.attentionCount}</strong>
          <small>Collateral records needing mitigation or escalation</small>
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
                <span className="psychometric-panel-kicker">Collateral Inventory</span>
                <h2>Coverage mix and collateral condition visibility</h2>
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
              {snapshot.inventoryItems.map((item) => (
                <article key={item.id} className={`budget-dashboard-card budget-dashboard-status-${item.status}`}>
                  <div className="budget-dashboard-card-header">
                    <span>{item.label}</span>
                    <strong>{formatPercent(item.share)}</strong>
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
                <span className="psychometric-panel-kicker">Control Metrics</span>
                <h2>Actual vs target collateral controls</h2>
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
                      <td>{formatMetric(item.actual, item.unit)}</td>
                      <td>{formatMetric(item.target, item.unit)}</td>
                      <td>{formatMetric(item.variance, item.unit)}</td>
                      <td>{getStatusLabel(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Early Warning</span>
                <h2>Indicators to maintain and escalate</h2>
              </div>
            </div>

            <div className="budget-dashboard-indicator-row">
              {snapshot.indicators.map((indicator) => (
                <article key={indicator.id} className={`budget-dashboard-indicator budget-dashboard-status-${indicator.status}`}>
                  <span>{indicator.label}</span>
                  <strong>{indicator.id === 'overall-collateral-score' ? indicator.value.toFixed(1) : formatPercent(indicator.value)}</strong>
                  <small>Target {indicator.id === 'overall-collateral-score' ? indicator.target.toFixed(1) : formatPercent(indicator.target)}</small>
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
                <span>Collateralized</span>
                <strong>{snapshot.collateralizedCount}</strong>
              </li>
              <li>
                <span>Average LTV</span>
                <strong>{formatPercent(snapshot.averageLtv)}</strong>
              </li>
              <li>
                <span>Insured</span>
                <strong>{snapshot.insuredCount}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Coverage Quality</span>
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
                <span>Average collateral score</span>
                <strong>{snapshot.averageCollateralScore.toFixed(1)}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Collateral Notes</span>
            <h2>Best-practice focus</h2>
            <p className="psychometric-section-note">
              This page emphasizes safe leverage, insurance completeness, marketability evidence, and
              blocker exposure so collateral issues surface before release-stage decisions.
            </p>
          </article>
        </aside>
      </section>
    </div>
  );
}
