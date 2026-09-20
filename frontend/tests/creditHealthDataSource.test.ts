import { describe, expect, it } from 'vitest'

import {
  allowsLocalBuildProfile,
  resolveDatabaseApplicationNo,
} from '../src/pages/scoring/creditHealthDataSource'

describe('Credit Health database source policy', () => {
  it('prefers applicationNo over profileId', () => {
    const params = new URLSearchParams('applicationNo=APP-001&profileId=PRO-001')

    expect(resolveDatabaseApplicationNo(params, true, 'APP-SELECTED')).toBe('APP-001')
  })

  it('accepts a mirrored profileId as the database application number', () => {
    const params = new URLSearchParams('profileId=PRO-001')

    expect(resolveDatabaseApplicationNo(params, true, '')).toBe('PRO-001')
  })

  it('requires an explicit URL identifier on the FILSCORE route', () => {
    expect(resolveDatabaseApplicationNo(new URLSearchParams(), true, 'APP-SELECTED')).toBe('')
  })

  it('keeps profileId as a local draft identity in the loan editor', () => {
    const params = new URLSearchParams('profileId=PRO-LOCAL')

    expect(resolveDatabaseApplicationNo(params, false, 'APP-SELECTED')).toBe('')
  })

  it('disables local Build Profile replication only for FILSCORE', () => {
    expect(allowsLocalBuildProfile(true)).toBe(false)
    expect(allowsLocalBuildProfile(false)).toBe(true)
  })
})
