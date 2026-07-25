export type LendingImprovementAreaKind =
  | 'credit'
  | 'non-starter'
  | 'social'
  | 'credit-values'

export type LendingImprovementArea = {
  kind: LendingImprovementAreaKind
  label: string
  actions: readonly string[]
}

const lendingImprovementAreas: readonly LendingImprovementArea[] = [
  {
    kind: 'credit',
    label: 'Credit Profile',
    actions: [
      'Reduce monthly debt obligations or increase verified recurring income.',
      'Increase the down payment or strengthen the collateral offered for the application.',
      'Keep loan and card payments current and provide complete income and bank-statement evidence.',
    ],
  },
  {
    kind: 'non-starter',
    label: 'Identity and Verification',
    actions: [
      'Complete identity, liveness, contact, and address verification with valid matching records.',
      'Resolve document, watchlist, device, or bank-ownership alerts before resubmission.',
      'Submit authentic, readable income and bank documents and avoid duplicate rapid applications.',
    ],
  },
  {
    kind: 'social',
    label: 'Social and Stability Profile',
    actions: [
      'Document residence and employment tenure with current, verifiable details.',
      'Provide complete employer, community, and character references where applicable.',
      'Maintain traceable banking relationships and consistent contact and address information.',
    ],
  },
  {
    kind: 'credit-values',
    label: 'Financial Behavior and Values',
    actions: [
      'Complete every behavioral and psychometric question with truthful, consistent responses.',
      'Demonstrate budgeting, repayment discipline, emergency planning, and responsible risk choices.',
      'Resolve incomplete or contradictory responses before requesting another review.',
    ],
  },
] as const

export function getLendingImprovementAreas(): readonly LendingImprovementArea[] {
  return lendingImprovementAreas
}
