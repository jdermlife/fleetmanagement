import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import PaymentSuccessPage from '../src/pages/subscriptions/PaymentSuccessPage'

describe('PaymentSuccessPage', () => {
  afterEach(() => cleanup())

  it('thanks the subscriber and continues to Financial Health', () => {
    render(
      <MemoryRouter initialEntries={['/payment-success?provider=paypal']}>
        <PaymentSuccessPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Thank You for Subscription!' })).toBeTruthy()
    expect(screen.getByText(/payment through PayPal was completed/i)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Subscription activated')
    expect(
      screen.getByRole('link', {
        name: /Continue your Journey to Robust Financial Health!/i,
      }).getAttribute('href'),
    ).toBe('/financial-health-summary')
  })
})