import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchAutosaveDraft } = vi.hoisted(() => ({
  fetchAutosaveDraft: vi.fn(),
}))

vi.mock('../src/autosave/draftApi', () => ({
  fetchAutosaveDraft,
}))

import FinancialHealthSummaryPage from '../src/pages/scoring/FinancialHealthSummaryPage'

describe('FinancialHealthSummaryPage', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    fetchAutosaveDraft.mockReset()
    fetchAutosaveDraft.mockResolvedValue(null)
  })

  it('starts the Financial Health Journey with Create Profile before Credit Health', () => {
    render(<FinancialHealthSummaryPage />)

    const checklist = screen.getByRole('list', { name: 'Financial Health journey checklist' })
    const journeyItems = within(checklist).getAllByRole('listitem')

    expect(within(journeyItems[0]).getByRole('heading', { name: '☐ Create Profile' })).toBeTruthy()
    expect(within(journeyItems[0]).getByRole('button', { name: 'Create Profile' })).toBeTruthy()
    expect(within(journeyItems[1]).getByRole('button', { name: 'Launch Credit Health' })).toBeTruthy()
  })

  it('shows the score, band, indicators, and transparent formula', () => {
    render(<FinancialHealthSummaryPage />)

    expect(screen.getByRole('heading', { name: 'Financial Health' })).toBeTruthy()
    expect(screen.getByText('842', { selector: '.financial-health-ring-score strong' })).toBeTruthy()
    expect(screen.getAllByText('Excellent').length).toBeGreaterThan(0)
    expect(screen.getByText('84.2 × 10 = 842')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Credit Health' })).toBeTruthy()
    expect(screen.getByText('Awaiting a saved loan application draft to paint the leaf with live lending scores.')).toBeTruthy()

    expect(screen.getByRole('progressbar', { name: 'Credit Health: 91 out of 100' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Goal Health: 82 out of 100' })).toBeTruthy()
    expect(screen.getByText('91.0', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.getByText('80.5', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.getByText('77.3', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Financial Health Summary Engine' })).toBeNull()
    expect(screen.queryByText('(91 x 15 + 88 x 14 + 94 x 14) / 43 = 91.0')).toBeNull()
    expect(screen.getAllByRole('progressbar')).toHaveLength(16)
  })

  it('publishes saved workflow figures only after the compute button is clicked', async () => {
    const netWorthDraft = {
      payload: {
        amounts: {
          'asset-cash-on-hand': 250000,
          'asset-savings-account': 350000,
          'asset-stocks': 250000,
          'asset-retirement-fund': 450000,
          'liability-home-mortgage': 0,
          'income-salary': 120000,
          'income-passive': 30000,
          'expense-housing': 18000,
          'expense-groceries': 9000,
          'expense-investments': 7000,
          'insurance-life': 1,
          'insurance-health': 1,
          'insurance-hmo': 1,
          'insurance-critical-illness': 1,
          'insurance-accident': 1,
          'insurance-disability': 1,
          'insurance-property': 1,
          'insurance-vehicle': 1,
          'insurance-business': 1,
        },
        selectedFinancialGoal: 'Grow an Investment Portfolio',
        targetAmount: 1000000,
        targetMonths: 12,
      },
    }
    const budgetDraft = {
      payload: {
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        incomeDraft: { salary: '100000' },
        expenseDraft: { housing: '30000', food: '15000', savings: '30000' },
        expenseAllocationDraft: {
          housing: '30',
          'food-dining': '15',
          transport: '10',
          insurance: '5',
          'savings-core': '30',
          entertainment: '10',
        },
        savedSetup: [
          { id: 'income-salary', setupAmount: 100000, type: 'income' },
          { id: 'expense-housing', setupAmount: 30000, type: 'expense' },
          { id: 'expense-food', setupAmount: 15000, type: 'expense' },
          { id: 'expense-savings', setupAmount: 30000, type: 'expense' },
        ],
        actualEntries: {
          'income-salary': '100000',
          'expense-housing': '30000',
          'expense-food': '15000',
          'expense-savings': '30000',
        },
        cashFlowHistory: Array.from({ length: 12 }, () => ({
          income: 100000,
          expenses: 75000,
          budgetVariancePercent: 2,
          budgetCompleted: true,
        })),
      },
    }
    fetchAutosaveDraft.mockImplementation((scope: string) => Promise.resolve(
      scope === 'budget-expense-tracker' ? budgetDraft : netWorthDraft,
    ))

    render(<FinancialHealthSummaryPage />)

    expect(await screen.findByText('Wealth Building Score', { selector: '.financial-health-summary-tile span' })).toBeTruthy()
    expect(await screen.findByText('Saved inputs are ready for review.')).toBeTruthy()
    expect(screen.getByText('842', { selector: '.financial-health-ring-score strong' })).toBeTruthy()
    expect(screen.getByText('91.0', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Compute Latest Financial Health' }))

    expect(await screen.findByText('962', { selector: '.financial-health-ring-score strong' })).toBeTruthy()
    expect(screen.getByText('96.9', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.getByText('98.2', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.getByText('92.7', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Financial Health Summary Engine' })).toBeNull()
    expect(await screen.findByText('A+ - Exceptional Wealth Builder')).toBeTruthy()
    expect(await screen.findByText('830-900')).toBeTruthy()
    expect(await screen.findByText('98.0', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(await screen.findByText('10-tier band from 200 to 900')).toBeTruthy()
  })
})
