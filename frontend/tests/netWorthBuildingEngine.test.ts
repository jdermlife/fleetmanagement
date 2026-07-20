import { describe, expect, it } from 'vitest'

import {
  computeNetWorthBuildingScore,
  getNetWorthBuildingGradeBand,
  NET_WORTH_BUILDING_GRADE_BANDS,
} from '../src/pages/scoring/netWorthBuildingEngine'

describe('net worth building engine', () => {
  it('defines the requested 10-tier bands from 900 down to 200', () => {
    expect(NET_WORTH_BUILDING_GRADE_BANDS).toHaveLength(10)
    expect(NET_WORTH_BUILDING_GRADE_BANDS[0]).toMatchObject({
      rangeScore: '830-900',
      grade: 'A+',
    })
    expect(NET_WORTH_BUILDING_GRADE_BANDS[9]).toMatchObject({
      rangeScore: '200-269',
      grade: 'F',
    })
  })

  it('maps boundary scores into the correct grade band', () => {
    expect(getNetWorthBuildingGradeBand(900).grade).toBe('A+')
    expect(getNetWorthBuildingGradeBand(760).grade).toBe('A')
    expect(getNetWorthBuildingGradeBand(200).grade).toBe('F')
  })

  it('computes a bounded score and core metrics from workflow inputs', () => {
    const result = computeNetWorthBuildingScore({
      amounts: {
        'asset-cash-on-hand': 200000,
        'asset-savings-account': 300000,
        'asset-stocks': 250000,
        'asset-retirement-fund': 500000,
        'liability-home-mortgage': 150000,
        'income-salary': 120000,
        'income-passive': 25000,
        'expense-housing': 20000,
        'expense-groceries': 10000,
        'expense-investments': 8000,
        'insurance-life': 1,
        'insurance-health': 1,
        'insurance-hmo': 1,
        'insurance-critical-illness': 1,
        'insurance-accident': 1,
        'insurance-disability': 1,
        'insurance-property': 1,
        'insurance-vehicle': 1,
        'insurance-business': 1,
      },
      selectedFinancialGoal: 'Build Emergency Fund',
      targetAmount: 1200000,
      targetMonths: 12,
    })

    expect(result.score).toBeGreaterThanOrEqual(200)
    expect(result.score).toBeLessThanOrEqual(900)
    expect(result.metrics.netWorth).toBe(1100000)
    expect(result.metrics.monthlyCashFlow).toBe(107000)
    expect(result.rangeScore).toBe(result.band.rangeScore)
  })
})