import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import FinancialHealthSummaryPage from '../src/pages/scoring/FinancialHealthSummaryPage'

describe('FinancialHealthSummaryPage', () => {
  afterEach(() => cleanup())

  it('shows the score, band, indicators, and transparent formula', () => {
    render(<FinancialHealthSummaryPage />)

    expect(screen.getByRole('heading', { name: 'Financial Health' })).toBeTruthy()
    expect(screen.getByText('842', { selector: '.financial-health-ring-score strong' })).toBeTruthy()
    expect(screen.getAllByText('Excellent').length).toBeGreaterThan(0)
    expect(screen.getByText('84.2 × 10 = 842')).toBeTruthy()

    expect(screen.getByRole('progressbar', { name: 'Credit Health: 91 out of 100' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Goal Health: 82 out of 100' })).toBeTruthy()
    expect(screen.getAllByRole('progressbar')).toHaveLength(16)
  })
})
