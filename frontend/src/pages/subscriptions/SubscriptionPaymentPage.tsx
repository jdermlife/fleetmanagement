import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import {
  cancelPublicTrialPayment,
  cancelSubscriptionPayment,
  capturePayPalOrder,
  capturePublicTrialPayPalOrder,
  createPublicTrialPayMongoCheckout,
  createPublicTrialPayPalOrder,
  createPayMongoCheckout,
  createPayMongoSubscription,
  createPayPalOrder,
  createPayPalSubscription,
  createFreeSubscription,
  createSubscription,
  fetchCurrentUser,
  getMySubscription,
  getAuthToken,
  getErrorMessage,
  listPublicSubscriptionPlans,
  type SubscriptionPlan,
  type SubscriptionRecord,
} from '../../api'
import {
  isNativeStoreBilling,
  loadNativeStoreProducts,
  manageNativeSubscriptions,
  purchaseNativeSubscription,
  restoreNativeSubscriptions,
  type NativeStoreProduct,
} from '../../nativeBilling'
import { loadPayPalSdk, type PayPalButtonsInstance } from '../../paypalSdk'

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

function buildPendingSubscriptionNumber(plan: SubscriptionPlan): string {
  return `SUB-${plan.plan_code}-${Date.now().toString(36).toUpperCase()}`.slice(0, 50)
}

function buildPayPalRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `checkout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID?.trim() || (import.meta.env.DEV ? 'sb' : '')
const PAYMENT_CANCELLATION_CONTEXT_KEY = 'fms:payment-cancellation-context'

type PaymentCancellationContext = {
  providerCode: 'PAYMONGO' | 'PAYPAL'
  providerTransactionId: string
  accountIdentifier?: string
  plan?: 'single' | 'multiple'
}

function savePaymentCancellationContext(context: PaymentCancellationContext): void {
  try {
    window.sessionStorage.setItem(PAYMENT_CANCELLATION_CONTEXT_KEY, JSON.stringify(context))
  } catch {
    // Cancellation can still be displayed when browser storage is unavailable.
  }
}

function takePaymentCancellationContext(): PaymentCancellationContext | null {
  try {
    const value = window.sessionStorage.getItem(PAYMENT_CANCELLATION_CONTEXT_KEY)
    window.sessionStorage.removeItem(PAYMENT_CANCELLATION_CONTEXT_KEY)
    if (!value) return null
    return JSON.parse(value) as PaymentCancellationContext
  } catch {
    return null
  }
}


function formatPayPalGatewayError(message: string, action: 'create' | 'capture'): string {
  const normalized = message.trim().toUpperCase()

  if (normalized.includes('ORDER_NOT_APPROVED')) {
    return 'PayPal approval was not completed. Restart PayPal checkout and finish approval before trying again.'
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

type GuestTrialPlanId = 'single' | 'multiple'

type GuestTrialPlan = {
  id: GuestTrialPlanId
  title: string
  price: number
  currency: string
  note: string
}

const GUEST_TRIAL_PLANS: Record<GuestTrialPlanId, GuestTrialPlan> = {
  single: {
    id: 'single',
    title: 'Subscriber Single Profile Plan',
    price: 160,
    currency: 'PHP',
    note: 'Php 160.00 per month',
  },
  multiple: {
    id: 'multiple',
    title: 'Subscriber Multiple Profile Plan',
    price: 1600,
    currency: 'PHP',
    note: 'Php 1,600.00 per month',
  },
}

export default function SubscriptionPaymentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [loadMessage, setLoadMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)
  const [recurringProvider, setRecurringProvider] = useState<'PAYMONGO' | 'PAYPAL' | null>(null)
  const [payMongoPaymentMethodId, setPayMongoPaymentMethodId] = useState('')
  const [isStartingFreeTrial, setIsStartingFreeTrial] = useState(false)
  const [nativeProducts, setNativeProducts] = useState<NativeStoreProduct[]>([])
  const [isNativePurchasePending, setIsNativePurchasePending] = useState(false)
  const paypalButtonContainerRef = useRef<HTMLDivElement | null>(null)
  const paypalCheckoutContextRef = useRef<{ orderId: string; subscriptionId: number } | null>(null)
  const paypalRequestContextRef = useRef<{ requestId: string; subscriptionId: number } | null>(null)
  const paypalStageRef = useRef<'create' | 'capture'>('create')
  const [guestAccountIdentifier, setGuestAccountIdentifier] = useState('')

  const selectedPlanId = Number(searchParams.get('planId') ?? 0)
  const selectedSubscriptionId = Number(searchParams.get('subscriptionId') ?? 0)
  const selectedGuestPlanId = searchParams.get('plan')
  const guestAccountQuery = searchParams.get('account')?.trim() || ''
  const checkoutStatus = searchParams.get('checkout')
  const isAuthenticated = Boolean(getAuthToken())
  const usesNativeStore = isNativeStoreBilling()
  const guestTrialPlan =
    !isAuthenticated && (selectedGuestPlanId === 'single' || selectedGuestPlanId === 'multiple')
      ? GUEST_TRIAL_PLANS[selectedGuestPlanId]
      : null

  useEffect(() => {
    if (checkoutStatus === 'success') {
      takePaymentCancellationContext()
      navigate('/payment-success?provider=paymongo', { replace: true })
      return
    }
    if (checkoutStatus === 'cancelled') {
      setPaymentMessage('Payment Cancelled. No charge was completed and your access was not changed.')
      const context = takePaymentCancellationContext()
      if (!context) return
      const cancellation = context.accountIdentifier && context.plan
        ? cancelPublicTrialPayment({
            account_identifier: context.accountIdentifier,
            plan: context.plan,
            provider_code: context.providerCode,
            provider_transaction_id: context.providerTransactionId,
          })
        : cancelSubscriptionPayment({
            provider_code: context.providerCode,
            provider_transaction_id: context.providerTransactionId,
          })
      void cancellation.catch((error) => {
        setPaymentMessage(`Payment Cancelled. ${getErrorMessage(error, 'The payment record could not be updated.')}`)
      })
    }
  }, [checkoutStatus, navigate])

  useEffect(() => {
    if (!guestTrialPlan) {
      return
    }
    setGuestAccountIdentifier(guestAccountQuery)
  }, [guestAccountQuery, guestTrialPlan])

  useEffect(() => {
    if (guestTrialPlan) {
      setIsLoading(false)
      return
    }

    const loadData = async () => {
      try {
        const [planRows, subscription] = await Promise.all([
          listPublicSubscriptionPlans(),
          getMySubscription(),
        ])
        setPlans(planRows)
        setSubscriptions(subscription ? [subscription] : [])
      } catch (error) {
        setLoadMessage(getErrorMessage(error, 'Unable to load subscription payment details.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [guestTrialPlan])

  useEffect(() => {
    if (!usesNativeStore || !isAuthenticated || guestTrialPlan) {
      return
    }
    void loadNativeStoreProducts()
      .then(setNativeProducts)
      .catch((error) => {
        setLoadMessage(getErrorMessage(error, 'Unable to load subscriptions from the app store.'))
      })
  }, [guestTrialPlan, isAuthenticated, usesNativeStore])

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

  const selectedNativeProduct = useMemo(
    () => nativeProducts.find((product) => product.mapping.plan_id === selectedSubscriptionPlan?.id) ?? null,
    [nativeProducts, selectedSubscriptionPlan?.id],
  )

  const paypalCurrency = useMemo(
    () => (selectedSubscriptionPlan?.currency ?? selectedPlan?.currency ?? 'PHP').toUpperCase(),
    [selectedSubscriptionPlan?.currency, selectedPlan?.currency],
  )

  const dueAmount = useMemo(() => {
    if (guestTrialPlan) {
      return guestTrialPlan.price
    }

    const activePlan = selectedSubscriptionPlan ?? selectedPlan
    if (!activePlan) {
      return 0
    }

    return billingAmount(activePlan)
  }, [guestTrialPlan, selectedPlan, selectedSubscriptionPlan])

  const isFreeTrialPlan = !guestTrialPlan
    && (selectedSubscriptionPlan ?? selectedPlan)?.plan_code === 'FREE'
    && dueAmount === 0

  const preferredPaidPlan = useMemo(() => {
    const paidPlans = plans.filter((plan) => plan.plan_code !== 'FREE' && billingAmount(plan) > 0)
    return paidPlans.find((plan) => plan.plan_code === 'SINGLE_PROFILE') ?? paidPlans[0] ?? null
  }, [plans])

  const canRenderPayPalButtons =
    !guestTrialPlan &&
    !isFreeTrialPlan &&
    !isLoading &&
    Boolean(selectedSubscription || selectedPlan)
  const canRenderGuestPayPalButtons =
    Boolean(guestTrialPlan)
    && guestAccountIdentifier.trim().length >= 3
    && Boolean(PAYPAL_CLIENT_ID)

  const ensureSubscriptionForPayment = useCallback(async (): Promise<SubscriptionRecord | null> => {
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
  }, [paymentSubscription, selectedPlan])

  const ensureSubscriptionForPaymentRef = useRef(ensureSubscriptionForPayment)
  ensureSubscriptionForPaymentRef.current = ensureSubscriptionForPayment

  useEffect(() => {
    if (!canRenderPayPalButtons) {
      return
    }

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
    let buttons: PayPalButtonsInstance | null = null

    const renderPayPalButtons = async () => {
      try {
        const paypal = await loadPayPalSdk(PAYPAL_CLIENT_ID, paypalCurrency, 'order')

        if (cancelled || !paypalButtonContainerRef.current) {
          return
        }

        buttons = paypal.Buttons({
          style: {
            layout: 'vertical',
            shape: 'rect',
            color: 'gold',
            label: 'paypal',
            tagline: false,
          },
          createOrder: async () => {
            paypalStageRef.current = 'create'
            paypalCheckoutContextRef.current = null
            setPaymentMessage('Creating a secure PayPal order...')

            const subscriptionForPayment = await ensureSubscriptionForPaymentRef.current()
            if (!subscriptionForPayment) {
              throw new Error('Please select a valid subscription plan before starting PayPal checkout.')
            }

            const existingRequestContext = paypalRequestContextRef.current
            const requestId = existingRequestContext?.subscriptionId === subscriptionForPayment.id
              ? existingRequestContext.requestId
              : buildPayPalRequestId()
            paypalRequestContextRef.current = {
              requestId,
              subscriptionId: subscriptionForPayment.id,
            }

            const order = await createPayPalOrder({
              subscription_id: subscriptionForPayment.id,
              invoice_no: subscriptionForPayment.subscription_no,
              request_id: requestId,
            })

            paypalCheckoutContextRef.current = {
              orderId: order.order_id,
              subscriptionId: subscriptionForPayment.id,
            }
            return order.order_id
          },
          onApprove: async (data) => {
            paypalStageRef.current = 'capture'
            const orderId = data.orderID?.trim() ?? ''
            if (!orderId) {
              throw new Error('PayPal did not return an order id.')
            }

            const checkoutContext = paypalCheckoutContextRef.current
            if (!checkoutContext || checkoutContext.orderId !== orderId) {
              throw new Error('PayPal returned an unexpected order id. Restart approval and try again.')
            }

            setPaymentMessage('PayPal approved the order. Finalizing payment...')
            await capturePayPalOrder({
              order_id: orderId,
              subscription_id: checkoutContext.subscriptionId,
            })
            paypalCheckoutContextRef.current = null
            paypalRequestContextRef.current = null
            navigate('/payment-success?provider=paypal', { replace: true })
          },
          onCancel: () => {
            const checkoutContext = paypalCheckoutContextRef.current
            paypalCheckoutContextRef.current = null
            setPaymentMessage('Payment Cancelled. PayPal checkout was cancelled and no access change was made.')
            if (checkoutContext) {
              void cancelSubscriptionPayment({
                provider_code: 'PAYPAL',
                provider_transaction_id: checkoutContext.orderId,
              }).catch((error) => {
                setPaymentMessage(`Payment Cancelled. ${getErrorMessage(error, 'The payment record could not be updated.')}`)
              })
            }
          },
          onError: (error) => {
            paypalCheckoutContextRef.current = null
            const fallback = error instanceof Error ? error.message : 'Unable to process PayPal checkout right now.'
            setPaymentMessage(formatPayPalGatewayError(fallback, paypalStageRef.current))
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
      paypalCheckoutContextRef.current = null
      void Promise.resolve(buttons?.close?.()).catch(() => undefined)
      container.replaceChildren()
    }
  }, [canRenderPayPalButtons, navigate, paypalCurrency])

  useEffect(() => {
    if (!canRenderGuestPayPalButtons || !guestTrialPlan) {
      return
    }

    const container = paypalButtonContainerRef.current
    if (!container) {
      return
    }

    container.innerHTML = ''

    let cancelled = false
    let buttons: PayPalButtonsInstance | null = null

    const renderPayPalButtons = async () => {
      try {
        const paypal = await loadPayPalSdk(PAYPAL_CLIENT_ID, guestTrialPlan.currency)

        if (cancelled || !paypalButtonContainerRef.current) {
          return
        }

        buttons = paypal.Buttons({
          style: {
            layout: 'vertical',
            shape: 'rect',
            color: 'gold',
            label: 'paypal',
            tagline: false,
          },
          createOrder: async () => {
            paypalStageRef.current = 'create'
            setPaymentMessage('Creating a secure PayPal order...')

            const requestId = buildPayPalRequestId()
            const order = await createPublicTrialPayPalOrder({
              account_identifier: guestAccountIdentifier.trim(),
              plan: guestTrialPlan.id,
              request_id: requestId,
            })

            paypalCheckoutContextRef.current = {
              orderId: order.order_id,
              subscriptionId: order.payment.subscription_id,
            }
            return order.order_id
          },
          onApprove: async (data) => {
            paypalStageRef.current = 'capture'
            const orderId = data.orderID?.trim() ?? ''
            if (!orderId) {
              throw new Error('PayPal did not return an order id.')
            }

            setPaymentMessage('PayPal approved the order. Finalizing payment...')
            await capturePublicTrialPayPalOrder({
              account_identifier: guestAccountIdentifier.trim(),
              plan: guestTrialPlan.id,
              order_id: orderId,
            })
            navigate('/payment-success?provider=paypal', { replace: true })
          },
          onCancel: () => {
            const checkoutContext = paypalCheckoutContextRef.current
            paypalCheckoutContextRef.current = null
            setPaymentMessage('Payment Cancelled. PayPal checkout was cancelled and no access change was made.')
            if (checkoutContext) {
              void cancelPublicTrialPayment({
                account_identifier: guestAccountIdentifier.trim(),
                plan: guestTrialPlan.id,
                provider_code: 'PAYPAL',
                provider_transaction_id: checkoutContext.orderId,
              }).catch((error) => {
                setPaymentMessage(`Payment Cancelled. ${getErrorMessage(error, 'The payment record could not be updated.')}`)
              })
            }
          },
          onError: (error) => {
            const fallback = error instanceof Error ? error.message : 'Unable to process PayPal checkout right now.'
            setPaymentMessage(formatPayPalGatewayError(fallback, paypalStageRef.current))
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
      paypalCheckoutContextRef.current = null
      void Promise.resolve(buttons?.close?.()).catch(() => undefined)
      container.replaceChildren()
    }
  }, [canRenderGuestPayPalButtons, guestAccountIdentifier, guestTrialPlan, navigate])

  const handleStartCheckout = async () => {
    setIsStartingCheckout(true)
    setPaymentMessage('')

    try {
      const subscriptionForPayment = await ensureSubscriptionForPaymentRef.current()
      if (!subscriptionForPayment) {
        throw new Error('Please select a valid subscription plan before starting checkout.')
      }
      setPaymentMessage('Opening secure PayMongo checkout...')
      const checkout = await createPayMongoCheckout({
        subscription_id: subscriptionForPayment.id,
        invoice_no: subscriptionForPayment.subscription_no,
      })
      savePaymentCancellationContext({
        providerCode: 'PAYMONGO',
        providerTransactionId: checkout.checkout_id,
      })
      window.location.href = checkout.checkout_url
    } catch (error) {
      setPaymentMessage(getErrorMessage(error, 'Unable to start secure checkout right now.'))
    } finally {
      setIsStartingCheckout(false)
    }
  }

  const handleStartPayMongoRecurring = async () => {
    const paymentMethodId = payMongoPaymentMethodId.trim()
    if (paymentMethodId.length < 6) {
      setPaymentMessage('Enter the PayMongo card authorization ID before starting recurring billing.')
      return
    }

    setRecurringProvider('PAYMONGO')
    setPaymentMessage('Starting recurring billing with PayMongo...')
    try {
      const subscriptionForPayment = await ensureSubscriptionForPaymentRef.current()
      if (!subscriptionForPayment) {
        throw new Error('Please select a valid subscription plan before starting recurring billing.')
      }
      const result = await createPayMongoSubscription({
        subscription_id: subscriptionForPayment.id,
        request_id: buildPayPalRequestId(),
        payment_method_id: paymentMethodId,
      })
      if (result.approval_url) {
        window.location.href = result.approval_url
        return
      }
      setPaymentMessage(`PayMongo recurring subscription is ${result.status.toLowerCase()}.`)
    } catch (error) {
      setPaymentMessage(getErrorMessage(error, 'Unable to start PayMongo recurring billing.'))
    } finally {
      setRecurringProvider(null)
    }
  }

  const handleStartPayPalRecurring = async () => {
    setRecurringProvider('PAYPAL')
    setPaymentMessage('Opening PayPal recurring subscription approval...')
    try {
      const subscriptionForPayment = await ensureSubscriptionForPaymentRef.current()
      if (!subscriptionForPayment) {
        throw new Error('Please select a valid subscription plan before starting recurring billing.')
      }
      const result = await createPayPalSubscription({
        subscription_id: subscriptionForPayment.id,
        request_id: buildPayPalRequestId(),
      })
      if (result.approval_url) {
        window.location.href = result.approval_url
        return
      }
      setPaymentMessage(`PayPal recurring subscription is ${result.status.toLowerCase()}.`)
    } catch (error) {
      setPaymentMessage(getErrorMessage(error, 'Unable to start PayPal recurring billing.'))
    } finally {
      setRecurringProvider(null)
    }
  }

  const handleStartFreeTrial = async () => {
    if (!usesNativeStore && paymentSubscription?.status === 'TRIAL') {
      navigate('/financial-health-summary', { replace: true })
      return
    }

    setIsStartingFreeTrial(true)
    setPaymentMessage('Starting your free two-day trial...')
    try {
      const trial = await createFreeSubscription()
      setSubscriptions([trial])
      if (usesNativeStore) {
        setPaymentMessage('Your free two-day trial is active. No payment was required.')
      } else {
        navigate('/financial-health-summary', { replace: true })
      }
    } catch (error) {
      setPaymentMessage(getErrorMessage(error, 'Unable to start the free trial right now.'))
    } finally {
      setIsStartingFreeTrial(false)
    }
  }

  const handleNativePurchase = async () => {
    if (!selectedNativeProduct) {
      setPaymentMessage('This subscription is not configured in the app store.')
      return
    }
    setIsNativePurchasePending(true)
    setPaymentMessage('Waiting for app store confirmation...')
    try {
      const currentUser = await fetchCurrentUser()
      const purchase = await purchaseNativeSubscription(
        selectedNativeProduct,
        currentUser.id,
        paymentSubscription?.id,
      )
      if (purchase.status === 'ACTIVE' || purchase.status === 'GRACE_PERIOD') {
        navigate(`/payment-success?provider=${purchase.platform === 'IOS' ? 'apple' : 'google-play'}`, { replace: true })
      } else {
        setPaymentMessage(`The app store reports this subscription as ${purchase.status.toLowerCase()}.`)
      }
    } catch (error) {
      setPaymentMessage(getErrorMessage(error, 'Unable to complete the app store purchase.'))
    } finally {
      setIsNativePurchasePending(false)
    }
  }

  const handleRestoreNativePurchases = async () => {
    setIsNativePurchasePending(true)
    setPaymentMessage('Restoring app store purchases...')
    try {
      const restored = await restoreNativeSubscriptions(nativeProducts)
      setPaymentMessage(
        restored.length > 0
          ? 'Your app store subscriptions have been restored.'
          : 'No active app store subscriptions were found.',
      )
    } catch (error) {
      setPaymentMessage(getErrorMessage(error, 'Unable to restore app store purchases.'))
    } finally {
      setIsNativePurchasePending(false)
    }
  }

  const handleStartGuestCheckout = async () => {
    if (!guestTrialPlan) {
      return
    }

    if (guestAccountIdentifier.trim().length < 3) {
      setPaymentMessage('Enter your registered username or email before starting payment.')
      return
    }

    setIsStartingCheckout(true)
    setPaymentMessage('')

    try {
      const checkout = await createPublicTrialPayMongoCheckout({
        account_identifier: guestAccountIdentifier.trim(),
        plan: guestTrialPlan.id,
      })
      savePaymentCancellationContext({
        providerCode: 'PAYMONGO',
        providerTransactionId: checkout.checkout_id,
        accountIdentifier: guestAccountIdentifier.trim(),
        plan: guestTrialPlan.id,
      })
      window.location.href = checkout.checkout_url
    } catch (error) {
      setPaymentMessage(getErrorMessage(error, 'Unable to start secure checkout right now.'))
    } finally {
      setIsStartingCheckout(false)
    }
  }

  if (guestTrialPlan && usesNativeStore) {
    return (
      <div className="standalone-card auth-screen trial-expired-page subscription-payment-guest-page">
        <h1>App Store Subscription</h1>
        <p className="status-message">Sign in to purchase or restore a subscription through this device&apos;s app store.</p>
        <div className="form-actions">
          <Link className="auth-link-button" to="/login">Back to Login</Link>
        </div>
      </div>
    )
  }

  if (checkoutStatus === 'cancelled') {
    return (
      <div className="standalone-card auth-screen trial-expired-page subscription-payment-guest-page">
        <section className="stack-panel auth-panel" role="alert" aria-labelledby="payment-cancelled-title">
          <h1 id="payment-cancelled-title">Payment Cancelled</h1>
          <p className="status-message">{paymentMessage || 'No charge was completed and your access was not changed.'}</p>
          <div className="form-actions">
            <Link className="auth-link-button" to="/trial-expired">Choose a Payment Option</Link>
            <Link className="auth-link-button" to="/account">View Account</Link>
          </div>
        </section>
      </div>
    )
  }

  if (guestTrialPlan) {
    return (
      <div className="standalone-card auth-screen trial-expired-page subscription-payment-guest-page">
        <h1>Subscription Payment</h1>
        <p className="intro">
          Continue your FILSCORE access by choosing a payment channel for the selected plan.
        </p>

        <section className="stack-panel auth-panel trial-expired-plan-summary">
          <h2>{guestTrialPlan.title}</h2>
          <p className="trial-expired-price">
            {guestTrialPlan.currency} {guestTrialPlan.price.toFixed(2)}
          </p>
          <p>{guestTrialPlan.note}</p>
        </section>

        <section className="stack-panel auth-panel">
          <label>
            Registered Username or Email
            <input
              value={guestAccountIdentifier}
              onChange={(event) => setGuestAccountIdentifier(event.target.value)}
              placeholder="Enter your registered username or email"
              autoComplete="username"
              required
            />
          </label>
        </section>

        <section className="stack-panel auth-panel trial-expired-payment-methods" aria-label="Payment channels">
          <h2>Choose Payment Channel</h2>
          <p>Select one secure payment option below.</p>
          <div className="trial-expired-payment-buttons">
            <div className="trial-expired-payment-option register-social-option">
              <h3>PayMongo</h3>
              <p>Continue to PayMongo for card, wallet, or other enabled checkout options.</p>
              <button
                type="button"
                className="auth-link-button auth-apple-button"
                onClick={() => void handleStartGuestCheckout()}
                disabled={isStartingCheckout || guestAccountIdentifier.trim().length < 3}
              >
                {isStartingCheckout ? 'Starting secure checkout...' : 'Pay with PayMongo'}
              </button>
            </div>

            <div className="trial-expired-payment-option register-social-option">
              <h3>PayPal</h3>
              <p>Use the official PayPal button to approve and complete payment securely.</p>
              {canRenderGuestPayPalButtons ? (
                <div
                  ref={paypalButtonContainerRef}
                  className="trial-expired-paypal-container register-google-button-wrap"
                  style={{ minHeight: '56px' }}
                />
              ) : (
                <>
                  <button type="button" className="auth-link-button auth-apple-button" disabled>
                    Pay with PayPal
                  </button>
                  <p className="trial-expired-payment-error">
                    {PAYPAL_CLIENT_ID
                      ? 'Enter your registered username or email to enable PayPal.'
                      : 'PayPal Buttons are unavailable because VITE_PAYPAL_CLIENT_ID is not configured.'}
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        <div className="form-actions">
          <button
            type="button"
            className="auth-link-button"
            onClick={() => navigate('/trial-expired')}
          >
            Choose Another Plan
          </button>
          <Link className="auth-link-button" to="/login">
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="standalone-card auth-screen trial-expired-page subscription-payment-guest-page">
      <h1>Subscription Payment</h1>
      <p className="intro">
        Choose a secure payment option to continue or renew your FILSCORE access.
      </p>

      {loadMessage ? <p className="status-message status-error">{loadMessage}</p> : null}
      {paymentMessage ? <p className="status-message">{paymentMessage}</p> : null}

      {isLoading ? <p className="status-message">Loading payment details...</p> : null}

      {!isLoading && (selectedSubscription || selectedPlan) ? (
        <>
          <section className="stack-panel auth-panel trial-expired-plan-summary">
            <h2>{selectedSubscriptionPlan?.plan_name ?? selectedPlan?.plan_name ?? 'Subscription'}</h2>
            <p className="trial-expired-price">
              {usesNativeStore && selectedNativeProduct
                ? selectedNativeProduct.priceString
                : `${selectedSubscriptionPlan?.currency ?? selectedPlan?.currency ?? 'PHP'} ${dueAmount.toFixed(2)}`}
            </p>
            <p>
              Billing cycle: {(selectedSubscriptionPlan?.billing_cycle ?? selectedPlan?.billing_cycle ?? 'MONTHLY').toLowerCase()}
            </p>
            <p>
              Subscription reference: {paymentSubscription ? paymentSubscription.subscription_no : selectedPlan?.plan_code ?? 'Pending'}
            </p>
            {!paymentSubscription && selectedPlan ? (
              <p>
                A pending subscription for <strong>{selectedPlan.plan_name}</strong> will be created automatically when you start payment.
              </p>
            ) : null}
          </section>

          {isFreeTrialPlan ? (
            <section className="stack-panel auth-panel" aria-label="Free trial activation">
              <h2>Start Free Trial</h2>
              <p>Activate two days of trial access immediately. PayPal and PayMongo are not required for PHP 0.00.</p>
              <button
                type="button"
                className="auth-link-button auth-apple-button"
                onClick={() => void handleStartFreeTrial()}
                disabled={isStartingFreeTrial || (usesNativeStore && paymentSubscription?.status === 'TRIAL')}
              >
                {paymentSubscription?.status === 'TRIAL'
                  ? usesNativeStore
                    ? 'Free Trial Active'
                    : 'Continue to Financial Health'
                  : isStartingFreeTrial
                    ? 'Starting Free Trial...'
                    : 'Start Free Trial'}
              </button>
              {!usesNativeStore && preferredPaidPlan ? (
                <p className="status-message">
                  Ready to subscribe?{' '}
                  <Link to={`/subscription-payment?planId=${preferredPaidPlan.id}`}>
                    Pay for {preferredPaidPlan.plan_name} now
                  </Link>
                  .
                </p>
              ) : null}
            </section>
          ) : (
          usesNativeStore ? (
          <section className="stack-panel auth-panel trial-expired-payment-methods" aria-label="App store subscription">
            <h2>{selectedNativeProduct?.title ?? 'App Store Subscription'}</h2>
            <p>{selectedNativeProduct?.description ?? 'This plan is not yet available from the app store.'}</p>
            {selectedNativeProduct ? (
              <p className="trial-expired-price">{selectedNativeProduct.priceString}</p>
            ) : null}
            <div className="trial-expired-payment-buttons">
              <button
                type="button"
                className="auth-link-button auth-apple-button"
                onClick={() => void handleNativePurchase()}
                disabled={isNativePurchasePending || !selectedNativeProduct}
              >
                {isNativePurchasePending ? 'Processing...' : 'Subscribe'}
              </button>
              <button
                type="button"
                className="auth-link-button"
                onClick={() => void handleRestoreNativePurchases()}
                disabled={isNativePurchasePending || nativeProducts.length === 0}
              >
                Restore Purchases
              </button>
              <button
                type="button"
                className="auth-link-button"
                onClick={() => void manageNativeSubscriptions().catch((error) => {
                  setPaymentMessage(getErrorMessage(error, 'Unable to open subscription management.'))
                })}
              >
                Manage Subscription
              </button>
            </div>
          </section>
          ) : (
          <>
          <section className="stack-panel auth-panel trial-expired-payment-methods" aria-label="Payment channels">
            <h2>Choose Payment Channel</h2>
            <p>Select PayMongo or PayPal for a one-time payment.</p>

            <div className="trial-expired-payment-buttons">
              <div className="trial-expired-payment-option register-social-option">
                <h3>PayMongo</h3>
                <p>Make a one-time payment by card, wallet, or another enabled checkout option.</p>
                <button
                  type="button"
                  className="auth-link-button auth-apple-button"
                  onClick={() => void handleStartCheckout()}
                  disabled={isStartingCheckout || (!paymentSubscription && !selectedPlan)}
                >
                  {isStartingCheckout ? 'Opening secure checkout...' : 'Pay once with PayMongo'}
                </button>
              </div>

              <div className="trial-expired-payment-option register-social-option">
                <h3>PayPal</h3>
                <p>Approve and complete a one-time payment securely with PayPal.</p>
                {PAYPAL_CLIENT_ID ? (
                  <div
                    ref={paypalButtonContainerRef}
                    className="trial-expired-paypal-container register-google-button-wrap"
                    style={{ minHeight: '56px' }}
                  />
                ) : (
                  <>
                    <button type="button" className="auth-link-button auth-apple-button" disabled>
                      Pay with PayPal
                    </button>
                    <p className="trial-expired-payment-error">
                      PayPal Buttons are unavailable because VITE_PAYPAL_CLIENT_ID is not configured.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="stack-panel auth-panel trial-expired-payment-methods" aria-label="Recurring subscription channels">
            <h2>Recurring Subscription</h2>
            <p>Authorize automatic renewals through your preferred payment provider.</p>

            <div className="trial-expired-payment-buttons">
              <div className="trial-expired-payment-option register-social-option">
                <h3>PayMongo Recurring</h3>
                <p>Use a PayMongo card authorization to enable automatic subscription renewals.</p>
                <label>
                  Card Authorization ID
                  <input
                    value={payMongoPaymentMethodId}
                    onChange={(event) => setPayMongoPaymentMethodId(event.target.value)}
                    placeholder="pm_..."
                    autoComplete="off"
                  />
                </label>
                <button
                  type="button"
                  className="auth-link-button auth-apple-button"
                  onClick={() => void handleStartPayMongoRecurring()}
                  disabled={recurringProvider !== null || (!paymentSubscription && !selectedPlan)}
                >
                  {recurringProvider === 'PAYMONGO' ? 'Starting recurring billing...' : 'Subscribe with PayMongo'}
                </button>
              </div>

              <div className="trial-expired-payment-option register-social-option">
                <h3>PayPal Recurring</h3>
                <p>Approve automatic subscription renewals securely in PayPal.</p>
                <button
                  type="button"
                  className="auth-link-button auth-apple-button"
                  onClick={() => void handleStartPayPalRecurring()}
                  disabled={recurringProvider !== null || (!paymentSubscription && !selectedPlan)}
                >
                  {recurringProvider === 'PAYPAL' ? 'Opening PayPal approval...' : 'Subscribe with PayPal'}
                </button>
              </div>
            </div>
          </section>
          </>
          )
          
          )}
        </>
      ) : null}








      {!isLoading && !selectedSubscription && !selectedPlan ? (
        <section className="stack-panel auth-panel">
          <p className="status-message">
            No subscription selected. Please choose or create a subscription from your account page first.
          </p>
          <div className="form-actions">
            <button type="button" className="auth-link-button" onClick={() => navigate('/account')}>
              Go to Account
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
