import { useEffect, useMemo, useState } from 'react';
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

function getControlActual(snapshot: ReturnType<typeof buildLoanMonitoringSnapshot>, controlId: string) {
  return snapshot.controlItems.find((item) => item.id === controlId)?.actual ?? 0;
}

function getIndicatorValue(snapshot: ReturnType<typeof buildLoanMonitoringSnapshot>, indicatorId: string) {
  return snapshot.indicators.find((item) => item.id === indicatorId)?.value ?? 0;
}

function buildAiAdvisor(snapshot: ReturnType<typeof buildLoanMonitoringSnapshot>) {
  const dsr = getControlActual(snapshot, 'dsr-control');
  const ltv = getControlActual(snapshot, 'ltv-control');
  const monthlyPayment = getControlActual(snapshot, 'monthly-payment');
  const availableCredit = getControlActual(snapshot, 'available-credit');
  const finalScore = getIndicatorValue(snapshot, 'final-score');
  const availableCreditRatio = getIndicatorValue(snapshot, 'available-credit-ratio');

  const interestStatus: 'maintain' | 'watch' | 'attention' =
    snapshot.pastDueCount > 0 ? 'attention' : availableCreditRatio >= 10 ? 'watch' : 'maintain';
  const interestAdvice =
    snapshot.pastDueCount > 0
      ? 'Bring projected past dues current first, then redirect extra cash to principal so new interest stops compounding on a higher balance.'
      : availableCredit > 0 && availableCreditRatio >= 10
        ? 'You still have borrowing headroom, but the better savings move is to avoid drawing it and apply spare cash to principal prepayments whenever allowed.'
        : monthlyPayment > 0
          ? 'Keep paying above the projected monthly installment when possible, prioritize principal reduction early, and avoid extending the term unless cashflow is under pressure.'
          : 'Complete the loan setup first so an interest-saving plan can be computed from the amount, term, and rate.';

  const dsrAdvisorStatus: 'maintain' | 'watch' | 'attention' =
    dsr <= 35 ? 'maintain' : dsr <= 50 ? 'watch' : 'attention';
  const dsrStatus =
    dsr <= 35
      ? 'DSR status: improving. The current debt-service load is in the stronger zone and suggests repayment capacity is still healthy.'
      : dsr <= 50
        ? 'DSR status: stable but watch closely. The debt-service load is still within an acceptable range, but tighter expense control would help preserve resilience.'
        : 'DSR status: deteriorating. The debt-service load is above the prudent range and should be improved through expense reduction, income support, or loan restructuring.';

  const refinancingStatus: 'maintain' | 'watch' | 'attention' =
    snapshot.pastDueCount === 0 && dsr <= 40 && ltv <= 80 && finalScore >= 75
      ? 'maintain'
      : snapshot.pastDueCount <= 1 && dsr <= 50 && ltv <= 90 && finalScore >= 65
        ? 'watch'
        : 'attention';
  const refinancingQuality =
    snapshot.pastDueCount === 0 && dsr <= 40 && ltv <= 80 && finalScore >= 75
      ? 'Quality of refinancing: strong. Current balance-sheet and application signals suggest the loan could qualify for better repricing or term optimization.'
      : snapshot.pastDueCount <= 1 && dsr <= 50 && ltv <= 90 && finalScore >= 65
        ? 'Quality of refinancing: moderate. Refinancing may still be viable, but better results will depend on improving repayment posture and documentation quality.'
        : 'Quality of refinancing: weak for now. Focus first on lowering debt-service stress, avoiding new dues, and strengthening the application profile before refinancing.';

  return {
    interestAdvice: {
      text: interestAdvice,
      status: interestStatus,
    },
    dsrStatus: {
      text: dsrStatus,
      status: dsrAdvisorStatus,
    },
    refinancingQuality: {
      text: refinancingQuality,
      status: refinancingStatus,
    },
  };
}

export default function LoanMonitoringPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const monitoredApplications = useMemo(
    () =>
      applications.filter(
        (record) => Number.isFinite(record.loan_amount) && record.loan_amount > 0 && Number.isFinite(record.term_months) && record.term_months > 0,
      ),
    [applications],
  );
  const [selectedApplicationNo, setSelectedApplicationNo] = useState('');

  useEffect(() => {
    if (!monitoredApplications.length) {
      setSelectedApplicationNo('');
      return;
    }

    if (!selectedApplicationNo || !monitoredApplications.some((record) => record.application_no === selectedApplicationNo)) {
      setSelectedApplicationNo(monitoredApplications[0]?.application_no ?? '');
    }
  }, [monitoredApplications, selectedApplicationNo]);

  const snapshot = useMemo(
    () => buildLoanMonitoringSnapshot(applications, selectedApplicationNo),
    [applications, selectedApplicationNo],
  );
  const advisor = useMemo(
    () => buildAiAdvisor(snapshot),
    [snapshot],
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
          <span>Product Type</span>
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

            <div className="budget-dashboard-category-summary" style={{ marginBottom: '18px' }}>
              <div className="budget-dashboard-category-summary-card">
                <span>Application Reference Number</span>
                <strong>{snapshot.sourceApplicationNo}</strong>
              </div>
              <div className="budget-dashboard-category-summary-card">
                <span>Choose Loan / Application Reference</span>
                <select
                  value={selectedApplicationNo}
                  onChange={(event) => setSelectedApplicationNo(event.target.value)}
                  disabled={monitoredApplications.length <= 1}
                  className="budget-dashboard-category-input"
                  aria-label="Choose loan or application reference number"
                >
                  {monitoredApplications.map((record) => (
                    <option key={record.application_no} value={record.application_no}>
                      {record.application_no}
                    </option>
                  ))}
                  {monitoredApplications.length === 0 ? (
                    <option value="">No application reference available</option>
                  ) : null}
                </select>
              </div>
              <div className="budget-dashboard-category-summary-card">
                <span>Current Status</span>
                <strong>{snapshot.sourceRecordStatus}</strong>
              </div>
            </div>

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
            <span className="psychometric-panel-kicker">Product Type</span>
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

      <section className="psychometric-panel">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">AI Advisor</span>
            <h2>Borrower guidance from the monitored loan</h2>
          </div>
        </div>

        <div className="budget-dashboard-indicator-row">
          <article className={`budget-dashboard-indicator budget-dashboard-status-${advisor.interestAdvice.status}`}>
            <span>Ways to Save Interest</span>
            <strong>Interest Strategy</strong>
            <p>{advisor.interestAdvice.text}</p>
          </article>

          <article className={`budget-dashboard-indicator budget-dashboard-status-${advisor.dsrStatus.status}`}>
            <span>DSR Status</span>
            <strong>Capacity Trend</strong>
            <p>{advisor.dsrStatus.text}</p>
          </article>

          <article className={`budget-dashboard-indicator budget-dashboard-status-${advisor.refinancingQuality.status}`}>
            <span>Quality of Refinancing</span>
            <strong>Refinancing View</strong>
            <p>{advisor.refinancingQuality.text}</p>
          </article>
        </div>
      </section>
    </div>
  );
}
