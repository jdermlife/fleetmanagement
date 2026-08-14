import { Link, useSearchParams } from 'react-router-dom'

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const provider = searchParams.get('provider')
  const providerLabel = provider === 'paypal' ? 'PayPal' : provider === 'paymongo' ? 'PayMongo' : null

  return (
    <main className="payment-success-page">
      <section className="payment-success-panel" aria-labelledby="payment-success-title">
        <div className="payment-success-mark" aria-hidden="true">
          <span>✓</span>
        </div>

        <p className="payment-success-kicker">Payment Successful</p>
        <h1 id="payment-success-title">Thank You for Subscription!</h1>
        <p className="payment-success-intro">
          Your subscription payment{providerLabel ? ` through ${providerLabel}` : ''} was completed.
          Your access is ready, and your financial health tools are available to support your next steps.
        </p>

        <div className="payment-success-confirmation" role="status">
          <strong>Subscription activated</strong>
          <span>A receipt and payment record will be available in your billing history.</span>
        </div>

        <Link className="payment-success-action" to="/financial-health-summary">
          Continue your Journey to Robust Financial Health!
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  )
}