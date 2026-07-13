import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getAuthToken } from '../api'
import {
  AutosaveDraftClient,
  autosaveDraftClient,
  isAutosaveConflictError,
  isAutosaveNetworkError,
} from './draftApi'
import {
  buildAutosaveStorageKey,
  clearAutosaveDraft,
  loadAutosaveDraft,
  mergeAutosaveDraft,
  retainAutosaveDraftOnLogout,
  saveAutosaveDraft,
} from './draftStorage'
import {
  AutosaveStatusDetail,
  emitAutosaveStatus,
} from './autosaveStatus'

export const DEFAULT_LOCAL_AUTOSAVE_DELAY_MS = 250
export const DEFAULT_REMOTE_AUTOSAVE_DELAY_MS = 1_500

interface ActiveAutosaveRegistration {
  saveNow: () => Promise<void>
  clearLocalForLogout: () => void
}

const activeAutosaves = new Set<ActiveAutosaveRegistration>()
const pendingAutosaveFlushes = new Set<Promise<void>>()

function trackPendingAutosave(promise: Promise<void>): void {
  pendingAutosaveFlushes.add(promise)
  void promise.then(
    () => pendingAutosaveFlushes.delete(promise),
    () => pendingAutosaveFlushes.delete(promise),
  )
}

export async function prepareAutosavesForLogout(): Promise<void> {
  const registrations = Array.from(activeAutosaves)
  const activeSaves = registrations.map((registration) => registration.saveNow())
  await Promise.allSettled([...Array.from(pendingAutosaveFlushes), ...activeSaves])
  registrations.forEach((registration) => registration.clearLocalForLogout())
}

export interface UseAutosaveDraftOptions<T> {
  scope: string
  entityKey: string | number
  value: T
  defaults: T
  onHydrate: (value: T) => void
  enabled?: boolean
  remote?: boolean
  token?: string | null
  storage?: Storage
  localDebounceMs?: number
  remoteDebounceMs?: number
  client?: AutosaveDraftClient
}

export interface UseAutosaveDraftResult {
  isHydrated: boolean
  status: AutosaveStatusDetail
  clear: () => Promise<void>
  saveNow: () => Promise<void>
}

function signatureOf(value: unknown): string | null {
  try {
    return JSON.stringify(value) ?? null
  } catch {
    return null
  }
}

