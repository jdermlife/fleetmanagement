import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
    expect(screen.getByRole('heading', { name: 'Financial Health Summary Engine' })).toBeTruthy()
    expect(screen.getByText('(91 x 15 + 88 x 14 + 94 x 14) / 43 = 91.0')).toBeTruthy()
    expect(screen.getAllByRole('progressbar')).toHaveLength(16)
  })

  it('publishes saved workflow figures only after the compute button is clicked', async () => {
    fetchAutosaveDraft.mockResolvedValue({
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
    })

    render(<FinancialHealthSummaryPage />)

    expect(await screen.findByRole('heading', { name: 'Net Worth Building Score' })).toBeTruthy()
    expect(await screen.findByText('Saved inputs are ready for review.')).toBeTruthy()
    expect(screen.getByText('842', { selector: '.financial-health-ring-score strong' })).toBeTruthy()
    expect(screen.getByText('91.0', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Compute Latest Financial Health' }))

    expect(await screen.findByText('964', { selector: '.financial-health-ring-score strong' })).toBeTruthy()
    expect(screen.getByText('96.9', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.getByText('98.9', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.getByText('92.7', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.getByText('(91 x 15 + 100 x 14 + 100 x 14) / 43 = 96.9')).toBeTruthy()
    expect(await screen.findByText('A+ - Exceptional Wealth Builder')).toBeTruthy()
    expect(await screen.findByText('830-900')).toBeTruthy()
    expect(await screen.findByText('10-tier band from 200 to 900')).toBeTruthy()
  })
})
