import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from '@capacitor/core'

const PENDING_PROMOTED_PRODUCT_KEY = 'fms:storekit:promoted-product'
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9._-]{1,255}$/

type PurchaseIntentEvent = {
  productIdentifier: string
}

interface PromotedPurchasesPlugin {
  addListener(
    eventName: 'purchaseIntentReceived',
    listener: (event: PurchaseIntentEvent) => void,
  ): Promise<PluginListenerHandle>
}

let promotedPurchasesPlugin: PromotedPurchasesPlugin | null = null

function getPromotedPurchasesPlugin(): PromotedPurchasesPlugin {
  if (!promotedPurchasesPlugin) {
    promotedPurchasesPlugin = registerPlugin<PromotedPurchasesPlugin>('PromotedPurchases')
  }
  return promotedPurchasesPlugin
}

export function normalizePromotedProductId(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return PRODUCT_ID_PATTERN.test(normalized) ? normalized : null
}

export function promotedPurchasePath(productId: string): string {
  const normalized = normalizePromotedProductId(productId)
  if (!normalized) {
    throw new Error('The App Store returned an invalid product identifier.')
  }
  return `/subscription-payment?promotedProductId=${encodeURIComponent(normalized)}`
}

export function savePendingPromotedProduct(productId: string): string | null {
  const normalized = normalizePromotedProductId(productId)
  if (!normalized) {
    return null
  }
  try {
    window.sessionStorage.setItem(PENDING_PROMOTED_PRODUCT_KEY, normalized)
  } catch {
    // The in-memory event still routes correctly when browser storage is unavailable.
  }
  return normalized
}

export function readPendingPromotedProduct(): string | null {
  try {
    return normalizePromotedProductId(
      window.sessionStorage.getItem(PENDING_PROMOTED_PRODUCT_KEY),
    )
  } catch {
    return null
  }
}

export function clearPendingPromotedProduct(): void {
  try {
    window.sessionStorage.removeItem(PENDING_PROMOTED_PRODUCT_KEY)
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
}

export async function listenForPromotedPurchases(
  listener: (productId: string) => void,
): Promise<PluginListenerHandle | null> {
  const platform = typeof Capacitor.getPlatform === 'function'
    ? Capacitor.getPlatform()
    : 'web'
  const isNativePlatform = typeof Capacitor.isNativePlatform === 'function'
    ? Capacitor.isNativePlatform()
    : platform === 'ios' || platform === 'android'
  if (!isNativePlatform || platform !== 'ios') {
    return null
  }

  return getPromotedPurchasesPlugin().addListener('purchaseIntentReceived', (event) => {
    const productId = savePendingPromotedProduct(event.productIdentifier)
    if (productId) {
      listener(productId)
    }
  })
}
