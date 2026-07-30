import { describe, expect, it } from 'vitest'

import {
  buildLendingScoreTimeline,
  calculateAffordableLoan,
} from '../src/pages/scoring/lendingDecisionInsights'

describe('lendingDecisionInsights', () => {
  it('calculates payment capacity and reverses amortization for the maximum loan', () => {
    const result = calculateAffordableLoan({
      totalMonthlyIncome: 100_000,
      existingMonthlyDebt: 20_000,
      requestedMonthlyPayment: 25_000,
      annualInterestRate: 12,
      termMonths: 12,
      collateralValue: 1_000_000,
      dsrLimitPercent: 50,
      ltvLimitPercent: 80,
    })

    expect(result.monthlyPaymentCapacity).toBe(30_000)
    expect(result.recommendedMonthlyPayment).toBe(25_000)
    expect(result.maximumAffordableLoan).toBeCloseTo(337_652, -1)
    expect(result.limitingFactor).toBe('income and existing debt')
  })

  it('projects each available score toward 800 over six months', () => {
    const timeline = buildLendingScoreTimeline([
      { label: 'Credit', score: 600 },
      { label: 'Social', score: 850 },
      { label: 'Credit Values', score: null },
    ])

    expect(timeline).toHaveLength(7)
    expect(timeline[0].scores.map((item) => item.score)).toEqual([600, 850, null])
    expect(timeline[3].scores.map((item) => item.score)).toEqual([700, 850, null])
    expect(timeline[6].scores.map((item) => item.score)).toEqual([800, 850, null])
  })
})