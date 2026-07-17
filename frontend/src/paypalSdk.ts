export interface PayPalButtonsOptions {
  style?: Record<string, unknown>
  createOrder: () => Promise<string>
  onApprove: (data: { orderID?: string | null }) => Promise<void>
  onCancel?: () => void
  onError?: (error: unknown) => void
}

export interface PayPalButtonsInstance {
  render: (target: HTMLElement) => Promise<void> | void
  close?: () => Promise<void> | void
}

export interface PayPalNamespace {
  Buttons: (options: PayPalButtonsOptions) => PayPalButtonsInstance
}

declare global {
  interface Window {
    paypal?: PayPalNamespace
  }
}

const PAYPAL_SDK_SCRIPT_ID = 'paypal-js-sdk'

let paypalSdkLoadCache: {
  src: string
  promise: Promise<PayPalNamespace>
  cancel: () => void
} | null = null

function buildPayPalSdkUrl(clientId: string, currency: string): string {
  const params = new URLSearchParams({
    'client-id': clientId,
    components: 'buttons',
    currency: currency.toUpperCase(),
    intent: 'capture',
  })
  return `https://www.paypal.com/sdk/js?${params.toString()}`
}

export function loadPayPalSdk(clientId: string, currency: string): Promise<PayPalNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('PayPal SDK can only load in a browser.'))
  }

  const normalizedClientId = clientId.trim()
  const normalizedCurrency = currency.trim().toUpperCase()
  if (!normalizedClientId || !normalizedCurrency) {
    return Promise.reject(new Error('PayPal client id and currency are required.'))
  }

  const sdkUrl = buildPayPalSdkUrl(normalizedClientId, normalizedCurrency)
  const existingScript = document.getElementById(PAYPAL_SDK_SCRIPT_ID) as HTMLScriptElement | null
  const existingScriptUrl = existingScript?.getAttribute('src') ?? ''

  if (window.paypal?.Buttons && (!existingScript || existingScriptUrl === sdkUrl)) {
    return Promise.resolve(window.paypal)
  }

  if (paypalSdkLoadCache?.src === sdkUrl) {
    return paypalSdkLoadCache.promise
  }

  if (paypalSdkLoadCache) {
    paypalSdkLoadCache.cancel()
    paypalSdkLoadCache = null
  }

  if (existingScript) {
    existingScript.remove()
  }
  delete window.paypal

  let rejectLoad: (reason?: unknown) => void = () => undefined
  const promise = new Promise<PayPalNamespace>((resolve, reject) => {
    rejectLoad = reject
    const script = document.createElement('script')
    script.id = PAYPAL_SDK_SCRIPT_ID
    script.async = true
    script.src = sdkUrl
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      if (!window.paypal?.Buttons) {
        reject(new Error('PayPal JavaScript SDK loaded without the Buttons component.'))
        return
      }
      resolve(window.paypal)
    }
    script.onerror = () => reject(new Error('Unable to load the PayPal JavaScript SDK.'))
    document.body.appendChild(script)
  })

  paypalSdkLoadCache = {
    src: sdkUrl,
    promise,
    cancel: () => rejectLoad(new Error('PayPal SDK load was superseded by new options.')),
  }

  return promise.catch((error) => {
    if (paypalSdkLoadCache?.src === sdkUrl) {
      paypalSdkLoadCache = null
    }
    throw error
  })
}
