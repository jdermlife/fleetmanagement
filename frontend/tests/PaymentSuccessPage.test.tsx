import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import PaymentSuccessPage from '../src/pages/subscriptions/PaymentSuccessPage'

describe('PaymentSuccessPage', () => {
  afterEach(() => cleanup())

  it('confirms the provider payment and offers clear next actions', () => {
    render(
      <MemoryRouter initialEntries={['/payment-success?provider=paypal']}>
        <PaymentSuccessPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Your payment is complete' })).toBeTruthy()
    expect(screen.getByText(/payment through PayPal was received successfully/i)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Payment received')
    expect(screen.getByRole('status').textContent).toContain('Access update')
    expect(
      screen.getByRole('link', {
        name: /Continue to Financial Health/i,
      }).getAttribute('href'),
    ).toBe('/financial-health-summary')
    expect(screen.getByRole('link', { name: 'View Account' }).getAttribute('href')).toBe('/account')
  })

  it('renders a provider-neutral confirmation for the legacy gateway return URL', () => {
    render(
      <MemoryRouter initialEntries={['/payment/success']}>
        <PaymentSuccessPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Your payment is complete' })).toBeTruthy()
    expect(screen.getByText('Thank you. Your subscription payment was received successfully.')).toBeTruthy()
  })
})