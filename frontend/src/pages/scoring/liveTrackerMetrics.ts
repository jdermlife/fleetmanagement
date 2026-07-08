import type { LoanApplicationRecord } from '../../api/loan';
import {
  isAcceptableDsr,
  isApproveBand,
  isElevatedLtv,
  isReviewBand,
  isRiskyLtv,
  isSafeLtv,
  isStrongDsr,
} from '../../config/creditPolicy';
import type { TrackerItem } from './FinancialTrackerTemplate';

type DecisionBand = 'approve' | 'review' | 'decline' | 'unknown';
type BudgetStatus = 'maintain' | 'watch' | 'attention';

export type BudgetFlowItem = {
  id: string;
  label: string;
  amount: number;
  share: number;
  note: string;
};

export type BudgetComparisonItem = {
  id: string;
  label: string;
  actual: number;
  budget: number;
  variance: number;
  attainment: number;
  status: BudgetStatus;
  note: string;
};

export type BudgetIndicator = {
  id: string;
  label: string;
  value: number;
  target: number;
  attainment: number;
  status: BudgetStatus;
  note: string;
};

export type BudgetDashboardSnapshot = {
  periodLabel: string;
  dateLabel: string;
  sourceLabel: string;
  sourceApplicationNo: string;
  healthScore: number;
  performanceBand: string;
  totalIncome: number;
  totalKnownExpenses: number;
  totalExpenseBudget: number;
  netCashflow: number;
  trackedAreas: number;
  budgetReadyCount: number;
  watchlistCount: number;
  needsAttentionCount: number;
  actionLabel: string;
  budgetSetupLabel: string;
  expenseLoggingLabel: string;
  livingExpenseDeclared: number;
  categoryTotal: number;
  incomeItems: BudgetFlowItem[];
  expenseItems: BudgetComparisonItem[];
  comparisonItems: BudgetComparisonItem[];
  categoryItems: BudgetFlowItem[];
  indicators: BudgetIndicator[];
};

export type MonitoringStageItem = {
  id: string;
  label: string;
  count: number;
  share: number;
  status: BudgetStatus;
  note: string;
};

export type MonitoringControlItem = {
  id: string;
  label: string;
  actual: number;
  target: number;
  variance: number;
  attainment: number;
  status: BudgetStatus;
  note: string;
  unit: 'percent' | 'days' | 'score';
};

export type LoanMonitoringSnapshot = {
  periodLabel: string;
  dateLabel: string;
  sourceLabel: string;
  sourceApplicationNo: string;
  healthScore: number;
  performanceBand: string;
  portfolioCount: number;
  openPipelineCount: number;
  releasedCount: number;
  watchlistCount: number;
  attentionCount: number;
  actionLabel: string;
  averageOpenAgeDays: number;
  averageFinalScore: number;
  pipelineItems: MonitoringStageItem[];
  controlItems: MonitoringControlItem[];
  indicators: BudgetIndicator[];
};

export type BillReminderSnapshot = {
  periodLabel: string;
  dateLabel: string;
  sourceLabel: string;
  sourceApplicationNo: string;
  healthScore: number;
  performanceBand: string;
  portfolioCount: number;
  activeCycleCount: number;
  readyToPayCount: number;
  watchlistCount: number;
  attentionCount: number;
  actionLabel: string;
  averageSurplusRatio: number;
  scheduleItems: MonitoringStageItem[];
  controlItems: MonitoringControlItem[];
  indicators: BudgetIndicator[];
};

export type CollateralMonitoringSnapshot = {
  periodLabel: string;
  dateLabel: string;
  sourceLabel: string;
  sourceApplicationNo: string;
  healthScore: number;
  performanceBand: string;
  collateralizedCount: number;
  insuredCount: number;
  watchlistCount: number;
  attentionCount: number;
  actionLabel: string;
  averageLtv: number;
  averageCollateralScore: number;
  inventoryItems: MonitoringStageItem[];
  controlItems: MonitoringControlItem[];
  indicators: BudgetIndicator[];
};

export type NetWorthPositioningSnapshot = {
  periodLabel: string;
  dateLabel: string;
  sourceLabel: string;
  sourceApplicationNo: string;
  healthScore: number;
  performanceBand: string;
  portfolioCount: number;
  strongPositionCount: number;
  watchlistCount: number;
  attentionCount: number;
  actionLabel: string;
  averageNetCashflow: number;
  averageAssetStrength: number;
  positioningItems: MonitoringStageItem[];
  controlItems: MonitoringControlItem[];
  indicators: BudgetIndicator[];
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

function mean(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countWhere(records: LoanApplicationRecord[], matcher: (record: LoanApplicationRecord) => boolean): number {
  return records.filter(matcher).length;
}

function asPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 1) {
    return clamp(value * 100, 0, 100);
  }

  return clamp(value, 0, 100);
}

