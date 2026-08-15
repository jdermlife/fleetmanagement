import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const { mockFetchAutosaveDraft, mockReadReplicatedBuildProfile, mockReload, mockSaveMonitoring, mockUpdateLoanApplication, mockUseLoanApplicationsMetrics } = vi.hoisted(() => ({
  mockFetchAutosaveDraft: vi.fn(),
  mockReadReplicatedBuildProfile: vi.fn(),
  mockReload: vi.fn(),
  mockSaveMonitoring: vi.fn(),
  mockUpdateLoanApplication: vi.fn(),
  mockUseLoanApplicationsMetrics: vi.fn(),
}))

vi.mock('../src/autosave', () => ({
  useAutosaveDraft: vi.fn(() => ({ isHydrated: true })),
}))

vi.mock('../src/autosave/draftApi', () => ({
  fetchAutosaveDraft: mockFetchAutosaveDraft,
}))

vi.mock('../src/pages/scoring/buildProfileReplication', () => ({
  readReplicatedBuildProfile: mockReadReplicatedBuildProfile,
}))

vi.mock('../src/api/loan', () => ({
  saveLoanApplicationMonitoring: mockSaveMonitoring,
  updateLoanApplication: mockUpdateLoanApplication,
}))

vi.mock('../src/hooks/useLoanApplicationsMetrics', () => ({
  useLoanApplicationsMetrics: mockUseLoanApplicationsMetrics,
}))

vi.mock('../src/hooks/useSelectedAnalysisEntity', () => ({
  useSelectedAnalysisEntity: vi.fn(() => ({
    selectedApplicationNo: '',
    entityKey: 'profile:cash-coverage',
    isIdentityReady: true,
  })),
}))

import LoanMonitoringPage from '../src/pages/scoring/LoanMonitoringPage'

describe('LoanMonitoringPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('shows cash coverage from Build Profile liquid cash and Budget Tracker actual expenses', async () => {
    mockReadReplicatedBuildProfile.mockReturnValue({
      profileId: 'PROFILE-CASH-COVERAGE',
      values: {
        'asset-cash-on-hand': '50000',
        'asset-savings-account': '150000',
      },
      documents: [],
      suitabilityAnswers: {},
      coBorrowers: [],
      guarantors: [],
      additionalCollaterals: [],
    })
    mockFetchAutosaveDraft.mockResolvedValue({
      payload: {
        savedSetup: [{ id: 'expense-rent', setupAmount: 120000, type: 'expense' }],
        actualEntries: { 'expense-rent': '100000' },
      },
    })
    mockUseLoanApplicationsMetrics.mockReturnValue({
      applications: [],
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

    const gauge = await screen.findByRole('meter', { name: /Cash Coverage: 200.0%/ })
    expect(gauge.getAttribute('aria-label')).toContain('Optimal')
    expect(screen.getByRole('meter', { name: /Loan Optimization Opportunity/ })).toBeTruthy()
    expect(screen.queryByText('Loan Monitoring Score Breakdown')).toBeNull()
    expect(screen.getByText('₱200,000')).toBeTruthy()
    expect(screen.getByText('₱100,000')).toBeTruthy()
  })

  it('shows optimal collateral coverage from Build Profile steps 6 and 7', async () => {
    mockReadReplicatedBuildProfile.mockReturnValue({
      profileId: 'PROFILE-COLLATERAL-COVERAGE',
      values: {
        requestedAmount: '500000',
        loanCurrentBalance: '500000',
        appraisedValue: '800000',
      },
      documents: [],
      suitabilityAnswers: {},
      coBorrowers: [],
      guarantors: [],
      additionalCollaterals: [{ appraisedValue: '200000' }],
    })
    mockFetchAutosaveDraft.mockResolvedValue(null)
    mockUseLoanApplicationsMetrics.mockReturnValue({
      applications: [],
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

    const gauge = await screen.findByRole('meter', { name: /Collateral Coverage: 200.0%/ })
    expect(gauge.getAttribute('aria-label')).toContain('Optimal')
    expect(screen.getByText('₱1,000,000')).toBeTruthy()
    expect(screen.getByText('₱500,000')).toBeTruthy()
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

    fireEvent.click(screen.getByRole('button', { name: /^3 Summary Dashboard/ }))
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

  it('prefills Build Profile loan data and saves an additional loan schedule to the profile', async () => {
    mockUpdateLoanApplication.mockResolvedValue({})
    mockUseLoanApplicationsMetrics.mockReturnValue({
      applications: [{
        application_no: 'APP-PROFILE-LOAN',
        loan_amount: 850_000,
        term_months: 48,
        interest_rate: 6.5,
        status: 'Approved',
        product_type: 'Auto Loan',
        vehicle_info: 'Sedan 2025',
        requirements: {
          buildProfile: {
            values: {
              loanType: 'Auto Loan',
              loanLender: 'Profile Bank',
              loanCurrentBalance: '700000',
              assetType: 'Passenger Cars',
            },
          },
        },
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

    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: 'Loan type' }) as HTMLSelectElement).value).toBe('Auto Loan')
      expect((screen.getByPlaceholderText('Enter loan issuer entity') as HTMLInputElement).value).toBe('Profile Bank')
      expect((screen.getByRole('textbox', { name: 'Collateral (If Any)' }) as HTMLInputElement).value).toBe('Passenger Cars')
      expect((screen.getByPlaceholderText('Enter original amount') as HTMLInputElement).value).toBe('850,000.00')
      expect((screen.getByPlaceholderText('Enter outstanding balance') as HTMLInputElement).value).toBe('700,000.00')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add Another Loan Not Declared in Building Profile' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Additional loan 1 loan type' }), { target: { value: 'Personal Loan' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Additional loan 1 entity issuer' }), { target: { value: 'Second Bank' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Additional loan 1 original amount' }), { target: { value: '120000' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Additional loan 1 interest rate' }), { target: { value: '8' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Additional loan 1 term months' }), { target: { value: '24' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Additional Loans to Profile' }))

    await waitFor(() => expect(mockUpdateLoanApplication).toHaveBeenCalledTimes(1))
    const savedPayload = mockUpdateLoanApplication.mock.calls[0][1]
    expect(savedPayload.requirements.buildProfile.additionalLoans).toEqual([
      expect.objectContaining({
        loanType: 'Personal Loan',
        entityIssuer: 'Second Bank',
        loanAmount: 120000,
        interestRate: 8,
        termMonths: 24,
      }),
    ])
    expect(savedPayload.requirements.buildProfile.additionalLoans[0]).not.toHaveProperty('rows')
  })
})