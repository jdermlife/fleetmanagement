import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BUILD_PROFILE_STORAGE_KEY,
  readReplicatedBuildProfile,
  getSelectedBuildProfileApplicationNo,
  toNetWorthDraft,
  type ReplicatedBuildProfile,
} from '../src/pages/scoring/buildProfileReplication'

const profile: ReplicatedBuildProfile = {
  profileId: 'PRO-1',
  values: {
    asOfDate: '2026-07-27',
    wealthCurrency: 'USD',
    financialGoal: 'Build Emergency Fund',
    targetAmount: '12000',
    targetMonths: '6',
    cash: '5000',
    'wealthAllocation.cash': '40',
    'wealthActual.cash': '5500',
    'wealthVarianceNote.cash': 'Saved more',
    wealthSetupSaved: 'true',
  },
  documents: [],
  suitabilityAnswers: { 'suitability-q1': '3' },
  coBorrowers: [],
  guarantors: [],
  additionalCollaterals: [],
}

describe('build profile replication', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
  })

  it('only reads the requested profile identity', () => {
    window.localStorage.setItem(BUILD_PROFILE_STORAGE_KEY, JSON.stringify(profile))
    expect(readReplicatedBuildProfile('PRO-1')?.profileId).toBe('PRO-1')
    expect(readReplicatedBuildProfile('PRO-2')).toBeNull()
  })

  it('keeps an explicit selected application separate from generated profile IDs', () => {
    window.localStorage.setItem(BUILD_PROFILE_STORAGE_KEY, JSON.stringify({
      ...profile,
      profileId: 'PRO-LOCAL',
      selectedApplicationNo: 'APP-SELECTED',
    }))
    expect(getSelectedBuildProfileApplicationNo()).toBe('APP-SELECTED')

    window.localStorage.setItem(BUILD_PROFILE_STORAGE_KEY, JSON.stringify({
      ...profile,
      profileId: 'PRO-LOCAL',
    }))
    expect(getSelectedBuildProfileApplicationNo()).toBe('')
  })

  it('does not expose another user’s selected application on a shared browser', () => {
    const tokenFor = (subject: string) => `header.${btoa(JSON.stringify({ sub: subject }))}.signature`
    window.localStorage.setItem('auth_token', tokenFor('user-2'))
    window.localStorage.setItem(BUILD_PROFILE_STORAGE_KEY, JSON.stringify({
      ...profile,
      ownerKey: 'user-1',
      selectedApplicationNo: 'APP-USER-1',
    }))

    expect(readReplicatedBuildProfile()).toBeNull()
    expect(getSelectedBuildProfileApplicationNo()).toBe('')
  })

  it('maps Build Profile wealth inputs into the Net Worth draft model', () => {
    const draft = toNetWorthDraft(profile, [{ id: 'cash', label: 'Cash', section: 'assets', category: 'Liquid Assets' }])
    expect(draft).toMatchObject({
      asOfDate: '2026-07-27',
      currency: 'USD',
      selectedFinancialGoal: 'Build Emergency Fund',
      targetAmount: 12000,
      targetMonths: 6,
      amounts: { cash: '5000' },
      monthlyExpenseAllocationDraft: { cash: '40' },
      actualEntries: { cash: '5500' },
      varianceNotes: { cash: 'Saved more' },
      suitabilityAnswers: { 'suitability-q1': 3 },
    })
    expect(draft.savedSetup[0]).toMatchObject({ id: 'cash', setupAmount: 5000 })
  })
})