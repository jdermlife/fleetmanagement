import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { authorization, mockFetchRepository } = vi.hoisted(() => ({
  authorization: { isAdmin: true, isLoading: false },
  mockFetchRepository: vi.fn(),
}))

vi.mock('../src/api/loan', () => ({
  fetchAdminLoanProfileRepository: mockFetchRepository,
}))

vi.mock('../src/hooks/useAuthorization', () => ({
  useAuthorization: () => authorization,
}))

import LoanRepository2 from '../src/pages/admin/LoanRepository2'

describe('LoanRepository2', () => {
  beforeEach(() => {
    authorization.isAdmin = true
    authorization.isLoading = false
    mockFetchRepository.mockReset()
    mockFetchRepository.mockResolvedValue({
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
        build_profile: {
          values: {
            fullName: 'Ada Borrower',
            employmentStatus: 'Regular',
            productType: 'Home Loan',
          },
          dependents: [{ id: 'DEP-1', name: 'Sample Dependent', dateOfBirth: '2015-01-01' }],
        },
      }],
    })
  })

  afterEach(() => cleanup())

  it('shows creator metadata and Build Profile Steps 1 to 7 data', async () => {
    render(<LoanRepository2 />)

    await waitFor(() => expect(screen.getByText('APP-2001')).toBeTruthy())
    expect(screen.getByText('admin.creator')).toBeTruthy()
    expect(screen.getByText('creator@example.com')).toBeTruthy()
    expect(screen.getByText('Ada Borrower')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'View profile' }))

    expect(screen.getByText('Step 1 - Tell Us About Yourself')).toBeTruthy()
    expect(screen.getByText('Step 7 - Collateral Assets')).toBeTruthy()
    expect(screen.getByText('Regular')).toBeTruthy()
    expect(screen.getByText('Sample Dependent')).toBeTruthy()
  })

  it('blocks non-admin users without requesting repository data', () => {
    authorization.isAdmin = false

    render(<LoanRepository2 />)

    expect(screen.getByRole('alert').textContent).toContain('administrators only')
    expect(mockFetchRepository).not.toHaveBeenCalled()
  })
})