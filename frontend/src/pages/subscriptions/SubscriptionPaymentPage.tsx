import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  capturePayPalOrder,
  createPayPalOrder,
  createSubscriptionCheckout,
  createSubscription,
  createSubscriptionPayment,
  getErrorMessage,
  listSubscriptionPlans,
  listSubscriptions,
  type SubscriptionPlan,
  type SubscriptionRecord,
} from '../../api'

function billingAmount(plan: SubscriptionPlan): number {
  const monthlyPrice = plan.monthly_price && plan.monthly_price > 0 ? plan.monthly_price : 0
  const yearlyPrice = plan.yearly_price && plan.yearly_price > 0 ? plan.yearly_price : 0
  const minimumFee = plan.minimum_monthly_fee && plan.minimum_monthly_fee > 0
    ? plan.minimum_monthly_fee
    : 0

  if (plan.billing_cycle === 'YEARLY') {
    return yearlyPrice || monthlyPrice * 12 || minimumFee
  }
  if (plan.billing_cycle === 'QUARTERLY') {
    return monthlyPrice * 3 || minimumFee
  }
  return monthlyPrice || minimumFee
}

type PaymentChannel = 'Bank Transfer' | 'GCash' | 'Maya' | 'Manual Invoice' | 'Over-the-Counter'

const DEFAULT_PAYMENT_CHANNEL = (import.meta.env.VITE_PAYMENT_DEFAULT_CHANNEL || 'Bank Transfer') as PaymentChannel

const PAYMENT_CHANNEL_DETAILS: Record<PaymentChannel, { title: string; summary: string; referenceHint: string; detailLines: string[] }> = {
  'Bank Transfer': {
    title: 'Bank Transfer',
    summary: 'Send the amount due to the bank account below and keep the transfer reference.',
    referenceHint: 'Bank transfer reference or deposit slip number',
    detailLines: [
      `Bank: ${import.meta.env.VITE_PAYMENT_BANK_NAME || 'Replace with bank name'}`,
      `Account Name: ${import.meta.env.VITE_PAYMENT_BANK_ACCOUNT_NAME || 'Replace with legal business name'}`,
      `Account No.: ${import.meta.env.VITE_PAYMENT_BANK_ACCOUNT_NO || 'Replace with bank account number'}`,
    ],
  },
  GCash: {
    title: 'GCash',
    summary: 'Pay to the GCash number below and save the transaction ID for submission.',
    referenceHint: 'GCash reference number or transaction ID',
    detailLines: [
      `GCash No.: ${import.meta.env.VITE_PAYMENT_GCASH_NUMBER || 'Replace with GCash number'}`,
      `Account Name: ${import.meta.env.VITE_PAYMENT_GCASH_NAME || 'Replace with wallet account name'}`,
    ],
  },
  Maya: {
    title: 'Maya',
    summary: 'Pay to the Maya wallet below and keep the transfer reference for confirmation.',
    referenceHint: 'Maya reference number or transaction ID',
    detailLines: [
      `Maya No.: ${import.meta.env.VITE_PAYMENT_MAYA_NUMBER || 'Replace with Maya number'}`,
      `Account Name: ${import.meta.env.VITE_PAYMENT_MAYA_NAME || 'Replace with wallet account name'}`,
    ],
  },
  'Manual Invoice': {
    title: 'Manual Invoice',
    summary: 'Use the invoice number issued by your team and submit the billing reference below.',
    referenceHint: 'Invoice number or billing reference',
    detailLines: [
      `Billing Contact: ${import.meta.env.VITE_PAYMENT_SUPPORT_EMAIL || 'Replace with support email'}`,
    ],
  },
  'Over-the-Counter': {
    title: 'Over-the-Counter',
    summary: 'Use the official receipt number from the counter or remittance center.',
    referenceHint: 'Official receipt number',
    detailLines: [
      `Support Email: ${import.meta.env.VITE_PAYMENT_SUPPORT_EMAIL || 'Replace with support email'}`,
    ],
  },
}

