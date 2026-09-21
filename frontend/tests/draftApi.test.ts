import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}

vi.mock('../src/api', () => ({ api }))

describe('autosave draft API', () => {
  beforeEach(() => {
    api.get.mockReset()
    api.put.mockReset()
    api.delete.mockReset()
  })

  it('bounds remote draft reads so one source cannot stall a page indefinitely', async () => {
    api.get.mockResolvedValue({
      data: {
        scope: 'budget',
        entity_key: 'APP-001',
        payload: {},
        revision: 1,
        updated_at: '2026-09-21T00:00:00.000Z',
      },
    })
    const { fetchAutosaveDraft } = await import('../src/autosave/draftApi')

    await expect(fetchAutosaveDraft('budget', 'APP-001')).resolves.toMatchObject({
      scope: 'budget',
      entityKey: 'APP-001',
    })
    expect(api.get).toHaveBeenCalledWith('/api/drafts/budget/APP-001', {
      timeout: 10000,
    })
  })

  it('uses revision zero when creating a remote draft', async () => {
    api.put.mockResolvedValue({
      data: {
        scope: 'profile',
        entity_key: 'new',
        payload: { name: 'Ana' },
        revision: 1,
        updated_at: '2026-07-13T12:00:00.000Z',
      },
    })
    const { saveAutosaveDraftRemote } = await import('../src/autosave/draftApi')

    const saved = await saveAutosaveDraftRemote('profile', 'new', {
      payload: { name: 'Ana' },
      expectedRevision: null,
    })

    expect(api.put).toHaveBeenCalledWith('/api/drafts/profile/new', {
      payload: { name: 'Ana' },
      expected_revision: 0,
    })
    expect(saved.mirrorStatus).toBeUndefined()
  })

  it('returns the Build Profile loan mirror outcome', async () => {
    api.put.mockResolvedValue({
      data: {
        scope: 'build-profile',
        entity_key: 'current',
        payload: { profileId: 'PRO-001', values: {} },
        revision: 1,
        updated_at: '2026-07-13T12:00:00.000Z',
        mirror_status: 'created',
        application_no: 'PRO-001',
      },
    })
    const { saveAutosaveDraftRemote } = await import('../src/autosave/draftApi')

    const saved = await saveAutosaveDraftRemote('build-profile', 'current', {
      payload: { profileId: 'PRO-001', values: {} },
      expectedRevision: null,
    })

    expect(saved.mirrorStatus).toBe('created')
    expect(saved.applicationNo).toBe('PRO-001')
  })
})
