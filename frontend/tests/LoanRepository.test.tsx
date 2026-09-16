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

  it('shows the creator username in the second repository column', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        total: 1,
        limit: 10,
        offset: 0,
        records: [{
          application_no: 'PRO-001',
          created_by_username: 'jorge.creator',
          created_at: '2026-09-16T10:00:00Z',
          product_type: 'Personal Loan',
          borrower_name: 'Sample Borrower',
          email: '',
          phone: '',
          gov_id: '',
          address: '',
          monthly_income: 0,
          other_income: 0,
          debt_obligations: 0,
          loan_amount: 0,
          term_months: 0,
          interest_rate: 0,
          purpose: '',
          vehicle_info: '',
          committee_remarks: '',
          executive_approval: false,
          scorecard_total: 0,
          ai_probability: 0,
          dti: 0,
          dsr: 0,
          ltv: 0,
          status: 'Draft',
        }],
      },
    })

    render(<LoanRepository />)
    await waitFor(() => expect(screen.getAllByText('jorge.creator').length).toBeGreaterThan(0))

    const headers = Array.from(document.querySelectorAll('.loan-repository-table thead th'))
      .map((header) => header.textContent)
    expect(headers.slice(0, 3)).toEqual(['Application No', 'Created By', 'Created At'])
  })
})