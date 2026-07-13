import { beforeEach, describe, expect, it } from 'vitest'

import {
  AUTOSAVE_DRAFT_TTL_MS,
  buildAutosaveStorageKey,
  clearAutosaveDraft,
  clearAutosaveDraftsForToken,
  loadAutosaveDraft,
  mergeAutosaveDraft,
  saveAutosaveDraft,
} from '../src/autosave/draftStorage'

function encodeBase64Url(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function tokenForUser(userId: number): string {
  return `${encodeBase64Url({ alg: 'none' })}.${encodeBase64Url({ sub: String(userId) })}.signature`
}

function createStorageMock(): Storage {
  const entries = new Map<string, string>()
  return {
    get length() {
      return entries.size
    },
    clear() {
      entries.clear()
    },
    getItem(key: string) {
      return entries.get(key) ?? null
    },
    key(index: number) {
      return Array.from(entries.keys())[index] ?? null
    },
    removeItem(key: string) {
      entries.delete(key)
    },
    setItem(key: string, value: string) {
      entries.set(key, String(value))
    },
  }
}

describe('autosave draft storage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createStorageMock(),
    })
  })

  it('isolates drafts by authenticated user and scope', () => {
    const firstUserKey = buildAutosaveStorageKey('vehicle-registry', tokenForUser(7))
    const secondUserKey = buildAutosaveStorageKey('vehicle-registry', tokenForUser(8))
    const otherScopeKey = buildAutosaveStorageKey('fuel-management', tokenForUser(7))

    expect(firstUserKey).not.toBe(secondUserKey)
    expect(firstUserKey).not.toBe(otherScopeKey)
    expect(firstUserKey).toContain('vehicle-registry')
  })

  it('round-trips a versioned draft and records its save time', () => {
    const storageKey = buildAutosaveStorageKey('driver-registration', tokenForUser(7))
    const savedAt = new Date('2026-07-13T10:30:00.000Z').getTime()

    const result = saveAutosaveDraft(
      storageKey,
      { firstName: 'Ana', lastName: 'Reyes' },
      window.localStorage,
      savedAt,
    )

    expect(result).toEqual({ ok: true, savedAt })
    expect(loadAutosaveDraft(storageKey, window.localStorage, savedAt + 1_000)).toEqual({
      value: { firstName: 'Ana', lastName: 'Reyes' },
      savedAt,
    })
  })

  it('removes and ignores expired drafts', () => {
    const storageKey = buildAutosaveStorageKey('lease-scorecard', tokenForUser(7))
    const savedAt = new Date('2026-01-01T00:00:00.000Z').getTime()
    saveAutosaveDraft(storageKey, { customerName: 'Old draft' }, window.localStorage, savedAt)

    expect(
      loadAutosaveDraft(
        storageKey,
        window.localStorage,
        savedAt + AUTOSAVE_DRAFT_TTL_MS + 1,
      ),
    ).toBeNull()
    expect(window.localStorage.getItem(storageKey)).toBeNull()
  })

  it('removes malformed or unsupported draft envelopes', () => {
    const storageKey = buildAutosaveStorageKey('maintenance', tokenForUser(7))
    window.localStorage.setItem(storageKey, '{not-json')

    expect(loadAutosaveDraft(storageKey)).toBeNull()
    expect(window.localStorage.getItem(storageKey)).toBeNull()

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ version: 99, savedAt: Date.now(), value: { notes: 'unsupported' } }),
    )
    expect(loadAutosaveDraft(storageKey)).toBeNull()
    expect(window.localStorage.getItem(storageKey)).toBeNull()
  })

  it('deep-merges restored objects with current defaults while replacing arrays', () => {
    const currentDefaults = {
      borrower: { name: '', email: '', phone: '' },
      documents: [{ id: 'default' }],
      workflow: { step: 1 },
    }
    const storedDraft = {
      borrower: { name: 'Ana' },
      documents: [{ id: 'saved' }],
    }

    expect(mergeAutosaveDraft(currentDefaults, storedDraft)).toEqual({
      borrower: { name: 'Ana', email: '', phone: '' },
      documents: [{ id: 'saved' }],
      workflow: { step: 1 },
    })
  })

  it('ignores prototype-polluting keys in restored drafts', () => {
    const maliciousDraft = JSON.parse('{"__proto__":{"polluted":true},"safe":"restored"}')

    expect(mergeAutosaveDraft({ safe: '' }, maliciousDraft)).toEqual({ safe: 'restored' })
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })

  it('returns a visible failure result when browser storage rejects a write', () => {
    const storageKey = buildAutosaveStorageKey('insurance', tokenForUser(7))
    const rejectingStorage = {
      ...window.localStorage,
      setItem() {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      },
    } as Storage

    const result = saveAutosaveDraft(storageKey, { provider: 'Example' }, rejectingStorage)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Quota exceeded')
  })

  it('clears a persisted draft explicitly', () => {
    const storageKey = buildAutosaveStorageKey('bill-reminder', tokenForUser(7))
    saveAutosaveDraft(storageKey, { billers: ['Electricity'] })

    clearAutosaveDraft(storageKey)

    expect(loadAutosaveDraft(storageKey)).toBeNull()
  })

  it('clears only the logging-out user drafts', () => {
    const firstToken = tokenForUser(7)
    const secondToken = tokenForUser(8)
    const firstUserKey = buildAutosaveStorageKey('bill-reminder', firstToken)
    const secondUserKey = buildAutosaveStorageKey('bill-reminder', secondToken)
    saveAutosaveDraft(firstUserKey, { owner: 7 })
    saveAutosaveDraft(secondUserKey, { owner: 8 })

    clearAutosaveDraftsForToken(firstToken)

    expect(loadAutosaveDraft(firstUserKey)).toBeNull()
    expect(loadAutosaveDraft(secondUserKey)?.value).toEqual({ owner: 8 })
  })
})
