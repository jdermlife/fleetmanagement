import { describe, expect, it } from 'vitest'

import { computeWealthCompositeScore } from '../src/pages/scoring/wealthCompositeEngine'

describe('computeWealthCompositeScore', () => {
  it('applies the 75/10/10/5 weighting after normalizing source scales', () => {
    const result = computeWealthCompositeScore({
      netWorthPositioningScore: 725,
      wealthBehaviourScore: 80,
      wealthFoundationScore: 900,
      wealthAuthenticityScore: 60,
    })

    expect(result.contributions).toEqual({
      netWorthPositioning: 56.3,
      wealthBehaviour: 8,
      wealthFoundation: 9,
      wealthAuthenticity: 3,
    })
    expect(result.normalizedScore).toBe(76.3)
    expect(result.score).toBe(734)
    expect(result.grade).toBe('B+')
  })

  it('keeps the composite within the 200 to 900 FILSCORE range', () => {
    expect(computeWealthCompositeScore({
      netWorthPositioningScore: 0,
      wealthBehaviourScore: -10,
      wealthFoundationScore: -100,
      wealthAuthenticityScore: -5,
    }).score).toBe(200)
    expect(computeWealthCompositeScore({
      netWorthPositioningScore: 1000,
      wealthBehaviourScore: 150,
      wealthFoundationScore: 1200,
      wealthAuthenticityScore: 200,
    }).score).toBe(900)
  })
})