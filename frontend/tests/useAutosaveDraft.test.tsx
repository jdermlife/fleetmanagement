import { act, cleanup, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api', () => ({
  api: {
    delete: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
  getAuthToken: () => null,
}))

import { AutosaveConflictError } from '../src/autosave/draftApi'
import type {
  AutosaveDraftClient,
  RemoteDraft,
  SaveRemoteDraftInput,
} from '../src/autosave/draftApi'
import {
  buildAutosaveStorageKey,
  clearAutosaveDraft,
  clearAutosaveDraftsForToken,
  loadAutosaveDraft,
  saveAutosaveDraft,
} from '../src/autosave/draftStorage'
import {
  prepareAutosavesForLogout,
  useAutosaveDraft,
} from '../src/autosave/useAutosaveDraft'

interface FormValue {
  person: {
    name: string
    email: string
  }
  notes: string[]
}

const defaults: FormValue = {
  person: { name: '', email: '' },
  notes: [],
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

function remoteDraft(
  payload: FormValue,
  revision = 1,
  updatedAt = '2026-07-13T12:00:00.000Z',
): RemoteDraft<FormValue> {
  return {
    scope: 'profile',
    entityKey: 'primary',
    payload,
    revision,
    updatedAt,
  }
}

function createClient(options: {
  get?: () => Promise<RemoteDraft<FormValue> | null>
  put?: (
    input: SaveRemoteDraftInput<FormValue>,
  ) => Promise<RemoteDraft<FormValue>>
  delete?: () => Promise<void>
} = {}) {
  const getMock = vi.fn(options.get ?? (async () => null))
  const putMock = vi.fn(options.put ?? (async (input) => remoteDraft(input.payload)))
  const deleteMock = vi.fn(options.delete ?? (async () => undefined))
  const client: AutosaveDraftClient = {
    get: async <T,>() => getMock() as Promise<RemoteDraft<T> | null>,
    put: async <T,>(
      _scope: string,
      _entityKey: string,
      input: SaveRemoteDraftInput<T>,
    ) => putMock(input as SaveRemoteDraftInput<FormValue>) as Promise<RemoteDraft<T>>,
    delete: async () => deleteMock(),
  }
  return { client, getMock, putMock, deleteMock }
}

function renderAutosave(client: AutosaveDraftClient, remote = true, storage?: Storage) {
  return renderHook(() => {
    const [value, setValue] = useState(defaults)
    const autosave = useAutosaveDraft({
      scope: 'profile',
      entityKey: 'primary',
      value,
      defaults,
      onHydrate: setValue,
      client,
      remote,
      storage,
    })
    return { ...autosave, value, setValue }
  })
}

async function settleHydration(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useAutosaveDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createStorageMock(),
    })
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('hydrates the newest draft and deep-merges it with current defaults', async () => {
    const key = buildAutosaveStorageKey('profile:primary', null)
    saveAutosaveDraft(
      key,
      { person: { name: 'Local', email: '' }, notes: ['local'] },
      window.localStorage,
      new Date('2026-07-13T10:00:00.000Z').getTime(),
    )
    const { client } = createClient({
      get: async () => remoteDraft({
        person: { name: 'Remote', email: '' },
        notes: ['server'],
      }),
    })

    const { result } = renderAutosave(client)
    await settleHydration()

    expect(result.current.isHydrated).toBe(true)
    expect(result.current.value).toEqual({
      person: { name: 'Remote', email: '' },
      notes: ['server'],
    })
  })

  it('does not create a draft until the user changes the initial form', async () => {
    const { client, putMock } = createClient()
    renderAutosave(client)
    await settleHydration()

    await act(async () => {
      vi.advanceTimersByTime(2_000)
    })

    const key = buildAutosaveStorageKey('profile:primary', null)
    expect(loadAutosaveDraft(key)).toBeNull()
    expect(putMock).not.toHaveBeenCalled()
  })

  it('does not overwrite user edits made while the server draft is loading', async () => {
    let resolveGet!: (value: RemoteDraft<FormValue>) => void
    const getPromise = new Promise<RemoteDraft<FormValue>>((resolve) => {
      resolveGet = resolve
    })
    const { client } = createClient({ get: () => getPromise })
    const { result } = renderAutosave(client)

    act(() => {
      result.current.setValue({
        person: { name: 'Typing now', email: 'user@example.com' },
        notes: [],
      })
    })
    await act(async () => {
      resolveGet(remoteDraft({
        person: { name: 'Old server value', email: '' },
        notes: [],
      }))
      await getPromise
    })

    expect(result.current.value.person.name).toBe('Typing now')
    expect(result.current.isHydrated).toBe(true)
  })

  it('debounces local writes and serializes revision-aware server writes', async () => {
    let resolveFirstPut!: (value: RemoteDraft<FormValue>) => void
    const firstPut = new Promise<RemoteDraft<FormValue>>((resolve) => {
      resolveFirstPut = resolve
    })
    let putCount = 0
    const { client, putMock } = createClient({
      get: async () => remoteDraft(defaults, 3),
      put: async (input) => {
        putCount += 1
        if (putCount === 1) {
          return firstPut
        }
        return remoteDraft(input.payload, 5)
      },
    })
    const { result } = renderAutosave(client)
    await settleHydration()
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    act(() => {
      result.current.setValue({ ...defaults, person: { ...defaults.person, name: 'First' } })
    })
    await act(async () => {
      vi.advanceTimersByTime(1_500)
    })
    expect(putMock).toHaveBeenCalledTimes(1)
    expect(putMock.mock.calls[0][0].expectedRevision).toBe(3)

    act(() => {
      result.current.setValue({ ...defaults, person: { ...defaults.person, name: 'Second' } })
    })
    await act(async () => {
      vi.advanceTimersByTime(1_500)
    })
    expect(putMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirstPut(remoteDraft(
        { ...defaults, person: { ...defaults.person, name: 'First' } },
        4,
      ))
      await firstPut
      await Promise.resolve()
    })

    expect(putMock).toHaveBeenCalledTimes(2)
    expect(putMock.mock.calls[1][0]).toMatchObject({
      expectedRevision: 4,
      payload: { person: { name: 'Second', email: '' }, notes: [] },
    })
  })

  it('flushes the current value to local storage when the page is hidden', async () => {
    const { client } = createClient()
    const { result } = renderAutosave(client, false)
    await settleHydration()

    act(() => {
      result.current.setValue({ ...defaults, notes: ['urgent'] })
    })
    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide'))
    })

    const key = buildAutosaveStorageKey('profile:primary', null)
    expect(loadAutosaveDraft<FormValue>(key)?.value.notes).toEqual(['urgent'])
  })

  it('surfaces storage quota failures without crashing or losing server sync', async () => {
    const rejectingStorage: Storage = {
      length: 0,
      clear: vi.fn(),
      getItem: vi.fn(() => null),
      key: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }),
    }
    const { client } = createClient()
    const { result } = renderAutosave(client, false, rejectingStorage)
    await settleHydration()

    act(() => {
      result.current.setValue({ ...defaults, notes: ['large'] })
    })
    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    expect(result.current.status.state).toBe('error')
    expect(result.current.status.message).toContain('Quota exceeded')
  })

  it('keeps the local copy on conflict and blocks silent overwrites', async () => {
    let putCount = 0
    const { client, putMock } = createClient({
      get: async () => remoteDraft(defaults, 1),
      put: async (input) => {
        putCount += 1
        if (putCount === 1) {
          throw new AutosaveConflictError(remoteDraft(defaults, 2))
        }
        return remoteDraft(input.payload, 3)
      },
    })
    const { result } = renderAutosave(client)
    await settleHydration()

    act(() => {
      result.current.setValue({ ...defaults, notes: ['local conflict copy'] })
    })
    await act(async () => {
      vi.advanceTimersByTime(1_500)
      await Promise.resolve()
    })

    expect(result.current.status.state).toBe('conflict')
    const key = buildAutosaveStorageKey('profile:primary', null)
    expect(loadAutosaveDraft<FormValue>(key)?.value.notes).toEqual(['local conflict copy'])

    act(() => {
      result.current.setValue({ ...defaults, notes: ['try again'] })
    })
    await act(async () => {
      vi.advanceTimersByTime(1_500)
      await Promise.resolve()
    })
    expect(putMock).toHaveBeenCalledTimes(1)
    expect(result.current.status.state).toBe('conflict')
    expect(loadAutosaveDraft<FormValue>(key)?.value.notes).toEqual(['try again'])
  })

  it('syncs a locally saved offline edit when connectivity returns', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    })
    const { client, getMock, putMock } = createClient()
    const { result } = renderAutosave(client)
    await settleHydration()

    act(() => {
      result.current.setValue({ ...defaults, notes: ['offline'] })
    })
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.status.state).toBe('offline')
    expect(getMock).not.toHaveBeenCalled()
    expect(putMock).not.toHaveBeenCalled()

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
    expect(putMock).toHaveBeenCalledTimes(1)
  })

  it('clears both copies and does not recreate the same draft', async () => {
    const key = buildAutosaveStorageKey('profile:primary', null)
    saveAutosaveDraft(key, defaults)
    const { client, deleteMock, putMock } = createClient({
      get: async () => remoteDraft(defaults),
    })
    const { result, unmount } = renderAutosave(client)
    await settleHydration()

    await act(async () => {
      await result.current.clear()
    })
    await act(async () => {
      vi.runOnlyPendingTimers()
    })

    expect(loadAutosaveDraft(key)).toBeNull()
    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(putMock).not.toHaveBeenCalled()
    expect(result.current.status.message).toBe('Draft cleared.')

    unmount()
    expect(loadAutosaveDraft(key)).toBeNull()
  })

  it('flushes remote changes and clears local caches before logout', async () => {
    const { client, putMock } = createClient()
    const { result } = renderAutosave(client)
    await settleHydration()

    act(() => {
      result.current.setValue({ ...defaults, notes: ['flush before logout'] })
    })
    await act(async () => {
      await prepareAutosavesForLogout()
    })

    const key = buildAutosaveStorageKey('profile:primary', null)
    expect(putMock).toHaveBeenCalledTimes(1)
    expect(loadAutosaveDraft(key)).toBeNull()
  })

  it('retains an unsynced offline draft during logout cleanup', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    })
    const { client } = createClient()
    const { result } = renderAutosave(client)
    await settleHydration()

    act(() => {
      result.current.setValue({ ...defaults, notes: ['must survive logout'] })
    })
    await act(async () => {
      vi.advanceTimersByTime(250)
      await prepareAutosavesForLogout()
    })

    const key = buildAutosaveStorageKey('profile:primary', null)
    expect(loadAutosaveDraft<FormValue>(key)?.value.notes).toEqual(['must survive logout'])
    clearAutosaveDraftsForToken(null)
    expect(loadAutosaveDraft<FormValue>(key)?.value.notes).toEqual(['must survive logout'])
    clearAutosaveDraft(key)
  })
})
