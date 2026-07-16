import { useNavigate, useSearchParams } from 'react-router-dom'

export default function PaymentSuccess() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const paypalToken = searchParams.get('token')

  const nextParams = new URLSearchParams()
  nextParams.set('paypal', 'success')
  if (paypalToken) {
    nextParams.set('token', paypalToken)
  }

  return (
    <div className="standalone-card auth-screen">
      <h1>Payment Successful</h1>
      <p className="intro">
        Your payment has been received. Subscription activation is confirmed by secure gateway callback.
      </p>
      <div className="form-actions">
        <button type="button" onClick={() => navigate(`/subscription/payment?${nextParams.toString()}`)}>
          Continue
        </button>
      </div>
    </div>
  )
}
