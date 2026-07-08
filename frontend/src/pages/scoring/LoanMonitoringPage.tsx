import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { buildLoanMonitoringSnapshot } from './liveTrackerMetrics';

function formatMetricValue(value: number, unit: 'percent' | 'days' | 'score' | 'currency' | 'count') {
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
          <span>Loan Health Score</span>
          <strong>{snapshot.healthScore.toFixed(1)}</strong>
          <small>{snapshot.performanceBand}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid loan-monitoring-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Monitored Loans</span>
          <strong>{snapshot.monitoredLoansCount}</strong>
          <small>
            <Link to="/lending-scorecard" className="auth-link-button">
              Add a loan to monitor
            </Link>
          </small>
        </article>

        <article className="psychometric-summary-card">
          <span>Available Credit</span>
          <strong>{formatMetricValue(snapshot.availableCredit, 'currency')}</strong>
          <small>Derived from application steps 1 to 8 and lending capacity controls</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Number of Past Dues</span>
          <strong>{snapshot.pastDueCount}</strong>
          <small>Projected elapsed installments from the monitored loan statement</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Loan Market</span>
          <strong>{snapshot.loanMarket}</strong>
          <small>{snapshot.sourceRecordStatus}</small>
        </article>
      </section>

      <section className="budget-dashboard-layout">
        <div className="budget-dashboard-main">
          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Loan Statement</span>
                <h2>Borrower running balance and installment schedule</h2>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link to="/lending-scorecard" className="auth-link-button">
                  Loan Setup
                </Link>
                <button
                  type="button"
                  className="psychometric-reset-button"
                  onClick={reload}
                  disabled={loading}
                >
                  {loading ? 'Refreshing...' : 'Refresh Data'}
                </button>
              </div>
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

            <div className="psychometric-scale-table-wrap">
              <table className="psychometric-scale-table">
                <thead>
                  <tr>
                    <th>Month/Year</th>
                    <th>Total Running Balance from Previous Month</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>End Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.statementRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.monthLabel}</td>
                      <td>{formatMetricValue(row.previousBalance, 'currency')}</td>
                      <td>{formatMetricValue(row.principal, 'currency')}</td>
                      <td>{formatMetricValue(row.interest, 'currency')}</td>
                      <td>{formatMetricValue(row.endBalance, 'currency')}</td>
                    </tr>
                  ))}
                  {snapshot.statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No loan statement available yet. Use Loan Setup to create or complete an application.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>

          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Loan Controls</span>
                <h2>Borrower payment and capacity controls</h2>
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
                <span className="psychometric-panel-kicker">Loan Health Indicators</span>
                <h2>Borrower indicators to maintain and review</h2>
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
                <span>Loan amount</span>
                <strong>{formatMetricValue(snapshot.totalRequestedAmount, 'currency')}</strong>
              </li>
              <li>
                <span>Monthly payment</span>
                <strong>{formatMetricValue(snapshot.monthlyPayment, 'currency')}</strong>
              </li>
              <li>
                <span>End balance</span>
                <strong>{formatMetricValue(snapshot.endBalance, 'currency')}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Loan Market</span>
            <h2>{snapshot.loanMarket}</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Loan health score</span>
                <strong>{snapshot.healthScore.toFixed(1)}</strong>
              </li>
              <li>
                <span>Past dues</span>
                <strong>{snapshot.pastDueCount}</strong>
              </li>
              <li>
                <span>Status</span>
                <strong>{snapshot.sourceRecordStatus}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Monitoring Notes</span>
            <h2>Borrower tool focus</h2>
            <p className="psychometric-section-note">
              Available credit is estimated from application fields across the lending workflow, and the
              loan statement is projected from the monitored loan amount, rate, and term when no payment
              ledger is available yet.
            </p>
          </article>
        </aside>
      </section>
    </div>
  );
}
