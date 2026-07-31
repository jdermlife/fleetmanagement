import { describe, expect, it } from 'vitest'

import { computeWidBenchmark, countryCodeFromCitizenship } from '../src/pages/scoring/widBenchmarkEngine'

describe('WID benchmark engine', () => {
  it('does not fabricate a rank when the supplied WID wealth values are blank', () => {
    const result = computeWidBenchmark({
      netWorth: 1_500_000,
      annualIncome: 1_200_000,
      countryCode: 'PH',
      currency: 'PHP',
    })

    expect(result.status).toBe('insufficient-data')
    expect(result.percentile).toBeNull()
    expect(result.band).toBe('Ranking pending')
    expect(result.explanation).toContain('no values or amount thresholds')
    expect(result.incomeConcentrationRank).toBe(5)
    expect(result.incomeConcentrationCountryCount).toBe(7)
    expect(result.top10IncomeShare).toBe(0.454)
  })

  it('interpolates between validated amount thresholds', () => {
    const result = computeWidBenchmark({
      netWorth: 3_000_000,
      annualIncome: 0,
      countryCode: 'PH',
      currency: 'PHP',
      reference: {
        countryCode: 'PH',
        countryName: 'Philippines',
        year: 2024,
        currency: 'PHP',
        incomeShares: { bottom50: 0.1435, top10: 0.454, top1: 0.1662, dataQuality: 1 },
        wealthVariableCode: 'fixture',
        populationBasis: 'Adults',
        wealthShares: { bottom50: 0.1, middle40: 0.3, top10: 0.6, top1: 0.3 },
        wealthThresholds: [
          { percentile: 50, amount: 1_000_000 },
          { percentile: 90, amount: 5_000_000 },
        ],
      },
    })

    expect(result.status).toBe('ranked')
    expect(result.percentile).toBe(70)
    expect(result.topPercent).toBe(30)
    expect(result.band).toBe('Middle 40%')
  })

  it('maps supported profile citizenship values to WID country codes', () => {
    expect(countryCodeFromCitizenship('Filipino')).toBe('PH')
    expect(countryCodeFromCitizenship('Singaporean')).toBe('SG')
  })
})