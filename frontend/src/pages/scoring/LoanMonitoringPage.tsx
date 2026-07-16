import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { buildLoanMonitoringSnapshot } from './liveTrackerMetrics';

type WorkflowStep = 1 | 2 | 3 | 4;

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

interface LoanMonitoringWorkflowConfig {
  step1: {
    hasPortfolioLoans: boolean;
    hasSelectedLoan: boolean;
    hasValidSnapshot: boolean;
    hasRecordStatus: boolean;
    hasLoanType: boolean;
    hasEntityIssuer: boolean;
    hasCollateralIfAny: boolean;
  };
  step2: {
    hasStatementRows: boolean;
    hasBalanceMovement: boolean;
    hasComputedInstallments: boolean;
  };
  step3: {
    hasSummaryRow: boolean;
    hasLoanType: boolean;
    hasIssuerLender: boolean;
    hasCollateral: boolean;
  };
  step4: {
    hasControlItems: boolean;
    hasIndicators: boolean;
    hasAdvisorSignals: boolean;
    hasHealthScore: boolean;
  };
  thresholds: {
    inProgressMin: number;
    completeMin: number;
  };
}

const WORKFLOW_CONFIG_STORAGE_KEY = 'loanMonitoring.workflowConfig';

const DEFAULT_WORKFLOW_CONFIG: LoanMonitoringWorkflowConfig = {
  step1: {
    hasPortfolioLoans: true,
    hasSelectedLoan: true,
    hasValidSnapshot: true,
    hasRecordStatus: true,
    hasLoanType: true,
    hasEntityIssuer: true,
    hasCollateralIfAny: true,
  },
  step2: {
    hasStatementRows: true,
    hasBalanceMovement: true,
    hasComputedInstallments: true,
  },
  step3: {
    hasSummaryRow: true,
    hasLoanType: true,
    hasIssuerLender: true,
    hasCollateral: true,
  },
  step4: {
    hasControlItems: true,
    hasIndicators: true,
    hasAdvisorSignals: true,
    hasHealthScore: true,
  },
  thresholds: {
    inProgressMin: 60,
    completeMin: 100,
  },
};

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function toMonthYearLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
}

