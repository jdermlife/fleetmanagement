import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('compares entered collateral value with the selected application appraisal', async () => {
    mockUseLoanApplicationsMetrics.mockReturnValue({
      applications: [{
        application_no: 'APP-COLLATERAL-1',
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
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <LoanMonitoringPage />
      </MemoryRouter>,
    )

    const compareButton = screen.getByRole('button', { name: 'Compare Value vs Market' }) as HTMLButtonElement
    expect(compareButton.disabled).toBe(true)

    await user.type(screen.getByRole('textbox', { name: 'Collateral (If Any)' }), 'House and lot in Quezon City')
    await user.type(screen.getByRole('textbox', { name: 'Current collateral value' }), '2100000')
    expect(compareButton.disabled).toBe(false)

    await user.click(compareButton)

    const dialog = screen.getByRole('dialog', { name: 'Value vs Market' })
    expect(dialog).toBeTruthy()
    expect(within(dialog).getByText('House and lot in Quezon City')).toBeTruthy()
    expect(within(dialog).getByText('Selected application appraisal', { exact: false })).toBeTruthy()
    expect(within(dialog).getByText('Within indicative market range')).toBeTruthy()
  })

  it('compares the loan interest rate and opens a scoped web search', async () => {
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
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <LoanMonitoringPage />
      </MemoryRouter>,
    )

    const compareButton = screen.getByRole('button', { name: 'Compare Loan Rate vs Market' }) as HTMLButtonElement
    expect(compareButton.disabled).toBe(true)

    await user.type(screen.getByRole('textbox', { name: 'Web comparison interest rate' }), '6')
    expect(compareButton.disabled).toBe(false)
    await user.click(compareButton)

    const dialog = screen.getByRole('dialog', { name: 'Loan Rate Comparison Summary' })
    expect(within(dialog).getByText('7.00%')).toBeTruthy()
    expect(within(dialog).getByText('6.00%')).toBeTruthy()
    expect(within(dialog).getByText('Current rate is close to the comparison rate')).toBeTruthy()
    expect(within(dialog).getByText('The current rate is 1.00 percentage points above the comparison rate.', { exact: false })).toBeTruthy()

    await user.click(within(dialog).getByRole('button', { name: 'Search Current Web Rates' }))
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('Home%20Loan'),
      'loan-rate-market-search',
      'popup=yes,width=920,height=720,resizable=yes,scrollbars=yes',
    )
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
    const collateralValuation = screen.getByRole('region', { name: 'Collateral Market Valuation' })
    const consolidation = screen.getByRole('region', { name: 'Loan Consolidation Guidance' })

    expect(within(debtSavings).getByText('Interest saved')).toBeTruthy()
    expect(within(borrowingCapacity).getByText('Estimated capacity')).toBeTruthy()
    expect(within(collateralValuation).getByText('Awaiting value')).toBeTruthy()
    expect(within(consolidation).getByText('Loans analyzed').parentElement?.textContent).toContain('2')
    expect(within(consolidation).getByText('Consolidation merits review because rates vary by 3.00 percentage points.', { exact: false })).toBeTruthy()
    expect(debtSavings.parentElement?.tabIndex).toBe(0)
  })
})