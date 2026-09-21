import type { ReplicatedBuildProfile } from './buildProfileReplication'

type PostingSection = 'assets' | 'liabilities' | 'monthly-income' | 'monthly-expenses'

export function postToStep8Account(
  profile: ReplicatedBuildProfile,
  accountId: string,
  section: PostingSection,
  debitAmount: number,
  creditAmount: number,
): ReplicatedBuildProfile {
  const currentAmount = Math.max(0, Number(profile.values[accountId]) || 0)
  const debitNormal = section === 'assets' || section === 'monthly-expenses'
  const change = debitNormal
    ? debitAmount - creditAmount
    : creditAmount - debitAmount

  return {
    ...profile,
    values: {
      ...profile.values,
      [accountId]: String(Math.max(0, currentAmount + change)),
    },
  }
}