function normalizeStatus(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeDecision(value: string | undefined): DecisionBand {
  const normalized = (value ?? '').trim().toLowerCase();

  if (
    normalized === 'approve' ||
    normalized === 'approved' ||
    normalized === 'released'
  ) {
    return 'approve';
  }

  if (
    normalized === 'review' ||
    normalized === 'submitted' ||
    normalized === 'under review' ||
    normalized === 'credit review'
  ) {
    return 'review';
  }

  if (
    normalized === 'decline' ||
    normalized === 'declined' ||
    normalized === 'rejected'
  ) {
    return 'decline';
  }

  return 'unknown';
}

function getFinalScore(record: LoanApplicationRecord): number | null {
  const fromOverall = safeNumber(record.overall_scores?.final_score);
  if (fromOverall > 0) {
    return asPercent(fromOverall);
  }

  const fromScorecard = safeNumber(record.scorecard_total);
  if (fromScorecard > 0) {
    return asPercent(fromScorecard);
  }

  return null;
}

function getDecisionBandFromScore(score: number | null): DecisionBand {
  if (score === null) {
    return 'unknown';
  }

  if (isApproveBand(score)) {
    return 'approve';
  }

  if (isReviewBand(score)) {
    return 'review';
  }

  return 'decline';
}

function getEffectiveDecisionBand(record: LoanApplicationRecord): DecisionBand {
  const explicitDecision = normalizeDecision(record.overall_scores?.final_decision);
  if (explicitDecision !== 'unknown') {
    return explicitDecision;
  }

  const statusDecision = normalizeDecision(record.status);
  if (statusDecision !== 'unknown') {
    return statusDecision;
  }

  return getDecisionBandFromScore(getFinalScore(record));
}

function getIncome(record: LoanApplicationRecord): number {
  const primaryIncome = safeNumber(record.monthly_income);
  const otherIncome = safeNumber(record.other_income);
  const grossIncome = safeNumber(record.requirements?.employmentInformation?.grossMonthlyIncome);

  return Math.max(primaryIncome + otherIncome, grossIncome);
}

function getLivingExpenses(record: LoanApplicationRecord): number {
  return safeNumber(record.requirements?.employmentInformation?.monthlyLivingExpenses);
}

function getDebt(record: LoanApplicationRecord): number {
  return safeNumber(record.debt_obligations);
}

function getSupplementalIncome(record: LoanApplicationRecord): number {
  return Math.max(
    safeNumber(record.other_income),
    safeNumber(record.requirements?.employmentInformation?.otherSourcesOfIncome),
  );
}

function getInvestmentIncome(record: LoanApplicationRecord): number {
  return safeNumber(record.requirements?.employmentInformation?.investmentIncome);
}

function getBusinessIncome(record: LoanApplicationRecord): number {
  return safeNumber(record.requirements?.employmentInformation?.businessIncome);
}

function getPensionIncome(record: LoanApplicationRecord): number {
  return safeNumber(record.requirements?.employmentInformation?.pensionIncome);
}

function getMortgageExpense(record: LoanApplicationRecord): number {
  return safeNumber(record.requirements?.bankingRelationships?.loanMonthlyAmortization);
}

function getOtherDebtExpense(record: LoanApplicationRecord): number {
  return Math.max(0, getDebt(record) - getMortgageExpense(record));
}

function getTotalIncome(record: LoanApplicationRecord): number {
  return (
    getIncome(record) +
    getSupplementalIncome(record) +
    getInvestmentIncome(record) +
    getBusinessIncome(record) +
    getPensionIncome(record)
  );
}

function getTotalKnownExpenses(record: LoanApplicationRecord): number {
  return getLivingExpenses(record) + getMortgageExpense(record) + getOtherDebtExpense(record);
}

type BudgetCategorySeed = {
  id: string;
  label: string;
  weight: number;
  note: string;
};

function buildBudgetCategorySeeds(record: LoanApplicationRecord | null): BudgetCategorySeed[] {
  const dependents = safeNumber(record?.requirements?.applicantPersonal?.numberOfDependents);
  const vehicleCount = safeNumber(record?.requirements?.otherInformation?.numberOfVehiclesOwned);
  const homeOwnership = normalizeStatus(record?.requirements?.otherInformation?.homeOwnership);
  const hasVehicle = vehicleCount > 0 || Boolean(record?.vehicle_info?.trim()) || Boolean(record?.requirements?.collateralAssetDetails?.model?.trim());
  const renterLike = homeOwnership.includes('rent');
  const ownerLike = homeOwnership.includes('owner') || homeOwnership.includes('mortgag');
  const hasInsurance = Boolean(record?.requirements?.collateralAssetDetails?.insuranceProviderCompany?.trim())
    || Boolean(record?.requirements?.enhancedDueDiligence?.existingInsurancePolicies?.trim());

  return [
    { id: 'housing', label: 'Housing', weight: ownerLike ? 8 : 7, note: 'Core shelter-related household spend.' },
    { id: 'transport', label: 'Transport', weight: hasVehicle ? 4 : 3, note: 'General mobility and commute allowance.' },
    { id: 'utilities', label: 'Utilities', weight: 3, note: 'Shared household utilities and service charges.' },
    { id: 'electricity', label: 'Electricity', weight: 4, note: 'Electric power consumption allocation.' },
    { id: 'water', label: 'Water', weight: 2, note: 'Water bill and related municipal charges.' },
    { id: 'rent', label: 'Rent', weight: renterLike ? 8 : 3, note: 'Rental commitment or tenancy-related shelter cost.' },
    { id: 'subscription', label: 'Subscription', weight: 2, note: 'Recurring digital and service subscriptions.' },
    { id: 'insurance', label: 'Insurance', weight: hasInsurance ? 3 : 2, note: 'General insurance premium allocation.' },
    { id: 'home-insurance', label: 'Home Insurance', weight: ownerLike ? 2 : 1, note: 'Property/home protection coverage.' },
    { id: 'home-maintenance', label: 'Home Maintenance', weight: ownerLike ? 3 : 2, note: 'Repair, upkeep, and maintenance buffer.' },
    { id: 'entertainment', label: 'Entertainment', weight: 3, note: 'Leisure, recreation, and discretionary spend.' },
    { id: 'food-dining', label: 'Food & Dining', weight: 6 + Math.min(dependents, 3), note: 'Meals outside the home and dining activity.' },
    { id: 'groceries', label: 'Groceries', weight: 8 + Math.min(dependents, 4), note: 'Household grocery basket and staples.' },
    { id: 'travel', label: 'Travel', weight: 2, note: 'Occasional travel and trip-related allocation.' },
    { id: 'fuel', label: 'Fuel', weight: hasVehicle ? 4 : 1, note: 'Fuel and transport energy costs.' },
    { id: 'car-insurance', label: 'Car Insurance', weight: hasVehicle ? 2 : 1, note: 'Vehicle insurance coverage allocation.' },
    { id: 'internet', label: 'Internet', weight: 3, note: 'Home or mobile internet connectivity.' },
    { id: 'phone', label: 'Phone', weight: 2, note: 'Mobile and communication plan spend.' },
    { id: 'streaming', label: 'Streaming', weight: 1.5, note: 'Entertainment streaming and recurring media access.' },
    { id: 'doctor', label: 'Doctor', weight: 2, note: 'Routine checkups and consultation buffer.' },
    { id: 'prescriptions', label: 'Prescriptions', weight: 1.5, note: 'Medicine and prescription-related spending.' },
    { id: 'savings-core', label: 'Savings', weight: 4, note: 'Core savings contribution within living-expense planning.' },
    { id: 'family', label: 'Family', weight: 3 + Math.min(dependents, 2), note: 'Family support and household shared obligations.' },
    { id: 'pets', label: 'Pets', weight: 1, note: 'Pet food, care, and basic wellness allowance.' },
    { id: 'gifts', label: 'Gifts', weight: 1, note: 'Occasional gifting and social obligation spending.' },
    { id: 'childcare', label: 'Childcare', weight: dependents > 0 ? 3 + Math.min(dependents, 2) : 1, note: 'Childcare and dependent care costs.' },
    { id: 'education', label: 'Education', weight: dependents > 0 ? 3 : 2, note: 'Schooling, training, and education-related needs.' },
    { id: 'personal', label: 'Personal', weight: 3, note: 'Personal care and routine lifestyle spending.' },
    { id: 'others', label: 'Others', weight: 2, note: 'Residual flexible category for uncaptured spend.' },
    { id: 'savings-buffer', label: 'Savings Buffer', weight: 2.5, note: 'Additional reserve bucket kept separate from core savings.' },
  ];
}

function buildBudgetCategoryItems(record: LoanApplicationRecord | null, livingExpenses: number): BudgetFlowItem[] {
  const seeds = buildBudgetCategorySeeds(record);
  if (livingExpenses <= 0 || seeds.length === 0) {
    return seeds.map((seed) => ({
      id: seed.id,
      label: seed.label,
      amount: 0,
      share: 0,
      note: seed.note,
    }));
  }

  const totalWeight = seeds.reduce((sum, seed) => sum + seed.weight, 0);
  const rawAmounts = seeds.map((seed) => (livingExpenses * seed.weight) / totalWeight);
  const roundedAmounts = rawAmounts.map((amount) => Math.round(amount));
  let roundingDelta = Math.round(livingExpenses) - roundedAmounts.reduce((sum, amount) => sum + amount, 0);

  if (roundingDelta !== 0) {
    const rankedIndexes = rawAmounts
      .map((amount, index) => ({
        index,
        fraction: amount - Math.floor(amount),
      }))
      .sort((left, right) => {
        return roundingDelta > 0 ? right.fraction - left.fraction : left.fraction - right.fraction;
      })
      .map((entry) => entry.index);

    let cursor = 0;
    while (roundingDelta !== 0 && rankedIndexes.length > 0) {
      const targetIndex = rankedIndexes[cursor % rankedIndexes.length];
      roundedAmounts[targetIndex] += roundingDelta > 0 ? 1 : -1;
      roundingDelta += roundingDelta > 0 ? -1 : 1;
      cursor += 1;
    }
  }

  return seeds.map((seed, index) => ({
    id: seed.id,
    label: seed.label,
    amount: roundedAmounts[index],
    share: scoreFromRatio(roundedAmounts[index], livingExpenses),
    note: seed.note,
  }));
}

function getCashflowSurplus(record: LoanApplicationRecord): number {
  return getTotalIncome(record) - getTotalKnownExpenses(record);
}

function percentWhere(records: LoanApplicationRecord[], matcher: (record: LoanApplicationRecord) => boolean): number {
  if (!records.length) {
    return 0;
  }

  const matches = records.filter(matcher).length;
  return (matches / records.length) * 100;
}

function scoreFromRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return clamp((numerator / denominator) * 100, 0, 100);
}

function formatBudgetStatus(actual: number, budget: number, higherIsBetter = false): BudgetStatus {
  if (budget <= 0) {
    return 'attention';
  }

  if (higherIsBetter) {
    if (actual >= budget) {
      return 'maintain';
    }

    if (actual >= budget * 0.7) {
      return 'watch';
    }

    return 'attention';
  }

  if (actual <= budget) {
    return 'maintain';
  }

  if (actual <= budget * 1.12) {
    return 'watch';
  }

  return 'attention';
}

function getBudgetPerformanceBand(score: number): string {
  if (score >= 85) {
    return 'Maintain';
  }

  if (score >= 70) {
    return 'Controlled';
  }

  if (score >= 55) {
    return 'Watchlist';
  }

  return 'Needs Attention';
}

function getLoanMonitoringPerformanceBand(score: number): string {
  if (score >= 85) {
    return 'Stable';
  }

  if (score >= 70) {
    return 'Controlled';
  }

  if (score >= 55) {
    return 'Watchlist';
  }

  return 'Needs Attention';
}

function getMostRecentRecord(records: LoanApplicationRecord[]): LoanApplicationRecord | null {
  if (!records.length) {
    return null;
  }

  return [...records].sort((left, right) => {
    const rightTimestamp = Date.parse(right.updated_at ?? right.created_at ?? '') || 0;
    const leftTimestamp = Date.parse(left.updated_at ?? left.created_at ?? '') || 0;
    return rightTimestamp - leftTimestamp;
  })[0] ?? null;
}

function getMostRecentFinancialRecord(records: LoanApplicationRecord[]): LoanApplicationRecord | null {
  const candidates = records.filter((record) => {
    return getTotalIncome(record) > 0 || getTotalKnownExpenses(record) > 0;
  });

  if (!candidates.length) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const rightTimestamp = Date.parse(right.updated_at ?? right.created_at ?? '') || 0;
    const leftTimestamp = Date.parse(left.updated_at ?? left.created_at ?? '') || 0;
    return rightTimestamp - leftTimestamp;
  })[0] ?? null;
}

function toMonthLabel(date: Date): string {
  return date.toLocaleString(undefined, { month: 'long' });
}

function toMonthYearLabel(date: Date): string {
  return date.toLocaleString(undefined, { month: 'short', year: 'numeric' });
}

function buildGoalIndicator(
  id: string,
  label: string,
  value: number,
  target: number,
  note: string,
  higherIsBetter = false,
): BudgetIndicator {
  const status = formatBudgetStatus(value, target, higherIsBetter);
  const attainment = higherIsBetter
    ? scoreFromRatio(value, target)
    : clamp(100 - Math.max(0, ((value - target) / Math.max(target, 1)) * 100), 0, 100);

  return {
    id,
    label,
    value,
    target,
    attainment,
    status,
    note,
  };
}

function isOpenMonitoringStatus(record: LoanApplicationRecord): boolean {
  const status = normalizeStatus(record.status);
  return status === 'submitted' || status === 'under review' || status === 'credit review';
}

function getRecordAgeInDays(record: LoanApplicationRecord, referenceTimeMs = Date.now()): number {
  const timestamp = Date.parse(record.created_at ?? record.updated_at ?? '') || 0;
  if (timestamp <= 0) {
    return 0;
  }

  const ageMs = Math.max(0, referenceTimeMs - timestamp);
  return ageMs / (1000 * 60 * 60 * 24);
}

function getAverageOpenAgeDays(records: LoanApplicationRecord[], referenceTimeMs = Date.now()): number {
  const openRecords = records.filter(isOpenMonitoringStatus);
  if (!openRecords.length) {
    return 0;
  }

  return mean(openRecords.map((record) => getRecordAgeInDays(record, referenceTimeMs)));
}

function getDataCompleteness(record: LoanApplicationRecord): boolean {
  return (
    safeNumber(record.dsr) > 0 &&
    safeNumber(record.dti) > 0 &&
    getFinalScore(record) !== null
  );
}

