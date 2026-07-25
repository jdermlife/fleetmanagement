import {
  buildFinancialHealthGroupRings,
  buildFinancialHealthIndicators,
  calculateFinancialHealthIndex,
  scaleFinancialHealthIndex,
  type FinancialHealthIndicator,
} from './financialHealthModel'

export type FinancialHealthSummaryInputs = Partial<Record<FinancialHealthIndicator['id'], number | null>>

export type FinancialHealthGroupCalculation = {
  id: 'foundation' | 'control' | 'future'
  label: string
  description: string
  indicatorIds: string[]
  numerator: number
  totalWeight: number
  value: number
  displayValue: string
  formula: string
}

export type FinancialHealthSummaryResult = {
  indicators: readonly FinancialHealthIndicator[]
  groups: readonly FinancialHealthGroupCalculation[]
  index: number
  score: number
}

const groupDefinitions = [
  {
    id: 'foundation',
    label: 'Foundation & reliability',
    description: 'Credit, cash flow, and payment',
    indicatorIds: ['credit', 'cash-flow', 'payment'],
  },
  {
    id: 'control',
    label: 'Control & resilience',
    description: 'Budget, wealth, and protection',
    indicatorIds: ['budget', 'wealth', 'protection'],
  },
  {
    id: 'future',
    label: 'Future progress',
    description: 'Investment and goal health',
    indicatorIds: ['investment', 'goal'],
  },
] as const

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function round(value: number, precision = 1): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export function computeFinancialHealthSummary(
  inputs: FinancialHealthSummaryInputs = {},
): FinancialHealthSummaryResult {
  const indicators = buildFinancialHealthIndicators().map((indicator) => {
    const latestScore = inputs[indicator.id]
    return {
      ...indicator,
      score: typeof latestScore === 'number' ? round(clampScore(latestScore)) : indicator.score,
    }
  })
  const rings = buildFinancialHealthGroupRings(indicators)
  const groups = groupDefinitions.map((definition, groupIndex) => {
    const components = definition.indicatorIds.map((indicatorId) => {
      const indicator = indicators.find((candidate) => candidate.id === indicatorId)
      if (!indicator) {
        throw new Error(`Missing Financial Health indicator: ${indicatorId}`)
      }
      return indicator
    })
    const numerator = components.reduce((total, indicator) => total + indicator.score * indicator.weight, 0)
    const totalWeight = components.reduce((total, indicator) => total + indicator.weight, 0)
    const value = totalWeight > 0 ? numerator / totalWeight : 0
    const terms = components.map((indicator) => `${indicator.score} x ${indicator.weight}`).join(' + ')

    return {
      ...definition,
      indicatorIds: [...definition.indicatorIds],
      numerator: round(numerator, 2),
      totalWeight,
      value,
      displayValue: rings[groupIndex].displayValue,
      formula: `(${terms}) / ${totalWeight} = ${rings[groupIndex].displayValue}`,
    }
  })
  const index = calculateFinancialHealthIndex(indicators) ?? 0

  return {
    indicators,
    groups,
    index,
    score: scaleFinancialHealthIndex(index),
  }
}