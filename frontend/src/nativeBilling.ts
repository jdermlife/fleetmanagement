import { Capacitor } from '@capacitor/core'
import {
  NativePurchases,
  PURCHASE_TYPE,
  type Product,
  type Transaction,
} from '@capgo/native-purchases'

import {
  listStoreProducts,
  verifyNativeStorePurchase,
  type NativeStorePlatform,
  type StoreProductMapping,
  type VerifiedStorePurchase,
} from './api'

export interface NativeStoreProduct {
  mapping: StoreProductMapping
  title: string
  description: string
  price: number
  priceString: string
  currencyCode: string
}

function currentStorePlatform(): NativeStorePlatform | null {
  const platform = Capacitor.getPlatform()
  if (!Capacitor.isNativePlatform() || (platform !== 'android' && platform !== 'ios')) {
    return null
  }
  return platform === 'android' ? 'ANDROID' : 'IOS'
}

function requireStorePlatform(): NativeStorePlatform {
  const platform = currentStorePlatform()
  if (!platform) {
    throw new Error('Native store billing is only available in the Android and iOS apps.')
  }
  return platform
}

function findProduct(mapping: StoreProductMapping, products: Product[]): Product | undefined {
  if (mapping.platform === 'ANDROID') {
    return products.find((product) => (
      product.planIdentifier === mapping.product_id &&
      (!mapping.base_plan_id || product.identifier === mapping.base_plan_id)
    ))
  }
  return products.find((product) => product.identifier === mapping.product_id)
}

function verificationData(platform: NativeStorePlatform, transaction: Transaction): string {
  const data = platform === 'ANDROID' ? transaction.purchaseToken : transaction.jwsRepresentation
  if (!data) {
    throw new Error('The app store did not return purchase verification data.')
  }
  return data
}

async function accountToken(userId: number): Promise<string> {
  const bytes = new TextEncoder().encode(`com.quantech.filscore:user:${userId}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)).slice(0, 16)
  digest[6] = (digest[6] & 0x0f) | 0x50
  digest[8] = (digest[8] & 0x3f) | 0x80
  const hex = Array.from(digest, (value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function acknowledge(platform: NativeStorePlatform, transaction: Transaction): Promise<void> {
  const token = platform === 'ANDROID' ? transaction.purchaseToken : transaction.transactionId
  if (token) {
    await NativePurchases.acknowledgePurchase({ purchaseToken: token })
  }
}

async function verifyTransaction(
  mapping: StoreProductMapping,
  transaction: Transaction,
  subscriptionId?: number,
): Promise<VerifiedStorePurchase> {
  if (transaction.productIdentifier !== mapping.product_id) {
    throw new Error('The app store returned an unexpected subscription product.')
  }
  const verified = await verifyNativeStorePurchase({
    platform: mapping.platform,
    product_id: mapping.product_id,
    verification_data: verificationData(mapping.platform, transaction),
    subscription_id: subscriptionId,
  })
  await acknowledge(mapping.platform, transaction)
  return verified
}

export function isNativeStoreBilling(): boolean {
  return currentStorePlatform() !== null
}

export async function loadNativeStoreProducts(): Promise<NativeStoreProduct[]> {
  const platform = requireStorePlatform()
  const { isBillingSupported } = await NativePurchases.isBillingSupported()
  if (!isBillingSupported) {
    throw new Error('App store billing is not available on this device.')
  }
  const mappings = await listStoreProducts(platform)
  if (mappings.length === 0) {
    return []
  }
  const { products } = await NativePurchases.getProducts({
    productIdentifiers: [...new Set(mappings.map((mapping) => mapping.product_id))],
    productType: PURCHASE_TYPE.SUBS,
  })
  return mappings.flatMap((mapping) => {
    const product = findProduct(mapping, products)
    return product ? [{
      mapping,
      title: product.title,
      description: product.description,
      price: product.price,
      priceString: product.priceString,
      currencyCode: product.currencyCode,
    }] : []
  })
}

export async function purchaseNativeSubscription(
  product: NativeStoreProduct,
  userId: number,
  subscriptionId?: number,
): Promise<VerifiedStorePurchase> {
  const platform = requireStorePlatform()
  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier: product.mapping.product_id,
    planIdentifier: platform === 'ANDROID' ? product.mapping.base_plan_id ?? undefined : undefined,
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken: await accountToken(userId),
    autoAcknowledgePurchases: false,
  })
  return verifyTransaction(product.mapping, transaction, subscriptionId)
}

export async function restoreNativeSubscriptions(
  products: NativeStoreProduct[],
  subscriptionId?: number,
): Promise<VerifiedStorePurchase[]> {
  requireStorePlatform()
  await NativePurchases.restorePurchases()
  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.SUBS,
    onlyCurrentEntitlements: true,
  })
  const restored: VerifiedStorePurchase[] = []
  for (const transaction of purchases) {
    const product = products.find((item) => item.mapping.product_id === transaction.productIdentifier)
    if (product) {
      restored.push(await verifyTransaction(product.mapping, transaction, subscriptionId))
    }
  }
  return restored
}

export async function manageNativeSubscriptions(): Promise<void> {
  requireStorePlatform()
  await NativePurchases.manageSubscriptions()
}