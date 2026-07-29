import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPatch } = vi.hoisted(() => ({
  mockPatch: vi.fn(),
}))

vi.mock('../src/api', () => ({
  api: {
    patch: mockPatch,
  },
}))

import { updateLoanApplicationWealthScore } from '../src/api/loan'

describe('updateLoanApplicationWealthScore', () => {
  beforeEach(() => {
    mockPatch.mockReset()
  })

  it('updates Wealth results for the encoded application number', async () => {
    const payload = {
      wealth_building_score: 742,
      wealth_grade: 'A-',
      wealth_rating: 'Very Strong',
      wealth_component_scores: {
        netWorthStrength: 82.5,
        liquidityBuffer: 76,
      },
      wealth_certification_status: 'GENERATED_COMPLETE' as const,
    }
    const response = {
      message: 'FILSCORE Wealth score updated',
      application_no: 'APP / 42',
      wealth_score: {
        ...payload,
        wealth_calculated_at: '2026-04-01T10:30:00+00:00',
      },
    }
    mockPatch.mockResolvedValue({ data: response })

    await expect(
      updateLoanApplicationWealthScore('APP / 42', payload),
    ).resolves.toEqual(response)
    expect(mockPatch).toHaveBeenCalledWith(
      '/api/loan-applications/APP%20%2F%2042/wealth-score',
      payload,
    )
  })
})