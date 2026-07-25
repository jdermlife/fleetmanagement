import { FILSCORE_BANDS, getFilscoreBand, toFilscore } from './filscoreScale'

export type LendingScoreRecommendationKind =
  | 'credit'
  | 'non-starter'
  | 'social'
  | 'credit-values'

export type LendingScoreRecommendation = {
  kind: LendingScoreRecommendationKind
  label: string
  currentScore: number | null
  currentBand: string
  nextBand: string | null
  targetScore: number | null
  pointsNeeded: number | null
  summary: string
  actions: readonly string[]
}

type RecommendationDefinition = {
  label: string
  actions: readonly string[]
}

const recommendationDefinitions: Record<LendingScoreRecommendationKind, RecommendationDefinition> = {
  credit: {
    label: 'Credit Score',
    actions: [
      'Reduce monthly debt obligations or increase verified recurring income to improve DSR.',
      'Increase the down payment or strengthen collateral value to reduce LTV.',
      'Keep loan and card payments current and provide complete income and bank-statement evidence.',
    ],
  },
  'non-starter': {
    label: 'Non-Starter Score',
    actions: [
      'Complete identity, liveness, contact, and address verification with valid matching records.',
      'Resolve document, watchlist, device, or bank-ownership alerts before resubmission.',
      'Submit authentic, readable income and bank documents and avoid duplicate rapid applications.',
    ],
  },
  social: {
    label: 'Social Score',
    actions: [
      'Document residence and employment tenure with current, verifiable details.',
      'Provide complete employer, community, and character references where applicable.',
      'Maintain traceable banking relationships and consistent contact and address information.',
    ],
  },
  'credit-values': {
    label: 'Credit Values Score',
    actions: [
      'Complete every behavioral and psychometric question with truthful, consistent responses.',
      'Demonstrate budgeting, repayment discipline, emergency planning, and responsible risk choices.',
      'Resolve incomplete or contradictory responses before requesting a new score.',
    ],
  },
}

export function buildLendingScoreRecommendation(
  kind: LendingScoreRecommendationKind,
  internalScore: number | null | undefined,
): LendingScoreRecommendation {
  const definition = recommendationDefinitions[kind]
  const currentScore = toFilscore(internalScore)

  if (currentScore === null) {
    return {
      kind,
      label: definition.label,
      currentScore: null,
      currentBand: 'Not produced',
      nextBand: null,
      targetScore: null,
      pointsNeeded: null,
      summary: 'Complete the required information and generate FILScore to receive a next-notch target.',
      actions: definition.actions,
    }
  }

  const currentBandIndex = FILSCORE_BANDS.findIndex((band) => currentScore >= band.minimum)
  const currentBand = getFilscoreBand(currentScore)
  const nextBand = currentBandIndex > 0 ? FILSCORE_BANDS[currentBandIndex - 1] : null
  const nextBandLabel = nextBand ? `${nextBand.grade} - ${nextBand.internalGrade}` : null

  return {
    kind,
    label: definition.label,
    currentScore,
    currentBand: currentBand
      ? `${currentBand.grade} - ${currentBand.internalGrade}`
      : `${FILSCORE_BANDS[FILSCORE_BANDS.length - 1].grade} - ${FILSCORE_BANDS[FILSCORE_BANDS.length - 1].internalGrade}`,
    nextBand: nextBandLabel,
    targetScore: nextBand?.minimum ?? null,
    pointsNeeded: nextBand ? Math.max(nextBand.minimum - currentScore, 0) : 0,
    summary: nextBand
      ? `Reach at least ${nextBand.minimum} FILScore points to move up one notch to ${nextBandLabel}.`
      : 'This score is already in the highest FILScore band. Maintain the practices supporting it.',
    actions: definition.actions,
  }
}
