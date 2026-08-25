import { Link, useSearchParams } from 'react-router-dom'

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const provider = searchParams.get('provider')?.trim().toLowerCase()
  const providerLabel = provider === 'paypal'
    ? 'PayPal'
    : provider === 'paymongo'
      ? 'PayMongo'
      : provider === 'apple'
        ? 'Apple App Store'
        : provider === 'google-play'
          ? 'Google Play'
          : null

  return (
    <main className="payment-success-page">
      <section className="payment-success-panel" aria-labelledby="payment-success-title">
        <div className="payment-success-mark" aria-hidden="true">
          <span>✓</span>
        </div>

        <p className="payment-success-kicker">Payment Successful</p>
        <h1 id="payment-success-title">Your payment is complete</h1>
        <p className="payment-success-intro">
          Thank you. Your subscription payment{providerLabel ? ` through ${providerLabel}` : ''} was
          received successfully.
        </p>

        <div className="payment-success-confirmation" role="status">
          <div>
            <strong>Payment received</strong>
            <span>The transaction was returned to FILSCORE successfully.</span>
          </div>
          <div>
            <strong>Access update</strong>
            <span>Your subscription access is ready or will update shortly after provider confirmation.</span>
          </div>
          <div>
            <strong>Payment record</strong>
            <span>Your account will retain the payment details for future reference.</span>
          </div>
        </div>

        <div className="payment-success-actions">
          <Link className="payment-success-action" to="/financial-health-summary">
            Continue to Financial Health
            <span aria-hidden="true">→</span>
          </Link>
          <Link className="payment-success-action payment-success-action-secondary" to="/account">
            View Account
          </Link>
        </div>

        <p className="payment-success-support">
          Please do not pay again if access takes a moment to update.
        </p>
      </section>
    </main>
  )
}