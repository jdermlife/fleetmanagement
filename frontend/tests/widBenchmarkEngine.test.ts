import { describe, expect, it } from 'vitest'

import {
  computePhilippineIncomeBenchmark,
  computeWidBenchmark,
  countryCodeFromCitizenship,
  getWidIncomeBenchmarkTable,
} from '../src/pages/scoring/widBenchmarkEngine'

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

  it('creates the supplied-country benchmark table in descending top-10% share order', () => {
    const table = getWidIncomeBenchmarkTable()

    expect(table).toHaveLength(7)
    expect(table.map((row) => row.countryCode)).toEqual(['TH', 'ID', 'US', 'SG', 'PH', 'MY', 'GB'])
    expect(table.find((row) => row.countryCode === 'PH')).toMatchObject({
      rank: 5,
      bottom50Share: 0.1435,
      top10Share: 0.454,
      top1Share: 0.1662,
    })
  })

  it('classifies Philippine household income and applies configured approximate ranks', () => {
    expect(computePhilippineIncomeBenchmark(25_000 * 12)).toMatchObject({
      classification: 'Low Income (Non-Poor)',
      nationalRank: 'Bottom 50%',
      globalRank: 'Bottom 60%',
    })
    expect(computePhilippineIncomeBenchmark(120_000 * 12)).toMatchObject({
      classification: 'Upper Middle Income',
      nationalRank: 'Top 10%',
      globalRank: 'Top 20%',
    })
    expect(computePhilippineIncomeBenchmark(500_000 * 12)).toMatchObject({
      classification: 'Rich',
      nationalRank: 'Top 1%',
      globalRank: 'Top 2%',
    })
  })

  it('applies the configured PSA household income boundaries', () => {
    expect(computePhilippineIncomeBenchmark(12_999 * 12).classification).toBe('Poor')
    expect(computePhilippineIncomeBenchmark(13_000 * 12).classification).toBe('Low Income (Non-Poor)')
    expect(computePhilippineIncomeBenchmark(26_001 * 12).classification).toBe('Lower Middle Income')
    expect(computePhilippineIncomeBenchmark(52_001 * 12).classification).toBe('Middle Middle Income')
    expect(computePhilippineIncomeBenchmark(104_001 * 12).classification).toBe('Upper Middle Income')
    expect(computePhilippineIncomeBenchmark(182_001 * 12).classification).toBe('High Income (Not Rich)')
    expect(computePhilippineIncomeBenchmark(219_001 * 12).classification).toBe('Rich')
  })
})