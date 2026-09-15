import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  cancelPublicTrialPayment,
  cancelSubscriptionPayment,
  getErrorMessage,
} from '../../api'

const PAYMENT_CANCELLATION_CONTEXT_KEY = 'fms:payment-cancellation-context'

type PaymentCancellationContext = {
  providerCode: 'PAYMONGO' | 'PAYPAL'
  providerTransactionId: string
  accountIdentifier?: string
  plan?: 'single' | 'multiple'
}

function takePaymentCancellationContext(): PaymentCancellationContext | null {
  try {
    const value = window.sessionStorage.getItem(PAYMENT_CANCELLATION_CONTEXT_KEY)
    window.sessionStorage.removeItem(PAYMENT_CANCELLATION_CONTEXT_KEY)
    return value ? JSON.parse(value) as PaymentCancellationContext : null
  } catch {
    return null
  }
}

export default function PaymentCancelPage() {
  const [message, setMessage] = useState('No charge was completed and your access was not changed.')

  useEffect(() => {
    const context = takePaymentCancellationContext()
    if (!context) {
      return
    }

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
      setMessage(
        `No charge was completed. ${getErrorMessage(error, 'The pending payment record could not be updated.')}`,
      )
    })
  }, [])

  return (
    <main className="payment-success-page payment-cancel-page">
      <section className="payment-success-panel payment-cancel-panel" aria-labelledby="payment-cancel-title">
        <div className="payment-success-mark payment-cancel-mark" aria-hidden="true">
          <span>X</span>
        </div>

        <p className="payment-success-kicker">Payment Cancelled</p>
        <h1 id="payment-cancel-title">Your payment was not completed</h1>
        <p className="payment-success-intro">{message}</p>

        <div className="payment-success-confirmation" role="status">
          <div>
            <strong>No payment received</strong>
            <span>PayMongo did not report a completed charge.</span>
          </div>
          <div>
            <strong>Access unchanged</strong>
            <span>Your current FILSCORE account and subscription remain unchanged.</span>
          </div>
        </div>

        <div className="payment-success-actions">
          <Link className="payment-success-action" to="/subscription/payment?plan=single">
            Choose a Payment Option
            <span aria-hidden="true">&gt;</span>
          </Link>
          <Link className="payment-success-action payment-success-action-secondary" to="/login">
            View Account
          </Link>
        </div>
      </section>
    </main>
  )
}
