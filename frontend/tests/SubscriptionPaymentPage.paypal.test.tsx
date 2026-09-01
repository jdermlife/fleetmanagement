import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  capturePayPalOrder: vi.fn(),
  createPayPalOrder: vi.fn(),
  createPayPalSubscription: vi.fn(),
  createPayMongoSubscription: vi.fn(),
  createFreeSubscription: vi.fn(),
  createSubscription: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
  createSubscriptionPayment: vi.fn(),
  getMySubscription: vi.fn(),
  listPublicSubscriptionPlans: vi.fn(),
}))
const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('axios', () => ({
  default: {
    isAxiosError: () => false,
  },
}))

vi.mock('../src/api', () => ({
  ...apiMocks,
  getAuthToken: () => 'subscriber-access-token',
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
  currency: 'PHP',
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
  currency: 'PHP',
  payment_method: 'PayPal Capture',
  payment_status: 'SUCCESS',
  provider_transaction_id: 'ORDER-123',
  paid_at: '2026-07-17T00:00:00Z',
  created_at: '2026-07-17T00:00:00Z',
}

describe('SubscriptionPaymentPage PayPal Buttons', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    vi.stubEnv('VITE_PAYPAL_CLIENT_ID', 'test-client')
    apiMocks.listPublicSubscriptionPlans.mockResolvedValue([plan])
    apiMocks.getMySubscription.mockResolvedValue(null)
    apiMocks.createSubscription.mockResolvedValue(subscription)
    apiMocks.createPayPalOrder.mockResolvedValue({
      order_id: 'ORDER-123',
      status: 'CREATED',
      approval_url: null,
      amount: 100,
      currency: 'PHP',
      payment: { ...payment, payment_status: 'PENDING' },
    })
    apiMocks.createPayPalSubscription.mockResolvedValue({
      agreement_id: 'I-SUBSCRIPTION-123',
      status: 'APPROVAL_PENDING',
      approval_url: null,
      first_charge_at: '2026-07-19T00:00:00Z',
      subscription,
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

  it('creates and captures the exact one-time PayPal order', async () => {
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
    expect(mockNavigate).toHaveBeenCalledWith('/payment-success?provider=paypal', { replace: true })
    expect(buttons).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('rejects an approval callback for a different PayPal order', async () => {
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

  it('activates a zero-value free trial without invoking PayPal or PayMongo', async () => {
    const freePlan = {
      ...plan,
      id: 1,
      plan_code: 'FREE',
      plan_name: 'Free',
      monthly_price: 0,
      yearly_price: 0,
      minimum_monthly_fee: 0,
    }
    const paidPlan = {
      ...plan,
      id: 2,
      plan_code: 'SINGLE_PROFILE',
      plan_name: 'Subscriber Single Profile Plan',
    }
    apiMocks.listPublicSubscriptionPlans.mockResolvedValue([freePlan, paidPlan])
    apiMocks.createFreeSubscription.mockResolvedValue({
      ...subscription,
      id: 1,
      plan_id: 1,
      status: 'TRIAL',
      subscription_type: 'FREE',
    })
    const { default: SubscriptionPaymentPage } = await import(
      '../src/pages/subscriptions/SubscriptionPaymentPage'
    )
    render(
      <MemoryRouter initialEntries={['/subscription-payment?planId=1']}>
        <SubscriptionPaymentPage />
      </MemoryRouter>,
    )

    const startTrial = await screen.findByRole('button', { name: 'Start Free Trial' })
    expect(
      screen.getByRole('link', { name: 'Pay for Subscriber Single Profile Plan now' }).getAttribute('href'),
    ).toBe('/subscription-payment?planId=2')
    expect(screen.queryByRole('button', { name: 'Pay with PayMongo' })).toBeNull()
    expect(screen.queryByText('PayPal', { selector: 'h3' })).toBeNull()

    await act(async () => startTrial.click())

    expect(apiMocks.createFreeSubscription).toHaveBeenCalledTimes(1)
    expect(apiMocks.createSubscriptionCheckout).not.toHaveBeenCalled()
    expect(apiMocks.createPayPalOrder).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/financial-health-summary', { replace: true })
  })

  it('continues an active browser trial to financial health', async () => {
    const freePlan = {
      ...plan,
      id: 1,
      plan_code: 'FREE',
      plan_name: 'Free',
      monthly_price: 0,
      yearly_price: 0,
      minimum_monthly_fee: 0,
    }
    apiMocks.listPublicSubscriptionPlans.mockResolvedValue([freePlan])
    apiMocks.getMySubscription.mockResolvedValue({
      ...subscription,
      id: 1,
      plan_id: 1,
      status: 'TRIAL',
      subscription_type: 'FREE',
    })
    const { default: SubscriptionPaymentPage } = await import(
      '../src/pages/subscriptions/SubscriptionPaymentPage'
    )
    render(
      <MemoryRouter initialEntries={['/subscription-payment?planId=1']}>
        <SubscriptionPaymentPage />
      </MemoryRouter>,
    )

    const continueButton = await screen.findByRole('button', { name: 'Continue to Financial Health' })
    await act(async () => continueButton.click())

    expect(apiMocks.createFreeSubscription).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/financial-health-summary', { replace: true })
  })

  it('routes a successful PayMongo return to the payment success page', async () => {
    const { default: SubscriptionPaymentPage } = await import(
      '../src/pages/subscriptions/SubscriptionPaymentPage'
    )
    render(
      <MemoryRouter initialEntries={['/subscription-payment?checkout=success']}>
        <SubscriptionPaymentPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/payment-success?provider=paymongo', {
        replace: true,
      })
    })
  })
})
