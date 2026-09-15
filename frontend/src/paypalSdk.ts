export interface PayPalButtonsOptions {
  style?: Record<string, unknown>
  createOrder?: () => Promise<string>
  createSubscription?: () => Promise<string>
  onApprove: (data: { orderID?: string | null; subscriptionID?: string | null }) => Promise<void>
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
    paypalSubscription?: PayPalNamespace
  }
}

type PayPalSdkMode = 'order' | 'subscription'

const paypalSdkLoadCache: Partial<Record<PayPalSdkMode, {
  src: string
  promise: Promise<PayPalNamespace>
  cancel: () => void
}>> = {}

function sdkSettings(mode: PayPalSdkMode) {
  return mode === 'subscription'
    ? { scriptId: 'paypal-subscription-js-sdk', namespace: 'paypalSubscription' as const }
    : { scriptId: 'paypal-js-sdk', namespace: 'paypal' as const }
}

function buildPayPalSdkUrl(clientId: string, currency: string, mode: PayPalSdkMode): string {
  const params = new URLSearchParams({
    'client-id': clientId,
    components: 'buttons',
    intent: mode === 'subscription' ? 'subscription' : 'capture',
  })
  if (mode === 'subscription') {
    params.set('vault', 'true')
  } else {
    params.set('currency', currency.toUpperCase())
  }
  return `https://www.paypal.com/sdk/js?${params.toString()}`
}

export function loadPayPalSdk(
  clientId: string,
  currency: string,
  mode: PayPalSdkMode = 'order',
): Promise<PayPalNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('PayPal SDK can only load in a browser.'))
  }

  const normalizedClientId = clientId.trim()
  const normalizedCurrency = currency.trim().toUpperCase()
  if (!normalizedClientId || !normalizedCurrency) {
    return Promise.reject(new Error('PayPal client id and currency are required.'))
  }

  const sdkUrl = buildPayPalSdkUrl(normalizedClientId, normalizedCurrency, mode)
  const { scriptId, namespace } = sdkSettings(mode)
  const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null
  const existingScriptUrl = existingScript?.getAttribute('src') ?? ''
  const existingNamespace = window[namespace]

  if (existingNamespace?.Buttons && (!existingScript || existingScriptUrl === sdkUrl)) {
    return Promise.resolve(existingNamespace)
  }

  if (paypalSdkLoadCache[mode]?.src === sdkUrl) {
    return paypalSdkLoadCache[mode].promise
  }

  if (paypalSdkLoadCache[mode]) {
    paypalSdkLoadCache[mode].cancel()
    delete paypalSdkLoadCache[mode]
  }

  if (existingScript) {
    existingScript.remove()
  }
  delete window[namespace]

  let rejectLoad: (reason?: unknown) => void = () => undefined
  const promise = new Promise<PayPalNamespace>((resolve, reject) => {
    rejectLoad = reject
    const script = document.createElement('script')
    script.id = scriptId
    script.async = true
    script.src = sdkUrl
    script.crossOrigin = 'anonymous'
    if (mode === 'subscription') {
      script.dataset.namespace = namespace
    }
    script.onload = () => {
      const loadedNamespace = window[namespace]
      if (!loadedNamespace?.Buttons) {
        reject(new Error('PayPal JavaScript SDK loaded without the Buttons component.'))
        return
      }
      resolve(loadedNamespace)
    }
    script.onerror = () => reject(new Error('Unable to load the PayPal JavaScript SDK.'))
    document.body.appendChild(script)
  })

  paypalSdkLoadCache[mode] = {
    src: sdkUrl,
    promise,
    cancel: () => rejectLoad(new Error('PayPal SDK load was superseded by new options.')),
  }

  return promise.catch((error) => {
    if (paypalSdkLoadCache[mode]?.src === sdkUrl) {
      delete paypalSdkLoadCache[mode]
    }
    throw error
  })
}