function buildMonitoringControlItem(
  id: string,
  label: string,
  actual: number,
  target: number,
  note: string,
  unit: 'percent' | 'days' | 'score',
  higherIsBetter = false,
): MonitoringControlItem {
  const status = formatBudgetStatus(actual, target, higherIsBetter);
  const attainment = higherIsBetter
    ? scoreFromRatio(actual, target)
    : clamp(100 - Math.max(0, ((actual - target) / Math.max(target, 1)) * 100), 0, 100);

  return {
    id,
    label,
    actual,
    target,
    variance: actual - target,
    attainment,
    status,
    note,
    unit,
  };
}

export function buildLoanMonitoringSnapshot(records: LoanApplicationRecord[]): LoanMonitoringSnapshot {
  const latestRecord = getMostRecentRecord(records);
  const referenceDate = latestRecord
    ? new Date(latestRecord.updated_at ?? latestRecord.created_at ?? Date.now())
    : new Date();
  const referenceTimeMs = referenceDate.getTime();

  const submittedCount = countWhere(records, (record) => normalizeStatus(record.status) === 'submitted');
  const underReviewCount = countWhere(records, (record) => normalizeStatus(record.status) === 'under review');
  const creditReviewCount = countWhere(records, (record) => normalizeStatus(record.status) === 'credit review');
  const approvedCount = countWhere(records, (record) => normalizeStatus(record.status) === 'approved');
  const releasedCount = countWhere(records, (record) => normalizeStatus(record.status) === 'released');
  const rejectedCount = countWhere(records, (record) => normalizeStatus(record.status) === 'rejected');
  const openPipelineCount = countWhere(records, isOpenMonitoringStatus);

  const approvalRate = percentWhere(records, (record) => getEffectiveDecisionBand(record) === 'approve');
  const reviewRate = percentWhere(records, (record) => getEffectiveDecisionBand(record) === 'review');
  const declineRate = percentWhere(records, (record) => getEffectiveDecisionBand(record) === 'decline');
  const dsrCompliance = percentWhere(records, (record) => {
    const dsrPercent = asPercent(safeNumber(record.dsr));
    return dsrPercent > 0 && isAcceptableDsr(dsrPercent);
  });
  const safeLtvCoverage = percentWhere(records, (record) => {
    const ltvPercent = asPercent(safeNumber(record.ltv));
    return ltvPercent > 0 && isSafeLtv(ltvPercent);
  });
  const elevatedLtvRate = percentWhere(records, (record) => {
    const ltvPercent = asPercent(safeNumber(record.ltv));
    return isElevatedLtv(ltvPercent);
  });
  const riskyLtvRate = percentWhere(records, (record) => {
    const ltvPercent = asPercent(safeNumber(record.ltv));
    return isRiskyLtv(ltvPercent);
  });
  const staleOpenPipelineShare = openPipelineCount
    ? (countWhere(records, (record) => isOpenMonitoringStatus(record) && getRecordAgeInDays(record, referenceTimeMs) > 7) / openPipelineCount) * 100
    : 0;
  const severeOpenPipelineShare = openPipelineCount
    ? (countWhere(records, (record) => isOpenMonitoringStatus(record) && getRecordAgeInDays(record, referenceTimeMs) > 14) / openPipelineCount) * 100
    : 0;
  const dataCompleteness = percentWhere(records, getDataCompleteness);
  const averageOpenAgeDays = getAverageOpenAgeDays(records, referenceTimeMs);
  const averageFinalScore = mean(
    records
      .map((record) => getFinalScore(record))
      .filter((score): score is number => score !== null),
  );

  const watchlistCount = countWhere(records, (record) => {
    const dsrPercent = asPercent(safeNumber(record.dsr));
    const ltvPercent = asPercent(safeNumber(record.ltv));
    return (
      getEffectiveDecisionBand(record) === 'review' ||
      (dsrPercent > 0 && !isAcceptableDsr(dsrPercent)) ||
      isElevatedLtv(ltvPercent) ||
      (isOpenMonitoringStatus(record) && getRecordAgeInDays(record, referenceTimeMs) > 7)
    );
  });

  const attentionCount = countWhere(records, (record) => {
    const dsrPercent = asPercent(safeNumber(record.dsr));
    const ltvPercent = asPercent(safeNumber(record.ltv));
    return (
      getEffectiveDecisionBand(record) === 'decline' ||
      isRiskyLtv(ltvPercent) ||
      dsrPercent >= 60 ||
      (isOpenMonitoringStatus(record) && getRecordAgeInDays(record, referenceTimeMs) > 14)
    );
  });

  const pipelineItems: MonitoringStageItem[] = [
    {
      id: 'submitted',
      label: 'Submitted',
      count: submittedCount,
      share: scoreFromRatio(submittedCount, records.length),
      status: 'watch',
      note: 'Fresh applications waiting to enter formal review.',
    },
    {
      id: 'under-review',
      label: 'Under Review',
      count: underReviewCount,
      share: scoreFromRatio(underReviewCount, records.length),
      status: 'watch',
      note: 'Cases actively being analyzed by underwriting or risk teams.',
    },
    {
      id: 'credit-review',
      label: 'Credit Review',
      count: creditReviewCount,
      share: scoreFromRatio(creditReviewCount, records.length),
      status: 'attention',
      note: 'Escalated cases needing tighter decision oversight and SLA control.',
    },
    {
      id: 'approved',
      label: 'Approved',
      count: approvedCount,
      share: scoreFromRatio(approvedCount, records.length),
      status: 'maintain',
      note: 'Applications cleared for approval but not yet released.',
    },
    {
      id: 'released',
      label: 'Released',
      count: releasedCount,
      share: scoreFromRatio(releasedCount, records.length),
      status: 'maintain',
      note: 'Finalized accounts contributing to portfolio conversion.',
    },
    {
      id: 'rejected',
      label: 'Rejected',
      count: rejectedCount,
      share: scoreFromRatio(rejectedCount, records.length),
      status: 'attention',
      note: 'Declined cases useful for exception tracking and policy refinement.',
    },
  ];

  const controlItems: MonitoringControlItem[] = [
    buildMonitoringControlItem(
      'approve-band-coverage',
      'Approve Band Coverage',
      approvalRate,
      55,
      'Healthy portfolios sustain strong approve-band throughput without relaxing policy discipline.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'review-band-containment',
      'Review Band Containment',
      reviewRate,
      25,
      'Review-band concentration should stay contained so exceptions do not dominate the pipeline.',
      'percent',
    ),
    buildMonitoringControlItem(
      'dsr-compliance',
      'DSR Compliance (< 50%)',
      dsrCompliance,
      75,
      'Global underwriting practice favors strong capacity coverage across the monitored book.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'safe-ltv-coverage',
      'Safe LTV Coverage (< 80%)',
      safeLtvCoverage,
      60,
      'Collateral-backed lending should maintain strong safe-LTV representation.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'stale-open-pipeline',
      'Stale Open Pipeline (> 7 days)',
      staleOpenPipelineShare,
      15,
      'Operational best practice is to prevent review queues from aging beyond one week.',
      'percent',
    ),
    buildMonitoringControlItem(
      'data-completeness',
      'Decision Data Completeness',
      dataCompleteness,
      95,
      'Portfolio monitoring is more reliable when DTI, DSR, and final score data are present.',
      'percent',
      true,
    ),
  ];

  const indicators: BudgetIndicator[] = [
    buildGoalIndicator(
      'avg-open-age',
      'Average Open Age',
      averageOpenAgeDays,
      7,
      'Average days an open case remains in the active review pipeline.',
    ),
    buildGoalIndicator(
      'watchlist-share',
      'Watchlist Share',
      scoreFromRatio(watchlistCount, records.length),
      25,
      'Share of loans that require closer monitoring due to policy or aging flags.',
    ),
    buildGoalIndicator(
      'attention-share',
      'Critical Attention Share',
      scoreFromRatio(attentionCount, records.length),
      10,
      'Critical concentration of loans with severe underwriting or pipeline issues.',
    ),
    buildGoalIndicator(
      'critical-aged-pipeline',
      'Critical Aged Pipeline',
      severeOpenPipelineShare,
      5,
      'Critical open cases older than 14 days should remain a very small share of the queue.',
    ),
    buildGoalIndicator(
      'average-final-score',
      'Average Final Score',
      averageFinalScore,
      75,
      'Average underwriting quality across monitored loan records.',
      true,
    ),
    buildGoalIndicator(
      'decline-concentration',
      'Decline Concentration',
      declineRate,
      20,
      'Decline concentration should remain controlled to signal healthy origination quality.',
    ),
    buildGoalIndicator(
      'elevated-ltv-exposure',
      'Elevated LTV Exposure',
      elevatedLtvRate,
      15,
      'Exposure to elevated LTV should remain contained before it becomes a blocker issue.',
    ),
    buildGoalIndicator(
      'risky-ltv-exposure',
      'Risky LTV Exposure',
      riskyLtvRate,
      5,
      'Exposure to LTV above the high-risk threshold should stay minimal.',
    ),
  ];

  const healthScore = Math.round(mean([...controlItems.map((item) => item.attainment), ...indicators.map((item) => item.attainment)]));

  return {
    periodLabel: toMonthLabel(referenceDate),
    dateLabel: toMonthYearLabel(referenceDate),
    sourceLabel: latestRecord ? 'Portfolio monitoring derived from the live Loan Repository' : 'Waiting for monitored loan records',
    sourceApplicationNo: latestRecord?.application_no ?? 'No recent loan record',
    healthScore,
    performanceBand: getLoanMonitoringPerformanceBand(healthScore),
    portfolioCount: records.length,
    openPipelineCount,
    releasedCount,
    watchlistCount,
    attentionCount,
    actionLabel: attentionCount > 0 ? 'Escalate' : watchlistCount > 0 ? 'Monitor' : 'Maintain',
    averageOpenAgeDays,
    averageFinalScore,
    pipelineItems,
    controlItems,
    indicators,
  };
}

