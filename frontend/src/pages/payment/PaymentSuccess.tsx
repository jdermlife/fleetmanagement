import { useNavigate } from 'react-router-dom'

export default function PaymentSuccess() {
  const navigate = useNavigate()

  return (
    <div className="standalone-card auth-screen">
      <h1>Payment Successful</h1>
      <p className="intro">
        Your payment has been received. Subscription activation is confirmed by secure gateway callback.
      </p>
      <div className="form-actions">
        <button type="button" onClick={() => navigate('/dashboard')}>
          Continue
        </button>
      </div>
    </div>
  )
}
