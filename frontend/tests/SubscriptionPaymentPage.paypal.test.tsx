import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  capturePayPalOrder: vi.fn(),
  createPayPalOrder: vi.fn(),
  createSubscription: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
  createSubscriptionPayment: vi.fn(),
  listSubscriptionPlans: vi.fn(),
  listSubscriptions: vi.fn(),
}))

vi.mock('axios', () => ({
  default: {
    isAxiosError: () => false,
  },
}))

vi.mock('../src/api', () => ({
  ...apiMocks,
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}))

const plan = {
  id: 7,
  plan_code: 'PRO',
  plan_name: 'Professional',
  billing_cycle: 'MONTHLY',
  monthly_price: 100,
  yearly_price: 1200,
  minimum_monthly_fee: 100,
  currency: 'USD',
  support_level: 'STANDARD',
}

const subscription = {
  id: 99,
  subscription_no: 'SUB-PRO-99',
  user_id: 42,
  plan_id: 7,
  status: 'SUSPENDED',
  subscription_type: 'PAID',
}

const payment = {
  id: 501,
  payment_reference: 'PP-501',
  subscription_id: 99,
  provider_id: 3,
  invoice_no: 'SUB-PRO-99',
  amount: 100,
  currency: 'USD',
  payment_method: 'PayPal Capture',
  payment_status: 'SUCCESS',
  provider_transaction_id: 'ORDER-123',
  paid_at: '2026-07-17T00:00:00Z',
  created_at: '2026-07-17T00:00:00Z',
}

describe('SubscriptionPaymentPage PayPal Buttons', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PAYPAL_CLIENT_ID', 'test-client')
    apiMocks.listSubscriptionPlans.mockResolvedValue([plan])
    apiMocks.listSubscriptions.mockResolvedValue([])
    apiMocks.createSubscription.mockResolvedValue(subscription)
    apiMocks.createPayPalOrder.mockResolvedValue({
      order_id: 'ORDER-123',
      status: 'CREATED',
      approval_url: null,
      amount: 100,
      currency: 'USD',
      payment: { ...payment, payment_status: 'PENDING' },
    })
    apiMocks.capturePayPalOrder.mockResolvedValue({
      captured: true,
      order_id: 'ORDER-123',
      capture_id: 'CAPTURE-123',
      payment,
    })
  })

  afterEach(() => {
    cleanup()
    delete window.paypal
    document.getElementById('paypal-js-sdk')?.remove()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('creates and captures the exact approved order without a manual capture action', async () => {
    let buttonOptions: {
      createOrder: () => Promise<string>
      onApprove: (data: { orderID?: string | null }) => Promise<void>
    } | null = null
    const close = vi.fn()
    const buttons = vi.fn((options) => {
      buttonOptions = options
      return { render: vi.fn(), close }
    })
    window.paypal = { Buttons: buttons }

    const { default: SubscriptionPaymentPage } = await import(
      '../src/pages/subscriptions/SubscriptionPaymentPage'
    )
    const view = render(
      <MemoryRouter initialEntries={['/subscription-payment?planId=7']}>
        <SubscriptionPaymentPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(buttons).toHaveBeenCalledTimes(1))

    let orderId = ''
    await act(async () => {
      orderId = await buttonOptions!.createOrder()
    })

    expect(orderId).toBe('ORDER-123')
    expect(apiMocks.createSubscription).toHaveBeenCalledTimes(1)
    expect(apiMocks.createPayPalOrder).toHaveBeenNthCalledWith(1, {
      subscription_id: 99,
      invoice_no: 'SUB-PRO-99',
      request_id: expect.stringMatching(/^[A-Za-z0-9._-]{8,38}$/),
    })

    await act(async () => {
      await buttonOptions!.createOrder()
    })
    expect(apiMocks.createPayPalOrder.mock.calls[1][0].request_id).toBe(
      apiMocks.createPayPalOrder.mock.calls[0][0].request_id,
    )

    await act(async () => {
      await buttonOptions!.onApprove({ orderID: orderId })
    })

    expect(apiMocks.capturePayPalOrder).toHaveBeenCalledWith({
      order_id: 'ORDER-123',
      subscription_id: 99,
    })
    expect(await screen.findByText('PayPal payment captured successfully. Your subscription is now updated.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /capture paypal payment/i })).toBeNull()
    expect(buttons).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('rejects an approval callback for an order other than the one just created', async () => {
    let buttonOptions: {
      createOrder: () => Promise<string>
      onApprove: (data: { orderID?: string | null }) => Promise<void>
    } | null = null
    window.paypal = {
      Buttons: vi.fn((options) => {
        buttonOptions = options
        return { render: vi.fn() }
      }),
    }

    const { default: SubscriptionPaymentPage } = await import(
      '../src/pages/subscriptions/SubscriptionPaymentPage'
    )
    render(
      <MemoryRouter initialEntries={['/subscription-payment?planId=7']}>
        <SubscriptionPaymentPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(buttonOptions).not.toBeNull())
    await act(async () => {
      await buttonOptions!.createOrder()
    })

    await expect(buttonOptions!.onApprove({ orderID: 'ORDER-DIFFERENT' })).rejects.toThrow(
      'PayPal returned an unexpected order id',
    )
    expect(apiMocks.capturePayPalOrder).not.toHaveBeenCalled()
  })
})
