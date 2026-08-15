import { useCallback, useEffect, useMemo, useState } from 'react';
import { NumericFormat } from 'react-number-format';

import { useAutosaveDraft } from '../../autosave';
import { fetchAutosaveDraft } from '../../autosave/draftApi';
import { saveLoanApplicationMonitoring, updateLoanApplication } from '../../api/loan';
import SelectedProfileIdCard from '../../components/profile/SelectedProfileIdCard';
import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { useSelectedAnalysisEntity } from '../../hooks/useSelectedAnalysisEntity';
import { computeBudgetHealthScore, type BudgetHealthDraftInput, type BudgetHealthScoreResult } from './budgetHealthEngine';
import { buildLoanMonitoringSnapshot } from './liveTrackerMetrics';
import { computeLoanMonitoringScore, type LoanMonitoringScoreResult } from './loanMonitoringScoreEngine';
import { readReplicatedBuildProfile } from './buildProfileReplication';
import { computeNetWorthBuildingScore } from './netWorthBuildingEngine';
import { computeCashCoverage } from './cashCoverageEngine';
import CashCoverageGauge from './CashCoverageGauge';
import { computeCollateralCoverage } from './collateralCoverageEngine';
import CollateralCoverageGauge from './CollateralCoverageGauge';
import DebtBalanceStackedChart, { type DebtBalanceAccount } from './DebtBalanceStackedChart';
import LoanOptimizationTachometer from './LoanOptimizationTachometer';

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
  loanType: string;
  entityIssuer: string;
  loanAmount: number;
  dateStarted: string;
  interestRate: number;
  termMonths: number;
  outstandingBalance: number;
  collateralAsset: string;
  collateralRecordedValue: number;
  collateralCurrentValue: number;
  markToMarketValuation: number;
  loanToValueRatio: number;
  monthlyPayment: number;
  rows: AdditionalLoanStatementRow[];
}

type AdditionalLoanInputField = Exclude<keyof AdditionalLoanSchedule, 'id' | 'loanToValueRatio' | 'monthlyPayment' | 'rows'>;

interface LoanMonitoringDraft {
  step: WorkflowStep;
  selectedApplicationNo: string;
  newLoanAmount: string;
  newLoanInterestRate: string;
  newLoanTerm: string;
  outstandingBalanceInput: string;
  loanType: string;
  entityIssuer: string;
  collateralIfAny: string;
  extraMonthlyPayment: string;
  borrowingDsrLimit: string;
  additionalSchedules: AdditionalLoanSchedule[];
  publishedScore?: LoanMonitoringScoreResult;
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

function buildAdditionalLoanSchedule(loan: Omit<AdditionalLoanSchedule, 'monthlyPayment' | 'rows'>): AdditionalLoanSchedule {
  const normalizedAmount = Math.max(0, loan.loanAmount);
  const normalizedRate = Math.max(0, loan.interestRate);
  const normalizedTerm = Math.max(1, Math.round(loan.termMonths));
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

  const parsedStartDate = loan.dateStarted ? new Date(`${loan.dateStarted}T00:00:00`) : new Date();
  const startDate = Number.isNaN(parsedStartDate.getTime()) ? new Date() : parsedStartDate;
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
    ...loan,
    loanAmount: normalizedAmount,
    interestRate: normalizedRate,
    termMonths: normalizedTerm,
    monthlyPayment,
    rows,
  };
}

function createAdditionalLoan(): AdditionalLoanSchedule {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    loanType: '',
    entityIssuer: '',
    loanAmount: 0,
    dateStarted: '',
    interestRate: 0,
    termMonths: 0,
    outstandingBalance: 0,
    collateralAsset: '',
    collateralRecordedValue: 0,
    collateralCurrentValue: 0,
    markToMarketValuation: 0,
    loanToValueRatio: 0,
    monthlyPayment: 0,
    rows: [],
  };
}

function normalizeAdditionalLoan(value: unknown): AdditionalLoanSchedule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const loan = value as Partial<AdditionalLoanSchedule>;
  const normalizedLoanAmount = Number(loan.loanAmount) || 0;
  const normalizedOutstandingBalance = Number(loan.outstandingBalance) || 0;
  const normalizedCollateralRecordedValue = Number(loan.collateralRecordedValue) || 0;
  const normalizedCollateralCurrentValue = Number(loan.collateralCurrentValue) || 0;
  const normalizedMarkToMarketValuation = Number(loan.markToMarketValuation) || 0;
  const collateralValue = normalizedMarkToMarketValuation
    || normalizedCollateralCurrentValue
    || normalizedCollateralRecordedValue;
  const loanBalance = normalizedOutstandingBalance || normalizedLoanAmount;
  const normalized = {
    ...createAdditionalLoan(),
    id: typeof loan.id === 'string' ? loan.id : createAdditionalLoan().id,
    loanType: typeof loan.loanType === 'string' ? loan.loanType : '',
    entityIssuer: typeof loan.entityIssuer === 'string' ? loan.entityIssuer : '',
    loanAmount: normalizedLoanAmount,
    dateStarted: typeof loan.dateStarted === 'string' ? loan.dateStarted : '',
    interestRate: Number(loan.interestRate) || 0,
    termMonths: Number(loan.termMonths) || 0,
    outstandingBalance: normalizedOutstandingBalance,
    collateralAsset: typeof loan.collateralAsset === 'string' ? loan.collateralAsset : '',
    collateralRecordedValue: normalizedCollateralRecordedValue,
    collateralCurrentValue: normalizedCollateralCurrentValue,
    markToMarketValuation: normalizedMarkToMarketValuation,
    loanToValueRatio: collateralValue > 0 ? (loanBalance / collateralValue) * 100 : 0,
  };

  if (normalized.loanAmount <= 0 || normalized.termMonths <= 0) {
    return { ...normalized, monthlyPayment: 0, rows: [] };
  }
  return buildAdditionalLoanSchedule(normalized);
}

function calculateLoanCost(loanAmount: number, annualRate: number, termMonths: number) {
  const normalizedAmount = Math.max(0, loanAmount);
  const normalizedRate = Math.max(0, annualRate);
  const normalizedTerm = Math.max(1, Math.round(termMonths));
  const monthlyRate = normalizedRate / 100 / 12;
  const monthlyPayment = normalizedAmount <= 0
    ? 0
    : monthlyRate <= 0
      ? normalizedAmount / normalizedTerm
      : normalizedAmount * (
          (monthlyRate * ((1 + monthlyRate) ** normalizedTerm))
          / (((1 + monthlyRate) ** normalizedTerm) - 1)
        );

  return {
    monthlyPayment,
    totalInterest: Math.max(0, (monthlyPayment * normalizedTerm) - normalizedAmount),
  };
}

