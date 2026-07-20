export type FinancialHealthIndicator = {
  id: string
  label: string
  score: number
  weight: number
  accent: string
  softAccent: string
}

export type FinancialHealthGroupRing = {
  label: string
  value: number
  displayValue: string
  color: string
  radius: number
}

export const DEFAULT_WEALTH_HEALTH_SCORE = 79

export function buildFinancialHealthIndicators(
  wealthScore = DEFAULT_WEALTH_HEALTH_SCORE,
): readonly FinancialHealthIndicator[] {
  return [
    {
      id: 'credit',
      label: 'Credit Health',
      score: 91,
      weight: 15,
      accent: '#5856d6',
      softAccent: '#efeffb',
    },
    {
      id: 'cash-flow',
      label: 'Cash Flow Health',
      score: 88,
      weight: 14,
      accent: '#32ade6',
      softAccent: '#e8f7fd',
    },
    {
      id: 'wealth',
      label: 'Wealth Health',
      score: wealthScore,
      weight: 10,
      accent: '#d4a017',
      softAccent: '#fff7df',
    },
    {
      id: 'budget',
      label: 'Budget Health',
      score: 86,
      weight: 11,
      accent: '#ff9f0a',
      softAccent: '#fff4df',
    },
    {
      id: 'payment',
      label: 'Payment Health',
      score: 94,
      weight: 14,
      accent: '#30b85c',
      softAccent: '#e9f8ee',
    },
    {
      id: 'protection',
      label: 'Protection Health',
      score: 76,
      weight: 10,
      accent: '#e85d5d',
      softAccent: '#fdecec',
    },
    {
      id: 'investment',
      label: 'Investment Health',
      score: 71,
      weight: 11,
      accent: '#0a84ff',
      softAccent: '#e8f3ff',
    },
    {
      id: 'goal',
      label: 'Goal Health',
      score: 82,
      weight: 15,
      accent: '#d94b7d',
      softAccent: '#fcebf1',
    },
  ]
}

export const financialHealthIndicators: readonly FinancialHealthIndicator[] = buildFinancialHealthIndicators()

export function buildFinancialHealthGroupRings(
  indicators: readonly FinancialHealthIndicator[],
): readonly FinancialHealthGroupRing[] {
  const average = (ids: readonly string[]) => {
    const subset = indicators.filter((indicator) => ids.includes(indicator.id))
    const totalWeight = subset.reduce((total, indicator) => total + indicator.weight, 0)
    if (totalWeight === 0) {
      return 0
    }
    return subset.reduce((total, indicator) => total + (indicator.score * indicator.weight), 0) / totalWeight
  }

  return [
    {
      label: 'Foundation',
      value: average(['credit', 'cash-flow', 'payment']),
      displayValue: average(['credit', 'cash-flow', 'payment']).toFixed(1),
      color: '#30b85c',
      radius: 78,
    },
    {
      label: 'Control',
      value: average(['budget', 'wealth', 'protection']),
      displayValue: average(['budget', 'wealth', 'protection']).toFixed(1),
      color: '#32ade6',
      radius: 61,
    },
    {
      label: 'Future',
      value: average(['investment', 'goal']),
      displayValue: average(['investment', 'goal']).toFixed(1),
      color: '#d94b7d',
      radius: 44,
    },
  ]
}

export type FinancialHealthBand =
  | 'Excellent'
  | 'Very Good'
  | 'Good'
  | 'Fair'
  | 'Needs Attention'

export function calculateFinancialHealthIndex(
  indicators: readonly Pick<FinancialHealthIndicator, 'score' | 'weight'>[],
): number | null {
  const totalWeight = indicators.reduce((total, indicator) => total + indicator.weight, 0)

  if (totalWeight !== 100) {
    return null
  }

  const weightedTotal = indicators.reduce(
    (total, indicator) => total + indicator.score * indicator.weight,
    0,
  )

  return Math.round((weightedTotal / totalWeight) * 10) / 10
}

export function scaleFinancialHealthIndex(index: number) {
  return Math.round(index * 10)
}

export function getFinancialHealthBand(score: number): FinancialHealthBand {
  if (score >= 840) return 'Excellent'
  if (score >= 760) return 'Very Good'
  if (score >= 680) return 'Good'
  if (score >= 600) return 'Fair'
  return 'Needs Attention'
}

export function calculateWeightedContribution(
  indicator: Pick<FinancialHealthIndicator, 'score' | 'weight'>,
) {
  return Math.round(indicator.score * (indicator.weight / 100) * 100) / 100
}