export function buildBillReminderSnapshot(records: LoanApplicationRecord[]): BillReminderSnapshot {
  const latestRecord = getMostRecentRecord(records);
  const referenceDate = latestRecord
    ? new Date(latestRecord.updated_at ?? latestRecord.created_at ?? Date.now())
    : new Date();
  const referenceTimeMs = referenceDate.getTime();

  const readyToPayCount = countWhere(records, (record) => {
    const income = getIncome(record);
    if (income <= 0) {
      return false;
    }
    return scoreFromRatio(Math.max(0, getCashflowSurplus(record)), income) >= 15;
  });

  const lowStressCount = countWhere(records, (record) => {
    const dsrPercent = asPercent(safeNumber(record.dsr));
    return dsrPercent > 0 && isAcceptableDsr(dsrPercent);
  });

  const strongStressCount = countWhere(records, (record) => {
    const dsrPercent = asPercent(safeNumber(record.dsr));
    return dsrPercent > 0 && isStrongDsr(dsrPercent);
  });

  const activeCycleCount = countWhere(records, (record) => {
    const status = normalizeStatus(record.status);
    return status === 'submitted' || status === 'under review' || status === 'credit review' || status === 'approved' || status === 'released';
  });

  const missedRiskCount = countWhere(records, (record) => normalizeStatus(record.status) === 'rejected');
  const billDataCoverageCount = countWhere(records, (record) => getIncome(record) > 0);
  const dueSoonWatchCount = countWhere(records, (record) => {
    const ageDays = getRecordAgeInDays(record, referenceTimeMs);
    return isOpenMonitoringStatus(record) && ageDays > 5;
  });
  const escalatedReminderCount = countWhere(records, (record) => {
    const dsrPercent = asPercent(safeNumber(record.dsr));
    return (
      normalizeStatus(record.status) === 'credit review' ||
      (dsrPercent > 0 && dsrPercent >= 60) ||
      getCashflowSurplus(record) < 0
    );
  });

  const readyToPayRate = scoreFromRatio(readyToPayCount, records.length);
  const lowStressRate = scoreFromRatio(lowStressCount, records.length);
  const strongStressRate = scoreFromRatio(strongStressCount, records.length);
  const activePaymentCycleRate = scoreFromRatio(activeCycleCount, records.length);
  const missedRiskControl = clamp(100 - scoreFromRatio(missedRiskCount, records.length), 0, 100);
  const billDataCoverage = scoreFromRatio(billDataCoverageCount, records.length);
  const dueSoonWatchRate = activeCycleCount > 0 ? scoreFromRatio(dueSoonWatchCount, activeCycleCount) : 0;
  const escalatedReminderRate = scoreFromRatio(escalatedReminderCount, records.length);
  const averageSurplusRatio = mean(
    records.map((record) => {
      const income = getIncome(record);
      if (income <= 0) {
        return 0;
      }
      return scoreFromRatio(Math.max(0, getCashflowSurplus(record)), income);
    }),
  );

  const scheduleItems: MonitoringStageItem[] = [
    {
      id: 'ready-now',
      label: 'Ready to Pay',
      count: readyToPayCount,
      share: readyToPayRate,
      status: 'maintain',
      note: 'Accounts with enough monthly surplus to sustain scheduled obligations.',
    },
    {
      id: 'active-cycle',
      label: 'Active Cycle',
      count: activeCycleCount,
      share: activePaymentCycleRate,
      status: 'watch',
      note: 'Accounts currently moving through the active payment or processing cycle.',
    },
    {
      id: 'strong-capacity',
      label: 'Strong Capacity',
      count: strongStressCount,
      share: strongStressRate,
      status: 'maintain',
      note: 'Accounts with strong debt-service room below the 35% pressure zone.',
    },
    {
      id: 'due-soon-watch',
      label: 'Due Soon Watch',
      count: dueSoonWatchCount,
      share: dueSoonWatchRate,
      status: 'watch',
      note: 'Open-cycle accounts aging beyond five days and needing follow-up.',
    },
    {
      id: 'escalated-reminders',
      label: 'Escalated',
      count: escalatedReminderCount,
      share: escalatedReminderRate,
      status: 'attention',
      note: 'High-stress or credit-review accounts that require immediate reminder handling.',
    },
    {
      id: 'rejected-history',
      label: 'Rejected',
      count: missedRiskCount,
      share: scoreFromRatio(missedRiskCount, records.length),
      status: 'attention',
      note: 'Rejected records are tracked as part of repayment-risk and communication history.',
    },
  ];

  const controlItems: MonitoringControlItem[] = [
    buildMonitoringControlItem(
      'payment-readiness',
      'Payment Readiness',
      readyToPayRate,
      80,
      'Global servicing teams favor a strong share of accounts with surplus buffer before obligations fall due.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'debt-service-room',
      'Debt Service Room (< 50%)',
      lowStressRate,
      75,
      'Policy-aligned share of accounts with acceptable debt-service pressure.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'strong-service-room',
      'Strong Service Room (< 35%)',
      strongStressRate,
      45,
      'Best-practice reminder queues prioritize accounts with strong repayment headroom.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'active-cycle-coverage',
      'Active Cycle Coverage',
      activePaymentCycleRate,
      85,
      'Reminder operations should maintain high visibility across active-cycle accounts.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'missed-risk-control',
      'Missed-Payment Risk Control',
      missedRiskControl,
      90,
      'Inverse concentration of higher-risk outcomes inside the billing portfolio.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'billing-data-coverage',
      'Billing Data Coverage',
      billDataCoverage,
      95,
      'Reminder quality depends on strong coverage of income and obligation data.',
      'percent',
      true,
    ),
  ];

  const indicators: BudgetIndicator[] = [
    buildGoalIndicator(
      'average-surplus-ratio',
      'Average Surplus Ratio',
      averageSurplusRatio,
      15,
      'Average percentage of monthly surplus available before the next due cycle.',
      true,
    ),
    buildGoalIndicator(
      'due-soon-watch-share',
      'Due Soon Watch Share',
      dueSoonWatchRate,
      20,
      'Share of active-cycle accounts that have aged into due-soon follow-up status.',
    ),
    buildGoalIndicator(
      'escalated-reminder-share',
      'Escalated Reminder Share',
      escalatedReminderRate,
      10,
      'Escalated reminder accounts should stay a small share of the total billing book.',
    ),
    buildGoalIndicator(
      'negative-cashflow-share',
      'Negative Cashflow Share',
      scoreFromRatio(countWhere(records, (record) => getCashflowSurplus(record) < 0), records.length),
      15,
      'Negative monthly cashflow is a leading stress signal for reminder and collections teams.',
    ),
  ];

  const healthScore = Math.round(mean([...controlItems.map((item) => item.attainment), ...indicators.map((item) => item.attainment)]));

  return {
    periodLabel: toMonthLabel(referenceDate),
    dateLabel: toMonthYearLabel(referenceDate),
    sourceLabel: latestRecord ? 'Reminder readiness derived from the live Loan Repository' : 'Waiting for reminder-ready loan records',
    sourceApplicationNo: latestRecord?.application_no ?? 'No recent loan record',
    healthScore,
    performanceBand: getLoanMonitoringPerformanceBand(healthScore),
    portfolioCount: records.length,
    activeCycleCount,
    readyToPayCount,
    watchlistCount: dueSoonWatchCount,
    attentionCount: escalatedReminderCount,
    actionLabel: escalatedReminderCount > 0 ? 'Escalate' : dueSoonWatchCount > 0 ? 'Follow Up' : 'Maintain',
    averageSurplusRatio,
    scheduleItems,
    controlItems,
    indicators,
  };
}

