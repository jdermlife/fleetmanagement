import { describe, expect, it } from 'vitest'

import {
  DEFAULT_GOOGLE_CLIENT_ID,
  DEFAULT_OLLAMA_FALLBACK_URL,
  resolveApiBase,
  resolveGoogleClientId,
  resolveOllamaFallbackUrl,
  validateConfiguredApiBase,
} from '../src/config'

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

  it('rejects the malformed hostname from the previous Play Store build', () => {
    expect(() => validateConfiguredApiBase('https://fleetmanagement=dq9t.onrender.com')).toThrow(
      'invalid hostname',
    )
  })

  it('requires HTTPS for non-local API endpoints', () => {
    expect(() => validateConfiguredApiBase('http://fleetmanagement-dq9t.onrender.com')).toThrow(
      'must use HTTPS',
    )
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

describe('resolveOllamaFallbackUrl', () => {
  it('uses a configured fallback without a trailing slash', () => {
    expect(resolveOllamaFallbackUrl(' https://example.com/local-ai/ ')).toBe(
      'https://example.com/local-ai',
    )
  })

  it('uses the secured FILSCORE endpoint when no build variable is configured', () => {
    expect(resolveOllamaFallbackUrl(undefined)).toBe(DEFAULT_OLLAMA_FALLBACK_URL)
  })
})
