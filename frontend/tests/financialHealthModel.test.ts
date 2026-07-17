import { describe, expect, it } from 'vitest'

import {
  calculateFinancialHealthIndex,
  calculateWeightedContribution,
  financialHealthIndicators,
  getFinancialHealthBand,
  scaleFinancialHealthIndex,
} from '../src/pages/scoring/financialHealthModel'

describe('financial health model', () => {
  it('uses a complete 100 percent weighting model', () => {
    const totalWeight = financialHealthIndicators.reduce(
      (total, indicator) => total + indicator.weight,
      0,
    )

    expect(totalWeight).toBe(100)
  })

  it('calculates the displayed 842 excellent score from the indicators', () => {
    const index = calculateFinancialHealthIndex(financialHealthIndicators)
    const score = scaleFinancialHealthIndex(index ?? 0)

    expect(index).toBe(84.2)
    expect(score).toBe(842)
    expect(getFinancialHealthBand(score)).toBe('Excellent')
  })

  it('marks an incomplete indicator set as provisional instead of reweighting it', () => {
    expect(calculateFinancialHealthIndex(financialHealthIndicators.slice(0, 7))).toBeNull()
  })

  it('uses 840 as the excellent band boundary', () => {
    expect(getFinancialHealthBand(840)).toBe('Excellent')
    expect(getFinancialHealthBand(839)).toBe('Very Good')
  })

  it('preserves each indicator contribution in the overall index', () => {
    const contributionTotal = financialHealthIndicators.reduce(
      (total, indicator) => total + calculateWeightedContribution(indicator),
      0,
    )

    expect(contributionTotal).toBeCloseTo(84.2, 2)
  })
})