export function buildCollateralMonitoringSnapshot(records: LoanApplicationRecord[]): CollateralMonitoringSnapshot {
  const latestRecord = getMostRecentRecord(records);
  const referenceDate = latestRecord
    ? new Date(latestRecord.updated_at ?? latestRecord.created_at ?? Date.now())
    : new Date();

  const collateralizedRecords = records.filter((record) => safeNumber(record.appraised_value) > 0 || safeNumber(record.ltv) > 0);
  const collateralizedCount = collateralizedRecords.length;
  const safeLtvCount = countWhere(collateralizedRecords, (record) => {
    const ltvPercent = asPercent(safeNumber(record.ltv));
    return ltvPercent > 0 && isSafeLtv(ltvPercent);
  });
  const elevatedLtvCount = countWhere(collateralizedRecords, (record) => {
    const ltvPercent = asPercent(safeNumber(record.ltv));
    return isElevatedLtv(ltvPercent);
  });
  const riskyLtvCount = countWhere(collateralizedRecords, (record) => {
    const ltvPercent = asPercent(safeNumber(record.ltv));
    return isRiskyLtv(ltvPercent);
  });
  const insuredCount = countWhere(collateralizedRecords, (record) => {
    const provider = record.requirements?.collateralAssetDetails?.insuranceProviderCompany;
    return Boolean(provider?.trim()) || safeNumber(record.collateral_scores?.insurance_score) > 0;
  });
  const marketableCount = countWhere(collateralizedRecords, (record) => {
    return Boolean(record.requirements?.collateralInformation?.propertyMarketabilityCategory?.trim())
      || safeNumber(record.collateral_scores?.marketability_score) > 0;
  });
  const assetQualityCount = countWhere(collateralizedRecords, (record) => {
    return Boolean(record.requirements?.collateralAssetDetails?.vehicleConditionCategory?.trim())
      || safeNumber(record.collateral_scores?.asset_quality_score) > 0;
  });

  const ltvSafeCoverage = scoreFromRatio(safeLtvCount, collateralizedCount);
  const elevatedLtvControl = clamp(100 - scoreFromRatio(elevatedLtvCount, collateralizedCount), 0, 100);
  const highLtvBlockerControl = clamp(100 - scoreFromRatio(riskyLtvCount, collateralizedCount), 0, 100);

  const insuranceCoverage = mean(
    collateralizedRecords.map((record) => {
      const explicitInsuranceScore = safeNumber(record.collateral_scores?.insurance_score);
      if (explicitInsuranceScore > 0) {
        return asPercent(explicitInsuranceScore);
      }
      const provider = record.requirements?.collateralAssetDetails?.insuranceProviderCompany;
      return provider ? 100 : 0;
    }),
  );

  const assetQuality = mean(
    collateralizedRecords.map((record) => {
      const explicitScore = safeNumber(record.collateral_scores?.asset_quality_score);
      if (explicitScore > 0) {
        return asPercent(explicitScore);
      }
      return record.requirements?.collateralAssetDetails?.vehicleConditionCategory ? 100 : 0;
    }),
  );

  const marketability = mean(
    collateralizedRecords.map((record) => {
      const explicitScore = safeNumber(record.collateral_scores?.marketability_score);
      if (explicitScore > 0) {
        return asPercent(explicitScore);
      }
      return record.requirements?.collateralInformation?.propertyMarketabilityCategory ? 100 : 0;
    }),
  );

  const overallCollateral = mean(
    collateralizedRecords.map((record) => {
      const explicitScore = safeNumber(record.collateral_scores?.overall_collateral_score);
      if (explicitScore > 0) {
        return asPercent(explicitScore);
      }
      return mean([ltvSafeCoverage, insuranceCoverage, assetQuality, marketability]);
    }),
  );

  const averageLtv = mean(
    collateralizedRecords
      .map((record) => asPercent(safeNumber(record.ltv)))
      .filter((value) => value > 0),
  );

  const inventoryItems: MonitoringStageItem[] = [
    {
      id: 'safe-ltv',
      label: 'Safe LTV',
      count: safeLtvCount,
      share: ltvSafeCoverage,
      status: 'maintain',
      note: 'Collateralized records sitting within the safe LTV threshold.',
    },
    {
      id: 'insured',
      label: 'Insured',
      count: insuredCount,
      share: scoreFromRatio(insuredCount, collateralizedCount),
      status: 'maintain',
      note: 'Collateral records with insurance backing captured in the file.',
    },
    {
      id: 'marketable',
      label: 'Marketable',
      count: marketableCount,
      share: scoreFromRatio(marketableCount, collateralizedCount),
      status: 'watch',
      note: 'Records with explicit marketability evidence or marketability score coverage.',
    },
    {
      id: 'asset-quality',
      label: 'Asset Quality Ready',
      count: assetQualityCount,
      share: scoreFromRatio(assetQualityCount, collateralizedCount),
      status: 'watch',
      note: 'Collateral records with condition or quality signals ready for review.',
    },
    {
      id: 'elevated-ltv',
      label: 'Elevated LTV',
      count: elevatedLtvCount,
      share: scoreFromRatio(elevatedLtvCount, collateralizedCount),
      status: 'watch',
      note: 'Collateral exposures at or above the elevated LTV threshold.',
    },
    {
      id: 'high-risk-ltv',
      label: 'High Risk LTV',
      count: riskyLtvCount,
      share: scoreFromRatio(riskyLtvCount, collateralizedCount),
      status: 'attention',
      note: 'High-risk collateral blockers requiring escalation or stronger mitigants.',
    },
  ];

  const controlItems: MonitoringControlItem[] = [
    buildMonitoringControlItem(
      'ltv-safety',
      'Safe LTV Coverage (< 80%)',
      ltvSafeCoverage,
      55,
      'Global secured-lending practice favors a healthy base of safe-LTV exposures.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'elevated-ltv-control',
      'Elevated LTV Control (>= 90%)',
      elevatedLtvControl,
      75,
      'Elevated-LTV concentrations should remain controlled before breaching blocker zones.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'high-ltv-blocker',
      'High-LTV Blocker Control (>= 95%)',
      highLtvBlockerControl,
      85,
      'High-risk LTV tail should stay tightly managed inside the collateral book.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'insurance-coverage',
      'Insurance Coverage Completeness',
      insuranceCoverage,
      80,
      'Collateral coverage is stronger when insurance support is consistently documented.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'asset-quality',
      'Asset Quality Readiness',
      assetQuality,
      75,
      'Condition and quality evidence should be broadly available across the collateral base.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'marketability',
      'Marketability Strength',
      marketability,
      75,
      'Marketability capture helps liquidation planning and residual-value confidence.',
      'percent',
      true,
    ),
  ];

  const indicators: BudgetIndicator[] = [
    buildGoalIndicator(
      'average-ltv',
      'Average LTV',
      averageLtv,
      80,
      'Average collateral leverage across records with LTV data.',
    ),
    buildGoalIndicator(
      'uninsured-share',
      'Uninsured Share',
      scoreFromRatio(Math.max(collateralizedCount - insuredCount, 0), collateralizedCount),
      20,
      'Share of collateralized records without insurance coverage evidence.',
    ),
    buildGoalIndicator(
      'high-risk-ltv-share',
      'High-Risk LTV Share',
      scoreFromRatio(riskyLtvCount, collateralizedCount),
      5,
      'Critical share of collateral records above the high-risk LTV threshold.',
    ),
    buildGoalIndicator(
      'overall-collateral-score',
      'Overall Collateral Score',
      overallCollateral,
      80,
      'Composite collateral integrity signal from score data and fallback fields.',
      true,
    ),
  ];

  const healthScore = Math.round(mean([...controlItems.map((item) => item.attainment), ...indicators.map((item) => item.attainment)]));

  return {
    periodLabel: toMonthLabel(referenceDate),
    dateLabel: toMonthYearLabel(referenceDate),
    sourceLabel: latestRecord ? 'Collateral monitoring derived from the live Loan Repository' : 'Waiting for collateral records',
    sourceApplicationNo: latestRecord?.application_no ?? 'No recent loan record',
    healthScore,
    performanceBand: getLoanMonitoringPerformanceBand(healthScore),
    collateralizedCount,
    insuredCount,
    watchlistCount: elevatedLtvCount,
    attentionCount: riskyLtvCount,
    actionLabel: riskyLtvCount > 0 ? 'Escalate' : elevatedLtvCount > 0 ? 'Mitigate' : 'Maintain',
    averageLtv,
    averageCollateralScore: overallCollateral,
    inventoryItems,
    controlItems,
    indicators,
  };
}

