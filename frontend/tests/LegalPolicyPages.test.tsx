import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import CustomerServicePage from '../src/pages/legal/CustomerServicePage'
import DisputeResolutionPage from '../src/pages/legal/DisputeResolutionPage'
import ReturnRefundPolicyPage from '../src/pages/legal/ReturnRefundPolicyPage'

afterEach(cleanup)

describe('public legal service pages', () => {
  it('publishes the return and refund policy with customer-service escalation', () => {
    render(<MemoryRouter><ReturnRefundPolicyPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Return and Refund Policy' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Customer Service' }).getAttribute('href')).toBe('/customer-service')
    expect(screen.getByText(/does not limit remedies for defective or imperfect services/i)).toBeTruthy()
  })

  it('publishes customer-service contact and safe submission instructions', () => {
    render(<MemoryRouter><CustomerServicePage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Customer Service and Contact Information' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'admin@quantech.international' }).getAttribute('href')).toBe(
      'mailto:admin@quantech.international',
    )
    expect(screen.getByText(/Do not send passwords, one-time codes, PINs/i)).toBeTruthy()
  })

  it('publishes internal and external dispute-resolution paths', () => {
    render(<MemoryRouter><DisputeResolutionPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Dispute Resolution' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '1. Contact Customer Service First' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Department of Trade and Industry/i })).toBeTruthy()
    expect(screen.getByText(/does not represent FILSCORE.*as a BSP-supervised institution/i)).toBeTruthy()
  })
})
