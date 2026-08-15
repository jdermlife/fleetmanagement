import { describe, expect, it } from 'vitest';

import { computeCashCoverage } from '../src/pages/scoring/cashCoverageEngine';

function resultAt(coveragePercent: number) {
  return computeCashCoverage({ liquidCash: coveragePercent, monthlyExpenses: 100 });
}

describe('computeCashCoverage', () => {
  it.each([
    [50, 'Insufficient liquidity', 25],
    [100, 'Acceptable', 70],
    [150, 'Good', 85],
    [175, 'Good', 90],
    [200, 'Optimal', 100],
    [225, 'Excess idle cash', 90],
    [250, 'More excess cash', 80],
    [275, 'Significant excess', 70],
    [300, 'Highly inefficient idle cash', 0],
  ])('scores %s%% coverage as %s', (coverage, interpretation, score) => {
    expect(resultAt(coverage)).toMatchObject({
      coveragePercent: coverage,
      interpretation,
      score,
    });
  });

  it('returns a pending result when monthly expenses are unavailable', () => {
    expect(computeCashCoverage({ liquidCash: 100_000, monthlyExpenses: 0 })).toMatchObject({
      coveragePercent: null,
      interpretation: 'Monthly expense data needed',
      score: 0,
    });
  });
});