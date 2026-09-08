import { describe, expect, it } from 'vitest'

import { computeRetirementModel, type RetirementModelInputs } from '../src/pages/scoring/retirementModelEngine'

const baseline: RetirementModelInputs = {
  currentAge: 35,
  retirementAge: 60,
  lifeExpectancy: 85,
  currentMonthlyExpenses: 50000,
  retirementSpendingPercent: 80,
  currentRetirementSavings: 1000000,
  monthlyContribution: 20000,
  annualPreRetirementReturn: 7,
  annualPostRetirementReturn: 5,
  annualReturnVolatility: 10,
  inflationRate: 3,
  annualPensionIncome: 120000,
  withdrawalRate: 4,
  annualContributionIncrease: 3,
}

describe('computeRetirementModel', () => {
  it('produces all nine retirement planning outputs', () => {
    const result = computeRetirementModel(baseline)

    expect(result.yearsToRetirement).toBe(25)
    expect(result.retirementNeeds.monthlyExpensesAtRetirement).toBeGreaterThan(50000)
    expect(result.inflation.cumulativeIncreasePercent).toBeGreaterThan(100)
    expect(result.retirementIncome.totalAnnualIncome).toBeGreaterThan(120000)
    expect(result.investmentProjection.projectedPortfolioAtRetirement).toBeGreaterThan(baseline.currentRetirementSavings)
    expect(result.retirementCorpus.requiredCorpus).toBeGreaterThan(0)
    expect(result.financialIndependence.age).not.toBeNull()
    expect(result.contributionOptimizer.requiredMonthlyContribution).toBeGreaterThanOrEqual(0)
    expect(result.scenarios).toHaveLength(3)
    expect(result.monteCarlo.trials).toBe(500)
    expect(result.monteCarlo.successProbabilityPercent).toBeGreaterThanOrEqual(0)
    expect(result.monteCarlo.successProbabilityPercent).toBeLessThanOrEqual(100)
  })

  it('shows a larger corpus and monthly contribution when inflation rises', () => {
    const base = computeRetirementModel(baseline)
    const highInflation = computeRetirementModel({ ...baseline, inflationRate: 6 })

    expect(highInflation.retirementCorpus.requiredCorpus).toBeGreaterThan(base.retirementCorpus.requiredCorpus)
    expect(highInflation.contributionOptimizer.requiredMonthlyContribution).toBeGreaterThan(base.contributionOptimizer.requiredMonthlyContribution)
  })

  it('returns deterministic Monte Carlo results for the same inputs', () => {
    const first = computeRetirementModel(baseline).monteCarlo
    const second = computeRetirementModel(baseline).monteCarlo

    expect(second).toEqual(first)
    expect(first.percentile10EndingBalance).toBeLessThanOrEqual(first.medianEndingBalance)
    expect(first.medianEndingBalance).toBeLessThanOrEqual(first.percentile90EndingBalance)
  })
})
