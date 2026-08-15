export type CollateralCoverageInput = {
  loanBalance: number;
  collateralValue: number;
};

export type CollateralCoverageResult = {
  loanBalance: number;
  collateralValue: number;
  coveragePercent: number | null;
  optimization: string;
  score: number;
};

function interpolate(value: number, start: number, end: number, startScore: number, endScore: number) {
  const ratio = (value - start) / (end - start);
  return startScore + ((endScore - startScore) * ratio);
}

function scoreCoverage(coveragePercent: number) {
  if (coveragePercent < 100) return interpolate(coveragePercent, 0, 100, 0, 50);
  if (coveragePercent < 150) return interpolate(coveragePercent, 100, 150, 50, 85);
  if (coveragePercent < 200) return interpolate(coveragePercent, 150, 200, 85, 100);
  if (coveragePercent < 225) return interpolate(coveragePercent, 200, 225, 100, 90);
  if (coveragePercent < 250) return interpolate(coveragePercent, 225, 250, 90, 80);
  if (coveragePercent < 275) return interpolate(coveragePercent, 250, 275, 80, 70);
  if (coveragePercent < 300) return interpolate(coveragePercent, 275, 300, 70, 0);
  return 0;
}

function optimizationFor(coveragePercent: number) {
  if (coveragePercent < 100) return 'Insufficient collateral';
  if (coveragePercent < 150) return 'Low';
  if (coveragePercent < 200) return 'Good';
  if (coveragePercent === 200) return 'Optimal';
  if (coveragePercent < 250) return 'Excess collateral';
  if (coveragePercent < 275) return 'More excess collateral';
  if (coveragePercent < 300) return 'Significant excess collateral';
  return 'Highly inefficient collateral allocation';
}

export function computeCollateralCoverage(input: CollateralCoverageInput): CollateralCoverageResult {
  const loanBalance = Math.max(0, Number(input.loanBalance) || 0);
  const collateralValue = Math.max(0, Number(input.collateralValue) || 0);

  if (loanBalance <= 0) {
    return {
      loanBalance,
      collateralValue,
      coveragePercent: null,
      optimization: 'Loan balance needed',
      score: 0,
    };
  }

  const coveragePercent = (collateralValue / loanBalance) * 100;

  return {
    loanBalance,
    collateralValue,
    coveragePercent: Math.round(coveragePercent * 10) / 10,
    optimization: optimizationFor(coveragePercent),
    score: Math.round(Math.max(0, Math.min(100, scoreCoverage(coveragePercent))) * 10) / 10,
  };
}