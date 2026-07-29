import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const { mockReload, mockUseLoanApplicationsMetrics } = vi.hoisted(() => ({
  mockReload: vi.fn(),
  mockUseLoanApplicationsMetrics: vi.fn(),
}))

vi.mock('../src/hooks/useLoanApplicationsMetrics', () => ({
  useLoanApplicationsMetrics: mockUseLoanApplicationsMetrics,
}))

import LoanMonitoringPage from '../src/pages/scoring/LoanMonitoringPage'

describe('LoanMonitoringPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('omits market interest-rate and collateral-value checks from Loan Setup', () => {
    mockUseLoanApplicationsMetrics.mockReturnValue({
      applications: [{
        application_no: 'APP-RATE-1',
        loan_amount: 1_500_000,
        term_months: 120,
        interest_rate: 7,
        appraised_value: 2_000_000,
        ltv: 75,
        status: 'Approved',
        product_type: 'Home Loan',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }],
      error: '',
      lastUpdated: null,
      loading: false,
      reload: mockReload,
    })
    render(
      <MemoryRouter>
        <LoanMonitoringPage />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Loan Interest Rate Check')).toBeNull()
    expect(screen.queryByText('Collateral Value Check')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Compare Loan Rate vs Market' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Compare Value vs Market' })).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Collateral (If Any)' })).toBeTruthy()
  })

  it('provides functional hover tools and portfolio consolidation guidance', () => {
    mockUseLoanApplicationsMetrics.mockReturnValue({
      applications: [
        {
          application_no: 'APP-LOW-RATE',
          loan_amount: 1_500_000,
          term_months: 120,
          interest_rate: 7,
          appraised_value: 2_000_000,
          ltv: 75,
          monthly_income: 150_000,
          other_income: 20_000,
          debt_obligations: 25_000,
          status: 'Approved',
          product_type: 'Home Loan',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        {
          application_no: 'APP-HIGH-RATE',
          loan_amount: 500_000,
          term_months: 60,
          interest_rate: 10,
          status: 'Approved',
          product_type: 'Personal Loan',
          created_at: '2026-02-01T00:00:00.000Z',
          updated_at: '2026-02-01T00:00:00.000Z',
        },
      ],
      error: '',
      lastUpdated: null,
      loading: false,
      reload: mockReload,
    })

    render(
      <MemoryRouter>
        <LoanMonitoringPage />
      </MemoryRouter>,
    )

    const debtSavings = screen.getByRole('region', { name: 'Debt Savings Calculator' })
    const borrowingCapacity = screen.getByRole('region', { name: 'Borrowing Capacity Simulator' })
    const consolidation = screen.getByRole('region', { name: 'Loan Consolidation Guidance' })

    expect(within(debtSavings).getByText('Interest saved')).toBeTruthy()
    expect(within(borrowingCapacity).getByText('Estimated capacity')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Collateral Market Valuation' })).toBeNull()
    expect(within(consolidation).getByText('Loans analyzed').parentElement?.textContent).toContain('2')
    expect(within(consolidation).getByText('Consolidation merits review because rates vary by 3.00 percentage points.', { exact: false })).toBeTruthy()
    expect(debtSavings.parentElement?.tabIndex).toBe(0)
  })
})