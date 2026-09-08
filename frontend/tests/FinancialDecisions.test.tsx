import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/components/profile/SelectedProfileIdCard', () => ({
  default: () => <article>Record ID</article>,
}))

import FinancialDecisions from '../src/pages/scoring/FinancialDecisions'

describe('FinancialDecisions', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the financial snapshot and seven decision categories', () => {
    render(<FinancialDecisions />)

    expect(screen.getByRole('heading', { name: 'Financial Decisions' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Your Financial Snapshot' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'What are you deciding today?' })).toBeTruthy()
    expect(document.querySelectorAll('.decision-card')).toHaveLength(7)
    expect(screen.getByText('Hypothetical data in use')).toBeTruthy()
  })

  it('shows the affordability workspace and recalculates a hard-stop recommendation', () => {
    render(<FinancialDecisions />)

    const result = screen.getByRole('region', { name: 'Affordability result' })
    expect(within(result).getByText(/\/100$/).textContent).toMatch(/^\d+\/100$/)

    fireEvent.change(screen.getByLabelText('Net Monthly Income'), { target: { value: '30000' } })

    expect(within(result).getByText('Not recommended')).toBeTruthy()
    expect(screen.getAllByText('Action required').length).toBeGreaterThan(0)
  })

  it('opens savings optimization and recalculates the goal timeline', async () => {
    render(<FinancialDecisions />)

    await userEvent.click(screen.getByRole('button', { name: /How much should I save?/ }))
    const result = screen.getByRole('region', { name: 'Savings optimization result' })

    expect(within(result).getByText('₱33,333')).toBeTruthy()
    expect(within(result).getByText('20 months')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Current Monthly Savings'), { target: { value: '40000' } })

    expect(within(result).getByText('10 months')).toBeTruthy()
    expect(within(result).getByText('On track')).toBeTruthy()
  })

  it('routes a plain-language question to the matching decision workspace', async () => {
    render(<FinancialDecisions />)

    await userEvent.type(screen.getByLabelText('Ask FIN a financial question'), 'How much emergency reserve should I keep?')
    await userEvent.click(screen.getByRole('button', { name: 'Ask FIN' }))

    expect(screen.getByRole('heading', { name: 'Emergency fund' })).toBeTruthy()
    expect(screen.getByText(/months covered/)).toBeTruthy()
  })

  it('renders all retirement engines and recalculates the required corpus', () => {
    render(<FinancialDecisions />)

    expect(screen.getByRole('heading', { name: 'Retirement Model Engine' })).toBeTruthy()
    for (const engine of [
      'Retirement Needs Engine',
      'Inflation Engine',
      'Retirement Income Engine',
      'Investment Projection Engine',
      'Retirement Corpus Engine',
      'FI Date Engine',
      'Contribution Optimizer',
      'Scenario Engine',
      'Stress / Monte Carlo Engine',
    ]) expect(screen.getByText(engine)).toBeTruthy()

    const corpusPanel = screen.getByText('Retirement Corpus Engine').closest('article')
    const initialCorpus = corpusPanel?.querySelector(':scope > strong')?.textContent
    fireEvent.change(screen.getByLabelText('Annual Inflation'), { target: { value: '6' } })

    expect(corpusPanel?.querySelector(':scope > strong')?.textContent).not.toBe(initialCorpus)
  })
})