function buildPendingSubscriptionNumber(plan: SubscriptionPlan): string {
  return `SUB-${plan.plan_code}-${Date.now().toString(36).toUpperCase()}`.slice(0, 50)
}

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID?.trim() || (import.meta.env.DEV ? 'sb' : '')
const PAYPAL_SDK_SCRIPT_ID = 'paypal-js-sdk'

let paypalSdkLoadCache: { src: string; promise: Promise<void> } | null = null

function loadPayPalSdk(clientId: string, currency: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('PayPal SDK can only load in a browser.'))
  }

  const sdkUrl = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`
  const existingWindow = window as Window & { paypal?: { Buttons?: unknown } }

  if (existingWindow.paypal?.Buttons) {
    return Promise.resolve()
  }

  if (paypalSdkLoadCache?.src === sdkUrl) {
    return paypalSdkLoadCache.promise
  }

  const existingScript = document.getElementById(PAYPAL_SDK_SCRIPT_ID) as HTMLScriptElement | null
  if (existingScript && existingScript.src !== sdkUrl) {
    existingScript.remove()
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = PAYPAL_SDK_SCRIPT_ID
    script.async = true
    script.src = sdkUrl
    script.crossOrigin = 'anonymous'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Unable to load the PayPal JavaScript SDK.'))
    document.body.appendChild(script)
  })

  paypalSdkLoadCache = { src: sdkUrl, promise }

  return promise.finally(() => {
    if (paypalSdkLoadCache?.src === sdkUrl) {
      paypalSdkLoadCache = null
    }
  })
}

function formatPayPalGatewayError(message: string, action: 'create' | 'capture'): string {
  const normalized = message.trim().toUpperCase()

  if (normalized.includes('ORDER_NOT_APPROVED')) {
    return 'PayPal approval is not completed yet. Finish approval in PayPal, then click Capture PayPal Payment again.'
  }

  if (normalized.includes('INSTRUMENT_DECLINED')) {
    return 'PayPal declined the selected payment method. Choose another card or funding source in PayPal and try again.'
  }

  if (normalized.includes('PAYER_ACTION_REQUIRED')) {
    return 'PayPal requires additional payer action. Re-open PayPal checkout and complete the requested verification steps.'
  }

  if (normalized.includes('PAYMENT_DENIED')) {
    return 'PayPal denied the payment. Verify the payer account status and funding source, then retry.'
  }

  if (normalized.includes('DUPLICATE_INVOICE_ID')) {
    return 'This invoice reference was already used in PayPal. Use a new invoice reference and start checkout again.'
  }

  if (normalized.includes('UNPROCESSABLE_ENTITY')) {
    return 'PayPal could not process this request. Start a new PayPal checkout and try again.'
  }

  if (normalized.includes('INVALID_RESOURCE_ID')) {
    return 'The PayPal order reference is no longer valid. Start a new PayPal checkout and try again.'
  }

  if (action === 'capture' && normalized.includes('RESOURCE_NOT_FOUND')) {
    return 'PayPal order was not found for capture. Start a new PayPal checkout to continue.'
  }

  return message
}

export default function SubscriptionPaymentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [loadMessage, setLoadMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)
  const [paymentReference, setPaymentReference] = useState('')
  const paymentMethod = DEFAULT_PAYMENT_CHANNEL
  const [invoiceNo, setInvoiceNo] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const paypalButtonContainerRef = useRef<HTMLDivElement | null>(null)

  const selectedPlanId = Number(searchParams.get('planId') ?? 0)
  const selectedSubscriptionId = Number(searchParams.get('subscriptionId') ?? 0)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [planRows, subscriptionRows] = await Promise.all([
          listSubscriptionPlans(),
          listSubscriptions(),
        ])
        setPlans(planRows)
        setSubscriptions(subscriptionRows)
      } catch (error) {
        setLoadMessage(getErrorMessage(error, 'Unable to load subscription payment details.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [])

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  )

  const selectedSubscription = useMemo(() => {
    if (selectedSubscriptionId > 0) {
      return subscriptions.find((subscription) => subscription.id === selectedSubscriptionId) ?? null
    }

    return subscriptions.find((subscription) => subscription.status === 'ACTIVE') ?? subscriptions[0] ?? null
  }, [selectedSubscriptionId, subscriptions])

  const matchedPlanSubscription = useMemo(() => {
    if (selectedPlanId <= 0) {
      return null
    }

    return (
      subscriptions.find(
        (subscription) =>
          subscription.plan_id === selectedPlanId &&
          subscription.status !== 'CANCELLED' &&
          subscription.status !== 'EXPIRED',
      ) ?? null
    )
  }, [selectedPlanId, subscriptions])

  const paymentSubscription = selectedPlan ? matchedPlanSubscription : selectedSubscription

  const selectedSubscriptionPlan = useMemo(
    () => plans.find((plan) => plan.id === paymentSubscription?.plan_id) ?? selectedPlan,
    [plans, paymentSubscription?.plan_id, selectedPlan],
  )

  const paymentChannel = useMemo(
    () => PAYMENT_CHANNEL_DETAILS[paymentMethod as PaymentChannel] ?? PAYMENT_CHANNEL_DETAILS['Bank Transfer'],
    [paymentMethod],
  )

  const paypalCurrency = useMemo(
    () => (selectedSubscriptionPlan?.currency ?? selectedPlan?.currency ?? 'PHP').toUpperCase(),
    [selectedSubscriptionPlan?.currency, selectedPlan?.currency],
  )

  const dueAmount = useMemo(() => {
    const activePlan = selectedSubscriptionPlan ?? selectedPlan
    if (!activePlan) {
      return 0
    }

    return billingAmount(activePlan)
  }, [selectedPlan, selectedSubscriptionPlan])

  useEffect(() => {
    if (!paymentAmount && dueAmount > 0) {
      setPaymentAmount(dueAmount.toFixed(2))
    }
  }, [dueAmount, paymentAmount])

  useEffect(() => {
    const container = paypalButtonContainerRef.current
    if (!container) {
      return
    }

    container.innerHTML = ''

    if (!PAYPAL_CLIENT_ID) {
      setPaymentMessage('PayPal Buttons are unavailable because VITE_PAYPAL_CLIENT_ID is not configured.')
      return
    }

    let cancelled = false

    const renderPayPalButtons = async () => {
      try {
        await loadPayPalSdk(PAYPAL_CLIENT_ID, paypalCurrency)

        if (cancelled || !paypalButtonContainerRef.current) {
          return
        }

        const paypalWindow = window as Window & {
          paypal?: {
            Buttons?: (options: {
              style?: Record<string, unknown>
              createOrder: () => Promise<string>
              onApprove: (data: { orderID?: string | null }) => Promise<void>
              onCancel?: () => void
              onError?: (error: unknown) => void
            }) => {
              render: (target: HTMLElement) => Promise<void> | void
            }
          }
        }

        if (!paypalWindow.paypal?.Buttons) {
          setPaymentMessage('PayPal Buttons are unavailable right now. Please try again later.')
          return
        }

        const buttons = paypalWindow.paypal.Buttons({
          style: {
            layout: 'vertical',
            shape: 'rect',
            color: 'gold',
            label: 'paypal',
            tagline: false,
          },
          createOrder: async () => {
            setPaymentMessage('')

            const subscriptionForPayment = await ensureSubscriptionForPayment()
            if (!subscriptionForPayment) {
              throw new Error('Please select a valid subscription plan before starting PayPal checkout.')
            }

            const order = await createPayPalOrder({
              subscription_id: subscriptionForPayment.id,
              invoice_no: invoiceNo.trim() || subscriptionForPayment.subscription_no,
            })

            return order.order_id
          },
          onApprove: async (data) => {
            const orderId = data.orderID?.trim() ?? ''
            if (!orderId) {
              throw new Error('PayPal did not return an order id.')
            }

            const captureResult = await capturePayPalOrder({
              order_id: orderId,
              subscription_id: paymentSubscription?.id ?? undefined,
            })

            if (captureResult.already_processed) {
              setPaymentMessage('PayPal payment was already processed and remains successful.')
            } else {
              setPaymentMessage('PayPal payment captured successfully. Your subscription is now updated.')
            }

            const subscriptionRows = await listSubscriptions()
            setSubscriptions(subscriptionRows)
          },
          onCancel: () => {
            setPaymentMessage('PayPal checkout was cancelled. You can start again anytime.')
          },
          onError: (error) => {
            const fallback = error instanceof Error ? error.message : 'Unable to process PayPal checkout right now.'
            setPaymentMessage(formatPayPalGatewayError(fallback, 'capture'))
          },
        })

        await Promise.resolve(buttons.render(container))
      } catch (error) {
        if (cancelled) {
          return
        }

        const fallback = getErrorMessage(error, 'Unable to load PayPal Buttons right now.')
        setPaymentMessage(formatPayPalGatewayError(fallback, 'create'))
      }
    }

    void renderPayPalButtons()

    return () => {
      cancelled = true
      container.innerHTML = ''
    }
  }, [invoiceNo, paypalCurrency, paymentSubscription?.id, selectedPlan?.id])

  const ensureSubscriptionForPayment = async (): Promise<SubscriptionRecord | null> => {
    if (paymentSubscription) {
      return paymentSubscription
    }

    if (!selectedPlan) {
      return null
    }

    const createdSubscription = await createSubscription({
      subscription_no: buildPendingSubscriptionNumber(selectedPlan),
      plan_id: selectedPlan.id,
      status: 'SUSPENDED',
      subscription_type: 'PAID',
      subscription_start: new Date().toISOString().slice(0, 10),
    })

    setSubscriptions((prev) => [createdSubscription, ...prev])
    return createdSubscription
  }

  const handleSubmitPayment = async () => {
    if (!paymentReference.trim()) {
      setPaymentMessage('Enter a payment reference before submitting.')
      return
    }

    setIsSubmitting(true)
    setPaymentMessage('')

    try {
      const subscriptionForPayment = await ensureSubscriptionForPayment()
      if (!subscriptionForPayment) {
        setPaymentMessage('Please select a valid subscription plan before submitting payment.')
        return
      }

      await createSubscriptionPayment({
        payment_reference: paymentReference.trim(),
        subscription_id: subscriptionForPayment.id,
        invoice_no: invoiceNo.trim() || subscriptionForPayment.subscription_no,
        amount: Number(paymentAmount) || dueAmount,
        currency: selectedSubscriptionPlan?.currency ?? selectedPlan?.currency ?? 'PHP',
        payment_method: paymentMethod,
        payment_status: 'PENDING',
      })

      navigate(`/subscription/payment?subscriptionId=${subscriptionForPayment.id}`, { replace: true })
      setPaymentMessage(
        'Payment submitted. Your subscription is awaiting confirmation and will activate once the payment is verified.',
      )
      setPaymentReference('')
      setInvoiceNo('')
    } catch (error) {
      setPaymentMessage(getErrorMessage(error, 'Unable to submit payment right now.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStartCheckout = async () => {
    setIsStartingCheckout(true)
    setPaymentMessage('')

    try {
      const checkoutPlan = selectedSubscriptionPlan ?? selectedPlan
      if (!checkoutPlan) {
        setPaymentMessage('Please select a valid subscription plan before starting checkout.')
        return
      }

      const checkout = await createSubscriptionCheckout({
        plan: checkoutPlan.plan_code,
        billing_cycle: checkoutPlan.billing_cycle,
      })
      window.location.href = checkout.checkout_url
    } catch (error) {
      setPaymentMessage(getErrorMessage(error, 'Unable to start secure checkout right now.'))
    } finally {
      setIsStartingCheckout(false)
    }
  }

  const handleCopyChannelDetails = async () => {
    const textToCopy = [paymentChannel.title, paymentChannel.summary, ...paymentChannel.detailLines].join('\n')

    try {
      await navigator.clipboard.writeText(textToCopy)
      setPaymentMessage('Payment channel details copied to clipboard.')
    } catch {
      setPaymentMessage('Unable to copy details automatically. Please select and copy the instructions manually.')
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.18),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#fff7e6_100%)] px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <div className="border-b border-amber-200 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-700 px-6 py-7 text-white md:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
                  Subscription Billing
                </p>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    Subscription Payment
                  </h1>
                  <p className="mt-2 text-sm text-slate-200 md:text-base">
                    Pay with PayMongo, PayPal, or a manual channel. Every path resolves into the same subscription ledger.
                  </p>
                </div>
              </div>

              <div className="grid gap-2 text-sm text-slate-100 sm:grid-cols-2 lg:grid-cols-1 lg:text-right">
                <div className="rounded-2xl border border-amber-200/20 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Amount Due</div>
                  <div className="mt-1 text-lg font-semibold">
                    {(selectedSubscriptionPlan?.currency ?? selectedPlan?.currency ?? 'PHP')} {dueAmount.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-200/20 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Billing Cycle</div>
                  <div className="mt-1 text-lg font-semibold">
                    {(selectedSubscriptionPlan?.billing_cycle ?? selectedPlan?.billing_cycle ?? 'MONTHLY').toLowerCase()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loadMessage ? (
            <div className="border-b border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700 md:px-8">
              {loadMessage}
            </div>
          ) : null}

          {paymentMessage ? (
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-700 md:px-8">
              {paymentMessage}
            </div>
          ) : null}

          {isLoading ? (
            <div className="px-6 py-10 text-sm text-slate-600 md:px-8">Loading payment details...</div>
          ) : null}

          {!isLoading && (selectedSubscription || selectedPlan) ? (
            <div className="grid gap-6 px-6 py-6 md:px-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] xl:items-start">
              <div className="space-y-5">
                <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Current Selection</p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                        {selectedSubscriptionPlan?.plan_name ?? selectedPlan?.plan_name ?? 'Subscription'}
                      </h2>
                    </div>
                    <div className="rounded-full border border-amber-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                      {paymentSubscription ? paymentSubscription.subscription_no : selectedPlan?.plan_code ?? 'Pending'}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-amber-100 bg-white p-4">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Support Level</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {selectedSubscriptionPlan?.support_level ?? selectedPlan?.support_level ?? 'N/A'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-white p-4">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Payment Path</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">Hosted, PayPal, or manual</div>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-white p-4">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Status</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">Ready for payment</div>
                    </div>
                  </div>

                  {!paymentSubscription && selectedPlan ? (
                    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                      A pending subscription for <strong>{selectedPlan.plan_name}</strong> will be created automatically when you submit payment.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
                        Secure Online Checkout
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Pay by an available card or e-wallet on PayMongo&apos;s hosted checkout page.
                      </p>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={() => void handleStartCheckout()}
                      disabled={isStartingCheckout || (!paymentSubscription && !selectedPlan)}
                      className="min-h-[48px] rounded-full border border-slate-950 bg-slate-950 px-6 text-sm font-semibold tracking-wide text-white shadow-[0_10px_18px_rgba(15,23,42,0.12)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isStartingCheckout ? 'Starting secure checkout...' : 'Pay Now with PayMongo'}
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    Available methods depend on the payment methods enabled for your PayMongo merchant account.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
                        PayPal Checkout
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Use the official PayPal button to approve and complete payment in PayPal.
                      </p>
                    </div>
                  </div>
                  {PAYPAL_CLIENT_ID ? (
                    <div
                      ref={paypalButtonContainerRef}
                      className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-inner"
                      style={{ minHeight: '56px' }}
                    />
                  ) : (
                    <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      PayPal Buttons are unavailable because VITE_PAYPAL_CLIENT_ID is not configured.
                    </p>
                  )}
                  <p className="mt-3 text-sm text-slate-500">
                    Secure approval and capture are handled through the official PayPal SDK.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">
                        Manual Payment Instructions
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Use the configured channel below, keep the reference or receipt number, then submit it for confirmation.
                      </p>
                    </div>
                    <button type="button" onClick={() => void handleCopyChannelDetails()} className="rounded-full border border-amber-700 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-800 shadow-sm transition hover:bg-amber-50">
                      Copy details
                    </button>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <h5 className="text-sm font-semibold text-slate-800">{paymentChannel.title}</h5>
                    <p className="mt-1 text-sm text-slate-600">{paymentChannel.summary}</p>
                    <ul className="mt-3 space-y-1 text-sm text-slate-700">
                      {paymentChannel.detailLines.map((line) => (
                        <li key={line}>• {line}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
                        Submit Manual Payment Details
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Submit references only after the payment has been sent.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Subscription
                      </span>
                      <select
                        value={paymentSubscription?.id ?? ''}
                        onChange={(event) => {
                          const subscriptionId = Number(event.target.value)
                          const nextSubscription = subscriptions.find((item) => item.id === subscriptionId) ?? null
                          if (nextSubscription) {
                            navigate(`/subscription-payment?subscriptionId=${nextSubscription.id}`)
                          }
                        }}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      >
                        {!paymentSubscription && selectedPlan ? <option value="">Create a new subscription for this plan</option> : null}
                        {subscriptions.length === 0 ? <option value="">No subscriptions available</option> : null}
                        {subscriptions.map((subscription) => (
                          <option key={subscription.id} value={subscription.id}>
                            {subscription.subscription_no} - {subscription.status}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Payment Method
                      </span>
                      <input value={paymentMethod} readOnly className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm" />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Amount Paid
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Payment Reference / Transaction ID
                      </span>
                      <input
                        value={paymentReference}
                        onChange={(event) => setPaymentReference(event.target.value)}
                        placeholder={paymentChannel.referenceHint}
                        required
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 md:col-span-2"
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Invoice No. / Billing Reference
                      </span>
                      <input
                        value={invoiceNo}
                        onChange={(event) => setInvoiceNo(event.target.value)}
                        placeholder={paymentSubscription?.subscription_no ?? 'Enter invoice reference'}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      />
                    </label>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      Submitted payments stay <strong className="text-slate-700">PENDING</strong> until verified or confirmed.
                    </p>
                    <div className="form-actions">
                      <button
                        type="button"
                        onClick={() => void handleSubmitPayment()}
                        disabled={isSubmitting || (!paymentSubscription && !selectedPlan)}
                        className="min-h-[48px] rounded-full border border-amber-700 bg-amber-600 px-6 text-sm font-semibold tracking-wide text-white shadow-[0_10px_18px_rgba(217,119,6,0.22)] transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Payment'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="space-y-5">
                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)] xl:sticky xl:top-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                    Payment Overview
                  </p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="text-sm text-slate-500">Plan</div>
                      <div className="mt-1 font-semibold text-slate-900">
                        {selectedSubscriptionPlan?.plan_name ?? selectedPlan?.plan_name ?? 'Subscription'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Subscription</div>
                      <div className="mt-1 font-semibold text-slate-900">
                        {paymentSubscription ? paymentSubscription.subscription_no : 'Pending creation'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Currency</div>
                      <div className="mt-1 font-semibold text-slate-900">
                        {selectedSubscriptionPlan?.currency ?? selectedPlan?.currency ?? 'PHP'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Due Amount</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">
                        {(selectedSubscriptionPlan?.currency ?? selectedPlan?.currency ?? 'PHP')} {dueAmount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                    Quick Notes
                  </p>
                  <ul className="mt-4 space-y-3 text-sm text-slate-600">
                    <li className="rounded-xl bg-slate-50 px-4 py-3">PayPal approval is handled by the official SDK button.</li>
                    <li className="rounded-xl bg-slate-50 px-4 py-3">Manual references should match the submitted payment exactly.</li>
                    <li className="rounded-xl bg-slate-50 px-4 py-3">Gateway errors are translated into action-oriented messages.</li>
                  </ul>
                </div>
              </aside>
            </div>
          ) : null}

          {!isLoading && !selectedSubscription && !selectedPlan ? (
            <div className="px-6 py-10 md:px-8">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <p className="text-sm text-slate-600">
                  No subscription selected. Please choose or create a subscription from your account page first.
                </p>
                <div className="mt-4 flex justify-center">
                  <button type="button" onClick={() => navigate('/account')}>
                    Go to Account
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