export function buildNetWorthPositioningSnapshot(records: LoanApplicationRecord[]): NetWorthPositioningSnapshot {
  const latestRecord = getMostRecentRecord(records);
  const referenceDate = latestRecord
    ? new Date(latestRecord.updated_at ?? latestRecord.created_at ?? Date.now())
    : new Date();

  const assetStrengthValues = records.map((record) => {
    const appraised = safeNumber(record.appraised_value);
    const loanAmount = safeNumber(record.loan_amount);
    if (appraised <= 0) {
      return 0;
    }
    return scoreFromRatio(Math.max(0, appraised - loanAmount), appraised);
  });

  const debtCompressionValues = records.map((record) => {
    const income = getIncome(record);
    if (income <= 0) {
      return 0;
    }
    const debtRatio = scoreFromRatio(getDebt(record), income);
    return clamp(100 - debtRatio, 0, 100);
  });

  const liquidityBufferValues = records.map((record) => {
    const income = getIncome(record);
    if (income <= 0) {
      return 0;
    }
    return scoreFromRatio(Math.max(0, getCashflowSurplus(record)), income);
  });

  const equityCushionValues = records.map((record) => {
    const loanAmount = safeNumber(record.loan_amount);
    const appraised = safeNumber(record.appraised_value);
    if (loanAmount <= 0) {
      return 0;
    }
    return scoreFromRatio(Math.max(0, appraised - loanAmount), loanAmount);
  });

  const assetStrength = mean(assetStrengthValues);
  const debtCompression = mean(debtCompressionValues);
  const liquidityBuffer = mean(liquidityBufferValues);
  const equityCushion = mean(equityCushionValues);
  const stabilityIndex = mean([assetStrength, debtCompression, liquidityBuffer, equityCushion]);

  const approveBandCoverage = percentWhere(records, (record) => getEffectiveDecisionBand(record) === 'approve');
  const reviewBandCoverage = percentWhere(records, (record) => getEffectiveDecisionBand(record) === 'review');
  const declineBandControl = 100 - percentWhere(records, (record) => getEffectiveDecisionBand(record) === 'decline');
  const strongPositionCount = countWhere(records, (record) => {
    return (
      getEffectiveDecisionBand(record) === 'approve' &&
      getCashflowSurplus(record) > 0 &&
      safeNumber(record.appraised_value) > safeNumber(record.loan_amount)
    );
  });
  const watchlistCount = countWhere(records, (record) => {
    return (
      getEffectiveDecisionBand(record) === 'review' ||
      getCashflowSurplus(record) <= 0 ||
      safeNumber(record.loan_amount) >= safeNumber(record.appraised_value)
    );
  });
  const attentionCount = countWhere(records, (record) => {
    return (
      getEffectiveDecisionBand(record) === 'decline' ||
      asPercent(safeNumber(record.dsr)) >= 60 ||
      safeNumber(record.loan_amount) > safeNumber(record.appraised_value)
    );
  });

  const averageNetCashflow = mean(records.map((record) => getCashflowSurplus(record)));

  const positioningItems: MonitoringStageItem[] = [
    {
      id: 'approve-band',
      label: 'Approve Band',
      count: countWhere(records, (record) => getEffectiveDecisionBand(record) === 'approve'),
      share: approveBandCoverage,
      status: 'maintain',
      note: 'Records already positioned in the stronger underwriting outcome band.',
    },
    {
      id: 'review-band',
      label: 'Review Band',
      count: countWhere(records, (record) => getEffectiveDecisionBand(record) === 'review'),
      share: reviewBandCoverage,
      status: 'watch',
      note: 'Accounts needing closer balance-sheet scrutiny before stronger positioning.',
    },
    {
      id: 'positive-cashflow',
      label: 'Positive Cashflow',
      count: countWhere(records, (record) => getCashflowSurplus(record) > 0),
      share: scoreFromRatio(countWhere(records, (record) => getCashflowSurplus(record) > 0), records.length),
      status: 'maintain',
      note: 'Accounts retaining positive monthly surplus after obligations.',
    },
    {
      id: 'equity-cushion',
      label: 'Equity Cushion',
      count: countWhere(records, (record) => safeNumber(record.appraised_value) > safeNumber(record.loan_amount)),
      share: scoreFromRatio(countWhere(records, (record) => safeNumber(record.appraised_value) > safeNumber(record.loan_amount)), records.length),
      status: 'maintain',
      note: 'Records where asset values still sit above financed exposure.',
    },
    {
      id: 'watchlist-position',
      label: 'Watchlist Position',
      count: watchlistCount,
      share: scoreFromRatio(watchlistCount, records.length),
      status: 'watch',
      note: 'Records with weaker liquidity or thinner asset cushion that need monitoring.',
    },
    {
      id: 'attention-position',
      label: 'Attention Position',
      count: attentionCount,
      share: scoreFromRatio(attentionCount, records.length),
      status: 'attention',
      note: 'Accounts showing material leverage, weak cashflow, or decline-band outcomes.',
    },
  ];

  const controlItems: MonitoringControlItem[] = [
    buildMonitoringControlItem(
      'approve-band-coverage',
      'Approve Band Coverage (>= 80)',
      approveBandCoverage,
      60,
      'Healthy books sustain strong positioning in the policy approve band.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'review-band-coverage',
      'Review Band Coverage (65 to 79)',
      reviewBandCoverage,
      30,
      'Review-band exposure should stay bounded so marginal profiles do not dominate the mix.',
      'percent',
    ),
    buildMonitoringControlItem(
      'decline-band-control',
      'Decline Band Control (< 65)',
      declineBandControl,
      80,
      'Inverse concentration of weaker positioning under the decline threshold.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'asset-strength',
      'Asset Strength',
      assetStrength,
      35,
      'Measures how much unencumbered asset cushion remains against financed value.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'debt-compression',
      'Debt Compression Score',
      debtCompression,
      70,
      'Inverse debt pressure based on income and monthly obligations.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'liquidity-buffer',
      'Liquidity Buffer',
      liquidityBuffer,
      25,
      'Healthy positioning keeps enough surplus available for resilience and shocks.',
      'percent',
      true,
    ),
    buildMonitoringControlItem(
      'equity-cushion',
      'Equity Cushion',
      equityCushion,
      30,
      'Loan-to-asset distance is stronger when equity cushion stays comfortably positive.',
      'percent',
      true,
    ),
  ];

  const indicators: BudgetIndicator[] = [
    buildGoalIndicator(
      'stability-index',
      'Net Worth Stability Index',
      stabilityIndex,
      75,
      'Composite signal of assets, debt pressure, liquidity, and equity positioning.',
      true,
    ),
    buildGoalIndicator(
      'strong-position-share',
      'Strong Position Share',
      scoreFromRatio(strongPositionCount, records.length),
      50,
      'Share of accounts with healthy cashflow, asset cushion, and approve-band posture.',
      true,
    ),
    buildGoalIndicator(
      'watchlist-position-share',
      'Watchlist Position Share',
      scoreFromRatio(watchlistCount, records.length),
      25,
      'Balance-sheet watchlist concentration should stay contained.',
    ),
    buildGoalIndicator(
      'average-net-cashflow',
      'Average Net Cashflow',
      averageNetCashflow,
      10000,
      'Average monthly surplus across the monitored book.',
      true,
    ),
  ];

  const healthScore = Math.round(mean([...controlItems.map((item) => item.attainment), ...indicators.map((item) => item.attainment)]));

  return {
    periodLabel: toMonthLabel(referenceDate),
    dateLabel: toMonthYearLabel(referenceDate),
    sourceLabel: latestRecord ? 'Net-worth positioning derived from the live Loan Repository' : 'Waiting for net-worth position records',
    sourceApplicationNo: latestRecord?.application_no ?? 'No recent loan record',
    healthScore,
    performanceBand: getLoanMonitoringPerformanceBand(healthScore),
    portfolioCount: records.length,
    strongPositionCount,
    watchlistCount,
    attentionCount,
    actionLabel: attentionCount > 0 ? 'Reposition' : watchlistCount > 0 ? 'Review' : 'Maintain',
    averageNetCashflow,
    averageAssetStrength: assetStrength,
    positioningItems,
    controlItems,
    indicators,
  };
}

export function buildBudgetExpenseTrackerSnapshot(records: LoanApplicationRecord[]): BudgetDashboardSnapshot {
  const sourceRecord = getMostRecentFinancialRecord(records);
  const sourceDate = sourceRecord
    ? new Date(sourceRecord.updated_at ?? sourceRecord.created_at ?? Date.now())
    : new Date();

  const totalIncome = sourceRecord ? getTotalIncome(sourceRecord) : 0;
  const livingExpenses = sourceRecord ? getLivingExpenses(sourceRecord) : 0;
  const mortgageExpense = sourceRecord ? getMortgageExpense(sourceRecord) : 0;
  const otherDebtExpense = sourceRecord ? getOtherDebtExpense(sourceRecord) : 0;
  const totalKnownExpenses = livingExpenses + mortgageExpense + otherDebtExpense;
  const netCashflow = totalIncome - totalKnownExpenses;
  const nonPrimaryIncome = sourceRecord
    ? getSupplementalIncome(sourceRecord) +
      getInvestmentIncome(sourceRecord) +
      getBusinessIncome(sourceRecord) +
      getPensionIncome(sourceRecord)
    : 0;

  const livingBudget = totalIncome * 0.45;
  const mortgageBudget = totalIncome * 0.28;
  const otherDebtBudget = totalIncome * 0.12;
  const totalExpenseBudget = totalIncome * 0.65;
  const reserveBudget = totalIncome * 0.1;
  const categoryItems = buildBudgetCategoryItems(sourceRecord, livingExpenses);
  const categoryTotal = categoryItems.reduce((sum, item) => sum + item.amount, 0);

  const incomeItems: BudgetFlowItem[] = [
    {
      id: 'employment-income',
      label: 'Employment Income',
      amount: sourceRecord ? getIncome(sourceRecord) : 0,
      share: scoreFromRatio(sourceRecord ? getIncome(sourceRecord) : 0, totalIncome),
      note: 'Declared monthly salary or gross employment income.',
    },
    {
      id: 'supplemental-income',
      label: 'Other Income',
      amount: sourceRecord ? getSupplementalIncome(sourceRecord) : 0,
      share: scoreFromRatio(sourceRecord ? getSupplementalIncome(sourceRecord) : 0, totalIncome),
      note: 'Other recurring income declared on the application.',
    },
    {
      id: 'investment-income',
      label: 'Investment Income',
      amount: sourceRecord ? getInvestmentIncome(sourceRecord) : 0,
      share: scoreFromRatio(sourceRecord ? getInvestmentIncome(sourceRecord) : 0, totalIncome),
      note: 'Income from declared investments and portfolio returns.',
    },
    {
      id: 'business-pension-income',
      label: 'Business and Pension',
      amount: sourceRecord ? getBusinessIncome(sourceRecord) + getPensionIncome(sourceRecord) : 0,
      share: scoreFromRatio(
        sourceRecord ? getBusinessIncome(sourceRecord) + getPensionIncome(sourceRecord) : 0,
        totalIncome,
      ),
      note: 'Business operations, retirement, and similar recurring inflows.',
    },
  ];

  const expenseItems: BudgetComparisonItem[] = [
    {
      id: 'living-expenses',
      label: 'Living Expenses',
      actual: livingExpenses,
      budget: livingBudget,
      variance: livingBudget - livingExpenses,
      attainment: clamp(100 - Math.max(0, ((livingExpenses - livingBudget) / Math.max(livingBudget, 1)) * 100), 0, 100),
      status: formatBudgetStatus(livingExpenses, livingBudget),
      note: 'Monthly living expenses should stay within 45% of total income.',
    },
    {
      id: 'mortgage-expenses',
      label: 'Mortgage / Amortization',
      actual: mortgageExpense,
      budget: mortgageBudget,
      variance: mortgageBudget - mortgageExpense,
      attainment: clamp(100 - Math.max(0, ((mortgageExpense - mortgageBudget) / Math.max(mortgageBudget, 1)) * 100), 0, 100),
      status: formatBudgetStatus(mortgageExpense, mortgageBudget),
      note: 'Housing-related debt is healthiest when held within 28% of income.',
    },
    {
      id: 'other-debt-expenses',
      label: 'Other Debt Commitments',
      actual: otherDebtExpense,
      budget: otherDebtBudget,
      variance: otherDebtBudget - otherDebtExpense,
      attainment: clamp(100 - Math.max(0, ((otherDebtExpense - otherDebtBudget) / Math.max(otherDebtBudget, 1)) * 100), 0, 100),
      status: formatBudgetStatus(otherDebtExpense, otherDebtBudget),
      note: 'Non-mortgage debt should stay below 12% of total income.',
    },
  ];

  const comparisonItems: BudgetComparisonItem[] = [
    ...expenseItems,
    {
      id: 'known-expense-total',
      label: 'Total Known Outflow',
      actual: totalKnownExpenses,
      budget: totalExpenseBudget,
      variance: totalExpenseBudget - totalKnownExpenses,
      attainment: clamp(100 - Math.max(0, ((totalKnownExpenses - totalExpenseBudget) / Math.max(totalExpenseBudget, 1)) * 100), 0, 100),
      status: formatBudgetStatus(totalKnownExpenses, totalExpenseBudget),
      note: 'Combined household outflow should generally remain within 65% of income.',
    },
    {
      id: 'reserve-headroom',
      label: 'Reserve Headroom',
      actual: Math.max(0, netCashflow),
      budget: reserveBudget,
      variance: Math.max(0, netCashflow) - reserveBudget,
      attainment: scoreFromRatio(Math.max(0, netCashflow), reserveBudget),
      status: formatBudgetStatus(Math.max(0, netCashflow), reserveBudget, true),
      note: 'Maintain at least a 10% residual buffer after known obligations.',
    },
  ];

  const indicators: BudgetIndicator[] = [
    buildGoalIndicator(
      'income-coverage',
      'Income Coverage',
      totalIncome,
      Math.max(totalKnownExpenses, 1),
      'Measures whether reported inflows cover the known monthly obligations.',
      true,
    ),
    buildGoalIndicator(
      'expense-ratio',
      'Expense Ratio',
      scoreFromRatio(totalKnownExpenses, totalIncome),
      65,
      'Keep known expenses under 65% of total income.',
    ),
    buildGoalIndicator(
      'mortgage-ratio',
      'Mortgage Ratio',
      scoreFromRatio(mortgageExpense, totalIncome),
      28,
      'Maintain housing and amortization payments within 28% of income.',
    ),
    buildGoalIndicator(
      'other-debt-ratio',
      'Other Debt Ratio',
      scoreFromRatio(otherDebtExpense, totalIncome),
      12,
      'Other debt should remain lean to preserve cash flow.',
    ),
    buildGoalIndicator(
      'surplus-ratio',
      'Surplus Ratio',
      scoreFromRatio(Math.max(0, netCashflow), totalIncome),
      10,
      'Healthy budgets keep at least 10% of income available after known expenses.',
      true,
    ),
    buildGoalIndicator(
      'income-diversity',
      'Income Diversity',
      scoreFromRatio(nonPrimaryIncome, totalIncome),
      15,
      'Supplementary and investment income improve resilience when above 15% of inflows.',
      true,
    ),
  ];

  const healthScore = Math.round(mean(indicators.map((indicator) => indicator.attainment)));
  const budgetReadyCount = comparisonItems.filter((item) => item.status === 'maintain').length;
  const watchlistCount = indicators.filter((indicator) => indicator.status === 'watch').length;
  const needsAttentionCount = indicators.filter((indicator) => indicator.status === 'attention').length;
  const performanceBand = getBudgetPerformanceBand(healthScore);

  return {
    periodLabel: toMonthLabel(sourceDate),
    dateLabel: toMonthYearLabel(sourceDate),
    sourceLabel: sourceRecord ? 'Application-derived household budget snapshot' : 'Waiting for application financial data',
    sourceApplicationNo: sourceRecord?.application_no ?? 'No application selected',
    healthScore,
    performanceBand,
    totalIncome,
    totalKnownExpenses,
    totalExpenseBudget,
    netCashflow,
    trackedAreas: comparisonItems.length,
    budgetReadyCount,
    watchlistCount,
    needsAttentionCount,
    actionLabel: needsAttentionCount > 0 ? 'Rebalance' : 'Maintain',
    budgetSetupLabel: `${budgetReadyCount}/${comparisonItems.length} lines within budget`,
    expenseLoggingLabel: sourceRecord ? `Source ${sourceRecord.application_no}` : 'Awaiting source record',
    livingExpenseDeclared: livingExpenses,
    categoryTotal,
    incomeItems,
    expenseItems,
    comparisonItems,
    categoryItems,
    indicators,
  };
}

