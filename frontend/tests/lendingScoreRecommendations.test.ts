import { describe, expect, it } from 'vitest'

import { getLendingImprovementAreas } from '../src/pages/scoring/lendingScoreRecommendations'

describe('lending score recommendations', () => {
  it('returns four plain-language areas for improvement', () => {
    const areas = getLendingImprovementAreas()

    expect(areas.map((area) => area.label)).toEqual([
      'Credit Profile',
      'Identity and Verification',
      'Social and Stability Profile',
      'Financial Behavior and Values',
    ])
  })

  it('does not reference scores, ratings, bands, or points', () => {
    const wording = JSON.stringify(getLendingImprovementAreas()).toLowerCase()

    expect(wording).not.toMatch(/score|rating|band|points/)
  })

  it('returns guidance tailored to each score category', () => {
    const areas = getLendingImprovementAreas()
    const credit = areas.find((area) => area.kind === 'credit')!
    const nonStarter = areas.find((area) => area.kind === 'non-starter')!
    const social = areas.find((area) => area.kind === 'social')!
    const creditValues = areas.find((area) => area.kind === 'credit-values')!

    expect(credit.actions.join(' ')).toContain('debt obligations')
    expect(nonStarter.actions.join(' ')).toContain('identity')
    expect(social.actions.join(' ')).toContain('residence')
    expect(creditValues.actions.join(' ')).toContain('psychometric')
  })
})