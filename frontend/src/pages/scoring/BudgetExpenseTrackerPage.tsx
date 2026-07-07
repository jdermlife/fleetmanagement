import { useMemo } from 'react';

import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { buildBudgetExpenseTrackerSnapshot } from './liveTrackerMetrics';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatSignedCurrency(amount: number) {
  const absoluteAmount = formatCurrency(Math.abs(amount));
  if (amount > 0) {
    return `+${absoluteAmount}`;
  }
  if (amount < 0) {
    return `-${absoluteAmount}`;
  }
  return absoluteAmount;
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

export default function BudgetExpenseTrackerPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const snapshot = useMemo(
    () => buildBudgetExpenseTrackerSnapshot(applications),
    [applications],
  );

  return (
    <div className="psychometric-page budget-dashboard-page">
      <section className="psychometric-hero budget-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Household Financial Controls</span>
          <h1>Budget and Expense Tracker</h1>
          <p>
            Period: <strong>{snapshot.periodLabel}</strong> | Date: <strong>{snapshot.dateLabel}</strong>
          </p>
          <p>
            Derived from application data covering declared income, investments, living expenses,
            mortgage amortization, and other debt commitments.
          </p>
        </div>

        <div className="psychometric-hero-metric budget-dashboard-scorecard">
          <span>Budget Health Score</span>
          <strong>{snapshot.healthScore.toFixed(1)}</strong>
          <small>{snapshot.performanceBand}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid budget-dashboard-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Actual MTD</span>
          <strong>{formatCurrency(snapshot.totalKnownExpenses)}</strong>
          <small>Known monthly outflow from source application</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Budget Setup</span>
          <strong>{formatCurrency(snapshot.totalExpenseBudget)}</strong>
          <small>{snapshot.budgetSetupLabel}</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Watchlist</span>
          <strong>{snapshot.watchlistCount + snapshot.needsAttentionCount}</strong>
          <small>Indicators needing review or rebalancing</small>
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
                <span className="psychometric-panel-kicker">Income Setup</span>
                <h2>Application-derived monthly inflow mix</h2>
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
              {snapshot.incomeItems.map((item) => (
                <article key={item.id} className="budget-dashboard-card">
                  <div className="budget-dashboard-card-header">
                    <span>{item.label}</span>
                    <strong>{item.share.toFixed(0)}%</strong>
                  </div>
                  <div className="budget-dashboard-card-value">{formatCurrency(item.amount)}</div>
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
                <span className="psychometric-panel-kicker">Expense Setup</span>
                <h2>Known monthly obligations against budget caps</h2>
              </div>
            </div>

            <div className="budget-dashboard-comparison-grid">
              {snapshot.expenseItems.map((item) => (
                <article key={item.id} className={`budget-dashboard-comparison-card budget-dashboard-status-${item.status}`}>
                  <div className="budget-dashboard-card-header">
                    <span>{item.label}</span>
                    <strong>{getStatusLabel(item.status)}</strong>
                  </div>
                  <div className="budget-dashboard-comparison-values">
                    <div>
                      <small>Actual</small>
                      <strong>{formatCurrency(item.actual)}</strong>
                    </div>
                    <div>
                      <small>Budget</small>
                      <strong>{formatCurrency(item.budget)}</strong>
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
                <span className="psychometric-panel-kicker">Actual vs Budget</span>
                <h2>Monthly comparison and maintain indicators</h2>
              </div>
            </div>

            <div className="psychometric-scale-table-wrap">
              <table className="psychometric-scale-table">
                <thead>
                  <tr>
                    <th>Budget Line</th>
                    <th>Actual</th>
                    <th>Budget</th>
                    <th>Variance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.comparisonItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      <td>{formatCurrency(item.actual)}</td>
                      <td>{formatCurrency(item.budget)}</td>
                      <td>{formatSignedCurrency(item.variance)}</td>
                      <td>{getStatusLabel(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="budget-dashboard-indicator-row">
              {snapshot.indicators.map((indicator) => (
                <article key={indicator.id} className={`budget-dashboard-indicator budget-dashboard-status-${indicator.status}`}>
                  <span>{indicator.label}</span>
                  <strong>
                    {indicator.id.endsWith('coverage')
                      ? `${indicator.value.toFixed(2)}x`
                      : `${indicator.value.toFixed(0)}%`}
                  </strong>
                  <small>
                    Target {indicator.id.endsWith('coverage') ? `${indicator.target.toFixed(2)}x` : `${indicator.target.toFixed(0)}%`}
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
                <span>Total Income</span>
                <strong>{formatCurrency(snapshot.totalIncome)}</strong>
              </li>
              <li>
                <span>Total Known Expenses</span>
                <strong>{formatCurrency(snapshot.totalKnownExpenses)}</strong>
              </li>
              <li>
                <span>Net Cashflow</span>
                <strong>{formatSignedCurrency(snapshot.netCashflow)}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Budget Setup</span>
            <h2>{snapshot.budgetReadyCount} Ready</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Tracked areas</span>
                <strong>{snapshot.trackedAreas}</strong>
              </li>
              <li>
                <span>Maintain</span>
                <strong>{snapshot.budgetReadyCount}</strong>
              </li>
              <li>
                <span>Watchlist</span>
                <strong>{snapshot.watchlistCount}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Expense Logging</span>
            <h2>{snapshot.expenseLoggingLabel}</h2>
            <p className="psychometric-section-note">
              This tracker uses the most recent application with income and expense data as the live monthly source.
            </p>
          </article>
        </aside>
      </section>
    </div>
  );
}
