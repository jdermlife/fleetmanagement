import { useNavigate } from 'react-router-dom'

export default function PaymentCancelled() {
  const navigate = useNavigate()

  return (
    <div className="standalone-card auth-screen">
      <h1>Payment Cancelled</h1>
      <p className="intro">
        Checkout was cancelled. You can retry payment anytime.
      </p>
      <div className="form-actions">
        <button type="button" onClick={() => navigate('/subscription/payment')}>
          Try Again
        </button>
      </div>
    </div>
  )
}
