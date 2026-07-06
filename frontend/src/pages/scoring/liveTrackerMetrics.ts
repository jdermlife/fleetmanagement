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

function getCashflowSurplus(record: LoanApplicationRecord): number {
  return getIncome(record) - getLivingExpenses(record) - getDebt(record);
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
