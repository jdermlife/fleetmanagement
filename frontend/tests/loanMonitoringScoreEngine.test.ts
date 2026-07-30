import { describe, expect, it } from 'vitest'

import { computeLoanMonitoringScore, type LoanMonitoringScoreInput } from '../src/pages/scoring/loanMonitoringScoreEngine'

const healthyInput: LoanMonitoringScoreInput = {
  daysPastDue: 0,
  beginningBalance: 2_000_000,
  currentBalance: 1_500_000,
  dsrPercent: 32,
  utilizationPercent: 35,
  ltvPercent: 58,
  activeLoanCount: 2,
  highInterestLoanCount: 0,
  distinctLoanTypeCount: 2,
  distinctLenderCount: 2,
  refinancingImprovesCashFlow: false,
  consolidationOpportunity: true,
  principalPrepayment: true,
  savingsBehaviorScore: 80,
  budgetAdherenceScore: 90,
}

describe('computeLoanMonitoringScore', () => {
  it('applies the requested component weights and grade bands', () => {
    const result = computeLoanMonitoringScore(healthyInput)

    expect(result.components).toEqual({
      paymentPerformance: 30,
      balanceManagement: 13,
      debtServiceCapacity: 18,
      loanUtilization: 10,
      collateralQuality: 10,
      portfolioHealth: 10,
      aiAdjustment: 1,
    })
    expect(result.score).toBe(92)
    expect(result.grade).toBe('A')
  })

  it('applies all listed positive adjustments without exceeding 100', () => {
    const result = computeLoanMonitoringScore({
      ...healthyInput,
      currentBalance: 1_000_000,
      dsrPercent: 25,
      regularExtraPayments: true,
      refinancingImprovesCashFlow: true,
    })

    expect(result.components.aiAdjustment).toBe(4)
    expect(result.score).toBe(99)
    expect(result.grade).toBe('A+')
  })

  it('does not award perfect points for unavailable ratios or payment data', () => {
    const result = computeLoanMonitoringScore({
      ...healthyInput,
      daysPastDue: null,
      dsrPercent: null,
      utilizationPercent: null,
      ltvPercent: null,
    })

    expect(result.components.paymentPerformance).toBe(0)
    expect(result.components.debtServiceCapacity).toBe(0)
    expect(result.components.loanUtilization).toBe(0)
    expect(result.components.collateralQuality).toBe(0)
  })

  it('produces behavioral health and bounded predictive estimates', () => {
    const result = computeLoanMonitoringScore(healthyInput)

    expect(result.behavioralHealth).toHaveLength(8)
    expect(result.predictions.probabilityOfDefault).toBeGreaterThanOrEqual(0)
    expect(result.predictions.probabilityOfDefault).toBeLessThanOrEqual(100)
    expect(result.predictions.expectedLoanTrajectory).toBeTruthy()
  })
})