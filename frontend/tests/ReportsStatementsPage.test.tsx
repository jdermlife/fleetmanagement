import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const access = vi.hoisted(() => ({
  hasPaidScoreAccess: true,
  isScoreAccessLoading: false,
}))
const { fetchAutosaveDraft } = vi.hoisted(() => ({
  fetchAutosaveDraft: vi.fn(),
}))

const netWorthPayload = {
  amounts: {
    'asset-cash-on-hand': '250000',
    'asset-savings-account': '500000',
    'liability-personal-loan': '100000',
    'income-salary': '120000',
    'expense-housing': '30000',
  },
}
const lendingPayload = {
  formData: {
    borrower: { govId: 'ID-123', email: 'client@example.com' },
    contactInformation: { mobileNumber: '09170000000' },
    addressInformation: { presentAddress: 'Manila', lengthOfStay: '5 years' },
    employment: { monthlyIncome: 100000, debtObligations: 5000 },
    loan: { amount: 120000, interestRate: 0, termMonths: 12, purpose: 'Personal' },
    documents: [{ status: 'Parsed' }, { status: 'Pending' }],
  },
}

vi.mock('../src/autosave/draftApi', () => ({
  fetchAutosaveDraft,
}))

vi.mock('../src/hooks/useAuthorization', () => ({
  useAuthorization: () => ({ isAdmin: false }),
}))

vi.mock('../src/hooks/usePaidScoreCertificationAccess', () => ({
  usePaidScoreCertificationAccess: () => access,
}))
vi.mock('../src/hooks/useSelectedAnalysisEntity', () => ({
  useSelectedAnalysisEntity: () => ({
    selectedApplicationNo: 'APP-001',
    entityKey: 'APP-001',
    isIdentityReady: true,
  }),
}))

vi.mock('../src/pages/scoring/LoanCertificationPage', () => ({
  default: () => (
    <section aria-label="FILSCORE Credit Health certification">
      <h2>FILSCORE Credit Health Certificate</h2>
      <span>760</span>
    </section>
  ),
}))

vi.mock('../src/pages/scoring/NetWorthPositioningPage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/pages/scoring/NetWorthPositioningPage')>()
  return {
    ...actual,
    default: () => (
      <section aria-label="FILSCORE wealth building certification">
        <h2>FILSCORE Wealth Building Score</h2>
        <span>Actual Wealth Score: 88</span>
      </section>
    ),
  }
})

import ReportsStatementsPage from '../src/pages/reports/ReportsStatementsPage'

function createStorageMock(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => data.delete(key),
    setItem: (key, value) => data.set(key, String(value)),
  }
}