function calculateAcceleratedPayoff(balance: number, annualRate: number, minimumPayment: number, extraPayment: number) {
  const monthlyRate = Math.max(0, annualRate) / 100 / 12;
  const payment = Math.max(0, minimumPayment + extraPayment);
  let remainingBalance = Math.max(0, balance);
  let totalInterest = 0;
  let months = 0;

  while (remainingBalance > 0.01 && months < 1200) {
    const interest = remainingBalance * monthlyRate;
    if (payment <= interest) {
      return { months: 0, totalInterest: 0 };
    }
    totalInterest += interest;
    remainingBalance = Math.max(0, remainingBalance + interest - payment);
    months += 1;
  }

  return { months, totalInterest };
}

function calculatePrincipalFromPayment(monthlyPayment: number, annualRate: number, termMonths: number) {
  const payment = Math.max(0, monthlyPayment);
  const term = Math.max(1, Math.round(termMonths));
  const monthlyRate = Math.max(0, annualRate) / 100 / 12;
  return monthlyRate <= 0
    ? payment * term
    : payment * ((1 - ((1 + monthlyRate) ** -term)) / monthlyRate);
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
  const { selectedApplicationNo: selectedProfileApplicationNo, entityKey, isIdentityReady } = useSelectedAnalysisEntity();
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics({
    applicationNo: selectedProfileApplicationNo,
  });
  const monitoredApplications = useMemo(
    () =>
      applications.filter(
        (record) => Number.isFinite(record.loan_amount) && record.loan_amount > 0 && Number.isFinite(record.term_months) && record.term_months > 0,
      ),
    [applications],
  );
  const [selectedApplicationNo, setSelectedApplicationNo] = useState(selectedProfileApplicationNo);
  const [newLoanAmount, setNewLoanAmount] = useState('');
  const [newLoanInterestRate, setNewLoanInterestRate] = useState('');
  const [newLoanTerm, setNewLoanTerm] = useState('');
  const [outstandingBalanceInput, setOutstandingBalanceInput] = useState('');
  const [loanType, setLoanType] = useState('');
  const [entityIssuer, setEntityIssuer] = useState('');
  const [collateralIfAny, setCollateralIfAny] = useState('');
  const [extraMonthlyPayment, setExtraMonthlyPayment] = useState('5000');
  const [borrowingDsrLimit, setBorrowingDsrLimit] = useState('35');
  const [additionalSchedules, setAdditionalSchedules] = useState<AdditionalLoanSchedule[]>([]);
  const [additionalScheduleMessage, setAdditionalScheduleMessage] = useState('');
  const [monitoringSaveMessage, setMonitoringSaveMessage] = useState('');
  const [isSavingAdditionalLoans, setIsSavingAdditionalLoans] = useState(false);
  const [budgetHealthScore, setBudgetHealthScore] = useState<BudgetHealthScoreResult | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<BudgetHealthDraftInput | null>(null);
  const [step, setStep] = useState<WorkflowStep>(1);

  const monitoringDraft = useMemo<LoanMonitoringDraft>(() => ({
    step,
    selectedApplicationNo,
    newLoanAmount,
    newLoanInterestRate,
    newLoanTerm,
    outstandingBalanceInput,
    loanType,
    entityIssuer,
    collateralIfAny,
    extraMonthlyPayment,
    borrowingDsrLimit,
    additionalSchedules,
  }), [additionalSchedules, borrowingDsrLimit, collateralIfAny, entityIssuer, extraMonthlyPayment, loanType, newLoanAmount, newLoanInterestRate, newLoanTerm, outstandingBalanceInput, selectedApplicationNo, step]);

  const hydrateMonitoringDraft = useCallback((draft: LoanMonitoringDraft) => {
    setStep(draft.step ?? 1);
    setSelectedApplicationNo(draft.selectedApplicationNo || selectedProfileApplicationNo);
    setNewLoanAmount(draft.newLoanAmount ?? '');
    setNewLoanInterestRate(draft.newLoanInterestRate ?? '');
    setNewLoanTerm(draft.newLoanTerm ?? '');
    setOutstandingBalanceInput(draft.outstandingBalanceInput ?? '');
    setLoanType(draft.loanType ?? '');
    setEntityIssuer(draft.entityIssuer ?? '');
    setCollateralIfAny(draft.collateralIfAny ?? '');
    setExtraMonthlyPayment(draft.extraMonthlyPayment ?? '5000');
    setBorrowingDsrLimit(draft.borrowingDsrLimit ?? '35');
    setAdditionalSchedules((draft.additionalSchedules ?? [])
      .map(normalizeAdditionalLoan)
      .filter((loan): loan is AdditionalLoanSchedule => loan !== null));
  }, [selectedProfileApplicationNo]);

  useEffect(() => {
    if (!monitoredApplications.length) {
      setSelectedApplicationNo('');
      return;
    }

    const requiredApplicationNo = selectedProfileApplicationNo || selectedApplicationNo;
    if (!requiredApplicationNo || !monitoredApplications.some((record) => record.application_no === requiredApplicationNo)) {
      setSelectedApplicationNo(monitoredApplications[0]?.application_no ?? '');
    } else if (selectedApplicationNo !== requiredApplicationNo) {
      setSelectedApplicationNo(requiredApplicationNo);
    }
  }, [monitoredApplications, selectedApplicationNo, selectedProfileApplicationNo]);

  const snapshot = useMemo(
    () => buildLoanMonitoringSnapshot(applications, selectedApplicationNo),
    [applications, selectedApplicationNo],
  );
  const selectedRecord = useMemo(
    () => monitoredApplications.find((record) => record.application_no === selectedApplicationNo) ?? null,
    [monitoredApplications, selectedApplicationNo],
  );

  useEffect(() => {
    let disposed = false;

    const loadBudgetBehavior = async () => {
      if (!isIdentityReady) return;
      try {
        const draft = await fetchAutosaveDraft<BudgetHealthDraftInput>('budget-expense-tracker', entityKey || 'identity-pending');
        if (!disposed) {
          setBudgetDraft(draft?.payload ?? null);
          setBudgetHealthScore(draft?.payload ? computeBudgetHealthScore(draft.payload) : null);
        }
      } catch {
        if (!disposed) {
          setBudgetDraft(null);
          setBudgetHealthScore(null);
        }
      }
    };

    void loadBudgetBehavior();
    return () => {
      disposed = true;
    };
  }, [entityKey, isIdentityReady]);

  useEffect(() => {
    if (!selectedRecord) {
      return;
    }

    const buildProfile = selectedRecord.requirements?.buildProfile;
    const profile = buildProfile && typeof buildProfile === 'object' && !Array.isArray(buildProfile)
      ? buildProfile as Record<string, unknown>
      : {};
    const profileValues = profile.values && typeof profile.values === 'object' && !Array.isArray(profile.values)
      ? profile.values as Record<string, unknown>
      : {};

    if (!loanType.trim()) {
      setLoanType(String(profileValues.loanType || profileValues.productType || selectedRecord.product_type || ''));
    }

    if (!entityIssuer.trim()) {
      setEntityIssuer(String(profileValues.loanLender || ''));
    }

    if (!collateralIfAny.trim()) {
      const collateral = profileValues.propertyAddress
        || profileValues.assetType
        || selectedRecord.vehicle_info
        || '';
      setCollateralIfAny(String(collateral));
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

    if (!outstandingBalanceInput.trim()) {
      const profileOutstanding = Number(profileValues.loanCurrentBalance);
      const statementOutstanding = snapshot.statementRows[snapshot.statementRows.length - 1]?.endBalance;
      const seededOutstanding = Number.isFinite(profileOutstanding) && profileOutstanding >= 0
        ? profileOutstanding
        : Number.isFinite(statementOutstanding)
          ? statementOutstanding ?? 0
          : Number(selectedRecord.loan_amount);
      if (Number.isFinite(seededOutstanding) && seededOutstanding >= 0) {
        setOutstandingBalanceInput(seededOutstanding.toFixed(2));
      }
    }

    if (additionalSchedules.length === 0 && Array.isArray(profile.additionalLoans)) {
      const savedLoans = profile.additionalLoans
        .map(normalizeAdditionalLoan)
        .filter((loan): loan is AdditionalLoanSchedule => loan !== null);
      if (savedLoans.length > 0) {
        setAdditionalSchedules(savedLoans);
      }
    }
  }, [additionalSchedules.length, collateralIfAny, entityIssuer, loanType, newLoanAmount, newLoanInterestRate, newLoanTerm, outstandingBalanceInput, selectedRecord, snapshot.statementRows]);
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
      loanType: schedule.loanType || 'Additional Loan',
      issuerLender: schedule.entityIssuer || 'Not set',
      originalLoanAmount: schedule.loanAmount,
      interestRate: schedule.interestRate,
      term: schedule.termMonths,
      outstandingBalance: schedule.outstandingBalance || schedule.loanAmount,
      collateral: schedule.collateralAsset || 'None',
    }));

    return [primaryRow, ...additionalRows].filter((item) => item.originalLoanAmount > 0);
  }, [selectedRecord, snapshot.statementRows, selectedApplicationNo, loanType, entityIssuer, collateralIfAny, additionalSchedules]);
  const debtBalanceAccounts = useMemo<DebtBalanceAccount[]>(() => {
    const primaryLabel = [selectedRecord?.product_type || loanType || 'Selected Loan', entityIssuer]
      .filter(Boolean)
      .join(' - ');
    const primaryAccount = snapshot.statementRows.length > 0 ? [{
      id: selectedApplicationNo || 'selected-loan',
      label: primaryLabel,
      balances: snapshot.statementRows,
    }] : [];
    const additionalAccounts = additionalSchedules.map((schedule, index) => ({
      id: schedule.id || `additional-loan-${index}`,
      label: [schedule.loanType || 'Additional Loan', schedule.entityIssuer].filter(Boolean).join(' - '),
      balances: schedule.rows,
    }));

    return [...primaryAccount, ...additionalAccounts];
  }, [additionalSchedules, entityIssuer, loanType, selectedApplicationNo, selectedRecord, snapshot.statementRows]);
  const debtSavingsAnalysis = useMemo(() => {
    const balance = Math.max(0, Number(outstandingBalanceInput) || Number(newLoanAmount) || 0);
    const annualRate = Math.max(0, Number(newLoanInterestRate) || 0);
    const termMonths = Math.max(1, Number(newLoanTerm) || 1);
    const extraPayment = Math.max(0, Number(extraMonthlyPayment) || 0);
    const minimumPayment = calculateLoanCost(balance, annualRate, termMonths).monthlyPayment;
    const baseline = calculateAcceleratedPayoff(balance, annualRate, minimumPayment, 0);
    const accelerated = calculateAcceleratedPayoff(balance, annualRate, minimumPayment, extraPayment);

    return {
      balance,
      minimumPayment,
      extraPayment,
      monthsSaved: Math.max(0, baseline.months - accelerated.months),
      interestSaved: Math.max(0, baseline.totalInterest - accelerated.totalInterest),
      savingsPercent: baseline.totalInterest > 0
        ? Math.min(100, Math.max(0, ((baseline.totalInterest - accelerated.totalInterest) / baseline.totalInterest) * 100))
        : 0,
      payoffMonths: accelerated.months,
    };
  }, [outstandingBalanceInput, newLoanAmount, newLoanInterestRate, newLoanTerm, extraMonthlyPayment]);
  const borrowingCapacityAnalysis = useMemo(() => {
    const monthlyIncome = Math.max(0, Number(selectedRecord?.monthly_income) || 0)
      + Math.max(0, Number(selectedRecord?.other_income) || 0);
    const existingMonthlyDebt = Math.max(0, Number(selectedRecord?.debt_obligations) || 0);
    const dsrLimit = Math.max(1, Math.min(100, Number(borrowingDsrLimit) || 35));
    const availablePayment = Math.max(0, (monthlyIncome * dsrLimit / 100) - existingMonthlyDebt);
    const estimatedCapacity = calculatePrincipalFromPayment(
      availablePayment,
      Math.max(0, Number(newLoanInterestRate) || 0),
      Math.max(1, Number(newLoanTerm) || 1),
    );

    return { monthlyIncome, existingMonthlyDebt, dsrLimit, availablePayment, estimatedCapacity };
  }, [selectedRecord, borrowingDsrLimit, newLoanInterestRate, newLoanTerm]);

  const handleSaveMonitoringRecord = async () => {
    const applicationNo = selectedProfileApplicationNo || selectedApplicationNo;
    if (!applicationNo || !selectedRecord) {
      setMonitoringSaveMessage('Select an APP Profile ID and monitored loan before saving.');
      return;
    }

    const statementRows = snapshot.statementRows;
    const principalPaid = statementRows.reduce((sum, row) => sum + Math.max(0, row.principal), 0);
    const interestPaid = statementRows.reduce((sum, row) => sum + Math.max(0, row.interest), 0);
    const monthlyPayment = statementRows[0]
      ? statementRows[0].principal + statementRows[0].interest
      : debtSavingsAnalysis.minimumPayment;
    try {
      await Promise.all([
        saveLoanApplicationMonitoring(applicationNo, {
          monitoring_date: new Date().toISOString().slice(0, 10),
          outstanding_balance: Math.max(0, Number(outstandingBalanceInput) || debtSavingsAnalysis.balance),
          principal_paid: principalPaid,
          interest_paid: interestPaid,
          monthly_payment: monthlyPayment,
          days_past_due: Math.max(0, snapshot.pastDueCount),
          loan_status: snapshot.sourceRecordStatus.slice(0, 30) || 'CURRENT',
          dsr: Number(selectedRecord.dsr) || 0,
          ltv: Number(selectedRecord.ltv) || 0,
          risk_level: `${loanMonitoringScore.grade} ${loanMonitoringScore.interpretation}`.slice(0, 30),
        }),
        persistAdditionalLoans(),
      ]);
      setMonitoringSaveMessage('Loan monitoring inputs saved to the selected Profile ID record.');
    } catch {
      setMonitoringSaveMessage('Inputs remain in autosave, but the selected Profile ID monitoring record could not be updated. Please retry.');
    }
  };
  const consolidationAnalysis = useMemo(() => {
    const portfolioLoans = monitoredApplications.map((record) => ({
      balance: record.application_no === selectedApplicationNo
        ? Math.max(0, Number(outstandingBalanceInput) || Number(record.loan_amount) || 0)
        : Math.max(0, Number(record.loan_amount) || 0),
      rate: Math.max(0, Number(record.interest_rate) || 0),
      term: Math.max(1, Number(record.term_months) || 1),
    }));
    const addedLoans = additionalSchedules.map((schedule) => ({
      balance: Math.max(0, schedule.loanAmount),
      rate: Math.max(0, schedule.interestRate),
      term: Math.max(1, schedule.termMonths),
    }));
    const loans = [...portfolioLoans, ...addedLoans].filter((item) => item.balance > 0);
    const totalBalance = loans.reduce((sum, item) => sum + item.balance, 0);
    const currentMonthlyPayment = loans.reduce(
      (sum, item) => sum + calculateLoanCost(item.balance, item.rate, item.term).monthlyPayment,
      0,
    );
    const weightedAverageRate = totalBalance > 0
      ? loans.reduce((sum, item) => sum + (item.rate * item.balance), 0) / totalBalance
      : 0;
    const rates = loans.map((item) => item.rate);
    const rateSpread = rates.length > 0 ? Math.max(...rates) - Math.min(...rates) : 0;
    const longestTerm = loans.length > 0 ? Math.max(...loans.map((item) => item.term)) : 1;
    const positiveRates = rates.filter((rate) => rate > 0);
    const comparisonRate = positiveRates.length > 0
      ? Math.min(...positiveRates)
      : Math.max(0, weightedAverageRate - 1);
    const consolidatedMonthlyPayment = calculateLoanCost(totalBalance, comparisonRate, longestTerm).monthlyPayment;
    const guidance = loans.length < 2
      ? 'At least two active loans are needed for a meaningful consolidation comparison. Add or select the other obligations first.'
      : comparisonRate >= weightedAverageRate
        ? 'The comparison rate does not improve the weighted portfolio rate. Keep loans separate unless reduced fees, simpler servicing, or a shorter term creates a clear benefit.'
        : rateSpread >= 1
          ? `Consolidation merits review because rates vary by ${rateSpread.toFixed(2)} percentage points. Prioritize replacing the highest-rate balances, but confirm settlement and origination fees before proceeding.`
          : 'Rates are relatively close. Consolidation may simplify payments, but savings could be modest; avoid extending the term solely to reduce the monthly installment.';

    return {
      loanCount: loans.length,
      totalBalance,
      weightedAverageRate,
      comparisonRate,
      currentMonthlyPayment,
      consolidatedMonthlyPayment,
      guidance,
    };
  }, [monitoredApplications, additionalSchedules, selectedApplicationNo, outstandingBalanceInput]);
  const loanMonitoringScore = useMemo(() => {
    const beginningBalance = Math.max(0, Number(selectedRecord?.loan_amount) || Number(newLoanAmount) || 0);
    const currentBalance = Math.max(0, Number(outstandingBalanceInput) || snapshot.endBalance || beginningBalance);
    const bankingRelationships = selectedRecord?.requirements?.bankingRelationships;
    const creditLimit = Math.max(0, Number(bankingRelationships?.creditLimit) || 0);
    const creditCapacity = creditLimit > 0 ? creditLimit : currentBalance + Math.max(0, snapshot.availableCredit);
    const utilizationPercent = creditCapacity > 0 ? (currentBalance / creditCapacity) * 100 : null;
    const dsrValue = getControlActual(snapshot, 'dsr-control');
    const dsrPercent = selectedRecord && dsrValue > 0 ? dsrValue : null;
    const primaryLtv = getControlActual(snapshot, 'ltv-control');
    const collateralizedBalances = [
      ...(primaryLtv > 0 ? [{ balance: currentBalance, ltv: primaryLtv }] : []),
      ...additionalSchedules
        .filter((loan) => loan.loanToValueRatio > 0)
        .map((loan) => ({
          balance: Math.max(0, loan.outstandingBalance || loan.loanAmount),
          ltv: loan.loanToValueRatio,
        })),
    ];
    const collateralizedTotal = collateralizedBalances.reduce((total, loan) => total + loan.balance, 0);
    const ltvPercent = collateralizedTotal > 0
      ? collateralizedBalances.reduce((total, loan) => total + loan.ltv * loan.balance, 0) / collateralizedTotal
      : null;
    const paymentHistory = String(bankingRelationships?.creditPaymentHistory ?? '').toLowerCase();
    const delinquentAccounts = Math.max(0, Number(selectedRecord?.credit_bureau_reports?.delinquent_accounts) || 0);
    const daysPastDue = !selectedRecord
      ? null
      : delinquentAccounts > 0 || /late|missed|delinquent|past due/.test(paymentHistory)
        ? 30
        : /current|on time|good|excellent|never late/.test(paymentHistory) || snapshot.pastDueCount === 0
          ? 0
          : Math.min(90, snapshot.pastDueCount * 30);
    const portfolioLoans = [
      ...monitoredApplications.map((record) => ({
        rate: Math.max(0, Number(record.interest_rate) || 0),
        type: record.product_type || 'Unspecified',
        lender: record.requirements?.bankingRelationships?.loanLender || 'Primary lender',
      })),
      ...additionalSchedules.map((loan) => ({
        rate: Math.max(0, loan.interestRate),
        type: loan.loanType || 'Unspecified',
        lender: loan.entityIssuer || 'Unspecified lender',
      })),
    ];
    const refinancingImprovesCashFlow = consolidationAnalysis.loanCount > 1
      && consolidationAnalysis.consolidatedMonthlyPayment < consolidationAnalysis.currentMonthlyPayment * 0.99;

    return computeLoanMonitoringScore({
      daysPastDue,
      beginningBalance,
      currentBalance,
      dsrPercent,
      utilizationPercent,
      ltvPercent,
      activeLoanCount: portfolioLoans.length,
      highInterestLoanCount: portfolioLoans.filter((loan) => loan.rate > 12).length,
      distinctLoanTypeCount: new Set(portfolioLoans.map((loan) => loan.type)).size,
      distinctLenderCount: new Set(portfolioLoans.map((loan) => loan.lender)).size,
      refinancingImprovesCashFlow,
      consolidationOpportunity: portfolioLoans.length <= 1 || consolidationAnalysis.comparisonRate < consolidationAnalysis.weightedAverageRate,
      principalPrepayment: debtSavingsAnalysis.extraPayment > 0,
      decliningPaymentBehavior: (dsrPercent ?? 0) > 50,
      increasingPastDues: (daysPastDue ?? 0) > 30,
      savingsBehaviorScore: budgetHealthScore ? (budgetHealthScore.savingsDiscipline / 20) * 100 : null,
      budgetAdherenceScore: budgetHealthScore ? (budgetHealthScore.adherence / 30) * 100 : null,
    });
  }, [
    additionalSchedules,
    budgetHealthScore,
    consolidationAnalysis,
    debtSavingsAnalysis.extraPayment,
    monitoredApplications,
    newLoanAmount,
    outstandingBalanceInput,
    selectedRecord,
    snapshot,
  ]);
  const advisorSnapshot = useMemo(
    () => ({ ...snapshot, healthScore: loanMonitoringScore.score }),
    [loanMonitoringScore.score, snapshot],
  );
  const advisor = useMemo(
    () => buildAiAdvisor(advisorSnapshot),
    [advisorSnapshot],
  );
  const monitoringAutosaveValue = useMemo<LoanMonitoringDraft>(() => ({
    ...monitoringDraft,
    publishedScore: loanMonitoringScore,
  }), [loanMonitoringScore, monitoringDraft]);

  useAutosaveDraft({
    scope: 'loan-monitoring',
    entityKey: entityKey || 'identity-pending',
    value: monitoringAutosaveValue,
    defaults: monitoringDraft,
    onHydrate: hydrateMonitoringDraft,
    enabled: isIdentityReady,
  });
  const loanScoreImpactAnalysis = useMemo(() => {
    const monthlyIncome = Math.max(0, Number(selectedRecord?.monthly_income) || 0)
      + Math.max(0, Number(selectedRecord?.other_income) || 0);
    const monthlyPayments = consolidationAnalysis.currentMonthlyPayment;
    const paymentBurden = monthlyIncome > 0 ? (monthlyPayments / monthlyIncome) * 100 : 0;
    const creditImpact = snapshot.pastDueCount === 0 && loanMonitoringScore.score >= 75
      ? 'Positive'
      : snapshot.pastDueCount <= 1 && loanMonitoringScore.score >= 60
        ? 'Monitor'
        : 'Needs attention';
    const wealthImpact = monthlyIncome <= 0
      ? 'Income needed'
      : paymentBurden <= 20
        ? 'Supports growth'
        : paymentBurden <= 35
          ? 'Moderate pressure'
          : 'High pressure';
    const tone = creditImpact === 'Positive' && wealthImpact === 'Supports growth'
      ? 'maintain'
      : creditImpact === 'Needs attention' || wealthImpact === 'High pressure'
        ? 'attention'
        : 'watch';

    return {
      creditImpact,
      wealthImpact,
      tone,
      paymentBurden,
      creditAnalysis: snapshot.pastDueCount === 0
        ? `No projected past-due installments are reducing the current loan health score of ${loanMonitoringScore.score.toFixed(1)}.`
        : `${snapshot.pastDueCount} projected past-due installment(s) may weaken repayment history and Credit Health until brought current.`,
      wealthAnalysis: monthlyIncome > 0
        ? `Estimated loan payments use ${paymentBurden.toFixed(1)}% of monthly income. The extra-payment plan could save ${formatMetricValue(debtSavingsAnalysis.interestSaved, 'currency')} in interest and release cashflow sooner.`
        : 'Add monthly income data to measure payment burden and its effect on wealth-building capacity.',
    };
  }, [consolidationAnalysis.currentMonthlyPayment, debtSavingsAnalysis.interestSaved, loanMonitoringScore.score, selectedRecord, snapshot.pastDueCount]);

  const cashCoverage = useMemo(() => {
    const buildProfile = readReplicatedBuildProfile();
    const stepEightAmounts = buildProfile?.values ?? {};
    const liquidCash = buildProfile
      ? computeNetWorthBuildingScore({ amounts: stepEightAmounts }).metrics.liquidAssets
      : 0;
    const savedExpenseRows = (budgetDraft?.savedSetup ?? []).filter((item) => item.type === 'expense');
    const monthlyExpenses = savedExpenseRows.length > 0
      ? savedExpenseRows.reduce((total, item) => {
          const actualValue = budgetDraft?.actualEntries?.[item.id];
          const effectiveValue = String(actualValue ?? '').trim() !== ''
            ? Number(actualValue)
            : item.setupAmount;
          return total + Math.max(0, Number(effectiveValue) || 0);
        }, 0)
      : Object.values(budgetDraft?.expenseDraft ?? {}).reduce<number>(
          (total, value) => total + Math.max(0, Number(value) || 0),
          0,
        );

    return computeCashCoverage({ liquidCash, monthlyExpenses });
  }, [budgetDraft]);

  const collateralCoverage = useMemo(() => {
    const replicatedProfile = readReplicatedBuildProfile();
    const storedProfile = selectedRecord?.requirements?.buildProfile;
    const repositoryProfile = storedProfile && typeof storedProfile === 'object' && !Array.isArray(storedProfile)
      ? storedProfile as Record<string, unknown>
      : {};
    const buildProfile = replicatedProfile ?? repositoryProfile;
    const storedValues = 'values' in buildProfile ? buildProfile.values : null;
    const profileValues = storedValues && typeof storedValues === 'object' && !Array.isArray(storedValues)
      ? storedValues as Record<string, unknown>
      : {};
    const profileCollection = (key: string) => {
      const collection = key in buildProfile ? buildProfile[key as keyof typeof buildProfile] : undefined;
      return Array.isArray(collection) ? collection as Array<Record<string, unknown>> : [];
    };
    const primaryCollateral = Math.max(
      0,
      Number(profileValues.appraisedValue) || 0,
      Number(profileValues.propertyAppraisedValue) || 0,
    );
    const additionalCollateral = profileCollection('additionalCollaterals').reduce(
      (total, collateral) => total + Math.max(0, Number(collateral.appraisedValue) || 0),
      0,
    );
    const realEstateCollateral = profileCollection('realEstateCollaterals').reduce(
      (total, collateral) => total + Math.max(0, Number(collateral.appraisedValue) || 0),
      0,
    );
    const financialCollateral = profileCollection('financialInstrumentCollaterals').reduce(
      (total, collateral) => total + Math.max(0, Number(collateral.markToMarket) || Number(collateral.value) || 0),
      0,
    );
    const loanBalance = Math.max(
      0,
      Number(outstandingBalanceInput)
        || Number(profileValues.loanCurrentBalance)
        || Number(profileValues.currentBalance)
        || Number(selectedRecord?.loan_amount)
        || Number(profileValues.requestedAmount)
        || Number(newLoanAmount)
        || 0,
    );

    return computeCollateralCoverage({
      loanBalance,
      collateralValue: primaryCollateral
        + additionalCollateral
        + realEstateCollateral
        + financialCollateral
        || Math.max(0, Number(selectedRecord?.appraised_value) || 0),
    });
  }, [newLoanAmount, outstandingBalanceInput, selectedRecord]);
  const loanOptimizationInput = useMemo(() => ({
    prioritizedLoanSavingsPercent: debtSavingsAnalysis.savingsPercent,
    cashOptimizationScore: cashCoverage.score,
    collateralOptimizationScore: collateralCoverage.score,
  }), [cashCoverage.score, collateralCoverage.score, debtSavingsAnalysis.savingsPercent]);

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
    const hasHealthScore = Number.isFinite(loanMonitoringScore.score);
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
    loanMonitoringScore.score,
    workflowConfig,
  ]);
  const workflowProgressPercent = Math.round((step / workflowSteps.length) * 100);
  const stepperButtonClass = 'loan-stepper-button';

  const handleRunAdditionalInstallmentSchedule = () => {
    setAdditionalSchedules((previous) => [...previous, createAdditionalLoan()]);
    setAdditionalScheduleMessage('Additional loan row added. Complete the row, then save it to the profile.');
  };

  const updateAdditionalLoan = (id: string, field: AdditionalLoanInputField, value: string) => {
    setAdditionalSchedules((previous) => previous.map((schedule) => {
      if (schedule.id !== id) {
        return schedule;
      }
      const numericFields: AdditionalLoanInputField[] = [
        'loanAmount',
        'interestRate',
        'termMonths',
        'outstandingBalance',
        'collateralRecordedValue',
        'collateralCurrentValue',
        'markToMarketValuation',
      ];
      const next = {
        ...schedule,
        [field]: numericFields.includes(field) ? Number(value) || 0 : value,
      };
      return normalizeAdditionalLoan(next) ?? schedule;
    }));
  };

  const persistAdditionalLoans = async () => {
    if (!selectedRecord) {
      throw new Error('No selected profile');
    }
    const existingBuildProfile = selectedRecord.requirements.buildProfile;
    const buildProfile = existingBuildProfile && typeof existingBuildProfile === 'object' && !Array.isArray(existingBuildProfile)
      ? existingBuildProfile
      : {};
    const additionalLoans = additionalSchedules.map((loan) => ({
      id: loan.id,
      loanType: loan.loanType,
      entityIssuer: loan.entityIssuer,
      loanAmount: loan.loanAmount,
      dateStarted: loan.dateStarted,
      interestRate: loan.interestRate,
      termMonths: loan.termMonths,
      outstandingBalance: loan.outstandingBalance,
      collateralAsset: loan.collateralAsset,
      collateralRecordedValue: loan.collateralRecordedValue,
      collateralCurrentValue: loan.collateralCurrentValue,
      markToMarketValuation: loan.markToMarketValuation,
      loanToValueRatio: loan.loanToValueRatio,
    }));
    await updateLoanApplication(selectedRecord.application_no, {
      ...selectedRecord,
      requirements: {
        ...selectedRecord.requirements,
        buildProfile: {
          ...buildProfile,
          additionalLoans,
        },
      },
    });
  };

  const handleSaveAdditionalLoans = async () => {
    if (!selectedRecord) {
      setAdditionalScheduleMessage('Select an APP Profile ID before saving additional loans.');
      return;
    }
    setIsSavingAdditionalLoans(true);
    try {
      await persistAdditionalLoans();
      setAdditionalScheduleMessage('Additional loans and installment setup saved to the selected user profile.');
    } catch {
      setAdditionalScheduleMessage('Additional loans remain in autosave, but the user profile could not be updated. Please retry.');
    } finally {
      setIsSavingAdditionalLoans(false);
    }
  };

  return (
    <div className="psychometric-page loan-monitoring-dashboard-page">
      <section className="psychometric-hero loan-monitoring-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Loan Performance Oversight</span>
          <h1>Debt Cash Collateral Optimizer</h1>
          <p>
            Period: <strong>{snapshot.dateLabel}</strong>
          </p>
          <p>
            Built from live loan statuses, DSR, LTV, decision outcomes, and pipeline aging indicators
            using portfolio-monitoring best practices.
          </p>
        </div>
      </section>

      <section className="psychometric-summary-grid" style={{ marginBottom: '12px' }}>
        <small>{`Step ${step}/${workflowSteps.length}: ${currentStepLabel}`}</small>
      </section>

      <section className="psychometric-summary-grid dashboard-five-card-summary loan-monitoring-summary-grid">
        <SelectedProfileIdCard />

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

        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Progress</span>
          <strong>{workflowProgressPercent}%</strong>
          <small>{currentStepLabel}</small>
        </article>

      </section>

      <LoanOptimizationTachometer input={loanOptimizationInput} />

      <section className="budget-dashboard-layout">
        <div className="budget-dashboard-main">
          <article className="psychometric-panel workflow-horizontal-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Workflow Steps</span>
                <h2>Navigate Workflow Steps</h2>
              </div>
            </div>
            <p className="psychometric-section-note">
              {`Thresholds: In Progress >= ${workflowConfig.thresholds.inProgressMin}% | Complete = ${workflowConfig.thresholds.completeMin}%`}
            </p>

            <div className="lending-psychometric-step-list workflow-horizontal-step-list">
              {workflowSteps.map((workflowStep) => {
                const isActive = step === workflowStep.id;
                const isCompleted = step > workflowStep.id;
                const stepPercent = stepCompletionById[workflowStep.id];
                const statusLabel = `${stepPercent}% Info Inputs`;
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
                    </div>
                  </button>
                );
              })}
            </div>
          </article>

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
                      $<option value="Other">Other</option>
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
                    <NumericFormat
                      value={newLoanAmount}
                      thousandSeparator=","
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative={false}
                      onValueChange={(values) => setNewLoanAmount(values.value)}
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
                    <NumericFormat
                      value={outstandingBalanceInput}
                      thousandSeparator=","
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative={false}
                      onValueChange={(values) => setOutstandingBalanceInput(values.value)}
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
                    Add Another Loan Not Declared in Building Profile
                  </button>
                </div>

                {additionalSchedules.length > 0 ? (
                  <div className="psychometric-scale-table-wrap loan-monitoring-additional-loans">
                    <table className="psychometric-scale-table">
                      <thead>
                        <tr>
                          <th>Loan Type</th>
                          <th>Entity Issuer</th>
                          <th>Original Amount</th>
                          <th>Date Started</th>
                          <th>Interest Rate %</th>
                          <th>Term (Months)</th>
                          <th>Outstanding Balance</th>
                          <th>Collateral Asset</th>
                          <th>Collateral Recorded Value</th>
                          <th>Collateral Current Value</th>
                          <th className="loan-monitoring-mark-to-market-heading">
                            Mark to Market Valuation
                            <small>Allow mark to market</small>
                          </th>
                          <th>Loan to Value Ratio</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {additionalSchedules.map((schedule, index) => (
                          <tr key={schedule.id}>
                            <td><input aria-label={`Additional loan ${index + 1} loan type`} value={schedule.loanType} onChange={(event) => updateAdditionalLoan(schedule.id, 'loanType', event.target.value)} /></td>
                            <td><input aria-label={`Additional loan ${index + 1} entity issuer`} value={schedule.entityIssuer} onChange={(event) => updateAdditionalLoan(schedule.id, 'entityIssuer', event.target.value)} /></td>
                            <td><NumericFormat aria-label={`Additional loan ${index + 1} original amount`} value={schedule.loanAmount || ''} thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateAdditionalLoan(schedule.id, 'loanAmount', value)} /></td>
                            <td><input aria-label={`Additional loan ${index + 1} date started`} type="date" value={schedule.dateStarted} onChange={(event) => updateAdditionalLoan(schedule.id, 'dateStarted', event.target.value)} /></td>
                            <td><NumericFormat aria-label={`Additional loan ${index + 1} interest rate`} value={schedule.interestRate || ''} thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateAdditionalLoan(schedule.id, 'interestRate', value)} /></td>
                            <td><NumericFormat aria-label={`Additional loan ${index + 1} term months`} value={schedule.termMonths || ''} thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateAdditionalLoan(schedule.id, 'termMonths', value)} /></td>
                            <td><NumericFormat aria-label={`Additional loan ${index + 1} outstanding balance`} value={schedule.outstandingBalance || ''} thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateAdditionalLoan(schedule.id, 'outstandingBalance', value)} /></td>
                            <td><input aria-label={`Additional loan ${index + 1} collateral asset`} value={schedule.collateralAsset} onChange={(event) => updateAdditionalLoan(schedule.id, 'collateralAsset', event.target.value)} /></td>
                            <td><NumericFormat aria-label={`Additional loan ${index + 1} collateral recorded value`} value={schedule.collateralRecordedValue || ''} thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateAdditionalLoan(schedule.id, 'collateralRecordedValue', value)} /></td>
                            <td><NumericFormat aria-label={`Additional loan ${index + 1} collateral current value`} value={schedule.collateralCurrentValue || ''} thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateAdditionalLoan(schedule.id, 'collateralCurrentValue', value)} /></td>
                            <td className="loan-monitoring-mark-to-market-cell"><NumericFormat aria-label={`Additional loan ${index + 1} mark to market valuation`} value={schedule.markToMarketValuation || ''} thousandSeparator="," decimalScale={2} fixedDecimalScale inputMode="decimal" allowNegative={false} onValueChange={({ value }) => updateAdditionalLoan(schedule.id, 'markToMarketValuation', value)} /></td>
                            <td><NumericFormat aria-label={`Additional loan ${index + 1} loan to value ratio`} value={schedule.loanToValueRatio} thousandSeparator="," decimalScale={2} fixedDecimalScale suffix="%" readOnly /></td>
                            <td>
                              <button type="button" className="budget-dashboard-category-reset" onClick={() => setAdditionalSchedules((previous) => previous.filter((item) => item.id !== schedule.id))}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="budget-workflow-inline-actions">
                      <button type="button" className="psychometric-reset-button" onClick={handleSaveAdditionalLoans} disabled={isSavingAdditionalLoans}>
                        {isSavingAdditionalLoans ? 'Saving...' : 'Save Additional Loans to Profile'}
                      </button>
                    </div>
                  </div>
                ) : null}

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

                <details className="loan-monitoring-statement" open>
                  <summary>Loan statement 1</summary>
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
                </details>

                {additionalSchedules.map((schedule, scheduleIndex) => (
                  <details key={schedule.id} className="loan-monitoring-statement">
                    <summary>{`Loan statement ${scheduleIndex + 2}`}</summary>
                    <p className="psychometric-section-note">
                      Amount: {formatMetricValue(schedule.loanAmount, 'currency')} | Interest Rate: {schedule.interestRate.toFixed(2)}% | Term: {schedule.termMonths} months | Monthly Installment: {formatMetricValue(schedule.monthlyPayment, 'currency')}
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
                  </details>
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
                        <th>Issuer/ Lender</th>
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

                <section className="loan-monitoring-step3-tools" aria-label="Loan analysis tools">
                  <div className="loan-monitoring-tool-grid">
                    <article className="budget-dashboard-indicator budget-dashboard-status-maintain loan-monitoring-hover-tool" tabIndex={0}>
                      <span>Debt Savings Calculator</span>
                      <p>Estimate potential savings from prepayments, lower rates, or term adjustments.</p>
                      <div className="loan-monitoring-tool-popout" role="region" aria-label="Debt Savings Calculator">
                        <h3>Debt Savings Calculator</h3>
                        <label>Extra Monthly Payment
                          <NumericFormat value={extraMonthlyPayment} valueIsNumericString thousandSeparator="," decimalScale={2} fixedDecimalScale allowNegative={false} onValueChange={({ value }) => setExtraMonthlyPayment(value)} />
                        </label>
                        <dl>
                          <div><dt>Current balance</dt><dd>{formatMetricValue(debtSavingsAnalysis.balance, 'currency')}</dd></div>
                          <div><dt>Regular payment</dt><dd>{formatMetricValue(debtSavingsAnalysis.minimumPayment, 'currency')}</dd></div>
                          <div><dt>Estimated payoff</dt><dd>{debtSavingsAnalysis.payoffMonths > 0 ? `${debtSavingsAnalysis.payoffMonths} months` : 'Complete loan terms'}</dd></div>
                          <div><dt>Months saved</dt><dd>{debtSavingsAnalysis.monthsSaved}</dd></div>
                          <div><dt>Interest saved</dt><dd>{formatMetricValue(debtSavingsAnalysis.interestSaved, 'currency')}</dd></div>
                        </dl>
                      </div>
                    </article>
                    <article className="budget-dashboard-indicator budget-dashboard-status-maintain loan-monitoring-hover-tool" tabIndex={0}>
                      <span>Borrowing Capacity Simulator</span>
                      <p>Simulate borrowing headroom based on current debt service and cashflow.</p>
                      <div className="loan-monitoring-tool-popout" role="region" aria-label="Borrowing Capacity Simulator">
                        <h3>Borrowing Capacity Simulator</h3>
                        <label>Maximum DSR (%)
                          <NumericFormat value={borrowingDsrLimit} valueIsNumericString decimalScale={0} allowNegative={false} onValueChange={({ value }) => setBorrowingDsrLimit(value)} />
                        </label>
                        <dl>
                          <div><dt>Monthly income</dt><dd>{formatMetricValue(borrowingCapacityAnalysis.monthlyIncome, 'currency')}</dd></div>
                          <div><dt>Existing monthly debt</dt><dd>{formatMetricValue(borrowingCapacityAnalysis.existingMonthlyDebt, 'currency')}</dd></div>
                          <div><dt>Available payment</dt><dd>{formatMetricValue(borrowingCapacityAnalysis.availablePayment, 'currency')}</dd></div>
                          <div><dt>Estimated capacity</dt><dd>{formatMetricValue(borrowingCapacityAnalysis.estimatedCapacity, 'currency')}</dd></div>
                        </dl>
                        <small>Estimate uses the current Loan Setup rate and term. Final capacity remains subject to lender policy.</small>
                      </div>
                    </article>
                    <article className="budget-dashboard-indicator budget-dashboard-status-watch loan-monitoring-hover-tool" tabIndex={0}>
                      <span>Loan Restructuring Advisor</span>
                      <p>Assess refinance, consolidation, and restructuring options to reduce repayment pressure.</p>
                      <div className="loan-monitoring-tool-popout" role="region" aria-label="Loan Consolidation Guidance">
                        <h3>Loan Consolidation Guidance</h3>
                        <dl>
                          <div><dt>Loans analyzed</dt><dd>{consolidationAnalysis.loanCount}</dd></div>
                          <div><dt>Total balance</dt><dd>{formatMetricValue(consolidationAnalysis.totalBalance, 'currency')}</dd></div>
                          <div><dt>Weighted rate</dt><dd>{consolidationAnalysis.weightedAverageRate.toFixed(2)}%</dd></div>
                          <div><dt>Comparison rate</dt><dd>{consolidationAnalysis.comparisonRate.toFixed(2)}%</dd></div>
                          <div><dt>Current payments</dt><dd>{formatMetricValue(consolidationAnalysis.currentMonthlyPayment, 'currency')}</dd></div>
                          <div><dt>Consolidated estimate</dt><dd>{formatMetricValue(consolidationAnalysis.consolidatedMonthlyPayment, 'currency')}</dd></div>
                        </dl>
                        <p>{consolidationAnalysis.guidance}</p>
                        <small>Review prepayment penalties, new origination fees, collateral changes, and total interest over the revised term before consolidating.</small>
                      </div>
                    </article>
                    <article className={`budget-dashboard-indicator budget-dashboard-status-${loanScoreImpactAnalysis.tone} loan-monitoring-score-impact`}>
                      <span>Loan Payment and Status Impact</span>
                      <strong>Credit Health and Wealth Building</strong>
                      <dl>
                        <div><dt>Credit Health Score impact</dt><dd>{loanScoreImpactAnalysis.creditImpact}</dd></div>
                        <div><dt>Wealth Building Score impact</dt><dd>{loanScoreImpactAnalysis.wealthImpact}</dd></div>
                        <div><dt>Payment burden</dt><dd>{loanScoreImpactAnalysis.paymentBurden.toFixed(1)}%</dd></div>
                      </dl>
                      <p>{loanScoreImpactAnalysis.creditAnalysis}</p>
                      <p>{loanScoreImpactAnalysis.wealthAnalysis}</p>
                    </article>
                  </div>
                </section>



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

                <section className="psychometric-panel" aria-labelledby="debt-behavioral-health-title">
                  <div className="psychometric-panel-header">
                    <div>
                      <span className="psychometric-panel-kicker">Debt behavior</span>
                      <h2 id="debt-behavioral-health-title">Debt Behavioral Health</h2>
                    </div>
                  </div>
                  <div className="budget-dashboard-indicator-row">
                    {loanMonitoringScore.behavioralHealth.map((measure) => (
                      <article key={measure.id} className="budget-dashboard-indicator">
                        <span>{measure.label}</span>
                        <strong>{measure.score === null ? 'Pending' : `${measure.score.toFixed(1)} / 100`}</strong>
                        <p>{measure.basis}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <div className="budget-workflow-inline-actions">
                  <button type="button" className="budget-dashboard-category-reset" onClick={() => setStep(3)}>
                    Back to Step 3
                  </button>
                  <button type="button" className="psychometric-reset-button" onClick={() => void handleSaveMonitoringRecord()}>
                    Save Monitoring Record
                  </button>
                </div>
                {monitoringSaveMessage ? <p className="psychometric-section-note" role="status">{monitoringSaveMessage}</p> : null}
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

              <div className="budget-dashboard-indicator-row">
                <article className="budget-dashboard-indicator budget-dashboard-status-maintain">
                  <span>Strengths</span>
                  <strong>What supports the score</strong>
                  <p>{loanMonitoringScore.strengths.join('; ')}.</p>
                </article>
                <article className="budget-dashboard-indicator budget-dashboard-status-watch">
                  <span>Areas for Improvement</span>
                  <strong>Priority actions</strong>
                  <p>{loanMonitoringScore.improvements.join('; ')}.</p>
                </article>
              </div>

              <section className="psychometric-panel" aria-labelledby="loan-predictive-ai-title">
                <div className="psychometric-panel-header">
                  <div>
                    <span className="psychometric-panel-kicker">Predictive AI</span>
                    <h2 id="loan-predictive-ai-title">Estimated Future Loan Outcomes</h2>
                  </div>
                </div>
                <p className="psychometric-section-note">
                  Deterministic estimates from current monitoring inputs. These are planning indicators, not lending decisions or guarantees.
                </p>
                <div className="budget-dashboard-indicator-row">
                  <article className="budget-dashboard-indicator">
                    <span>Probability of Default</span>
                    <strong>{loanMonitoringScore.predictions.probabilityOfDefault.toFixed(1)}%</strong>
                    <p>Estimated from payment, DSR, utilization, collateral, portfolio, and behavioral pressure.</p>
                  </article>
                  <article className="budget-dashboard-indicator">
                    <span>Probability of Restructuring</span>
                    <strong>{loanMonitoringScore.predictions.probabilityOfRestructuring.toFixed(1)}%</strong>
                    <p>Estimated from debt-service stress, payment condition, balance progress, and portfolio complexity.</p>
                  </article>
                  <article className="budget-dashboard-indicator">
                    <span>Probability of Early Payoff</span>
                    <strong>{loanMonitoringScore.predictions.probabilityOfEarlyPayoff.toFixed(1)}%</strong>
                    <p>Estimated from balance reduction, payment condition, capacity, and prepayment planning.</p>
                  </article>
                  <article className="budget-dashboard-indicator">
                    <span>Wealth-building Impact</span>
                    <strong>{loanMonitoringScore.predictions.wealthBuildingImpact.toFixed(1)} / 100</strong>
                    <p>Expected support for savings and wealth capacity after debt obligations.</p>
                  </article>
                  <article className="budget-dashboard-indicator">
                    <span>Financial Resilience Under Stress</span>
                    <strong>{loanMonitoringScore.predictions.financialResilienceUnderStress.toFixed(1)} / 100</strong>
                    <p>Capacity to absorb pressure using payment, DSR, collateral, portfolio, and budget signals.</p>
                  </article>
                  <article className="budget-dashboard-indicator">
                    <span>Expected Loan Trajectory</span>
                    <strong>{loanMonitoringScore.predictions.expectedLoanTrajectory}</strong>
                    <p>Directional outlook based on the current score components.</p>
                  </article>
                </div>
              </section>
            </article>
          ) : null}
        </div>

        <aside className="budget-dashboard-side loan-monitoring-cash-coverage-side" aria-label="Debt and coverage analysis">
          <DebtBalanceStackedChart accounts={debtBalanceAccounts} />
          <CashCoverageGauge result={cashCoverage} />
          <CollateralCoverageGauge result={collateralCoverage} />
        </aside>

      </section>

    </div>
  );
}
