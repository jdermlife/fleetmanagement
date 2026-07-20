import { describe, expect, it } from 'vitest'

import {
  computeWealthFoundationScore,
  WEALTH_FOUNDATION_BANDS,
} from '../src/pages/scoring/wealthFoundationEngine'

describe('wealth foundation engine', () => {
  it('defines the foundation rating bands', () => {
    expect(WEALTH_FOUNDATION_BANDS).toHaveLength(5)
    expect(WEALTH_FOUNDATION_BANDS[0]).toMatchObject({
      rangeScore: '31-35',
      rating: 'Excellent Wealth Foundation',
      positioningBand: 'Strong Wealth Foundation',
    })
    expect(WEALTH_FOUNDATION_BANDS[4]).toMatchObject({
      rangeScore: 'Below 16',
      rating: 'Weak Wealth Foundation',
      positioningBand: 'Weak Wealth Foundation',
    })
  })

  it('scales raw 35 points to 1000 and returns a banded rating', () => {
    const result = computeWealthFoundationScore({
      amounts: {
        'asset-cash-on-hand': 100000,
        'asset-savings-account': 200000,
        'liability-home-mortgage': 50000,
        'income-salary': 90000,
        'expense-housing': 20000,
        'expense-groceries': 10000,
        'insurance-life': 1,
        'insurance-health': 1,
        'insurance-hmo': 1,
        'banking-account-1': 1,
        'banking-account-2': 1,
        'goal-emergency-fund': 1,
        'goal-financial-independence': 1,
      },
    })

    expect(result.rawScore).toBeGreaterThanOrEqual(0)
    expect(result.rawScore).toBeLessThanOrEqual(35)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(1000)
    expect(result.positioningBand).toBeDefined()
    expect(result.rating).toBeDefined()
  })
})