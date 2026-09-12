import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  getMySubscription: vi.fn(),
  listPublicSubscriptionPlans: vi.fn(),
}))

const nativeBillingMocks = vi.hoisted(() => ({
  loadNativeStoreProducts: vi.fn(),
  manageNativeSubscriptions: vi.fn(),
  purchaseNativeSubscription: vi.fn(),
  restoreNativeSubscriptions: vi.fn(),
}))

vi.mock('../src/api', () => ({
  ...apiMocks,
  getAuthToken: () => 'subscriber-access-token',
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}))

vi.mock('../src/nativeBilling', () => ({
  ...nativeBillingMocks,
  isNativeStoreBilling: () => true,
}))

vi.mock('../src/paypalSdk', () => ({
  loadPayPalSdk: vi.fn(),
}))

const plan = {
  id: 7,
  plan_code: 'MULTIPLE_PROFILE',
  plan_name: 'Subscriber Multiple Profile Plan',
  billing_cycle: 'MONTHLY',
  monthly_price: 100,
  yearly_price: 1200,
  minimum_monthly_fee: 100,
  currency: 'PHP',
  support_level: 'STANDARD',
}

describe('SubscriptionPaymentPage native billing', () => {
  beforeEach(() => {
    apiMocks.listPublicSubscriptionPlans.mockResolvedValue([plan])
    apiMocks.getMySubscription.mockResolvedValue(null)
    nativeBillingMocks.loadNativeStoreProducts.mockResolvedValue([{
      mapping: {
        id: 12,
        plan_id: 7,
        platform: 'IOS',
        product_id: 'com.quantech.filscore.multiple.monthly',
        base_plan_id: null,
        is_active: true,
      },
      title: 'FILSCORE Multiple Profile',
      description: 'Monthly access for multiple profiles.',
      price: 99,
      priceString: '₱99.00',
      currencyCode: 'PHP',
      subscriptionPeriod: {
        numberOfUnits: 1,
        unit: 2,
        unitString: 'month',
      },
      introductoryPrice: {
        identifier: '',
        type: 0,
        price: 0,
        priceString: '₱0.00',
        currencySymbol: '₱',
        currencyCode: 'PHP',
        paymentMode: 0,
        numberOfPeriods: 1,
        subscriptionPeriod: {
          numberOfUnits: 1,
          unit: 2,
          unitString: 'month',
        },
      },
    }])
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows localized Apple renewal terms before Subscribe', async () => {
    const { default: SubscriptionPaymentPage } = await import(
      '../src/pages/subscriptions/SubscriptionPaymentPage'
    )
    render(
      <MemoryRouter initialEntries={['/subscription-payment?planId=7']}>
        <SubscriptionPaymentPage />
      </MemoryRouter>,
    )

    const terms = await screen.findByRole('region', { name: 'Apple subscription terms' })
    expect(within(terms).getByText('FILSCORE Multiple Profile')).toBeTruthy()
    expect(within(terms).getByText('one month')).toBeTruthy()
    expect(within(terms).getByText('₱99.00 per month')).toBeTruthy()
    expect(within(terms).getByText(/Introductory offer: free for one month.*Apple determines eligibility/i)).toBeTruthy()
    expect(within(terms).getByText(/automatically renews unless cancelled at least 24 hours/i)).toBeTruthy()
    expect(within(terms).getByText(/charged for renewal within 24 hours/i)).toBeTruthy()
    expect(within(terms).getByRole('link', { name: 'Terms of Use' }).getAttribute('href')).toBe('/terms')
    expect(within(terms).getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe('/privacy')

    const subscribe = screen.getByRole('button', { name: 'Subscribe' })
    expect(terms.compareDocumentPosition(subscribe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await waitFor(() => expect(nativeBillingMocks.loadNativeStoreProducts).toHaveBeenCalledTimes(1))
  })
})