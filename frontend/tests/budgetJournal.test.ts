import { describe, expect, it } from 'vitest'

import { postToStep8Account } from '../src/pages/scoring/budgetJournal'
import type { ReplicatedBuildProfile } from '../src/pages/scoring/buildProfileReplication'

const profile = {
  profileId: 'PRO-TEST',
  values: {},
  documents: [],
  suitabilityAnswers: {},
  coBorrowers: [],
  guarantors: [],
  additionalCollaterals: [],
} satisfies ReplicatedBuildProfile

describe('budget journal posting', () => {
  it('posts debit-normal and credit-normal accounts to Step 8 only', () => {
    const debitedAsset = postToStep8Account(profile, 'asset-cash-on-hand', 'assets', 500, 100)
    const creditedIncome = postToStep8Account(debitedAsset, 'income-salary', 'monthly-income', 50, 300)

    expect(debitedAsset.values['asset-cash-on-hand']).toBe('400')
    expect(creditedIncome.values['income-salary']).toBe('250')
    expect(creditedIncome.values['wealthActual.asset-cash-on-hand']).toBeUndefined()
    expect(creditedIncome.values['wealthActual.income-salary']).toBeUndefined()
  })
})