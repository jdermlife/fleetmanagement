import { describe, expect, it } from 'vitest'

import { isAdminUser } from '../src/hooks/useAuthorization'

describe('isAdminUser', () => {
  it('does not grant admin access based on username', () => {
    expect(isAdminUser({ role: 'subscriber_borrower', roles: ['subscriber_borrower'] })).toBe(false)
  })

  it('grants admin access only from an assigned role', () => {
    expect(isAdminUser({ role: 'subscriber_borrower', roles: ['subscriber_borrower', 'admin'] })).toBe(true)
  })
})