function timestampOf(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function browserIsOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useAutosaveDraft<T>({
  scope,
  entityKey,
  value,
  defaults,
  onHydrate,
  enabled = true,
  remote = true,
  token,
  storage,
  localDebounceMs = DEFAULT_LOCAL_AUTOSAVE_DELAY_MS,
  remoteDebounceMs = DEFAULT_REMOTE_AUTOSAVE_DELAY_MS,
  client = autosaveDraftClient,
}: UseAutosaveDraftOptions<T>): UseAutosaveDraftResult {
  const normalizedScope = scope.trim() || 'default'
  const normalizedEntityKey = String(entityKey).trim() || 'default'
  const resolvedToken = token === undefined ? getAuthToken() : token
  const storageKey = useMemo(
    () => buildAutosaveStorageKey(`${normalizedScope}:${normalizedEntityKey}`, resolvedToken),
    [normalizedEntityKey, normalizedScope, resolvedToken],
  )

  const [isHydrated, setIsHydrated] = useState(false)
  const [status, setStatus] = useState<AutosaveStatusDetail>({
    scope: normalizedScope,
    entityKey: normalizedEntityKey,
    state: enabled ? 'hydrating' : 'idle',
  })

  const mountedRef = useRef(false)
  const generationRef = useRef(0)
  const valueRef = useRef(value)
  const defaultsRef = useRef(defaults)
  const onHydrateRef = useRef(onHydrate)
  const clientRef = useRef(client)
  const enabledRef = useRef(enabled)
  const remoteRef = useRef(remote)
  const storageRef = useRef(storage)
  const storageKeyRef = useRef(storageKey)
  const scopeRef = useRef(normalizedScope)
  const entityKeyRef = useRef(normalizedEntityKey)
  const hydratedRef = useRef(false)
  const hydratingRef = useRef(false)
  const hydrationSignaturesRef = useRef<Set<string | null>>(new Set())
  const dirtyDuringHydrationRef = useRef(false)
  const revisionRef = useRef<number | null>(null)
  const lastLocalSignatureRef = useRef<string | null>(null)
  const lastRemoteSignatureRef = useRef<string | null>(null)
  const clearedSignatureRef = useRef<string | null>(null)
  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remoteChainRef = useRef<Promise<void>>(Promise.resolve())
  const pendingDeleteRef = useRef(false)
  const conflictRef = useRef(false)

  valueRef.current = value
  defaultsRef.current = defaults
  onHydrateRef.current = onHydrate
  clientRef.current = client
  enabledRef.current = enabled
  remoteRef.current = remote
  storageRef.current = storage
  storageKeyRef.current = storageKey
  scopeRef.current = normalizedScope
  entityKeyRef.current = normalizedEntityKey

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const publish = useCallback((next: Omit<AutosaveStatusDetail, 'scope' | 'entityKey'>) => {
    const detail: AutosaveStatusDetail = {
      scope: scopeRef.current,
      entityKey: entityKeyRef.current,
      ...next,
    }
    if (mountedRef.current) {
      setStatus(detail)
    }
    emitAutosaveStatus(detail)
  }, [])

  const clearTimers = useCallback(() => {
    if (localTimerRef.current) {
      clearTimeout(localTimerRef.current)
      localTimerRef.current = null
    }
    if (remoteTimerRef.current) {
      clearTimeout(remoteTimerRef.current)
      remoteTimerRef.current = null
    }
  }, [])

  const flushLocal = useCallback((): boolean => {
    if (!enabledRef.current || !hydratedRef.current) {
      return true
    }

    const snapshot = valueRef.current
    const signature = signatureOf(snapshot)
    if (!signature) {
      publish({
        state: 'error',
        message: 'This form contains a value that cannot be autosaved.',
      })
      return false
    }
    if (
      signature === lastLocalSignatureRef.current ||
      signature === clearedSignatureRef.current
    ) {
      return true
    }

    const result = saveAutosaveDraft(
      storageKeyRef.current,
      snapshot,
      storageRef.current,
    )
    if (!result.ok) {
      publish({
        state: 'error',
        message: `Could not save on this device: ${'error' in result ? result.error : 'Unknown storage error.'}`,
      })
      return false
    }

    lastLocalSignatureRef.current = signature
    retainAutosaveDraftOnLogout(storageKeyRef.current, true)
    if (!remoteRef.current || signature === lastRemoteSignatureRef.current) {
      if (signature === lastRemoteSignatureRef.current) {
        retainAutosaveDraftOnLogout(storageKeyRef.current, false)
      }
      publish({ state: 'saved', savedAt: result.savedAt, source: 'local' })
    } else if (browserIsOffline()) {
      publish({ state: 'offline', savedAt: result.savedAt, source: 'local' })
    }
    return true
  }, [publish])

  const enqueueRemote = useCallback((): Promise<void> => {
    if (!enabledRef.current || !remoteRef.current || !hydratedRef.current) {
      return remoteChainRef.current
    }

    const generation = generationRef.current
    const snapshot = valueRef.current
    const signature = signatureOf(snapshot)
    if (!signature || signature === clearedSignatureRef.current) {
      if (!signature) {
        publish({
          state: 'error',
          message: 'This form contains a value that cannot be autosaved.',
        })
      }
      return remoteChainRef.current
    }
    if (signature === lastRemoteSignatureRef.current) {
      return remoteChainRef.current
    }
    if (conflictRef.current) {
      publish({
        state: 'conflict',
        message: 'Saved on this device. Another session has a newer copy.',
        source: 'local',
      })
      return remoteChainRef.current
    }

    const write = async () => {
      if (generation !== generationRef.current || !enabledRef.current) {
        return
      }
      if (browserIsOffline()) {
        publish({ state: 'offline', source: 'local' })
        return
      }

      publish({ state: 'saving' })
      try {
        const saved = await clientRef.current.put<T>(
          scopeRef.current,
          entityKeyRef.current,
          { payload: snapshot, expectedRevision: revisionRef.current },
        )
        if (generation !== generationRef.current) {
          return
        }

        revisionRef.current = saved.revision
        conflictRef.current = false
        lastRemoteSignatureRef.current = signature
        retainAutosaveDraftOnLogout(storageKeyRef.current, false)
        if (signatureOf(valueRef.current) === signature) {
          publish({
            state: 'saved',
            savedAt: timestampOf(saved.updatedAt) || Date.now(),
            source: 'remote',
          })
        } else {
          publish({ state: 'pending' })
        }
      } catch (error) {
        if (generation !== generationRef.current) {
          return
        }

        if (isAutosaveConflictError(error)) {
          conflictRef.current = true
          retainAutosaveDraftOnLogout(storageKeyRef.current, true)
          if (error.currentDraft) {
            revisionRef.current = error.currentDraft.revision
          }
          publish({
            state: 'conflict',
            message: 'Saved on this device. Another session has a newer copy.',
            source: 'local',
          })
        } else if (browserIsOffline() || isAutosaveNetworkError(error)) {
          retainAutosaveDraftOnLogout(storageKeyRef.current, true)
          publish({ state: 'offline', source: 'local' })
        } else {
          publish({
            state: 'error',
            message: errorMessage(error, 'Unable to sync this draft.'),
          })
        }
      }
    }

    remoteChainRef.current = remoteChainRef.current.catch(() => undefined).then(write)
    return remoteChainRef.current
  }, [publish])

  const scheduleRemote = useCallback((delay: number) => {
    if (!enabledRef.current || !remoteRef.current || !hydratedRef.current) {
      return
    }
    if (remoteTimerRef.current) {
      clearTimeout(remoteTimerRef.current)
    }
    remoteTimerRef.current = setTimeout(() => {
      remoteTimerRef.current = null
      void enqueueRemote()
    }, Math.max(0, delay))
  }, [enqueueRemote])

  useEffect(() => {
    generationRef.current += 1
    const generation = generationRef.current
    clearTimers()
    revisionRef.current = null
    lastLocalSignatureRef.current = null
    lastRemoteSignatureRef.current = null
    clearedSignatureRef.current = null
    pendingDeleteRef.current = false
    conflictRef.current = false
    dirtyDuringHydrationRef.current = false
    hydratedRef.current = false
    hydratingRef.current = enabled
    setIsHydrated(!enabled)

    const initialSignature = signatureOf(valueRef.current)
    hydrationSignaturesRef.current = new Set([initialSignature])

    if (!enabled) {
      publish({ state: 'idle' })
      return () => {
        generationRef.current += 1
        clearTimers()
      }
    }

    publish({ state: 'hydrating' })
    const localDraft = loadAutosaveDraft<T>(storageKey, storage)
    let localValue: T | null = null
    let localSignature: string | null = null
    if (localDraft) {
      localValue = mergeAutosaveDraft(defaultsRef.current, localDraft.value)
      localSignature = signatureOf(localValue)
      hydrationSignaturesRef.current.add(localSignature)
      onHydrateRef.current(localValue)
      retainAutosaveDraftOnLogout(storageKey, true)
    }

    const finishHydration = () => {
      if (generation !== generationRef.current) {
        return
      }
      hydratingRef.current = false
      hydratedRef.current = true
      setIsHydrated(true)

      const currentSignature = signatureOf(valueRef.current)
      const fullySaved = currentSignature !== null &&
        currentSignature === lastLocalSignatureRef.current &&
        (!remote || currentSignature === lastRemoteSignatureRef.current)
      if (fullySaved) {
        publish({ state: 'saved', source: remote ? 'remote' : 'local' })
      } else {
        publish(browserIsOffline() && remote
          ? { state: 'offline', source: 'local' }
          : { state: 'pending' })
      }
    }

    const hydrateRemote = async () => {
      if (!remote || browserIsOffline()) {
        const cleanBaseline = localSignature ?? initialSignature
        lastLocalSignatureRef.current = cleanBaseline
        if (remote && !localDraft) {
          lastRemoteSignatureRef.current = initialSignature
        }
        finishHydration()
        return
      }

      try {
        const remoteDraft = await clientRef.current.get<T>(
          normalizedScope,
          normalizedEntityKey,
        )
        if (generation !== generationRef.current) {
          return
        }

        lastLocalSignatureRef.current = localSignature
        if (remoteDraft) {
          revisionRef.current = remoteDraft.revision
          const remoteValue = mergeAutosaveDraft(defaultsRef.current, remoteDraft.payload)
          const remoteSignature = signatureOf(remoteValue)
          lastRemoteSignatureRef.current = remoteSignature
          if (remoteSignature === localSignature) {
            retainAutosaveDraftOnLogout(storageKey, false)
          }

          const remoteIsNewer = !localDraft ||
            timestampOf(remoteDraft.updatedAt) > localDraft.savedAt
          if (localDraft && localSignature !== remoteSignature && !remoteIsNewer) {
            conflictRef.current = true
          }
          if (!dirtyDuringHydrationRef.current && remoteIsNewer) {
            hydrationSignaturesRef.current.add(remoteSignature)
            onHydrateRef.current(remoteValue)
          }
        } else if (!localDraft) {
          lastLocalSignatureRef.current = initialSignature
          lastRemoteSignatureRef.current = initialSignature
        }
        finishHydration()
        if (conflictRef.current) {
          publish({
            state: 'conflict',
            message: 'Saved on this device. Another session has a newer copy.',
            source: 'local',
          })
        }
      } catch (error) {
        if (generation !== generationRef.current) {
          return
        }
        lastLocalSignatureRef.current = localSignature ?? initialSignature
        if (!localDraft) {
          lastRemoteSignatureRef.current = initialSignature
        }
        finishHydration()
        if (browserIsOffline() || isAutosaveNetworkError(error)) {
          publish({ state: 'offline', source: 'local' })
        } else {
          publish({
            state: 'error',
            message: errorMessage(error, 'Unable to restore the server draft.'),
          })
        }
      }
    }

    void hydrateRemote()

    return () => {
      generationRef.current += 1
      clearTimers()
    }
  }, [
    clearTimers,
    enabled,
    normalizedEntityKey,
    normalizedScope,
    publish,
    remote,
    storage,
    storageKey,
  ])

  useEffect(() => {
    if (!enabled || !hydratedRef.current) {
      if (hydratingRef.current) {
        const signature = signatureOf(value)
        if (!hydrationSignaturesRef.current.has(signature)) {
          dirtyDuringHydrationRef.current = true
        }
      }
      return
    }

    const signature = signatureOf(value)
    if (!signature) {
      publish({
        state: 'error',
        message: 'This form contains a value that cannot be autosaved.',
      })
      return
    }
    if (signature === clearedSignatureRef.current) {
      return
    }

    const needsLocalSave = signature !== lastLocalSignatureRef.current
    const needsRemoteSave = remote && signature !== lastRemoteSignatureRef.current
    if (!needsLocalSave && !needsRemoteSave) {
      return
    }

    publish(browserIsOffline() && needsRemoteSave
      ? { state: 'offline', source: 'local' }
      : { state: 'pending' })

    if (needsLocalSave) {
      if (localTimerRef.current) {
        clearTimeout(localTimerRef.current)
      }
      localTimerRef.current = setTimeout(() => {
        localTimerRef.current = null
        flushLocal()
      }, Math.max(0, localDebounceMs))
    }

    if (needsRemoteSave && !browserIsOffline()) {
      scheduleRemote(remoteDebounceMs)
    }

    return () => {
      if (localTimerRef.current) {
        clearTimeout(localTimerRef.current)
        localTimerRef.current = null
      }
      if (remoteTimerRef.current) {
        clearTimeout(remoteTimerRef.current)
        remoteTimerRef.current = null
      }
    }
  }, [
    enabled,
    flushLocal,
    localDebounceMs,
    publish,
    remote,
    remoteDebounceMs,
    scheduleRemote,
    value,
  ])

  useEffect(() => {
    const handlePageHide = () => {
      if (localTimerRef.current) {
        clearTimeout(localTimerRef.current)
        localTimerRef.current = null
      }
      flushLocal()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handlePageHide()
      }
    }
    const handleOffline = () => {
      if (remoteTimerRef.current) {
        clearTimeout(remoteTimerRef.current)
        remoteTimerRef.current = null
      }
      flushLocal()
      if (remoteRef.current && hydratedRef.current) {
        publish({ state: 'offline', source: 'local' })
      }
    }
    const handleOnline = () => {
      if (pendingDeleteRef.current) {
        void clientRef.current.delete(scopeRef.current, entityKeyRef.current).then(() => {
          pendingDeleteRef.current = false
          revisionRef.current = null
          publish({ state: 'idle', message: 'Draft cleared.' })
        }).catch((error) => {
          publish({
            state: 'error',
            message: errorMessage(error, 'Unable to clear the server draft.'),
          })
        })
        return
      }
      if (
        remoteRef.current &&
        hydratedRef.current &&
        signatureOf(valueRef.current) !== lastRemoteSignatureRef.current
      ) {
        scheduleRemote(0)
      }
    }

    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [flushLocal, publish, scheduleRemote])

  useEffect(() => () => {
    flushLocal()
    if (remoteRef.current) {
      trackPendingAutosave(enqueueRemote())
    }
  }, [enqueueRemote, flushLocal])

  const saveNow = useCallback(async () => {
    if (!enabledRef.current || !hydratedRef.current) {
      return
    }
    clearTimers()
    flushLocal()
    if (remoteRef.current) {
      await enqueueRemote()
    }
  }, [clearTimers, enqueueRemote, flushLocal])

  const clearLocalForLogout = useCallback(() => {
    clearTimers()
    const signature = signatureOf(valueRef.current)
    if (remoteRef.current && signature !== lastRemoteSignatureRef.current) {
      retainAutosaveDraftOnLogout(storageKeyRef.current, true)
      return
    }
    clearedSignatureRef.current = signature
    clearAutosaveDraft(storageKeyRef.current, storageRef.current)
    lastLocalSignatureRef.current = null
  }, [clearTimers])

  useEffect(() => {
    const registration: ActiveAutosaveRegistration = {
      saveNow,
      clearLocalForLogout,
    }
    activeAutosaves.add(registration)
    return () => {
      activeAutosaves.delete(registration)
    }
  }, [clearLocalForLogout, saveNow])

  const clear = useCallback(async () => {
    clearTimers()
    const signature = signatureOf(valueRef.current)
    clearedSignatureRef.current = signature
    clearAutosaveDraft(storageKeyRef.current, storageRef.current)
    lastLocalSignatureRef.current = null
    lastRemoteSignatureRef.current = null
    conflictRef.current = false

    if (remoteRef.current) {
      await remoteChainRef.current.catch(() => undefined)
      try {
        await clientRef.current.delete(scopeRef.current, entityKeyRef.current)
      } catch (error) {
        if (browserIsOffline() || isAutosaveNetworkError(error)) {
          pendingDeleteRef.current = true
          publish({
            state: 'offline',
            message: 'Draft cleared on this device; server cleanup will retry when online.',
            source: 'local',
          })
          return
        }
        publish({
          state: 'error',
          message: errorMessage(error, 'Unable to clear the server draft.'),
        })
        return
      }
    }

    revisionRef.current = null
    publish({ state: 'idle', message: 'Draft cleared.' })
  }, [clearTimers, publish])

  return { isHydrated, status, clear, saveNow }
}