export function buildBudgetExpenseTrackerItems(records: LoanApplicationRecord[]): TrackerItem[] {
  const incomeRecords = records.filter((record) => getIncome(record) > 0);

  const expenseControl = mean(
    incomeRecords.map((record) => {
      const expenseRatio = scoreFromRatio(getLivingExpenses(record), getIncome(record));
      return clamp(100 - expenseRatio, 0, 100);
    }),
  );

  const debtBurdenControl = mean(
    incomeRecords.map((record) => {
      const debtRatio = scoreFromRatio(getDebt(record), getIncome(record));
      return clamp(100 - debtRatio, 0, 100);
    }),
  );

  const savingsPotential = mean(
    incomeRecords.map((record) => scoreFromRatio(Math.max(0, getCashflowSurplus(record)), getIncome(record))),
  );

  const positiveCashflowRate = percentWhere(records, (record) => getCashflowSurplus(record) > 0);
  const dsrPolicyCompliance = percentWhere(records, (record) => {
    const dsrPercent = asPercent(safeNumber(record.dsr));
    return dsrPercent > 0 && isAcceptableDsr(dsrPercent);
  });
  const expenseDataCoverage = percentWhere(records, (record) => getLivingExpenses(record) > 0);

  return [
    {
      id: 'expense-control',
      label: 'Expense Ratio Control',
      target: 60,
      initialValue: Math.round(expenseControl),
      note: 'Measures how much income remains after living expenses.',
    },
    {
      id: 'debt-burden',
      label: 'Debt Burden Control',
      target: 70,
      initialValue: Math.round(debtBurdenControl),
      note: 'Tracks debt obligations relative to monthly earning capacity.',
    },
    {
      id: 'savings-potential',
      label: 'Savings Potential',
      target: 20,
      initialValue: Math.round(savingsPotential),
      note: 'Represents surplus cashflow available for savings and buffers.',
    },
    {
      id: 'positive-cashflow',
      label: 'Positive Cashflow Rate',
      target: 85,
      initialValue: Math.round(positiveCashflowRate),
      note: 'Share of applications where monthly inflow exceeds expenses and debt.',
    },
    {
      id: 'dsr-policy-compliance',
      label: 'DSR Policy Compliance (< 50%)',
      target: 75,
      initialValue: Math.round(dsrPolicyCompliance),
      note: 'Aligned with lending policy threshold where DSR below 50% is acceptable.',
    },
    {
      id: 'expense-coverage',
      label: 'Expense Data Coverage',
      target: 95,
      initialValue: Math.round(expenseDataCoverage),
      note: 'Coverage of applications with recorded living-expense values.',
    },
  ];
}

export function buildLoanMonitoringItems(records: LoanApplicationRecord[]): TrackerItem[] {
  const approvalRate = percentWhere(records, (record) => getEffectiveDecisionBand(record) === 'approve');
  const reviewRate = percentWhere(records, (record) => getEffectiveDecisionBand(record) === 'review');
  const declineRate = percentWhere(records, (record) => getEffectiveDecisionBand(record) === 'decline');

  const strongDsrRate = percentWhere(records, (record) => {
    const dsrPercent = asPercent(safeNumber(record.dsr));
    return dsrPercent > 0 && isStrongDsr(dsrPercent);
  });

  const acceptableDsrRate = percentWhere(records, (record) => {
    const dsrPercent = asPercent(safeNumber(record.dsr));
    return dsrPercent > 0 && isAcceptableDsr(dsrPercent);
  });

  const safeLtvRate = percentWhere(records, (record) => {
    const ltvPercent = asPercent(safeNumber(record.ltv));
    return ltvPercent > 0 && isSafeLtv(ltvPercent);
  });

  const highLtvRiskControl = 100 - percentWhere(records, (record) => {
    const ltvPercent = asPercent(safeNumber(record.ltv));
    return isRiskyLtv(ltvPercent);
  });

  return [
    {
      id: 'approval-throughput',
      label: 'Approve Band Coverage',
      target: 60,
      initialValue: Math.round(approvalRate),
      note: 'Records in approve outcome band (score >= 80 or equivalent decision/status).',
    },
    {
      id: 'review-band',
      label: 'Review Band Coverage',
      target: 30,
      initialValue: Math.round(reviewRate),
      note: 'Records in policy review band (65 to 79 final score or review status).',
    },
    {
      id: 'decline-risk-control',
      label: 'Decline Risk Control',
      target: 80,
      initialValue: Math.round(clamp(100 - declineRate, 0, 100)),
      note: 'Inverse of decline concentration (score < 65 or declined/rejected outcomes).',
    },
    {
      id: 'dsr-policy-compliance',
      label: 'DSR Compliance (< 50%)',
      target: 70,
      initialValue: Math.round(acceptableDsrRate),
      note: 'Aligned to policy where DSR under 50% is within acceptable limits.',
    },
    {
      id: 'strong-dsr-zone',
      label: 'Strong DSR Zone (< 35%)',
      target: 45,
      initialValue: Math.round(strongDsrRate),
      note: 'Strong-risk profile share where DSR is below 35% threshold.',
    },
    {
      id: 'safe-ltv-zone',
      label: 'Safe LTV Zone (< 80%)',
      target: 55,
      initialValue: Math.round(safeLtvRate),
      note: 'Share of records meeting policy-safe LTV threshold below 80%.',
    },
    {
      id: 'high-ltv-risk-control',
      label: 'High-LTV Risk Control (> 95%)',
      target: 85,
      initialValue: Math.round(clamp(highLtvRiskControl, 0, 100)),
      note: 'Inverse score of high-risk LTV tail above 95% policy trigger.',
    },
  ];
}

