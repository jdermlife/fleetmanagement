import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeMocks = vi.hoisted(() => ({
  acknowledgePurchase: vi.fn(),
  getProducts: vi.fn(),
  getPurchases: vi.fn(),
  isBillingSupported: vi.fn(),
  purchaseProduct: vi.fn(),
  restorePurchases: vi.fn(),
}))
const apiMocks = vi.hoisted(() => ({
  listStoreProducts: vi.fn(),
  verifyNativeStorePurchase: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android',
    isNativePlatform: () => true,
  },
}))

vi.mock('@capgo/native-purchases', () => ({
  NativePurchases: nativeMocks,
  PURCHASE_TYPE: { INAPP: 'inapp', SUBS: 'subs' },
}))

vi.mock('../src/api', () => apiMocks)

import {
  loadAndroidOneTimeProducts,
  purchaseAndroidOneTimeProduct,
  restoreAndroidOneTimeProducts,
} from '../src/nativeBilling'

const mapping = {
  id: 1,
  plan_id: null,
  platform: 'ANDROID' as const,
  product_id: 'filscore_reports',
  base_plan_id: null,
  product_type: 'INAPP' as const,
  entitlement_category: 'REPORTS' as const,
  is_active: true,
}
const product = {
  identifier: 'filscore_reports',
  title: 'Reports Access',
  description: 'Permanent reports access.',
  price: 49,
  priceString: '₱49.00',
  currencyCode: 'PHP',
  subscriptionPeriod: { numberOfUnits: 0, unit: 0, unitString: '' },
  introductoryPrice: null,
}
const transaction = {
  productIdentifier: 'filscore_reports',
  transactionId: 'GPA.1234',
  purchaseToken: 'android-purchase-token',
}

describe('Android native one-time billing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nativeMocks.isBillingSupported.mockResolvedValue({ isBillingSupported: true })
    nativeMocks.getProducts.mockResolvedValue({ products: [product] })
    nativeMocks.purchaseProduct.mockResolvedValue(transaction)
    nativeMocks.getPurchases.mockResolvedValue({ purchases: [transaction] })
    nativeMocks.restorePurchases.mockResolvedValue(undefined)
    nativeMocks.acknowledgePurchase.mockResolvedValue(undefined)
    apiMocks.listStoreProducts.mockResolvedValue([mapping])
    apiMocks.verifyNativeStorePurchase.mockResolvedValue({ status: 'ACTIVE' })
  })

  it('loads and purchases a durable INAPP product before acknowledging it', async () => {
    const products = await loadAndroidOneTimeProducts()
    expect(nativeMocks.getProducts).toHaveBeenCalledWith({
      productIdentifiers: ['filscore_reports'],
      productType: 'inapp',
    })

    await purchaseAndroidOneTimeProduct(products[0], 42)

    expect(nativeMocks.purchaseProduct).toHaveBeenCalledWith(expect.objectContaining({
      productIdentifier: 'filscore_reports',
      productType: 'inapp',
      isConsumable: false,
      autoAcknowledgePurchases: false,
    }))
    expect(apiMocks.verifyNativeStorePurchase).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'ANDROID',
      product_id: 'filscore_reports',
      verification_data: 'android-purchase-token',
    }))
    expect(apiMocks.verifyNativeStorePurchase.mock.invocationCallOrder[0])
      .toBeLessThan(nativeMocks.acknowledgePurchase.mock.invocationCallOrder[0])
  })

  it('restores only Android INAPP purchases for the signed-in account', async () => {
    const products = await loadAndroidOneTimeProducts()
    const restored = await restoreAndroidOneTimeProducts(products, 42)

    expect(nativeMocks.getPurchases).toHaveBeenCalledWith(expect.objectContaining({
      productType: 'inapp',
      appAccountToken: expect.any(String),
    }))
    expect(restored).toHaveLength(1)
    expect(nativeMocks.acknowledgePurchase).toHaveBeenCalledWith({
      purchaseToken: 'android-purchase-token',
    })
  })
})
