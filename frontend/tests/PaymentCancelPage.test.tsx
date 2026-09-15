import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api', () => ({
  cancelPublicTrialPayment: vi.fn(),
  cancelSubscriptionPayment: vi.fn(),
  getAuthToken: () => null,
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}))

describe('PaymentCancelPage', () => {
  afterEach(() => {
    cleanup()
    window.sessionStorage.clear()
  })

  it('shows recovery actions when PayMongo returns without stored context', async () => {
    const { default: PaymentCancelPage } = await import('../src/pages/payment/cancel')

    render(
      <MemoryRouter initialEntries={['/payment/cancel']}>
        <PaymentCancelPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Your payment was not completed' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Choose a Payment Option/ }).getAttribute('href')).toBe('/trial-expired')
    expect(screen.getByRole('link', { name: 'Back to Login' }).getAttribute('href')).toBe('/login')
  })
})
