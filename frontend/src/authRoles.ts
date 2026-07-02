export const SUBSCRIBER_ROLE = 'subscriber'
export const SUBSCRIBER_BORROWER_ROLE = 'subscriber_borrower'
export const SUBSCRIBER_LENDER_ROLE = 'subscriber_lender'

export type RegisterSubscriberType = 'borrower' | 'lender'

export const REGISTER_SUBSCRIBER_OPTIONS: Array<{
  description: string
  label: string
  value: RegisterSubscriberType
}> = [
  {
    value: 'borrower',
    label: 'Subscriber Borrower',
    description: 'Access the lending scorecard steps 1 to 8 and the certification only.',
  },
  {
    value: 'lender',
    label: 'Subscriber Lender',
    description: 'Access the current subscriber workspace and permissions.',
  },
]

function normalizeRole(role?: string | null) {
  return (role ?? '').trim().toLowerCase()
}

export function isBorrowerSubscriberRole(role?: string | null) {
  return normalizeRole(role) === SUBSCRIBER_BORROWER_ROLE
}

export function isLenderSubscriberRole(role?: string | null) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole === SUBSCRIBER_ROLE || normalizedRole === SUBSCRIBER_LENDER_ROLE
}

export function isAnySubscriberRole(role?: string | null) {
  return isBorrowerSubscriberRole(role) || isLenderSubscriberRole(role)
}
