import { describe, expect, it } from 'vitest';

import { computeCollateralCoverage } from '../src/pages/scoring/collateralCoverageEngine';

function resultAt(coveragePercent: number) {
  return computeCollateralCoverage({ loanBalance: 100, collateralValue: coveragePercent });
}

describe('computeCollateralCoverage', () => {
  it.each([
    [100, 'Low', 50],
    [150, 'Good', 85],
    [200, 'Optimal', 100],
    [225, 'Excess collateral', 90],
    [250, 'More excess collateral', 80],
    [275, 'Significant excess collateral', 70],
    [300, 'Highly inefficient collateral allocation', 0],
  ])('scores %s%% collateral coverage', (coverage, optimization, score) => {
    expect(resultAt(coverage)).toMatchObject({ coveragePercent: coverage, optimization, score });
  });

  it('returns a pending result when loan balance is unavailable', () => {
    expect(computeCollateralCoverage({ loanBalance: 0, collateralValue: 500_000 })).toMatchObject({
      coveragePercent: null,
      optimization: 'Loan balance needed',
      score: 0,
    });
  });
});