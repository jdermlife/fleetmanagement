import { describe, expect, it } from 'vitest'

import { buildLendingScoreRecommendation } from '../src/pages/scoring/lendingScoreRecommendations'

describe('lending score recommendations', () => {
  it('targets the next FILScore band and calculates the required lift', () => {
    const recommendation = buildLendingScoreRecommendation('credit', 50)

    expect(recommendation.currentScore).toBe(550)
    expect(recommendation.currentBand).toBe('Bronze 1 - Moderate Risk')
    expect(recommendation.nextBand).toBe('Silver 2 - Acceptable')
    expect(recommendation.targetScore).toBe(620)
    expect(recommendation.pointsNeeded).toBe(70)
    expect(recommendation.summary).toContain('move up one notch')
  })

  it('uses a maintenance recommendation at the highest band', () => {
    const recommendation = buildLendingScoreRecommendation('social', 100)

    expect(recommendation.currentScore).toBe(900)
    expect(recommendation.currentBand).toBe('Platinum 1 - Exceptional')
    expect(recommendation.nextBand).toBeNull()
    expect(recommendation.pointsNeeded).toBe(0)
    expect(recommendation.summary).toContain('highest FILScore band')
  })

  it('asks for score generation when a score has not been produced', () => {
    const recommendation = buildLendingScoreRecommendation('non-starter', null)

    expect(recommendation.currentScore).toBeNull()
    expect(recommendation.currentBand).toBe('Not produced')
    expect(recommendation.pointsNeeded).toBeNull()
    expect(recommendation.summary).toContain('generate FILScore')
  })

  it('returns guidance tailored to each score category', () => {
    const credit = buildLendingScoreRecommendation('credit', 60)
    const nonStarter = buildLendingScoreRecommendation('non-starter', 60)
    const social = buildLendingScoreRecommendation('social', 60)
    const creditValues = buildLendingScoreRecommendation('credit-values', 60)

    expect(credit.actions.join(' ')).toContain('DSR')
    expect(nonStarter.actions.join(' ')).toContain('identity')
    expect(social.actions.join(' ')).toContain('residence')
    expect(creditValues.actions.join(' ')).toContain('psychometric')
  })
})