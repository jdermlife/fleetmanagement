import { Link } from 'react-router-dom'

import SubscriptionPlansDisclosure from './SubscriptionPlansDisclosure'

export default function SubscriptionFeesPage() {
  return (
    <div className="standalone-card auth-screen">
      <h1>Subscription Fees Disclosure</h1>
      <p className="intro">
        This page shows the latest published subscription plans and billing amounts.
      </p>

      <div className="stack-panel auth-panel">
        <SubscriptionPlansDisclosure />
        <p className="status-message">
          Need payment instructions? Go to <Link to="/subscription-payment">Subscription Payment</Link> after signing in.
        </p>
      </div>
    </div>
  )
}