export function buildBillReminderItems(records: LoanApplicationRecord[]): TrackerItem[] {
  const readyToPayRate = percentWhere(records, (record) => {
    const income = getIncome(record);
    if (income <= 0) {
      return false;
    }
    return scoreFromRatio(Math.max(0, getCashflowSurplus(record)), income) >= 15;
  });

  const lowStressRate = percentWhere(records, (record) => {
    const dsrPercent = asPercent(safeNumber(record.dsr));
    return dsrPercent > 0 && isAcceptableDsr(dsrPercent);
  });

  const strongStressRate = percentWhere(records, (record) => {
    const dsrPercent = asPercent(safeNumber(record.dsr));
    return dsrPercent > 0 && isStrongDsr(dsrPercent);
  });

  const activePaymentCycleRate = percentWhere(records, (record) => {
    const status = normalizeStatus(record.status);
    return status === 'submitted' || status === 'under review' || status === 'credit review' || status === 'approved' || status === 'released';
  });

  const missedRiskControl = 100 - percentWhere(records, (record) => normalizeStatus(record.status) === 'rejected');
  const billDataCoverage = percentWhere(records, (record) => getIncome(record) > 0);

  return [
    {
      id: 'payment-readiness',
      label: 'Payment Readiness',
      target: 80,
      initialValue: Math.round(readyToPayRate),
      note: 'Portion of applications with a minimum surplus buffer for due dates.',
    },
    {
      id: 'debt-service-room',
      label: 'Debt Service Room (< 50%)',
      target: 75,
      initialValue: Math.round(lowStressRate),
      note: 'Policy-aligned share of records with acceptable DSR below 50%.',
    },
    {
      id: 'strong-service-room',
      label: 'Strong Service Room (< 35%)',
      target: 45,
      initialValue: Math.round(strongStressRate),
      note: 'Strong capacity pocket aligned to DSR below 35% threshold.',
    },
    {
      id: 'active-cycle',
      label: 'Active Payment-Cycle Coverage',
      target: 85,
      initialValue: Math.round(activePaymentCycleRate),
      note: 'Indicates records progressing through active processing stages.',
    },
    {
      id: 'missed-risk',
      label: 'Missed-Payment Risk Control',
      target: 90,
      initialValue: Math.round(clamp(missedRiskControl, 0, 100)),
      note: 'Inverse score of rejection concentration in portfolio records.',
    },
    {
      id: 'bill-data-coverage',
      label: 'Billing Data Coverage',
      target: 95,
      initialValue: Math.round(billDataCoverage),
      note: 'Coverage of records with income and obligations data available.',
    },
  ];
}

export function buildCollateralMonitoringItems(records: LoanApplicationRecord[]): TrackerItem[] {
  const ltvSafeCoverage = percentWhere(records, (record) => {
    const ltvPercent = asPercent(safeNumber(record.ltv));
    return ltvPercent > 0 && isSafeLtv(ltvPercent);
  });

  const elevatedLtvControl = 100 - percentWhere(records, (record) => {
    const ltvPercent = asPercent(safeNumber(record.ltv));
    return isElevatedLtv(ltvPercent);
  });

  const highLtvBlockerControl = 100 - percentWhere(records, (record) => {
    const ltvPercent = asPercent(safeNumber(record.ltv));
    return isRiskyLtv(ltvPercent);
  });

  const insuranceCoverage = mean(
    records.map((record) => {
      const explicitInsuranceScore = safeNumber(record.collateral_scores?.insurance_score);
      if (explicitInsuranceScore > 0) {
        return asPercent(explicitInsuranceScore);
      }
      const provider = record.requirements?.collateralAssetDetails?.insuranceProviderCompany;
      return provider ? 100 : 0;
    }),
  );

  const assetQuality = mean(
    records.map((record) => {
      const explicitScore = safeNumber(record.collateral_scores?.asset_quality_score);
      if (explicitScore > 0) {
        return asPercent(explicitScore);
      }
      return record.requirements?.collateralAssetDetails?.vehicleConditionCategory ? 100 : 0;
    }),
  );

  const marketability = mean(
    records.map((record) => {
      const explicitScore = safeNumber(record.collateral_scores?.marketability_score);
      if (explicitScore > 0) {
        return asPercent(explicitScore);
      }
      return record.requirements?.collateralInformation?.propertyMarketabilityCategory ? 100 : 0;
    }),
  );

  const overallCollateral = mean(
    records.map((record) => {
      const explicitScore = safeNumber(record.collateral_scores?.overall_collateral_score);
      if (explicitScore > 0) {
        return asPercent(explicitScore);
      }
      return mean([ltvSafeCoverage, insuranceCoverage, assetQuality, marketability]);
    }),
  );

  return [
    {
      id: 'ltv-safety',
      label: 'Safe LTV Coverage (< 80%)',
      target: 55,
      initialValue: Math.round(ltvSafeCoverage),
      note: 'Share of collateralized records within safe LTV policy threshold.',
    },
    {
      id: 'elevated-ltv-control',
      label: 'Elevated LTV Control (>= 90%)',
      target: 75,
      initialValue: Math.round(clamp(elevatedLtvControl, 0, 100)),
      note: 'Inverse exposure to elevated-LTV records at or above 90%.',
    },
    {
      id: 'high-ltv-blocker',
      label: 'High-LTV Blocker Control (>= 95%)',
      target: 85,
      initialValue: Math.round(clamp(highLtvBlockerControl, 0, 100)),
      note: 'Inverse exposure to high-risk LTV tail at or above 95%.',
    },
    {
      id: 'insurance-coverage',
      label: 'Insurance Coverage Completeness',
      target: 80,
      initialValue: Math.round(insuranceCoverage),
      note: 'Measures availability and scoring of insurance-backed collateral.',
    },
    {
      id: 'asset-quality',
      label: 'Asset Quality Readiness',
      target: 75,
      initialValue: Math.round(assetQuality),
      note: 'Summarizes collateral condition and quality assessment capture.',
    },
    {
      id: 'marketability',
      label: 'Marketability Strength',
      target: 75,
      initialValue: Math.round(marketability),
      note: 'Reflects collateral marketability indicators and valuations.',
    },
    {
      id: 'overall-collateral',
      label: 'Overall Collateral Integrity',
      target: 80,
      initialValue: Math.round(overallCollateral),
      note: 'Composite collateral quality signal from score and fallback fields.',
    },
  ];
}

export function buildNetWorthPositioningItems(records: LoanApplicationRecord[]): TrackerItem[] {
  const assetStrength = mean(
    records.map((record) => {
      const appraised = safeNumber(record.appraised_value);
      const loanAmount = safeNumber(record.loan_amount);
      if (appraised <= 0) {
        return 0;
      }
      return scoreFromRatio(Math.max(0, appraised - loanAmount), appraised);
    }),
  );

  const debtCompression = mean(
    records.map((record) => {
      const income = getIncome(record);
      if (income <= 0) {
        return 0;
      }
      const debtRatio = scoreFromRatio(getDebt(record), income);
      return clamp(100 - debtRatio, 0, 100);
    }),
  );

  const liquidityBuffer = mean(
    records.map((record) => {
      const income = getIncome(record);
      if (income <= 0) {
        return 0;
      }
      return scoreFromRatio(Math.max(0, getCashflowSurplus(record)), income);
    }),
  );

  const equityCushion = mean(
    records.map((record) => {
      const loanAmount = safeNumber(record.loan_amount);
      const appraised = safeNumber(record.appraised_value);
      if (loanAmount <= 0) {
        return 0;
      }
      return scoreFromRatio(Math.max(0, appraised - loanAmount), loanAmount);
    }),
  );

  const stabilityIndex = mean([assetStrength, debtCompression, liquidityBuffer, equityCushion]);

  const approveBandCoverage = percentWhere(records, (record) => getEffectiveDecisionBand(record) === 'approve');
  const reviewBandCoverage = percentWhere(records, (record) => getEffectiveDecisionBand(record) === 'review');
  const declineBandControl = 100 - percentWhere(records, (record) => getEffectiveDecisionBand(record) === 'decline');

  return [
    {
      id: 'approve-band-coverage',
      label: 'Approve Band Coverage (>= 80)',
      target: 60,
      initialValue: Math.round(approveBandCoverage),
      note: 'Share of records in policy approve band by score or decision outcome.',
    },
    {
      id: 'review-band-coverage',
      label: 'Review Band Coverage (65 to 79)',
      target: 30,
      initialValue: Math.round(reviewBandCoverage),
      note: 'Share of records in policy review band from decision-engine thresholds.',
    },
    {
      id: 'decline-band-control',
      label: 'Decline Band Control (< 65)',
      target: 80,
      initialValue: Math.round(clamp(declineBandControl, 0, 100)),
      note: 'Inverse concentration of decline-band records under score threshold 65.',
    },
    {
      id: 'asset-strength',
      label: 'Asset Strength',
      target: 35,
      initialValue: Math.round(assetStrength),
      note: 'Measures asset cushion after accounting for financed exposure.',
    },
    {
      id: 'debt-compression',
      label: 'Debt Compression Score',
      target: 70,
      initialValue: Math.round(debtCompression),
      note: 'Inverse debt pressure based on income and obligations profile.',
    },
    {
      id: 'liquidity-buffer',
      label: 'Liquidity Buffer',
      target: 25,
      initialValue: Math.round(liquidityBuffer),
      note: 'Cashflow surplus capability available for resilience planning.',
    },
    {
      id: 'equity-cushion',
      label: 'Equity Cushion',
      target: 30,
      initialValue: Math.round(equityCushion),
      note: 'Loan-to-asset equity distance derived from valuation and exposure.',
    },
    {
      id: 'stability-index',
      label: 'Net Worth Stability Index',
      target: 75,
      initialValue: Math.round(stabilityIndex),
      note: 'Composite signal of assets, debt pressure, liquidity, and equity.',
    },
  ];
}
