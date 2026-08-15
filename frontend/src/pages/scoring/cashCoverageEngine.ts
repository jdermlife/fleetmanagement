export type CashCoverageInput = {
  liquidCash: number;
  monthlyExpenses: number;
};

export type CashCoverageResult = {
  coveragePercent: number | null;
  interpretation: string;
  score: number;
  liquidCash: number;
  monthlyExpenses: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function interpolate(value: number, start: number, end: number, startScore: number, endScore: number) {
  const ratio = (value - start) / (end - start);
  return startScore + ((endScore - startScore) * ratio);
}

function scoreCashCoverage(coveragePercent: number) {
  if (coveragePercent < 100) return interpolate(coveragePercent, 0, 100, 0, 50);
  if (coveragePercent < 150) return interpolate(coveragePercent, 100, 150, 70, 85);
  if (coveragePercent < 200) return interpolate(coveragePercent, 150, 200, 85, 95);
  if (coveragePercent === 200) return 100;
  if (coveragePercent < 225) return interpolate(coveragePercent, 200, 225, 100, 90);
  if (coveragePercent < 250) return interpolate(coveragePercent, 225, 250, 90, 80);
  if (coveragePercent < 275) return interpolate(coveragePercent, 250, 275, 80, 70);
  if (coveragePercent < 300) return interpolate(coveragePercent, 275, 300, 70, 0);
  return 0;
}

function interpretationFor(coveragePercent: number) {
  if (coveragePercent < 100) return 'Insufficient liquidity';
  if (coveragePercent < 150) return 'Acceptable';
  if (coveragePercent < 200) return 'Good';
  if (coveragePercent === 200) return 'Optimal';
  if (coveragePercent < 250) return 'Excess idle cash';
  if (coveragePercent < 275) return 'More excess cash';
  if (coveragePercent < 300) return 'Significant excess';
  return 'Highly inefficient idle cash';
}

export function computeCashCoverage(input: CashCoverageInput): CashCoverageResult {
  const liquidCash = Math.max(0, Number(input.liquidCash) || 0);
  const monthlyExpenses = Math.max(0, Number(input.monthlyExpenses) || 0);

  if (monthlyExpenses <= 0) {
    return {
      coveragePercent: null,
      interpretation: 'Monthly expense data needed',
      score: 0,
      liquidCash,
      monthlyExpenses,
    };
  }

  const coveragePercent = (liquidCash / monthlyExpenses) * 100;

  return {
    coveragePercent: Math.round(coveragePercent * 10) / 10,
    interpretation: interpretationFor(coveragePercent),
    score: Math.round(clamp(scoreCashCoverage(coveragePercent), 0, 100) * 10) / 10,
    liquidCash,
    monthlyExpenses,
  };
}