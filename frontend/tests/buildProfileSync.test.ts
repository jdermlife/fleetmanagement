import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BUILD_PROFILE_DRAFT_ENTITY_KEY,
  BUILD_PROFILE_DRAFT_SCOPE,
  synchronizeBuildProfileDraft,
} from '../src/autosave/buildProfileSync'
import type { AutosaveDraftClient, RemoteDraft } from '../src/autosave/draftApi'
import {
  BUILD_PROFILE_STORAGE_KEY,
  type ReplicatedBuildProfile,
} from '../src/pages/scoring/buildProfileReplication'

function profile(profileId: string, updatedAt?: string): ReplicatedBuildProfile {
  return {
    profileId,
    updatedAt,
    values: { fullName: 'Cross Device User' },
    documents: [],
    suitabilityAnswers: {},
    coBorrowers: [],
    guarantors: [],
    additionalCollaterals: [],
  }
}

function remoteDraft(
  payload: ReplicatedBuildProfile,
  revision: number,
  updatedAt: string,
): RemoteDraft<ReplicatedBuildProfile> {
  return {
    scope: BUILD_PROFILE_DRAFT_SCOPE,
    entityKey: BUILD_PROFILE_DRAFT_ENTITY_KEY,
    payload,
    revision,
    updatedAt,
  }
}

function clientWith(remote: RemoteDraft<ReplicatedBuildProfile> | null) {
  const put = vi.fn(async <T>(
    _scope: string,
    _entityKey: string,
    input: { payload: T; expectedRevision: number | null },
  ) => remoteDraft(
    input.payload as ReplicatedBuildProfile,
    (input.expectedRevision ?? 0) + 1,
    '2026-09-16T12:00:00.000Z',
  ) as RemoteDraft<T>)
  const client: AutosaveDraftClient = {
    get: vi.fn(async <T>() => remote as RemoteDraft<T> | null),
    put,
    delete: vi.fn(async () => undefined),
  }
  return { client, put }
}

function createStorageMock(): Storage {
  const entries = new Map<string, string>()
  return {
    get length() {
      return entries.size
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => entries.delete(key),
    setItem: (key, value) => entries.set(key, String(value)),
  }
}

describe('synchronizeBuildProfileDraft', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createStorageMock(),
    })
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: createStorageMock(),
    })
  })

  it('hydrates the shared cache from the account draft on a fresh gadget', async () => {
    const serverProfile = profile('PRO-SERVER')
    const { client, put } = clientWith(remoteDraft(
      serverProfile,
      4,
      '2026-09-16T10:00:00.000Z',
    ))

    await synchronizeBuildProfileDraft(client)

    const cached = JSON.parse(window.localStorage.getItem(BUILD_PROFILE_STORAGE_KEY) ?? '{}')
    expect(cached.profileId).toBe('PRO-SERVER')
    expect(cached.updatedAt).toBe('2026-09-16T10:00:00.000Z')
    expect(put).not.toHaveBeenCalled()
  })

  it('uploads newer offline changes with the current server revision', async () => {
    window.localStorage.setItem(BUILD_PROFILE_STORAGE_KEY, JSON.stringify(
      profile('PRO-LOCAL', '2026-09-16T11:00:00.000Z'),
    ))
    const { client, put } = clientWith(remoteDraft(
      profile('PRO-LOCAL'),
      7,
      '2026-09-16T10:00:00.000Z',
    ))

    await synchronizeBuildProfileDraft(client)

    expect(put).toHaveBeenCalledWith(
      BUILD_PROFILE_DRAFT_SCOPE,
      BUILD_PROFILE_DRAFT_ENTITY_KEY,
      expect.objectContaining({ expectedRevision: 7 }),
    )
    const cached = JSON.parse(window.localStorage.getItem(BUILD_PROFILE_STORAGE_KEY) ?? '{}')
    expect(cached.profileId).toBe('PRO-LOCAL')
    expect(cached.updatedAt).toBe('2026-09-16T12:00:00.000Z')
  })
})