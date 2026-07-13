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

    await saveAutosaveDraftRemote('profile', 'new', {
      payload: { name: 'Ana' },
      expectedRevision: null,
    })

    expect(api.put).toHaveBeenCalledWith('/api/drafts/profile/new', {
      payload: { name: 'Ana' },
      expected_revision: 0,
    })
  })
})
