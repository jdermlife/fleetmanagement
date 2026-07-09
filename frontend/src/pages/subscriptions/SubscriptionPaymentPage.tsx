import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  createSubscription,
  createSubscriptionPayment,
  getErrorMessage,
  listSubscriptionPlans,
  listSubscriptions,
  type SubscriptionPlan,
  type SubscriptionRecord,
} from '../../api'

function monthlyEquivalent(plan: SubscriptionPlan): number {
  if (plan.monthly_price && plan.monthly_price > 0) {
    return plan.monthly_price
  }
  if (plan.yearly_price && plan.yearly_price > 0) {
    return plan.yearly_price / 12
  }
  if (plan.minimum_monthly_fee && plan.minimum_monthly_fee > 0) {
    return plan.minimum_monthly_fee
  }
  return 0
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

export default function SubscriptionPaymentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [loadMessage, setLoadMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentReference, setPaymentReference] = useState('')
  const paymentMethod = DEFAULT_PAYMENT_CHANNEL
  const [invoiceNo, setInvoiceNo] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')

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

  const dueAmount = useMemo(() => {
    const activePlan = selectedSubscriptionPlan ?? selectedPlan
    if (!activePlan) {
      return 0
    }

    return monthlyEquivalent(activePlan)
  }, [selectedPlan, selectedSubscriptionPlan])

  useEffect(() => {
    if (!paymentAmount && dueAmount > 0) {
      setPaymentAmount(dueAmount.toFixed(2))
    }
  }, [dueAmount, paymentAmount])

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

      navigate(`/subscription-payment?subscriptionId=${subscriptionForPayment.id}`, { replace: true })
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
    <div className="standalone-card auth-screen">
      <h1>Subscription Payment</h1>
      <p className="intro">Pay through the configured channel below, then submit the reference here for confirmation.</p>

      {isLoading ? <p>Loading payment details...</p> : null}
      {loadMessage ? <p className="status-message status-error">{loadMessage}</p> : null}

      {!isLoading && (selectedSubscription || selectedPlan) ? (
        <div className="card auth-helper-card">
          <h3>{selectedSubscriptionPlan?.plan_name ?? selectedPlan?.plan_name ?? 'Subscription'}</h3>
          <p className="intro">
            {paymentSubscription
              ? `Subscription: ${paymentSubscription.subscription_no}`
              : `Plan code: ${selectedPlan?.plan_code ?? 'N/A'}`} | Support level: {selectedSubscriptionPlan?.support_level ?? selectedPlan?.support_level ?? 'N/A'}
          </p>
          <p className="status-message">
            Amount due: {(selectedSubscriptionPlan?.currency ?? selectedPlan?.currency ?? 'PHP')} {dueAmount.toFixed(2)} / month
          </p>
          {!paymentSubscription && selectedPlan ? (
            <p className="status-message">
              A pending subscription for <strong>{selectedPlan.plan_name}</strong> will be created automatically when you submit your payment.
            </p>
          ) : null}

          <div className="card" style={{ marginTop: '16px' }}>
            <h4>Payment Instructions</h4>
            <p className="intro">
              Use the configured channel below, keep the reference or receipt number, then submit it for confirmation.
            </p>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h5 className="text-sm font-semibold text-slate-800">Selected Channel: {paymentChannel.title}</h5>
                  <p className="mt-1 text-sm text-slate-600">{paymentChannel.summary}</p>
                </div>
                <button type="button" onClick={() => void handleCopyChannelDetails()} className="rounded-md border border-blue-700 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50">
                  Copy channel details
                </button>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {paymentChannel.detailLines.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card" style={{ marginTop: '16px' }}>
            <h4>Submit payment details</h4>
            <label>
              Subscription
              <select
                value={paymentSubscription?.id ?? ''}
                onChange={(event) => {
                  const subscriptionId = Number(event.target.value)
                  const nextSubscription = subscriptions.find((item) => item.id === subscriptionId) ?? null
                  if (nextSubscription) {
                    navigate(`/subscription-payment?subscriptionId=${nextSubscription.id}`)
                  }
                }}
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

            <label>
              Payment Method
              <input value={paymentMethod} readOnly />
            </label>

            <label>
              Payment Reference / Transaction ID
              <input
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                placeholder={paymentChannel.referenceHint}
                required
              />
            </label>

            <label>
              Invoice No. / Billing Reference
              <input
                value={invoiceNo}
                onChange={(event) => setInvoiceNo(event.target.value)}
                placeholder={paymentSubscription?.subscription_no ?? 'Enter invoice reference'}
              />
            </label>

            <label>
              Amount Paid
              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
              />
            </label>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => void handleSubmitPayment()}
                disabled={isSubmitting || (!paymentSubscription && !selectedPlan)}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Payment'}
              </button>
            </div>

            <p className="status-message">
              After submission, the payment is stored as <strong>PENDING</strong> until it is verified or confirmed by your payment gateway or support team.
            </p>
          </div>
          {paymentMessage ? <p className="status-message">{paymentMessage}</p> : null}
        </div>
      ) : null}

      {!isLoading && !selectedSubscription && !selectedPlan ? (
        <div className="card auth-helper-card">
          <p className="status-message">No subscription selected. Please choose or create a subscription from your account page first.</p>
          <div className="form-actions">
            <button type="button" onClick={() => navigate('/account')}>
              Go to Account
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
