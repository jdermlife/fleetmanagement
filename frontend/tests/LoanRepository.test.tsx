import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockApiGet, mockImportLoanApplications } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockImportLoanApplications: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

vi.mock('../src/api', () => ({
  api: { get: mockApiGet },
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}))

vi.mock('../src/api/loan', () => ({
  exportLoanApplications: vi.fn(),
  importLoanApplications: mockImportLoanApplications,
  updateLoanApplicationStatus: vi.fn(),
}))

vi.mock('../src/hooks/useAuthorization', () => ({
  useAuthorization: () => ({
    hasPermission: () => true,
    hasRole: () => true,
  }),
}))

vi.mock('../src/components/auth/Authorize', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}))

import LoanRepository from '../src/pages/scoring/LoanRepository'

const emptyRepositoryResponse = {
  data: { total: 0, limit: 10, offset: 0, records: [] },
}

describe('LoanRepository upload overlay', () => {
  beforeEach(() => {
    mockApiGet.mockReset()
    mockApiGet.mockResolvedValue(emptyRepositoryResponse)
    mockImportLoanApplications.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps the upload overlay visible through import and repository refresh', async () => {
    let resolveImport!: (value: { message: string }) => void
    let resolveRefresh!: (value: typeof emptyRepositoryResponse) => void
    mockImportLoanApplications.mockImplementationOnce(() => new Promise((resolve) => {
      resolveImport = resolve
    }))

    render(<LoanRepository />)
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1))
    mockApiGet.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRefresh = resolve
    }))

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, {
      target: { files: [new File(['application_no,borrower_name'], 'records.csv', { type: 'text/csv' })] },
    })

    expect(screen.getByRole('dialog', { name: 'Uploading your records' })).toBeTruthy()

    resolveImport({ message: 'Imported 1 record.' })
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('dialog', { name: 'Uploading your records' })).toBeTruthy()

    resolveRefresh(emptyRepositoryResponse)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Uploading your records' })).toBeNull()
      expect(screen.getByText(/Upload completed/)).toBeTruthy()
    })
  })
})