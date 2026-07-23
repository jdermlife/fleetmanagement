import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

import {
  capturePublicTrialPayPalOrder,
  capturePayPalOrder,
  createPublicTrialPayMongoCheckout,
  createPublicTrialPayPalOrder,
  createPayPalOrder,
  createSubscriptionCheckout,
  createSubscription,
  getAuthToken,
  getErrorMessage,
  listSubscriptionPlans,
  listSubscriptions,
  type SubscriptionPlan,
  type SubscriptionRecord,
} from '../../api'
import { loadPayPalSdk, type PayPalButtonsInstance } from '../../paypalSdk'
import SubscriptionAccessDeniedCard from './SubscriptionAccessDeniedCard'

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
console.log("VITE_PAYPAL_CLIENT_ID =", import.meta.env.VITE_PAYPAL_CLIENT_ID)
console.log("MODE =", import.meta.env.MODE)
console.log(import.meta.env)




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
  const [hasSubscriptionAccessDenied, setHasSubscriptionAccessDenied] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)
  const paypalButtonContainerRef = useRef<HTMLDivElement | null>(null)
  const paypalCheckoutContextRef = useRef<{ orderId: string; subscriptionId: number } | null>(null)
  const paypalRequestContextRef = useRef<{ requestId: string; subscriptionId: number } | null>(null)
  const paypalStageRef = useRef<'create' | 'capture'>('create')
  const [guestAccountIdentifier, setGuestAccountIdentifier] = useState('')

  const selectedPlanId = Number(searchParams.get('planId') ?? 0)
  const selectedSubscriptionId = Number(searchParams.get('subscriptionId') ?? 0)
  const selectedGuestPlanId = searchParams.get('plan')
  const guestAccountQuery = searchParams.get('account')?.trim() || ''
  const isAuthenticated = Boolean(getAuthToken())
  const guestTrialPlan =
    !isAuthenticated && (selectedGuestPlanId === 'single' || selectedGuestPlanId === 'multiple')
      ? GUEST_TRIAL_PLANS[selectedGuestPlanId]
      : null

  useEffect(() => {
    if (!guestTrialPlan) {
      return
    }
    setGuestAccountIdentifier(guestAccountQuery)
  }, [guestAccountQuery, guestTrialPlan])

  useEffect(() => {
    if (guestTrialPlan) {
      setIsLoading(false)
      setHasSubscriptionAccessDenied(false)
      return
    }

    const loadData = async () => {
      try {
        const [planRows, subscriptionRows] = await Promise.all([
          listSubscriptionPlans(),
          listSubscriptions(),
        ])
        setPlans(planRows)
        setSubscriptions(subscriptionRows)
        setHasSubscriptionAccessDenied(false)
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          setHasSubscriptionAccessDenied(true)
          setLoadMessage('You do not have access to subscription billing. Contact your administrator to request billing permissions.')
          return
        }

        setHasSubscriptionAccessDenied(false)
        setLoadMessage(getErrorMessage(error, 'Unable to load subscription payment details.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [guestTrialPlan])

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

  const canRenderPayPalButtons =
    !guestTrialPlan &&
    !isLoading &&
    !hasSubscriptionAccessDenied &&
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
        const paypal = await loadPayPalSdk(PAYPAL_CLIENT_ID, paypalCurrency)

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
              throw new Error('PayPal returned an unexpected order id. Restart checkout and try again.')
            }

            setPaymentMessage('PayPal approved the order. Finalizing payment...')
            const captureResult = await capturePayPalOrder({
              order_id: orderId,
              subscription_id: checkoutContext.subscriptionId,
            })
            paypalCheckoutContextRef.current = null
            paypalRequestContextRef.current = null

            const successMessage = captureResult.already_processed
              ? 'PayPal payment was already processed and remains successful.'
              : 'PayPal payment captured successfully. Your subscription is now updated.'

            try {
              const subscriptionRows = await listSubscriptions()
              setSubscriptions(subscriptionRows)
              setPaymentMessage(successMessage)
            } catch {
              setPaymentMessage(`${successMessage} Refresh the page to update the subscription summary.`)
            }
          },
          onCancel: () => {
            paypalCheckoutContextRef.current = null
            setPaymentMessage('PayPal checkout was cancelled. You can start again anytime.')
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
  }, [canRenderPayPalButtons, paypalCurrency])

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
            setPaymentMessage('PayPal payment captured successfully. Your subscription is now updated.')
          },
          onCancel: () => {
            setPaymentMessage('PayPal checkout was cancelled. You can start again anytime.')
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
  }, [canRenderGuestPayPalButtons, guestAccountIdentifier, guestTrialPlan])

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
      window.location.href = checkout.checkout_url
    } catch (error) {
      setPaymentMessage(getErrorMessage(error, 'Unable to start secure checkout right now.'))
    } finally {
      setIsStartingCheckout(false)
    }
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

      {!isLoading && !hasSubscriptionAccessDenied && (selectedSubscription || selectedPlan) ? (
        <>
          <section className="stack-panel auth-panel trial-expired-plan-summary">
            <h2>{selectedSubscriptionPlan?.plan_name ?? selectedPlan?.plan_name ?? 'Subscription'}</h2>
            <p className="trial-expired-price">
              {(selectedSubscriptionPlan?.currency ?? selectedPlan?.currency ?? 'PHP')} {dueAmount.toFixed(2)}
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

          <section className="stack-panel auth-panel trial-expired-payment-methods" aria-label="Payment channels">
            <h2>Choose Payment Channel</h2>
            <p>Select one secure payment option below.</p>

            <div className="trial-expired-payment-buttons">
              <div className="trial-expired-payment-option register-social-option">
                <h3>PayMongo</h3>
                <p>Pay by an available card or e-wallet on PayMongo&apos;s hosted checkout page.</p>
                <button
                  type="button"
                  className="auth-link-button auth-apple-button"
                  onClick={() => void handleStartCheckout()}
                  disabled={isStartingCheckout || (!paymentSubscription && !selectedPlan)}
                >
                  {isStartingCheckout ? 'Starting secure checkout...' : 'Pay with PayMongo'}
                </button>
              </div>

              <div className="trial-expired-payment-option register-social-option">
                <h3>PayPal</h3>
                <p>Use the official PayPal button to approve and complete payment securely.</p>
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
        </>
      ) : null}

      {!isLoading && hasSubscriptionAccessDenied ? (
        <div className="stack-panel auth-panel">
          <SubscriptionAccessDeniedCard onGoToAccount={() => navigate('/account')} />
        </div>
      ) : null}

      {!isLoading && !hasSubscriptionAccessDenied && !selectedSubscription && !selectedPlan ? (
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
