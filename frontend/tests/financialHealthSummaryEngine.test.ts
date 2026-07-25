import { describe, expect, it } from 'vitest'

import { computeFinancialHealthSummary } from '../src/pages/scoring/financialHealthSummaryEngine'

describe('financial health summary engine', () => {
  it('shows the default weighted calculations for all three summary groups', () => {
    const result = computeFinancialHealthSummary()

    expect(result.groups.map((group) => group.displayValue)).toEqual(['91.0', '80.5', '77.3'])
    expect(result.groups[0].formula).toBe('(91 x 15 + 88 x 14 + 94 x 14) / 43 = 91.0')
    expect(result.groups[1].formula).toBe('(86 x 11 + 79 x 10 + 76 x 10) / 31 = 80.5')
    expect(result.groups[2].formula).toBe('(71 x 11 + 82 x 15) / 26 = 77.3')
    expect(result.score).toBe(842)
  })

  it('applies latest inputs as one published computation', () => {
    const result = computeFinancialHealthSummary({
      credit: 80,
      'cash-flow': 70,
      payment: 90,
      budget: 75,
      wealth: 65,
      protection: 85,
      investment: 60,
      goal: 70,
    })

    expect(result.groups.map((group) => group.displayValue)).toEqual(['80.0', '75.0', '65.8'])
    expect(result.score).toBe(748)
  })
})
