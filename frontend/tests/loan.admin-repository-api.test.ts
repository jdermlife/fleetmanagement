import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }))

vi.mock('../src/api', () => ({
  api: { get: mockApiGet },
}))

import { fetchAdminLoanProfileRepository } from '../src/api/loan'

describe('fetchAdminLoanProfileRepository', () => {
  beforeEach(() => mockApiGet.mockReset())

  it('falls back to the existing repository API when the admin endpoint is not deployed', async () => {
    mockApiGet
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 404 } })
      .mockResolvedValueOnce({
        data: {
          total: 1,
          limit: 25,
          offset: 0,
          records: [{
            application_no: 'APP-2001',
            borrower_name: 'Ada Borrower',
            created_by: 7,
            created_by_username: 'admin.creator',
            created_by_email: 'creator@example.com',
            created_at: '2026-10-19T08:00:00Z',
            requirements: { buildProfile: { values: { fullName: 'Ada Borrower' } } },
          }],
        },
      })

    const result = await fetchAdminLoanProfileRepository(25, 0)

    expect(mockApiGet).toHaveBeenNthCalledWith(
      1,
      '/api/admin/loan-profile-repository',
      expect.objectContaining({ params: { limit: 25, offset: 0 } }),
    )
    expect(mockApiGet).toHaveBeenNthCalledWith(
      2,
      '/api/loan-applications',
      expect.objectContaining({ params: { limit: 25, offset: 0, summary: true } }),
    )
    expect(result.records[0]).toMatchObject({
      application_no: 'APP-2001',
      borrower_name: 'Ada Borrower',
      build_profile: { values: { fullName: 'Ada Borrower' } },
      created_by_username: 'admin.creator',
    })
  })
})