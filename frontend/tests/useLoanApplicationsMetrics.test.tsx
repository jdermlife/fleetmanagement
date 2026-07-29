import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockFetchAllLoanApplications, mockFetchLoanApplication } = vi.hoisted(() => ({
  mockFetchAllLoanApplications: vi.fn(),
  mockFetchLoanApplication: vi.fn(),
}))

vi.mock('../src/api', () => ({
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}))

vi.mock('../src/api/loan', () => ({
  fetchAllLoanApplications: mockFetchAllLoanApplications,
  fetchLoanApplication: mockFetchLoanApplication,
}))

import { useLoanApplicationsMetrics } from '../src/hooks/useLoanApplicationsMetrics'

describe('useLoanApplicationsMetrics', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('loads only the selected application for report analysis', async () => {
    const selectedRecord = { application_no: 'APP-SELECTED' }
    mockFetchLoanApplication.mockResolvedValue(selectedRecord)

    const { result } = renderHook(() => useLoanApplicationsMetrics({
      applicationNo: 'APP-SELECTED',
    }))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockFetchLoanApplication).toHaveBeenCalledWith('APP-SELECTED')
    expect(mockFetchAllLoanApplications).not.toHaveBeenCalled()
    expect(result.current.applications).toEqual([selectedRecord])
  })
})