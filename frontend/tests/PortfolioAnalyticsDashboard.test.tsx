import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchAllLoanApplications, fetchDashboardStatistics, navigate } = vi.hoisted(() => ({
  fetchAllLoanApplications: vi.fn(),
  fetchDashboardStatistics: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../src/api', () => ({ getErrorMessage: (_error: unknown, fallback: string) => fallback }))
vi.mock('../src/api/loan', () => ({ fetchAllLoanApplications, fetchDashboardStatistics }))

import PortfolioAnalyticsDashboard from '../src/pages/dashboard/PortfolioAnalyticsDashboard'

describe('PortfolioAnalyticsDashboard', () => {
  beforeEach(() => {
    fetchDashboardStatistics.mockResolvedValue({ totalApplications: 2, approved: 1, pending: 1, rejected: 0 })
    fetchAllLoanApplications.mockResolvedValue([
      {
        application_no: 'APP-APPROVED',
        borrower_name: 'Ana Approved',
        product_type: 'Personal Loan',
        status: 'Approved',
        loan_amount: 100000,
        ai_probability: 0.2,
        created_at: new Date().toISOString(),
      },
      {
        application_no: 'APP-PENDING',
        borrower_name: 'Paolo Pending',
        product_type: 'Auto Loan',
        status: 'Credit Review',
        loan_amount: 300000,
        ai_probability: 0.8,
        created_at: new Date().toISOString(),
      },
    ])
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders live metrics and filters the portfolio by status', async () => {
    render(<PortfolioAnalyticsDashboard />)

    await waitFor(() => expect(screen.getByText('APP-APPROVED')).toBeTruthy())
    expect(screen.getByText('APP-PENDING')).toBeTruthy()
    expect(screen.getByText('Showing 2 of 2 records')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Approved' } })

    expect(screen.getByText('APP-APPROVED')).toBeTruthy()
    expect(screen.queryByText('APP-PENDING')).toBeNull()
    expect(screen.getByText('Showing 1 of 2 records')).toBeTruthy()
  })
})