function buildAdditionalLoanSchedule(loanAmount: number, annualRate: number, termMonths: number): AdditionalLoanSchedule {
  const normalizedAmount = Math.max(0, loanAmount);
  const normalizedRate = Math.max(0, annualRate);
  const normalizedTerm = Math.max(1, Math.round(termMonths));
  const monthlyRate = normalizedRate / 100 / 12;

  let monthlyPayment = 0;
  if (normalizedAmount > 0) {
    if (monthlyRate <= 0) {
      monthlyPayment = normalizedAmount / normalizedTerm;
    } else {
      const numerator = monthlyRate * ((1 + monthlyRate) ** normalizedTerm);
      const denominator = ((1 + monthlyRate) ** normalizedTerm) - 1;
      monthlyPayment = denominator > 0 ? normalizedAmount * (numerator / denominator) : normalizedAmount / normalizedTerm;
    }
  }

  const startDate = new Date();
  let runningBalance = normalizedAmount;

  const rows = Array.from({ length: normalizedTerm }, (_, index) => {
    const previousBalance = runningBalance;
    const interest = monthlyRate > 0 ? previousBalance * monthlyRate : 0;
    const principal = Math.min(previousBalance, Math.max(monthlyPayment - interest, 0));
    const endBalance = Math.max(previousBalance - principal, 0);
    runningBalance = endBalance;

    return {
      id: `additional-statement-${index + 1}`,
      monthLabel: toMonthYearLabel(addMonths(startDate, index)),
      previousBalance,
      principal,
      interest,
      endBalance,
    };
  });

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    loanAmount: normalizedAmount,
    interestRate: normalizedRate,
    termMonths: normalizedTerm,
    monthlyPayment,
    rows,
  };
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
  const [newLoanAmount, setNewLoanAmount] = useState('');
  const [newLoanInterestRate, setNewLoanInterestRate] = useState('');
  const [newLoanTerm, setNewLoanTerm] = useState('');
  const [outstandingBalanceInput, setOutstandingBalanceInput] = useState('');
  const [loanType, setLoanType] = useState('');
  const [entityIssuer, setEntityIssuer] = useState('');
  const [collateralIfAny, setCollateralIfAny] = useState('');
  const [additionalSchedules, setAdditionalSchedules] = useState<AdditionalLoanSchedule[]>([]);
  const [additionalScheduleMessage, setAdditionalScheduleMessage] = useState('');
  const [step, setStep] = useState<WorkflowStep>(1);

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
  const selectedRecord = useMemo(
    () => monitoredApplications.find((record) => record.application_no === selectedApplicationNo) ?? null,
    [monitoredApplications, selectedApplicationNo],
  );

  useEffect(() => {
    if (!selectedRecord) {
      return;
    }

    if (!newLoanAmount.trim()) {
      const seededLoanAmount = Number(selectedRecord.loan_amount);
      if (Number.isFinite(seededLoanAmount) && seededLoanAmount > 0) {
        setNewLoanAmount(seededLoanAmount.toFixed(2));
      }
    }

    if (!newLoanInterestRate.trim()) {
      const seededRate = Number(selectedRecord.interest_rate);
      if (Number.isFinite(seededRate) && seededRate >= 0) {
        setNewLoanInterestRate(seededRate.toFixed(2));
      }
    }

    if (!newLoanTerm.trim()) {
      const seededTerm = Number(selectedRecord.term_months);
      if (Number.isFinite(seededTerm) && seededTerm > 0) {
        setNewLoanTerm(String(Math.round(seededTerm)));
      }
    }

    if (!outstandingBalanceInput.trim() && snapshot.statementRows.length > 0) {
      const seededOutstanding = snapshot.statementRows[snapshot.statementRows.length - 1]?.endBalance ?? 0;
      if (Number.isFinite(seededOutstanding) && seededOutstanding >= 0) {
        setOutstandingBalanceInput(seededOutstanding.toFixed(2));
      }
    }
  }, [selectedRecord, snapshot.statementRows, newLoanAmount, newLoanInterestRate, newLoanTerm, outstandingBalanceInput]);
  const summaryDashboardRows = useMemo(() => {
    const selectedOriginalAmount = Number(selectedRecord?.loan_amount ?? 0);
    const selectedRate = Number(selectedRecord?.interest_rate ?? 0);
    const selectedTerm = Number(selectedRecord?.term_months ?? 0);
    const selectedOutstanding = snapshot.statementRows.length > 0
      ? snapshot.statementRows[snapshot.statementRows.length - 1]?.endBalance ?? selectedOriginalAmount
      : selectedOriginalAmount;

    const primaryRow = {
      id: selectedApplicationNo || 'selected-loan',
      loanType: loanType || 'Not set',
      issuerLender: entityIssuer || 'Not set',
      originalLoanAmount: selectedOriginalAmount,
      interestRate: selectedRate,
      term: selectedTerm,
      outstandingBalance: selectedOutstanding,
      collateral: collateralIfAny || 'None',
    };

    const additionalRows = additionalSchedules.map((schedule, index) => ({
      id: `${schedule.id}-${index}`,
      loanType: loanType || 'Additional Loan',
      issuerLender: entityIssuer || 'Not set',
      originalLoanAmount: schedule.loanAmount,
      interestRate: schedule.interestRate,
      term: schedule.termMonths,
      outstandingBalance: schedule.rows[schedule.rows.length - 1]?.endBalance ?? schedule.loanAmount,
      collateral: collateralIfAny || 'None',
    }));

    return [primaryRow, ...additionalRows].filter((item) => item.originalLoanAmount > 0);
  }, [selectedRecord, snapshot.statementRows, selectedApplicationNo, loanType, entityIssuer, collateralIfAny, additionalSchedules]);

  const workflowSteps: Array<{ id: WorkflowStep; label: string; description: string }> = [
    {
      id: 1,
      label: 'Loan Setup',
      description: 'Choose and monitor a loan from your active portfolio.',
    },
    {
      id: 2,
      label: 'Loan Statement',
      description: 'View the borrower running balance and installment schedule.',
    },
    {
      id: 3,
      label: 'Summary Dashboard',
      description: 'Review loan summary and analysis/computation areas.',
    },
    {
      id: 4,
      label: 'AI Advisor',
      description: 'Get borrower guidance from the monitored loan.',
    },
  ];

  const workflowConfig = useMemo<LoanMonitoringWorkflowConfig>(() => {
    const readBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
    const readNumber = (value: unknown, fallback: number) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
      }
      return Math.max(0, Math.min(100, value));
    };

    if (typeof window === 'undefined') {
      return DEFAULT_WORKFLOW_CONFIG;
    }

    try {
      const rawConfig = window.localStorage.getItem(WORKFLOW_CONFIG_STORAGE_KEY);
      if (!rawConfig) {
        return DEFAULT_WORKFLOW_CONFIG;
      }

      const parsed = JSON.parse(rawConfig) as Record<string, unknown>;
      const step1 = typeof parsed.step1 === 'object' && parsed.step1 ? parsed.step1 as Record<string, unknown> : {};
      const step2 = typeof parsed.step2 === 'object' && parsed.step2 ? parsed.step2 as Record<string, unknown> : {};
      const step3 = typeof parsed.step3 === 'object' && parsed.step3 ? parsed.step3 as Record<string, unknown> : {};
      const step4 = typeof parsed.step4 === 'object' && parsed.step4 ? parsed.step4 as Record<string, unknown> : {};
      const thresholds = typeof parsed.thresholds === 'object' && parsed.thresholds
        ? parsed.thresholds as Record<string, unknown>
        : {};

      const inProgressMin = readNumber(thresholds.inProgressMin, DEFAULT_WORKFLOW_CONFIG.thresholds.inProgressMin);
      const completeMin = readNumber(thresholds.completeMin, DEFAULT_WORKFLOW_CONFIG.thresholds.completeMin);

      return {
        step1: {
          hasPortfolioLoans: readBoolean(step1.hasPortfolioLoans, DEFAULT_WORKFLOW_CONFIG.step1.hasPortfolioLoans),
          hasSelectedLoan: readBoolean(step1.hasSelectedLoan, DEFAULT_WORKFLOW_CONFIG.step1.hasSelectedLoan),
          hasValidSnapshot: readBoolean(step1.hasValidSnapshot, DEFAULT_WORKFLOW_CONFIG.step1.hasValidSnapshot),
          hasRecordStatus: readBoolean(step1.hasRecordStatus, DEFAULT_WORKFLOW_CONFIG.step1.hasRecordStatus),
          hasLoanType: readBoolean(step1.hasLoanType, DEFAULT_WORKFLOW_CONFIG.step1.hasLoanType),
          hasEntityIssuer: readBoolean(step1.hasEntityIssuer, DEFAULT_WORKFLOW_CONFIG.step1.hasEntityIssuer),
          hasCollateralIfAny: readBoolean(step1.hasCollateralIfAny, DEFAULT_WORKFLOW_CONFIG.step1.hasCollateralIfAny),
        },
        step2: {
          hasStatementRows: readBoolean(step2.hasStatementRows, DEFAULT_WORKFLOW_CONFIG.step2.hasStatementRows),
          hasBalanceMovement: readBoolean(step2.hasBalanceMovement, DEFAULT_WORKFLOW_CONFIG.step2.hasBalanceMovement),
          hasComputedInstallments: readBoolean(step2.hasComputedInstallments, DEFAULT_WORKFLOW_CONFIG.step2.hasComputedInstallments),
        },
        step3: {
          hasSummaryRow: readBoolean(step3.hasSummaryRow, DEFAULT_WORKFLOW_CONFIG.step3.hasSummaryRow),
          hasLoanType: readBoolean(step3.hasLoanType, DEFAULT_WORKFLOW_CONFIG.step3.hasLoanType),
          hasIssuerLender: readBoolean(step3.hasIssuerLender, DEFAULT_WORKFLOW_CONFIG.step3.hasIssuerLender),
          hasCollateral: readBoolean(step3.hasCollateral, DEFAULT_WORKFLOW_CONFIG.step3.hasCollateral),
        },
        step4: {
          hasControlItems: readBoolean(step4.hasControlItems, DEFAULT_WORKFLOW_CONFIG.step4.hasControlItems),
          hasIndicators: readBoolean(step4.hasIndicators, DEFAULT_WORKFLOW_CONFIG.step4.hasIndicators),
          hasAdvisorSignals: readBoolean(step4.hasAdvisorSignals, DEFAULT_WORKFLOW_CONFIG.step4.hasAdvisorSignals),
          hasHealthScore: readBoolean(step4.hasHealthScore, DEFAULT_WORKFLOW_CONFIG.step4.hasHealthScore),
        },
        thresholds: {
          inProgressMin: Math.min(inProgressMin, completeMin),
          completeMin,
        },
      };
    } catch {
      return DEFAULT_WORKFLOW_CONFIG;
    }
  }, []);

  const currentStepLabel = workflowSteps.find((item) => item.id === step)?.label ?? 'Loan Workflow';
  const stepCompletionById = useMemo<Record<WorkflowStep, number>>(() => {
    const hasPortfolioLoans = monitoredApplications.length > 0;
    const hasSelectedLoan = selectedApplicationNo.trim().length > 0;
    const hasValidSnapshot = snapshot.sourceApplicationNo !== 'N/A';
    const hasRecordStatus = snapshot.sourceRecordStatus.trim().length > 0 && snapshot.sourceRecordStatus !== 'No Records';
    const hasLoanType = loanType.trim().length > 0;
    const hasEntityIssuer = entityIssuer.trim().length > 0;
    const hasCollateralIfAny = collateralIfAny.trim().length > 0;
    const step1Rules = [
      workflowConfig.step1.hasPortfolioLoans ? hasPortfolioLoans : null,
      workflowConfig.step1.hasSelectedLoan ? hasSelectedLoan : null,
      workflowConfig.step1.hasValidSnapshot ? hasValidSnapshot : null,
      workflowConfig.step1.hasRecordStatus ? hasRecordStatus : null,
      workflowConfig.step1.hasLoanType ? hasLoanType : null,
      workflowConfig.step1.hasEntityIssuer ? hasEntityIssuer : null,
      workflowConfig.step1.hasCollateralIfAny ? hasCollateralIfAny : null,
    ].filter((item): item is boolean => typeof item === 'boolean');
    const step1Checks = step1Rules.filter(Boolean).length;

    const hasStatementRows = snapshot.statementRows.length > 0;
    const hasBalanceMovement = snapshot.statementRows.some(
      (row) => row.previousBalance > 0 || row.principal > 0 || row.interest > 0 || row.endBalance > 0,
    );
    const hasComputedInstallments = snapshot.statementRows.length >= 3 || additionalSchedules.length > 0;
    const step2Rules = [
      workflowConfig.step2.hasStatementRows ? hasStatementRows : null,
      workflowConfig.step2.hasBalanceMovement ? hasBalanceMovement : null,
      workflowConfig.step2.hasComputedInstallments ? hasComputedInstallments : null,
    ].filter((item): item is boolean => typeof item === 'boolean');
    const step2Checks = step2Rules.filter(Boolean).length;

    const hasSummaryRow = summaryDashboardRows.length > 0;
    const hasLoanTypeStep3 = loanType.trim().length > 0;
    const hasIssuerLender = entityIssuer.trim().length > 0;
    const hasCollateral = collateralIfAny.trim().length > 0;
    const step3Rules = [
      workflowConfig.step3.hasSummaryRow ? hasSummaryRow : null,
      workflowConfig.step3.hasLoanType ? hasLoanTypeStep3 : null,
      workflowConfig.step3.hasIssuerLender ? hasIssuerLender : null,
      workflowConfig.step3.hasCollateral ? hasCollateral : null,
    ].filter((item): item is boolean => typeof item === 'boolean');
    const step3Checks = step3Rules.filter(Boolean).length;

    const hasControlItems = snapshot.controlItems.length > 0;
    const hasIndicators = snapshot.indicators.length > 0;
    const hasAdvisorSignals = [advisor.interestAdvice.text, advisor.dsrStatus.text, advisor.refinancingQuality.text]
      .every((item) => item.trim().length > 0);
    const hasHealthScore = Number.isFinite(snapshot.healthScore);
    const step4Rules = [
      workflowConfig.step4.hasControlItems ? hasControlItems : null,
      workflowConfig.step4.hasIndicators ? hasIndicators : null,
      workflowConfig.step4.hasAdvisorSignals ? hasAdvisorSignals : null,
      workflowConfig.step4.hasHealthScore ? hasHealthScore : null,
    ].filter((item): item is boolean => typeof item === 'boolean');
    const step4Checks = step4Rules.filter(Boolean).length;

    return {
      1: Math.round((step1Checks / Math.max(step1Rules.length, 1)) * 100),
      2: Math.round((step2Checks / Math.max(step2Rules.length, 1)) * 100),
      3: Math.round((step3Checks / Math.max(step3Rules.length, 1)) * 100),
      4: Math.round((step4Checks / Math.max(step4Rules.length, 1)) * 100),
    };
  }, [
    monitoredApplications.length,
    selectedApplicationNo,
    snapshot,
    loanType,
    entityIssuer,
    collateralIfAny,
    summaryDashboardRows,
    additionalSchedules.length,
    advisor,
    workflowConfig,
  ]);
  const workflowProgressPercent = Math.round((step / workflowSteps.length) * 100);
  const stepperButtonClass = 'loan-stepper-button';

  const handleRunAdditionalInstallmentSchedule = () => {
    const parsedLoanAmount = Number(newLoanAmount);
    const parsedInterestRate = Number(newLoanInterestRate);
    const parsedTerm = Number(newLoanTerm);

    if (!Number.isFinite(parsedLoanAmount) || parsedLoanAmount <= 0) {
      setAdditionalScheduleMessage('Please enter a valid Amount of Loan greater than zero.');
      return;
    }

    if (!Number.isFinite(parsedInterestRate) || parsedInterestRate < 0) {
      setAdditionalScheduleMessage('Please enter a valid Interest Rate (zero or higher).');
      return;
    }

    if (!Number.isFinite(parsedTerm) || parsedTerm <= 0) {
      setAdditionalScheduleMessage('Please enter a valid Term in months greater than zero.');
      return;
    }

    const schedule = buildAdditionalLoanSchedule(parsedLoanAmount, parsedInterestRate, parsedTerm);
    setAdditionalSchedules((previous) => [schedule, ...previous]);
    setAdditionalScheduleMessage('Additional loan installment schedule generated.');
    setNewLoanAmount('');
    setNewLoanInterestRate('');
    setNewLoanTerm('');
  };

  return (
    <div className="psychometric-page loan-monitoring-dashboard-page">
      <section className="psychometric-hero loan-monitoring-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Loan Performance Oversight</span>
          <h1>Debt Optimizer-Loan Monitoring</h1>
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
          <span>Progress</span>
          <strong>{workflowProgressPercent}%</strong>
          <small>{currentStepLabel}</small>
        </article>

        <article className="psychometric-summary-card">
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

      </section>

      <section className="budget-dashboard-layout">
        <div className="budget-dashboard-main">
          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Workflow Form</span>
                <h2>{`Step ${step}: ${currentStepLabel}`}</h2>
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

            {step === 1 ? (
              <div className="budget-workflow-step-block">
                <h3 className="workflow-duplicate-step-title">Step 1: Loan Setup</h3>
                <p className="psychometric-section-note">
                  Select the loan to monitor and optionally add a custom installment schedule for additional analysis.
                </p>

                <div className="budget-dashboard-category-summary">
                  <div className="budget-dashboard-category-summary-card">
                    <span>Application Reference Number</span>
                    <strong>{snapshot.sourceApplicationNo}</strong>
                  </div>
                  <label className="budget-dashboard-category-summary-card">
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
                  </label>
                  <div className="budget-dashboard-category-summary-card">
                    <span>Current Status</span>
                    <strong>{snapshot.sourceRecordStatus}</strong>
                  </div>
                </div>

                <div className="budget-dashboard-category-summary">
                  <label className="budget-dashboard-category-summary-card">
                    <span>Loan Type</span>
                    <select
                      value={loanType}
                      onChange={(event) => setLoanType(event.target.value)}
                      className="budget-dashboard-category-input"
                      aria-label="Loan type"
                    >
                      <option value="">Select loan type</option>
                      <option value="Home Loan">Home Loan</option>
                      <option value="Auto Loan">Auto Loan</option>
                      <option value="Personal Loan">Personal Loan</option>
                      <option value="Business Loan">Business Loan</option>
                      <option value="Credit Line">Credit Line</option>
                      <option value="Bridge Loan">Bridge Loan</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  <label className="budget-dashboard-category-summary-card">
                    <span>Entity Issuer</span>
                    <input
                      type="text"
                      value={entityIssuer}
                      onChange={(event) => setEntityIssuer(event.target.value)}
                      className="budget-dashboard-category-input"
                      placeholder="Enter loan issuer entity"
                    />
                  </label>
                  <label className="budget-dashboard-category-summary-card">
                    <span>Collateral (If Any)</span>
                    <input
                      type="text"
                      value={collateralIfAny}
                      onChange={(event) => setCollateralIfAny(event.target.value)}
                      className="budget-dashboard-category-input"
                      placeholder="Type collateral or None"
                    />
                  </label>
                </div>

                <div className="budget-dashboard-category-summary">
                  <label className="budget-dashboard-category-summary-card">
                    <span>Original Loan Amount</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={newLoanAmount}
                      onChange={(event) => setNewLoanAmount(event.target.value)}
                      className="budget-dashboard-category-input"
                      placeholder="Enter original amount"
                    />
                  </label>
                  <label className="budget-dashboard-category-summary-card">
                    <span>Interest Rate (%)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={newLoanInterestRate}
                      onChange={(event) => setNewLoanInterestRate(event.target.value)}
                      className="budget-dashboard-category-input"
                      placeholder="Enter annual rate"
                    />
                  </label>
                  <label className="budget-dashboard-category-summary-card">
                    <span>Term (Months)</span>
                    <input
                      type="number"
                      min={1}
                      step="1"
                      value={newLoanTerm}
                      onChange={(event) => setNewLoanTerm(event.target.value)}
                      className="budget-dashboard-category-input"
                      placeholder="Enter term"
                    />
                  </label>
                  <label className="budget-dashboard-category-summary-card">
                    <span>Outstanding Balance</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={outstandingBalanceInput}
                      onChange={(event) => setOutstandingBalanceInput(event.target.value)}
                      className="budget-dashboard-category-input"
                      placeholder="Enter outstanding balance"
                    />
                  </label>
                </div>

                <div className="budget-workflow-inline-actions">
                  <button
                    type="button"
                    className="psychometric-reset-button"
                    onClick={handleRunAdditionalInstallmentSchedule}
                  >
                    Add Another Loan and Installment Schedule
                  </button>
                </div>

                {additionalScheduleMessage ? (
                  <p className="psychometric-section-note" role="status">
                    {additionalScheduleMessage}
                  </p>
                ) : null}

                <div className="budget-workflow-inline-actions">
                  <button type="button" className="psychometric-reset-button" onClick={() => setStep(2)}>
                    Continue to Step 2
                  </button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="budget-workflow-step-block">
                <h3 className="workflow-duplicate-step-title">Step 2: Loan Statement</h3>
                <p className="psychometric-section-note">
                  Review running balance and installment schedule values for selected and additional loans.
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
                          <td data-label="Month/Year">{row.monthLabel}</td>
                          <td data-label="Previous Balance">{formatMetricValue(row.previousBalance, 'currency')}</td>
                          <td data-label="Principal">{formatMetricValue(row.principal, 'currency')}</td>
                          <td data-label="Interest">{formatMetricValue(row.interest, 'currency')}</td>
                          <td data-label="End Balance">{formatMetricValue(row.endBalance, 'currency')}</td>
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

                {additionalSchedules.map((schedule, scheduleIndex) => (
                  <div key={schedule.id} className="psychometric-scale-table-wrap">
                    <h3>{`Additional Loan Statement ${scheduleIndex + 1}`}</h3>
                    <p className="psychometric-section-note">
                      Amount: {formatMetricValue(schedule.loanAmount, 'currency')} | Interest Rate: {schedule.interestRate.toFixed(2)}% | Term: {schedule.termMonths} months | Monthly Installment: {formatMetricValue(schedule.monthlyPayment, 'currency')}
                    </p>
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
                        {schedule.rows.map((row) => (
                          <tr key={row.id}>
                            <td data-label="Month/Year">{row.monthLabel}</td>
                            <td data-label="Previous Balance">{formatMetricValue(row.previousBalance, 'currency')}</td>
                            <td data-label="Principal">{formatMetricValue(row.principal, 'currency')}</td>
                            <td data-label="Interest">{formatMetricValue(row.interest, 'currency')}</td>
                            <td data-label="End Balance">{formatMetricValue(row.endBalance, 'currency')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                <div className="budget-workflow-inline-actions">
                  <button type="button" className="budget-dashboard-category-reset" onClick={() => setStep(1)}>
                    Back to Step 1
                  </button>
                  <button type="button" className="psychometric-reset-button" onClick={() => setStep(3)}>
                    Continue to Step 3
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="budget-workflow-step-block">
                <h3 className="workflow-duplicate-step-title">Step 3: Dashboard - Loan Summary</h3>
                <p className="psychometric-section-note">
                  Review the consolidated loan summary table and run loan optimization computations.
                </p>

                <div className="psychometric-scale-table-wrap">
                  <table className="psychometric-scale-table">
                    <thead>
                      <tr>
                        <th>Loan Type</th>
                        <th>Issuer/Lender</th>
                        <th>Original Loan Amount</th>
                        <th>Interest Rate</th>
                        <th>Term</th>
                        <th>Outstanding Balance</th>
                        <th>Collateral (If Any)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryDashboardRows.map((row) => (
                        <tr key={row.id}>
                          <td data-label="Loan Type">{row.loanType}</td>
                          <td data-label="Issuer/Lender">{row.issuerLender}</td>
                          <td data-label="Original Loan Amount">{formatMetricValue(row.originalLoanAmount, 'currency')}</td>
                          <td data-label="Interest Rate">{`${row.interestRate.toFixed(2)}%`}</td>
                          <td data-label="Term">{`${row.term} months`}</td>
                          <td data-label="Outstanding Balance">{formatMetricValue(row.outstandingBalance, 'currency')}</td>
                          <td data-label="Collateral (If Any)">{row.collateral}</td>
                        </tr>
                      ))}
                      {summaryDashboardRows.length === 0 ? (
                        <tr>
                          <td colSpan={7}>No loan summary available yet. Complete Step 1 and Step 2 first.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="budget-dashboard-indicator-row" style={{ marginTop: '12px' }}>
                  <article className="budget-dashboard-indicator budget-dashboard-status-watch" style={{ flex: '1 1 100%' }}>
                    <span>Analysis / Computation</span>
                    <strong>Debt Optimization Summary</strong>
                    <p>
                      Debt Consolidation, Debt Repayment, Refinancing Opportunities, Credit Utilization Optimizer, Debt-to-Income Optimization, Loan Restructuring Advisor, Borrowing Capacity Simulator, Debt Free-Date Analysis, and Interest Leakage.
                    </p>
                  </article>
                </div>

                <div className="budget-workflow-inline-actions">
                  <button type="button" className="budget-dashboard-category-reset" onClick={() => setStep(2)}>
                    Back to Step 2
                  </button>
                  <button type="button" className="psychometric-reset-button" onClick={() => setStep(4)}>
                    Continue to Step 4
                  </button>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="budget-workflow-step-block">
                <h3 className="workflow-duplicate-step-title">Step 4: AI Advisor</h3>
                <p className="psychometric-section-note">
                  Review payment controls, health indicators, and AI guidance from live loan behavior.
                </p>

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
                          <td data-label="Control">{item.label}</td>
                          <td data-label="Actual">{formatMetricValue(item.actual, item.unit)}</td>
                          <td data-label="Target">{formatMetricValue(item.target, item.unit)}</td>
                          <td data-label="Variance">{formatMetricValue(item.variance, item.unit)}</td>
                          <td data-label="Status">{getStatusLabel(item.status)}</td>
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

                <div className="budget-workflow-inline-actions">
                  <button type="button" className="budget-dashboard-category-reset" onClick={() => setStep(3)}>
                    Back to Step 3
                  </button>
                </div>
              </div>
            ) : null}
          </article>

          {step === 4 ? (
            <article className="psychometric-panel">
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
            </article>
          ) : null}
        </div>

        <aside className="budget-dashboard-side">
          <article className="psychometric-panel psychometric-sticky-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Workflow Steps</span>
                <h2>Navigate Workflow Steps</h2>
              </div>
            </div>
            <p className="psychometric-section-note">
              {`Thresholds: In Progress >= ${workflowConfig.thresholds.inProgressMin}% | Complete = ${workflowConfig.thresholds.completeMin}%`}
            </p>

            <div className="lending-psychometric-step-list">
              {workflowSteps.map((workflowStep) => {
                const isActive = step === workflowStep.id;
                const isCompleted = step > workflowStep.id;
                const stepPercent = stepCompletionById[workflowStep.id];
                const statusLabel = `${stepPercent}% information provided`;
                const statusTone =
                  stepPercent >= workflowConfig.thresholds.completeMin
                    ? 'complete'
                    : stepPercent >= workflowConfig.thresholds.inProgressMin
                      ? 'in-progress'
                      : 'low';
                const stepAccent =
                  statusTone === 'complete'
                    ? '#047857'
                    : statusTone === 'in-progress'
                      ? '#0369a1'
                      : '#b45309';
                const stepTrack =
                  statusTone === 'complete'
                    ? '#10b981'
                    : statusTone === 'in-progress'
                      ? '#0ea5e9'
                      : '#f59e0b';

                return (
                  <button
                    key={workflowStep.id}
                    type="button"
                    onClick={() => setStep(workflowStep.id)}
                    className={`${stepperButtonClass} lending-psychometric-step-button ${isActive ? 'loan-stepper-button-active border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'loan-stepper-button-idle border-gray-200 bg-white hover:border-blue-400 hover:text-blue-600'}`}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <div
                      className="lending-psychometric-step-index"
                      style={{
                        backgroundColor: isActive || isCompleted ? stepAccent : '#cbd5e1',
                        color: isActive || isCompleted ? '#ffffff' : '#475569',
                      }}
                    >
                      {workflowStep.id}
                    </div>
                    <div className="lending-psychometric-step-copy">
                      <strong>{workflowStep.label}</strong>
                      <span>{statusLabel.toUpperCase()}</span>
                      <div className="lending-step-information-track" aria-hidden="true">
                        <div
                          className={`lending-step-information-bar${stepPercent < 30 ? ' lending-step-information-bar-low' : ''}`}
                          style={{ width: `${stepPercent}%`, backgroundColor: stepTrack }}
                        />
                      </div>
                      <small>{workflowStep.description}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel" style={{ marginTop: '12px' }}>
            <div className="budget-dashboard-indicator-row" style={{ display: 'grid', gap: '10px' }}>
              <article className="budget-dashboard-indicator budget-dashboard-status-maintain" style={{ margin: 0 }}>
                <span>Debt Savings Calculator</span>
                <p>Estimate potential savings from prepayments, lower rates, or term adjustments.</p>
              </article>
              <article className="budget-dashboard-indicator budget-dashboard-status-maintain" style={{ margin: 0 }}>
                <span>Borrowing Capacity Simulator</span>
                <p>Simulate borrowing headroom based on current debt service and cashflow.</p>
              </article>
              <article className="budget-dashboard-indicator budget-dashboard-status-watch" style={{ margin: 0 }}>
                <span>Collateral Valuation Trigger</span>
                <p>Highlight loans that require updated collateral valuation and risk reassessment.</p>
              </article>
              <article className="budget-dashboard-indicator budget-dashboard-status-watch" style={{ margin: 0 }}>
                <span>Loan Restructuring Advisor</span>
                <p>Assess refinance, consolidation, and restructuring options to reduce repayment pressure.</p>
              </article>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
