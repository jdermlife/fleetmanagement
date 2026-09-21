import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import FinancialHealthJourneyPage from '../src/pages/scoring/FinancialHealthJourneyPage'

describe('FinancialHealthJourneyPage resources', () => {
  it('shows legal and support links after the six-stage journey', () => {
    render(<MemoryRouter><FinancialHealthJourneyPage /></MemoryRouter>)

    const resources = screen.getByRole('navigation', { name: 'FILSCORE information and support' })
    const expectedLinks = [
      ['About', '/about-filscore'],
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
      ['Fees', '/fees'],
      ['Returns and Refunds', '/return-refund-policy'],
      ['Customer Service', '/customer-service'],
      ['Dispute Resolution', '/dispute-resolution'],
    ]

    expectedLinks.forEach(([name, href]) => {
      expect(resources.querySelector(`a[href="${href}"]`)?.textContent).toBe(name)
    })
  })
})