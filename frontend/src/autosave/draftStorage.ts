const AUTOSAVE_STORAGE_PREFIX = 'fms:autosave:v1'
const AUTOSAVE_DRAFT_VERSION = 1
const logoutRetainedDraftKeys = new Set<string>()

export const AUTOSAVE_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1_000

interface AutosaveDraftEnvelope<T> {
  version: typeof AUTOSAVE_DRAFT_VERSION
  savedAt: number
  value: T
}

export interface LoadedAutosaveDraft<T> {
  value: T
  savedAt: number
}

export type AutosaveWriteResult =
  | { ok: true; savedAt: number }
  | { ok: false; error: string }

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) {
    return storage
  }

  return typeof window === 'undefined' ? null : window.localStorage
}

function decodeTokenOwner(token: string | null | undefined): string {
  if (!token) {
    return 'anonymous'
  }

  try {
    const payloadSegment = token.split('.')[1]
    if (!payloadSegment) {
      return 'authenticated'
    }

    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as { sub?: unknown }
    const subject = typeof payload.sub === 'string' || typeof payload.sub === 'number'
      ? String(payload.sub).trim()
      : ''

    return subject ? encodeURIComponent(subject) : 'authenticated'
  } catch {
    return 'authenticated'
  }
}

export function buildAutosaveStorageKey(scope: string, token?: string | null): string {
  const normalizedScope = encodeURIComponent(scope.trim() || 'default')
  return `${AUTOSAVE_STORAGE_PREFIX}:${decodeTokenOwner(token)}:${normalizedScope}`
}

export function clearAutosaveDraftsForToken(
  token: string | null | undefined,
  storage?: Storage,
): void {
  const targetStorage = resolveStorage(storage)
  if (!targetStorage) {
    return
  }

  const ownerPrefix = `${AUTOSAVE_STORAGE_PREFIX}:${decodeTokenOwner(token)}:`
  const matchingKeys: string[] = []
  try {
    for (let index = 0; index < targetStorage.length; index += 1) {
      const key = targetStorage.key(index)
      if (key?.startsWith(ownerPrefix) && !logoutRetainedDraftKeys.has(key)) {
        matchingKeys.push(key)
      }
    }
    matchingKeys.forEach((key) => targetStorage.removeItem(key))
  } catch {
    // Logout cleanup is best-effort when browser storage is blocked.
  }
}

export function retainAutosaveDraftOnLogout(storageKey: string, retain: boolean): void {
  if (retain) {
    logoutRetainedDraftKeys.add(storageKey)
  } else {
    logoutRetainedDraftKeys.delete(storageKey)
  }
}

export function loadAutosaveDraft<T>(
  storageKey: string,
  storage?: Storage,
  now = Date.now(),
): LoadedAutosaveDraft<T> | null {
  const targetStorage = resolveStorage(storage)
  if (!targetStorage) {
    return null
  }

  try {
    const rawDraft = targetStorage.getItem(storageKey)
    if (!rawDraft) {
      return null
    }

    const parsed = JSON.parse(rawDraft) as Partial<AutosaveDraftEnvelope<T>>
    const isSupported =
      parsed.version === AUTOSAVE_DRAFT_VERSION &&
      typeof parsed.savedAt === 'number' &&
      Number.isFinite(parsed.savedAt) &&
      Object.prototype.hasOwnProperty.call(parsed, 'value')

    if (!isSupported || now - parsed.savedAt! > AUTOSAVE_DRAFT_TTL_MS) {
      targetStorage.removeItem(storageKey)
      return null
    }

    return {
      value: parsed.value as T,
      savedAt: parsed.savedAt!,
    }
  } catch {
    try {
      targetStorage.removeItem(storageKey)
    } catch {
      // A blocked storage implementation is treated the same as no draft.
    }
    return null
  }
}

export function saveAutosaveDraft<T>(
  storageKey: string,
  value: T,
  storage?: Storage,
  now = Date.now(),
): AutosaveWriteResult {
  const targetStorage = resolveStorage(storage)
  if (!targetStorage) {
    return { ok: false, error: 'Browser storage is unavailable.' }
  }

  const envelope: AutosaveDraftEnvelope<T> = {
    version: AUTOSAVE_DRAFT_VERSION,
    savedAt: now,
    value,
  }

  try {
    targetStorage.setItem(storageKey, JSON.stringify(envelope))
    return { ok: true, savedAt: now }
  } catch (error) {
    const errorMessage =
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
        ? error.message
        : 'Unable to save this draft.'
    return {
      ok: false,
      error: errorMessage,
    }
  }
}

export function clearAutosaveDraft(storageKey: string, storage?: Storage): void {
  logoutRetainedDraftKeys.delete(storageKey)
  const targetStorage = resolveStorage(storage)
  if (!targetStorage) {
    return
  }

  try {
    targetStorage.removeItem(storageKey)
  } catch {
    // Clearing a draft is best-effort when browser storage is blocked.
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function mergeAutosaveDraft<T>(defaults: T, draft: unknown): T {
  if (Array.isArray(defaults)) {
    return (Array.isArray(draft) ? draft : defaults) as T
  }

  if (!isPlainObject(defaults) || !isPlainObject(draft)) {
    return (draft === undefined ? defaults : draft) as T
  }

  const merged: Record<string, unknown> = { ...defaults }
  for (const [key, draftValue] of Object.entries(draft)) {
    if (UNSAFE_OBJECT_KEYS.has(key)) {
      continue
    }
    const defaultValue = defaults[key]
    merged[key] = isPlainObject(defaultValue) && isPlainObject(draftValue)
      ? mergeAutosaveDraft(defaultValue, draftValue)
      : draftValue
  }

  return merged as T
}
