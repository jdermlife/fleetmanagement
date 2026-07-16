import { useNavigate, useSearchParams } from 'react-router-dom'

export default function PaymentCancelled() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const paypalToken = searchParams.get('token')

  const nextParams = new URLSearchParams()
  nextParams.set('paypal', 'cancel')
  if (paypalToken) {
    nextParams.set('token', paypalToken)
  }

  return (
    <div className="standalone-card auth-screen">
      <h1>Payment Cancelled</h1>
      <p className="intro">
        Checkout was cancelled. You can retry payment anytime.
      </p>
      <div className="form-actions">
        <button type="button" onClick={() => navigate(`/subscription/payment?${nextParams.toString()}`)}>
          Try Again
        </button>
      </div>
    </div>
  )
}
