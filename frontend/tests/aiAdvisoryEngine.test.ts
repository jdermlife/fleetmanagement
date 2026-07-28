import { describe, expect, it } from 'vitest'

import { computeAiAdvisories } from '../src/pages/scoring/aiAdvisoryEngine'
import { computeNetWorthBuildingScore } from '../src/pages/scoring/netWorthBuildingEngine'

describe('computeAiAdvisories', () => {
  it('builds all twelve advisories from live wealth metrics without inventing history', () => {
    const amounts = {
      'asset-cash-on-hand': '50000',
      'asset-real-estate-primary': '950000',
      'liability-home-mortgage': '20000',
      'income-salary': '33000',
      'expense-housing': '18500',
    }
    const score = computeNetWorthBuildingScore({ amounts, targetAmount: 1200000, targetMonths: 12 })
    const advisories = computeAiAdvisories({
      score,
      amounts,
      labels: {
        'asset-cash-on-hand': 'Cash on Hand',
        'asset-real-estate-primary': 'Primary Residence',
        'liability-home-mortgage': 'Home Mortgage',
      },
      currency: 'PHP',
    })

    expect(Object.keys(advisories)).toHaveLength(12)
    expect(advisories['ai-net-worth'].analysis.join(' ')).toContain('Primary Residence is the largest current asset contributor')
    expect(advisories['ai-net-worth'].analysis.join(' ')).toContain('Previous-month data is not available')
    expect(advisories['ai-monthly-cash-flow'].recommendation).toContain('₱14,500.00')
    expect(advisories['ai-overall-financial-wellness'].analysis[0]).toContain(`Overall Financial Wellness Rating: ${score.score}`)
  })
})