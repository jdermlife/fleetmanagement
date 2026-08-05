import { describe, expect, it } from 'vitest'

import { DEFAULT_GOOGLE_CLIENT_ID, resolveApiBase, resolveGoogleClientId } from '../src/config'

describe('resolveApiBase', () => {
  it('uses the configured backend URL in production', () => {
    expect(resolveApiBase('https://fleetmanagement-dq9t.onrender.com/', false)).toBe(
      'https://fleetmanagement-dq9t.onrender.com',
    )
  })

  it('uses the configured backend URL in development', () => {
    expect(resolveApiBase('http://localhost:5000/', true)).toBe('http://localhost:5000')
  })

  it('keeps the same-origin proxy fallback when no production URL is configured', () => {
    expect(resolveApiBase(undefined, false)).toBe('/api')
  })

  it('keeps the local backend fallback when no development URL is configured', () => {
    expect(resolveApiBase(undefined, true)).toBe('http://localhost:5000')
  })
})

describe('resolveGoogleClientId', () => {
  it('uses the configured Google OAuth client ID', () => {
    expect(resolveGoogleClientId(' configured-client-id ')).toBe('configured-client-id')
  })

  it('keeps Google Sign-In enabled when a deployment omits the build variable', () => {
    expect(resolveGoogleClientId(undefined)).toBe(DEFAULT_GOOGLE_CLIENT_ID)
  })
})