describe('ReportsStatementsPage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
    window.localStorage.setItem('fms:build-profile', JSON.stringify({
      profileId: 'PROFILE-LIVE-1',
      completionPercent: 88,
      values: {
        wealthCurrency: 'PHP',
        'asset-cash-on-hand': '250000',
        'asset-savings-account': '500000',
        'liability-personal-loan': '100000',
        'income-salary': '120000',
        'expense-housing': '30000',
      },
      documents: [],
      suitabilityAnswers: { riskCapacity: '4', investmentDiscipline: '4' },
      coBorrowers: [],
      guarantors: [],
      additionalCollaterals: [],
    }))
    fetchAutosaveDraft.mockReset()
    fetchAutosaveDraft.mockImplementation((scope: string) => Promise.resolve(
      scope === 'net-worth-positioning'
        ? { payload: netWorthPayload }
        : scope === 'loan-application'
          ? { payload: lendingPayload }
          : { payload: {} },
    ))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    access.hasPaidScoreAccess = true
    access.isScoreAccessLoading = false
  })

  it('groups all existing statements and certificates for paid accounts', async () => {
    render(<MemoryRouter><ReportsStatementsPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Financial Statements' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Score Certificates' })).toBeTruthy()
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(await screen.findByRole('button', { name: /Statement of Net Worth/ })).toBeTruthy()
    const balanceSheet = screen.getByRole('link', { name: /Balance Sheet/ })
    const incomeStatement = screen.getByRole('link', { name: /Income Statement/ })
    const cashFlowStatement = screen.getByRole('link', { name: /Cash Flow Statement/ })
    expect(balanceSheet.getAttribute('href')).toBe('/financial-health-summary')
    expect(within(balanceSheet).getByText('Statement of Networth')).toBeTruthy()
    expect(incomeStatement.getAttribute('href')).toBe('/budget-expense-tracker')
    expect(within(incomeStatement).getByText('See statement of Networth')).toBeTruthy()
    expect(cashFlowStatement.getAttribute('href')).toBe('/budget-expense-tracker')
    expect(within(cashFlowStatement).queryByText('Open report')).toBeNull()
    expect(screen.getByRole('button', { name: /Credit Score Certificate/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Wealth Protection Score Certificate/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Wealth Building Score Certificate/ })).toBeTruthy()
  })

  it('opens the existing live Credit Health certificate in a popout', () => {
    render(<MemoryRouter><ReportsStatementsPage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /Credit Score Certificate/ }))

    const dialog = screen.getByRole('dialog', { name: 'FILSCORE Credit Health Certificate' })
    const certificate = within(dialog).getByLabelText('FILSCORE Credit Health certification')
    expect(within(certificate).getByRole('heading', { name: 'FILSCORE Credit Health Certificate', level: 2 })).toBeTruthy()
    expect(within(certificate).getByText('760')).toBeTruthy()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close certificate report' }))
    expect(screen.queryByRole('dialog', { name: 'FILSCORE Credit Health Certificate' })).toBeNull()
  })

  it('opens the existing live Wealth Building certificate in a popout', () => {
    render(<MemoryRouter><ReportsStatementsPage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /Wealth Building Score Certificate/ }))

    const dialog = screen.getByRole('dialog', { name: 'FILSCORE Wealth Building Score Certificate' })
    expect(within(dialog).getByRole('heading', { name: 'FILSCORE Wealth Building Score' })).toBeTruthy()
    expect(within(dialog).getByText('Actual Wealth Score: 88')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'FILSCORE Wealth Building Score Certificate' })).toBeNull()
  })

  it('opens the Wealth Protection Score Certificate with the live assessment in a popout', async () => {
    render(<MemoryRouter><ReportsStatementsPage /></MemoryRouter>)

    await waitFor(() => expect(fetchAutosaveDraft).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /Wealth Protection Score Certificate/ }))

    const dialog = screen.getByRole('dialog', { name: 'Wealth Protection Score Certificate' })
    const certificate = within(dialog).getByLabelText('Wealth Protection Score Certificate')
    expect(within(certificate).getByText('Assessment pending')).toBeTruthy()
    expect(within(certificate).getByText('Insurance coverage adequacy')).toBeTruthy()
    expect(within(certificate).getByText('40% of total score')).toBeTruthy()
    expect(within(certificate).getByText('Strong protection')).toBeTruthy()
    expect(within(certificate).getByText('High vulnerability')).toBeTruthy()

    const actualCertificate = within(dialog).getByLabelText('Actual Wealth Protection Score Certificate')
    expect(within(actualCertificate).getByRole('heading', { name: 'Actual Wealth Protection Score' })).toBeTruthy()
    expect(within(actualCertificate).getByText('High vulnerability')).toBeTruthy()
    expect(within(actualCertificate).getByText('39')).toBeTruthy()
    expect(within(actualCertificate).getAllByText('Not assessed')).toHaveLength(4)
    expect(within(actualCertificate).getByText('25.0 months of expenses in liquid reserves')).toBeTruthy()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close certificate report' }))
    expect(screen.queryByRole('dialog', { name: 'Wealth Protection Score Certificate' })).toBeNull()
  })

  it('opens the assets and liabilities report with live financial and credit charts', async () => {
    render(<MemoryRouter><ReportsStatementsPage /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: /Statement of Net Worth/ }))

    const statement = screen.getByRole('dialog', { name: 'Statement of Assets and Liabilities' })
    expect(statement.querySelectorAll('.admin-statement-sheet')).toHaveLength(4)
    expect(within(statement).getByRole('heading', { name: 'Current Net Worth' })).toBeTruthy()
    expect(statement.querySelector('.admin-cover-ring-score strong')?.textContent).not.toBe('842')
    await waitFor(() => expect(statement.querySelector('.admin-cover-credit')?.textContent).toContain('774'))
    const wealthBehaviour = [...statement.querySelectorAll('.wealth-balance-radar-indicator')]
      .find((indicator) => indicator.textContent?.includes('Wealth Behaviour'))
    expect(wealthBehaviour?.querySelector('strong')?.textContent).toBe('100')

    fireEvent.click(within(statement).getByRole('button', { name: 'Close financial statement' }))
    expect(screen.queryByRole('dialog', { name: 'Statement of Assets and Liabilities' })).toBeNull()
  })

  it('keeps reports visible but dimmed and non-navigable for non-paid accounts', () => {
    access.hasPaidScoreAccess = false

    render(<MemoryRouter><ReportsStatementsPage /></MemoryRouter>)

    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getAllByText('Paid account required')).toHaveLength(7)
    expect(document.querySelectorAll('.reports-statements-card.is-locked')).toHaveLength(7)
    expect(document.querySelectorAll('[aria-disabled="true"]')).toHaveLength(7)
  })
})