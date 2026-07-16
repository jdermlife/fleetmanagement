import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { buildLoanMonitoringSnapshot } from './liveTrackerMetrics';

type WorkflowStep = 1 | 2 | 3 | 4 | 5;

interface AdditionalLoanStatementRow {
  id: string;
  monthLabel: string;
  previousBalance: number;
  principal: number;
  interest: number;
  endBalance: number;
}

interface AdditionalLoanSchedule {
  id: string;
  loanAmount: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  rows: AdditionalLoanStatementRow[];
}

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
  const { applications } = useLoanApplicationsMetrics();
  const monitoredApplications = useMemo(
    () =>
      applications.filter(
        (record) => Number.isFinite(record.loan_amount) && record.loan_amount > 0 && Number.isFinite(record.term_months) && record.term_months > 0,
      ),
    [applications],
  );
  const [selectedApplicationNo, setSelectedApplicationNo] = useState('');
  const [additionalSchedules] = useState<AdditionalLoanSchedule[]>([]);
  const [step, setStep] = useState<WorkflowStep>(1);
  
  // Step 1: Loan Master
  const [loanName, setLoanName] = useState('');
  const [loanType, setLoanType] = useState('');
  const [lender, setLender] = useState('');
  const [borrower, setBorrower] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [dateGranted, setDateGranted] = useState('');
  const [interestRateForMaster, setInterestRateForMaster] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState('Monthly');
  const [maturity, setMaturity] = useState('');
  
  // Step 2: Loan Accounts (auto-generated)
  const loanAccounts = [
    'Outstanding Principal',
    'Interest Expense',
    'Penalty Charges',
    'Insurance',
    'Processing Fees',
    'Monthly Amortization',
    'Advance Payments',
    'Loan Balance',
    'Remaining Interest',
  ];

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

  const workflowSteps: Array<{ id: WorkflowStep; label: string; description: string }> = [
    {
      id: 1,
      label: 'Loan Master',
      description: 'Define the loan with core details.',
    },
    {
      id: 2,
      label: 'Loan Accounts',
      description: 'View auto-generated loan subaccounts.',
    },
    {
      id: 3,
      label: 'Payment Schedule',
      description: 'View automatically generated installments.',
    },
    {
      id: 4,
      label: 'Monthly Monitoring',
      description: 'Monitor monthly payment workflow.',
    },
    {
      id: 5,
      label: 'AI Recommendations',
      description: 'Get AI-driven insights and strategies.',
    },
  ];

  const currentStepLabel = workflowSteps.find((item) => item.id === step)?.label ?? 'Loan Workflow';
  const stepperButtonClass = 'loan-stepper-button';

  return (
    <div className="psychometric-page loan-monitoring-dashboard-page">
      <section className="psychometric-hero loan-monitoring-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Loan Performance Oversight</span>
          <h1>Loan Monitoring</h1>
          <p>
            Period: <strong>{snapshot.dateLabel}</strong>
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

      <section className="psychometric-summary-grid" style={{ marginBottom: '12px' }}>
        <small>{`Step ${step}/${workflowSteps.length}: ${currentStepLabel}`}</small>
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
        {step === 1 ? (
          <div className="budget-dashboard-main">
            <article className="psychometric-panel">
              <div className="psychometric-panel-header">
                <div>
                  <span className="psychometric-panel-kicker">Step 1</span>
                  <h2>Loan Master</h2>
                </div>
              </div>

              <p className="psychometric-section-note">
                Define the loan with core details. Created once.
              </p>

              <div className="budget-dashboard-category-summary">
                <label className="budget-dashboard-category-summary-card">
                  <span>Loan Name</span>
                  <input
                    type="text"
                    value={loanName}
                    onChange={(event) => setLoanName(event.target.value)}
                    className="budget-dashboard-category-input"
                    placeholder="e.g., Toyota Auto Loan"
                  />
                </label>
                <label className="budget-dashboard-category-summary-card">
                  <span>Loan Type</span>
                  <select
                    value={loanType}
                    onChange={(event) => setLoanType(event.target.value)}
                    className="budget-dashboard-category-input"
                  >
                    <option value="">Select Loan Type</option>
                    <option value="Auto Loan">Auto Loan</option>
                    <option value="Home Loan">Home Loan</option>
                    <option value="Personal Loan">Personal Loan</option>
                    <option value="Business Loan">Business Loan</option>
                    <option value="Student Loan">Student Loan</option>
                    <option value="Mortgage">Mortgage</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label className="budget-dashboard-category-summary-card">
                  <span>Lender</span>
                  <input
                    type="text"
                    value={lender}
                    onChange={(event) => setLender(event.target.value)}
                    className="budget-dashboard-category-input"
                    placeholder="e.g., BDO"
                  />
                </label>
                <label className="budget-dashboard-category-summary-card">
                  <span>Borrower</span>
                  <input
                    type="text"
                    value={borrower}
                    onChange={(event) => setBorrower(event.target.value)}
                    className="budget-dashboard-category-input"
                    placeholder="e.g., Jorge Dioneda"
                  />
                </label>
                <label className="budget-dashboard-category-summary-card">
                  <span>Original Amount</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={originalAmount}
                    onChange={(event) => setOriginalAmount(event.target.value)}
                    className="budget-dashboard-category-input"
                    placeholder="₱1,500,000"
                  />
                </label>
                <label className="budget-dashboard-category-summary-card">
                  <span>Date Granted</span>
                  <input
                    type="date"
                    value={dateGranted}
                    onChange={(event) => setDateGranted(event.target.value)}
                    className="budget-dashboard-category-input"
                  />
                </label>
                <label className="budget-dashboard-category-summary-card">
                  <span>Interest Rate (%)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={interestRateForMaster}
                    onChange={(event) => setInterestRateForMaster(event.target.value)}
                    className="budget-dashboard-category-input"
                    placeholder="8.5"
                  />
                </label>
                <label className="budget-dashboard-category-summary-card">
                  <span>Payment Frequency</span>
                  <select
                    value={paymentFrequency}
                    onChange={(event) => setPaymentFrequency(event.target.value)}
                    className="budget-dashboard-category-input"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Semi-Annual">Semi-Annual</option>
                    <option value="Annual">Annual</option>
                    <option value="Bi-Weekly">Bi-Weekly</option>
                  </select>
                </label>
                <label className="budget-dashboard-category-summary-card">
                  <span>Maturity Date</span>
                  <input
                    type="date"
                    value={maturity}
                    onChange={(event) => setMaturity(event.target.value)}
                    className="budget-dashboard-category-input"
                  />
                </label>
              </div>

              <div className="budget-workflow-inline-actions">
                <button
                  type="button"
                  className="psychometric-reset-button"
                  onClick={() => {
                    setLoanName('');
                    setLoanType('');
                    setLender('');
                    setBorrower('');
                    setOriginalAmount('');
                    setDateGranted('');
                    setInterestRateForMaster('');
                    setPaymentFrequency('Monthly');
                    setMaturity('');
                  }}
                >
                  Clear Form
                </button>
                <button
                  type="button"
                  className="psychometric-reset-button"
                  onClick={() => {
                    if (loanName && loanType && lender && originalAmount && dateGranted) {
                      alert(`Loan Master "${loanName}" created successfully.`);
                    } else {
                      alert('Please fill in required fields: Loan Name, Type, Lender, Amount, and Date Granted.');
                    }
                  }}
                >
                  Save Loan Master
                </button>
              </div>
            </article>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="budget-dashboard-main">
            <article className="psychometric-panel">
              <div className="psychometric-panel-header">
                <div>
                  <span className="psychometric-panel-kicker">Step 2</span>
                  <h2>Loan Accounts</h2>
                </div>
              </div>

              <p className="psychometric-section-note">
                Auto-generated subaccounts created from the Loan Master. These accounts track all aspects of the loan lifecycle.
              </p>

              {loanName ? (
                <div className="psychometric-scale-table-wrap">
                  <h3>{loanName}</h3>
                  <table className="psychometric-scale-table">
                    <thead>
                      <tr>
                        <th>Account Name</th>
                        <th>Description</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loanAccounts.map((account, index) => (
                        <tr key={index}>
                          <td data-label="Account Name">{account}</td>
                          <td data-label="Description">
                            {account === 'Outstanding Principal' && 'Remaining principal balance'}
                            {account === 'Interest Expense' && 'Accumulated interest charges'}
                            {account === 'Penalty Charges' && 'Late payment penalties'}
                            {account === 'Insurance' && 'Loan protection insurance'}
                            {account === 'Processing Fees' && 'Loan origination and processing fees'}
                            {account === 'Monthly Amortization' && 'Regular monthly payment'}
                            {account === 'Advance Payments' && 'Payments made ahead of schedule'}
                            {account === 'Loan Balance' && 'Current total loan balance'}
                            {account === 'Remaining Interest' && 'Interest yet to be accrued'}
                          </td>
                          <td data-label="Status">
                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>Active</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="psychometric-section-note" style={{ padding: '20px', textAlign: 'center' }}>
                  <p>Complete Step 1 (Loan Master) to generate loan accounts automatically.</p>
                </div>
              )}
            </article>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="budget-dashboard-main">
            <article className="psychometric-panel">
              <div className="psychometric-panel-header">
                <div>
                  <span className="psychometric-panel-kicker">Step 3</span>
                  <h2>Payment Schedule</h2>
                </div>
              </div>

              <p className="psychometric-section-note">
                Automatically generated installment schedule showing all monthly payments with due dates, principal, interest, and remaining balance.
              </p>

              {snapshot.statementRows.length > 0 ? (
                <div className="psychometric-scale-table-wrap">
                  <table className="psychometric-scale-table">
                    <thead>
                      <tr>
                        <th>Installment</th>
                        <th>Due Date</th>
                        <th>Principal</th>
                        <th>Interest</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.statementRows.slice(0, 60).map((row, index) => (
                        <tr key={row.id}>
                          <td data-label="Installment">{index + 1}</td>
                          <td data-label="Due Date">{row.monthLabel}</td>
                          <td data-label="Principal">{formatMetricValue(row.principal, 'currency')}</td>
                          <td data-label="Interest">{formatMetricValue(row.interest, 'currency')}</td>
                          <td data-label="Balance">{formatMetricValue(row.endBalance, 'currency')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="psychometric-section-note" style={{ padding: '20px', textAlign: 'center' }}>
                  <p>Complete Steps 1 & 2 (Loan Master and Loan Accounts) to generate the payment schedule.</p>
                </div>
              )}

              {additionalSchedules.map((schedule) => (
                <div key={schedule.id} className="psychometric-scale-table-wrap" style={{ marginTop: '20px' }}>
                  <h3>{`${schedule.id} Schedule - ${formatMetricValue(schedule.loanAmount, 'currency')}`}</h3>
                  <p className="psychometric-section-note">
                    Term: {schedule.termMonths} months | Interest Rate: {schedule.interestRate.toFixed(2)}% | Monthly: {formatMetricValue(schedule.monthlyPayment, 'currency')}
                  </p>
                  <table className="psychometric-scale-table">
                    <thead>
                      <tr>
                        <th>Installment</th>
                        <th>Due Date</th>
                        <th>Principal</th>
                        <th>Interest</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.rows.map((row, index) => (
                        <tr key={row.id}>
                          <td data-label="Installment">{index + 1}</td>
                          <td data-label="Due Date">{row.monthLabel}</td>
                          <td data-label="Principal">{formatMetricValue(row.principal, 'currency')}</td>
                          <td data-label="Interest">{formatMetricValue(row.interest, 'currency')}</td>
                          <td data-label="Balance">{formatMetricValue(row.endBalance, 'currency')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </article>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="budget-dashboard-main">
            <article className="psychometric-panel">
              <div className="psychometric-panel-header">
                <div>
                  <span className="psychometric-panel-kicker">Step 4</span>
                  <h2>Monthly Monitoring</h2>
                </div>
              </div>

              <p className="psychometric-section-note">
                Track monthly payment workflow: Payment Due → Reminder → User Pays → Upload Receipt → Balance Updated → Credit Score Updated → Financial Health Updated
              </p>

              <div className="budget-dashboard-indicator-row">
                <article className="budget-dashboard-indicator budget-dashboard-status-maintain">
                  <span>1. Payment Due</span>
                  <strong>Status: Current</strong>
                  <p>Next payment is due on the scheduled date</p>
                </article>
                <article className="budget-dashboard-indicator budget-dashboard-status-maintain">
                  <span>2. Reminder</span>
                  <strong>Notification Sent</strong>
                  <p>Email/SMS reminder sent 10 days before due date</p>
                </article>
                <article className="budget-dashboard-indicator budget-dashboard-status-maintain">
                  <span>3. User Pays</span>
                  <strong>Payment Required</strong>
                  <p>Make payment through your bank or payment platform</p>
                </article>
              </div>

              <div className="budget-dashboard-indicator-row" style={{ marginTop: '16px' }}>
                <article className="budget-dashboard-indicator budget-dashboard-status-watch">
                  <span>4. Upload Receipt</span>
                  <strong>Pending</strong>
                  <p>Upload proof of payment for record keeping</p>
                </article>
                <article className="budget-dashboard-indicator budget-dashboard-status-maintain">
                  <span>5. Balance Updated</span>
                  <strong>Automatic</strong>
                  <p>Loan balance and accounts automatically updated</p>
                </article>
                <article className="budget-dashboard-indicator budget-dashboard-status-maintain">
                  <span>6. Score Updated</span>
                  <strong>Automatic</strong>
                  <p>Credit score recalculated based on payment history</p>
                </article>
              </div>

              <div className="budget-dashboard-indicator-row" style={{ marginTop: '16px' }}>
                <article className="budget-dashboard-indicator budget-dashboard-status-maintain" style={{ flex: '1 1 100%' }}>
                  <span>7. Financial Health Updated</span>
                  <strong>Complete</strong>
                  <p>Overall financial health score refreshed with latest payment and loan data</p>
                </article>
              </div>
            </article>
          </div>
        ) : null}
      </section>

      <section className="psychometric-panel">
        {step === 5 ? (
          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Step 5</span>
                <h2>AI Recommendations</h2>
              </div>
            </div>

            <p className="psychometric-section-note">
              Continuous AI-driven recommendations for loan optimization and financial improvement opportunities.
            </p>

            <div className="budget-dashboard-indicator-row">
              <article className={`budget-dashboard-indicator budget-dashboard-status-${advisor.interestAdvice.status}`}>
                <span>Interest Too High?</span>
                <strong>Interest Review</strong>
                <p>{advisor.interestAdvice.text}</p>
              </article>

              <article className={`budget-dashboard-indicator budget-dashboard-status-${advisor.refinancingQuality.status}`}>
                <span>Refinancing Options</span>
                <strong>Rate Optimization</strong>
                <p>{advisor.refinancingQuality.text}</p>
              </article>

              <article className={`budget-dashboard-indicator budget-dashboard-status-${advisor.dsrStatus.status}`}>
                <span>Debt Consolidation</span>
                <strong>Consolidation View</strong>
                <p>{advisor.dsrStatus.text}</p>
              </article>
            </div>

            <div className="budget-dashboard-indicator-row" style={{ marginTop: '16px' }}>
              <article className="budget-dashboard-indicator budget-dashboard-status-watch">
                <span>Early Settlement</span>
                <strong>Settlement Analysis</strong>
                <p>Evaluate the benefits of paying off this loan early to save on interest expenses</p>
              </article>

              <article className="budget-dashboard-indicator budget-dashboard-status-maintain">
                <span>Borrowing Capacity</span>
                <strong>Capacity Assessment</strong>
                <p>Your current loan balance and payment history determine your available borrowing capacity</p>
              </article>
            </div>
          </article>
        ) : null}
      </section>

      <section style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {workflowSteps.map((workflowStep) => {
          const isActive = step === workflowStep.id;
          return (
            <button
              key={workflowStep.id}
              type="button"
              onClick={() => setStep(workflowStep.id)}
              className={`${stepperButtonClass} lending-psychometric-step-button ${isActive ? 'loan-stepper-button-active border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'loan-stepper-button-idle border-gray-200 bg-white hover:border-blue-400 hover:text-blue-600'}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <div>
                <span>{`Step ${workflowStep.id}`}</span>
                <strong>{workflowStep.label}</strong>
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
}
