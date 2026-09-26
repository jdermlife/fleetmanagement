import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({ value: 'ios' }))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => platform.value,
    isNativePlatform: () => true,
  },
}))

const apiMocks = vi.hoisted(() => ({
  fetchCurrentUser: vi.fn(),
  getMySubscription: vi.fn(),
  listPublicSubscriptionPlans: vi.fn(),
}))

const nativeBillingMocks = vi.hoisted(() => ({
  loadNativeOneTimeProducts: vi.fn(),
  loadNativeStoreProducts: vi.fn(),
  manageNativeSubscriptions: vi.fn(),
  purchaseNativeOneTimeProduct: vi.fn(),
  purchaseNativeSubscription: vi.fn(),
  restoreNativeOneTimeProducts: vi.fn(),
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
    platform.value = 'ios'
    apiMocks.fetchCurrentUser.mockResolvedValue({ id: 42 })
    apiMocks.listPublicSubscriptionPlans.mockResolvedValue([plan])
    apiMocks.getMySubscription.mockResolvedValue(null)
    nativeBillingMocks.loadNativeStoreProducts.mockResolvedValue([{
      mapping: {
        id: 12,
        plan_id: 7,
        platform: 'IOS',
        product_id: 'com.quantech.filscore.multiple.monthly',
        base_plan_id: null,
        product_type: 'SUBS',
        entitlement_category: null,
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
    nativeBillingMocks.loadNativeOneTimeProducts.mockResolvedValue([])
    nativeBillingMocks.purchaseNativeOneTimeProduct.mockResolvedValue({ status: 'ACTIVE' })
    nativeBillingMocks.restoreNativeOneTimeProducts.mockResolvedValue([])
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

  it('shows Android subscriptions and four non-consumable one-time products', async () => {
    platform.value = 'android'
    nativeBillingMocks.loadNativeStoreProducts.mockResolvedValue([{
      mapping: {
        id: 20,
        plan_id: 7,
        platform: 'ANDROID',
        product_id: 'filscore_multiple_monthly',
        base_plan_id: 'monthly',
        product_type: 'SUBS',
        entitlement_category: null,
        is_active: true,
      },
      title: 'FILSCORE Monthly',
      description: 'All feature categories.',
      price: 99,
      priceString: '₱99.00',
      currencyCode: 'PHP',
      subscriptionPeriod: { numberOfUnits: 1, unit: 2, unitString: 'month' },
      introductoryPrice: null,
    }])
    const categories = ['REPORTS', 'STATEMENTS', 'CERTIFICATIONS', 'SCORES'] as const
    nativeBillingMocks.loadNativeOneTimeProducts.mockResolvedValue(categories.map((category, index) => ({
      mapping: {
        id: 30 + index,
        plan_id: null,
        platform: 'ANDROID',
        product_id: `filscore_${category.toLowerCase()}`,
        base_plan_id: null,
        product_type: 'INAPP',
        entitlement_category: category,
        is_active: true,
      },
      title: `${category[0]}${category.slice(1).toLowerCase()} Access`,
      description: `Permanent ${category.toLowerCase()} access.`,
      price: 49,
      priceString: '₱49.00',
      currencyCode: 'PHP',
      subscriptionPeriod: { numberOfUnits: 0, unit: 0, unitString: '' },
      introductoryPrice: null,
    })))

    const { default: SubscriptionPaymentPage } = await import(
      '../src/pages/subscriptions/SubscriptionPaymentPage'
    )
    render(
      <MemoryRouter initialEntries={['/subscription-payment?planId=7']}>
        <SubscriptionPaymentPage />
      </MemoryRouter>,
    )

    const oneTimeSection = await screen.findByRole('region', { name: 'App store one-time products' })
    expect(within(oneTimeSection).getAllByRole('button', { name: /^Buy / })).toHaveLength(4)
    expect(screen.queryByRole('heading', { name: 'Choose Payment Channel' })).toBeNull()

    fireEvent.click(within(oneTimeSection).getByRole('button', { name: 'Buy reports' }))
    await waitFor(() => expect(nativeBillingMocks.purchaseNativeOneTimeProduct).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Reports Access is now available.')).toBeTruthy()
  })

  it('shows and purchases an iOS Reports non-consumable product', async () => {
    nativeBillingMocks.loadNativeOneTimeProducts.mockResolvedValue([{
      mapping: {
        id: 40,
        plan_id: null,
        platform: 'IOS',
        product_id: 'com.quantech.filscore.reports',
        base_plan_id: null,
        product_type: 'INAPP',
        entitlement_category: 'REPORTS',
        is_active: true,
      },
      title: 'Reports Access',
      description: 'Permanent reports access.',
      price: 49,
      priceString: '₱49.00',
      currencyCode: 'PHP',
      subscriptionPeriod: { numberOfUnits: 0, unit: 0, unitString: '' },
      introductoryPrice: null,
    }])

    const { default: SubscriptionPaymentPage } = await import(
      '../src/pages/subscriptions/SubscriptionPaymentPage'
    )
    render(
      <MemoryRouter initialEntries={['/subscription-payment?planId=7']}>
        <SubscriptionPaymentPage />
      </MemoryRouter>,
    )

    const oneTimeSection = await screen.findByRole('region', { name: 'App store one-time products' })
    expect(within(oneTimeSection).getByRole('heading', { name: 'App Store One-Time Access' })).toBeTruthy()
    fireEvent.click(within(oneTimeSection).getByRole('button', { name: 'Buy reports' }))

    await waitFor(() => expect(nativeBillingMocks.purchaseNativeOneTimeProduct).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Reports Access is now available.')).toBeTruthy()
  })
})