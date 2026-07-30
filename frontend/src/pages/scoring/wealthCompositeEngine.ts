import { getNetWorthBuildingGradeBand } from './netWorthBuildingEngine'

export type WealthCompositeInput = {
  netWorthPositioningScore: number
  wealthBehaviourScore: number
  wealthFoundationScore: number
  wealthAuthenticityScore: number
}

export type WealthCompositeResult = {
  score: number
  normalizedScore: number
  grade: string
  rating: string
  rangeScore: string
  contributions: {
    netWorthPositioning: number
    wealthBehaviour: number
    wealthFoundation: number
    wealthAuthenticity: number
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function round(value: number, precision = 1) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export function computeWealthCompositeScore(input: WealthCompositeInput): WealthCompositeResult {
  const positioningNormalized = clamp((input.netWorthPositioningScore - 200) / 7, 0, 100)
  const behaviourNormalized = clamp(input.wealthBehaviourScore, 0, 100)
  const foundationNormalized = clamp(input.wealthFoundationScore / 10, 0, 100)
  const authenticityNormalized = clamp(input.wealthAuthenticityScore, 0, 100)
  const contributions = {
    netWorthPositioning: positioningNormalized * 0.75,
    wealthBehaviour: behaviourNormalized * 0.1,
    wealthFoundation: foundationNormalized * 0.1,
    wealthAuthenticity: authenticityNormalized * 0.05,
  }
  const normalizedScore = round(
    contributions.netWorthPositioning
      + contributions.wealthBehaviour
      + contributions.wealthFoundation
      + contributions.wealthAuthenticity,
  )
  const score = Math.round(clamp(200 + (normalizedScore * 7), 200, 900))
  const band = getNetWorthBuildingGradeBand(score)

  return {
    score,
    normalizedScore,
    grade: band.grade,
    rating: band.rating,
    rangeScore: band.rangeScore,
    contributions: {
      netWorthPositioning: round(contributions.netWorthPositioning),
      wealthBehaviour: round(contributions.wealthBehaviour),
      wealthFoundation: round(contributions.wealthFoundation),
      wealthAuthenticity: round(contributions.wealthAuthenticity),
    },
  }
}