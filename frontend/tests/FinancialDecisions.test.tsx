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

  it('renders all financial questions with answers collapsed by default', () => {
    render(<FinancialDecisions />)

    expect(screen.getByRole('heading', { name: 'Ask FIN' })).toBeTruthy()
    const questions = document.querySelectorAll<HTMLDetailsElement>('.affordability-question')
    expect(questions).toHaveLength(18)
    expect(Array.from(questions).every((question) => !question.open)).toBe(true)
    expect(screen.getByText('Hypothetical data in use')).toBeTruthy()
  })

  it('opens the affordability engine and recalculates a hard-stop recommendation', async () => {
    render(<FinancialDecisions />)

    await userEvent.click(screen.getByText('Can I afford this?'))
    const result = screen.getByRole('region', { name: 'Affordability result' })
    expect(within(result).getByText(/\/100$/).textContent).toMatch(/^\d+\/100$/)

    fireEvent.change(screen.getByLabelText('Net Monthly Income'), { target: { value: '30000' } })

    expect(within(result).getByText('Not recommended')).toBeTruthy()
    expect(screen.getAllByText('Action required').length).toBeGreaterThan(0)
  })

  it('shows item 3 savings optimization and recalculates the goal timeline', async () => {
    render(<FinancialDecisions />)

    await userEvent.click(screen.getByText('When can I reach my savings goal?'))
    const result = screen.getByRole('region', { name: 'Savings optimization result' })

    expect(within(result).getByText('₱33,333')).toBeTruthy()
    expect(within(result).getByText('20 months')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Current Monthly Savings'), { target: { value: '40000' } })

    expect(within(result).getByText('10 months')).toBeTruthy()
    expect(within(result).getByText('On track')).toBeTruthy()
  })
})
