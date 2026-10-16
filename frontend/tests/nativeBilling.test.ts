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
const platform = vi.hoisted(() => ({ value: 'android' }))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => platform.value,
    isNativePlatform: () => true,
  },
}))

vi.mock('@capgo/native-purchases', () => ({
  NativePurchases: nativeMocks,
  PURCHASE_TYPE: { INAPP: 'inapp', SUBS: 'subs' },
}))

vi.mock('../src/api', () => apiMocks)

import {
  isNativeStoreBilling,
  loadNativeOneTimeProducts,
  purchaseNativeOneTimeProduct,
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

describe('Native one-time billing', () => {
  beforeEach(() => {
    platform.value = 'android'
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

  it('disables native store billing on Android', async () => {
    expect(isNativeStoreBilling()).toBe(false)
    await expect(loadNativeOneTimeProducts()).rejects.toThrow('Native store billing is only available')
    expect(nativeMocks.isBillingSupported).not.toHaveBeenCalled()
  })

  it('verifies an iOS non-consumable JWS before acknowledging the transaction', async () => {
    platform.value = 'ios'
    apiMocks.listStoreProducts.mockResolvedValue([{
      ...mapping,
      platform: 'IOS',
      product_id: 'com.quantech.filscore.reports',
    }])
    nativeMocks.getProducts.mockResolvedValue({ products: [{
      ...product,
      identifier: 'com.quantech.filscore.reports',
    }] })
    nativeMocks.purchaseProduct.mockResolvedValue({
      productIdentifier: 'com.quantech.filscore.reports',
      transactionId: '2000000123456789',
      jwsRepresentation: 'signed-storekit-transaction',
    })

    const products = await loadNativeOneTimeProducts()
    await purchaseNativeOneTimeProduct(products[0], 42)

    expect(apiMocks.verifyNativeStorePurchase).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'IOS',
      product_id: 'com.quantech.filscore.reports',
      verification_data: 'signed-storekit-transaction',
    }))
    expect(apiMocks.verifyNativeStorePurchase.mock.invocationCallOrder[0])
      .toBeLessThan(nativeMocks.acknowledgePurchase.mock.invocationCallOrder[0])
    expect(nativeMocks.acknowledgePurchase).toHaveBeenCalledWith({
      purchaseToken: '2000000123456789',
    })
  })
})
