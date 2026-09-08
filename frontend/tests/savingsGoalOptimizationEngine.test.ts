import { describe, expect, it } from 'vitest'

import { computeSavingsGoalOptimization } from '../src/pages/scoring/savingsGoalOptimizationEngine'

describe('computeSavingsGoalOptimization', () => {
  it('quantifies the monthly amount and duration without investment growth', () => {
    const result = computeSavingsGoalOptimization({
      targetSavingsGoal: 500000,
      actualSavings: 100000,
      currentMonthlySavings: 20000,
      targetMonths: 12,
      annualReturnRate: 0,
    })

    expect(result.savingsGap).toBe(400000)
    expect(result.monthlyAmountNeeded).toBeCloseTo(33333.33, 2)
    expect(result.monthsRequired).toBe(20)
    expect(result.projectedSavingsAtTarget).toBe(340000)
    expect(result.monthlyAdjustment).toBeCloseTo(13333.33, 2)
    expect(result.status).toBe('Adjustment needed')
  })

  it('recognizes an already funded goal', () => {
    const result = computeSavingsGoalOptimization({
      targetSavingsGoal: 250000,
      actualSavings: 300000,
      currentMonthlySavings: 0,
      targetMonths: 12,
      annualReturnRate: 0,
    })

    expect(result.monthsRequired).toBe(0)
    expect(result.monthlyAmountNeeded).toBe(0)
    expect(result.progressPercent).toBe(100)
    expect(result.status).toBe('Goal reached')
  })

  it('returns no completion date when no savings or growth is provided', () => {
    const result = computeSavingsGoalOptimization({
      targetSavingsGoal: 100000,
      actualSavings: 10000,
      currentMonthlySavings: 0,
      targetMonths: 12,
      annualReturnRate: 0,
    })

    expect(result.monthsRequired).toBeNull()
    expect(result.status).toBe('No contribution set')
  })
})
