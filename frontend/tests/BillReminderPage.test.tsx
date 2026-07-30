import { useEffect } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDraft, mockUseLoanApplicationsMetrics } = vi.hoisted(() => ({
  mockDraft: {
    step: 3,
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    draftBillers: [],
    billerAllocationDraft: { electric: '60', water: '40' },
    editingBillerId: null,
    company: '',
    utilityType: '',
    estimatedDueDay: '',
    emailReminder10DaysBefore: false,
    frequency: 'Monthly',
    budgetedAmount: '',
    savedSetup: [
      {
        id: 'electric',
        company: 'Metro Electric',
        utilityType: 'Electricity',
        estimatedDueDay: '15',
        emailReminder10DaysBefore: true,
        frequency: 'Monthly',
        dateCovered: '2026-07-01 to 2026-07-31',
        budgetedAmount: 1200,
      },
      {
        id: 'water',
        company: 'City Water',
        utilityType: 'Water',
        estimatedDueDay: '20',
        emailReminder10DaysBefore: false,
        frequency: 'Monthly',
        dateCovered: '2026-07-01 to 2026-07-31',
        budgetedAmount: 800,
      },
    ],
    paymentEntries: {
      electric: [{ id: 'electric-payment-1', datePaid: '', amountPaid: '' }],
      water: [{ id: 'water-payment-1', datePaid: '', amountPaid: '' }],
    },
    actualEntries: {},
    varianceNotes: {},
    step3RecordSavedAt: '',
    isBaselineAllocationFixed: true,
  },
  mockUseLoanApplicationsMetrics: vi.fn(),
}))

vi.mock('../src/autosave', () => ({
  useAutosaveDraft: ({ onHydrate }: { onHydrate: (draft: typeof mockDraft) => void }) => {
    useEffect(() => onHydrate(mockDraft), [onHydrate])
    return {}
  },
}))

vi.mock('../src/hooks/useLoanApplicationsMetrics', () => ({
  useLoanApplicationsMetrics: mockUseLoanApplicationsMetrics,
}))

import BillReminderPage from '../src/pages/scoring/BillReminderPage'

describe('BillReminderPage Step 3 payments', () => {
  beforeEach(() => {
    mockDraft.paymentEntries = {
      electric: [{ id: 'electric-payment-1', datePaid: '', amountPaid: '' }],
      water: [{ id: 'water-payment-1', datePaid: '', amountPaid: '' }],
    }
    mockDraft.actualEntries = {}
    mockUseLoanApplicationsMetrics.mockReturnValue({
      applications: [],
      error: '',
      lastUpdated: null,
      loading: false,
      reload: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows an editable payment table per biller and totals succeeding rows', async () => {
    const user = userEvent.setup()

    render(<BillReminderPage />)

    const electricSection = await screen.findByRole('region', { name: 'Metro Electric' })
    const waterSection = screen.getByRole('region', { name: 'City Water' })
    expect(within(electricSection).getByText('Electricity')).toBeTruthy()
    expect(within(waterSection).getByText('Water')).toBeTruthy()

    await user.type(
      within(electricSection).getByLabelText('Metro Electric payment 1 date paid'),
      '2026-07-15',
    )
    await user.type(
      within(electricSection).getByLabelText('Metro Electric payment 1 amount paid'),
      '700',
    )
    expect(within(electricSection).getAllByText(/₱700/)).toHaveLength(2)

    await user.click(within(electricSection).getByRole('button', { name: 'Add Payment Row' }))
    expect(within(electricSection).getByLabelText('Metro Electric payment 2 date paid')).toBeTruthy()
    expect(within(electricSection).getByLabelText('Metro Electric payment 2 amount paid')).toBeTruthy()
  })

  it('preserves a legacy single actual amount in the first payment row', async () => {
    mockDraft.paymentEntries = {}
    mockDraft.actualEntries = { electric: '650' }

    render(<BillReminderPage />)

    const legacyAmount = await screen.findByLabelText('Metro Electric payment 1 amount paid') as HTMLInputElement
    expect(legacyAmount.value).toBe('650.00')
  })

  it('shows health insights, score impact, and monthly payment outlook', async () => {
    render(<BillReminderPage />)

    expect(await screen.findByRole('heading', { name: 'Bill Payment Health Score Breakdown' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Strengths' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Opportunities' })).toBeTruthy()
    const combinedCard = screen.getByRole('heading', { name: 'AI Recommendations and Health Score Impact' }).closest('article')
    expect(combinedCard).toBeTruthy()
    expect(within(combinedCard as HTMLElement).getByRole('heading', { name: 'Health Score Impact' })).toBeTruthy()
    expect(screen.getByText('Credit Health Overall Score')).toBeTruthy()
    expect(screen.getByText('Wealth Building Capacity Score')).toBeTruthy()
    expect(screen.getAllByRole('heading', { name: 'Health Score Impact' })).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Current, History and Forecast' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Last 3 Months' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Forecast Next 3 Months' })).toBeTruthy()
  })
})