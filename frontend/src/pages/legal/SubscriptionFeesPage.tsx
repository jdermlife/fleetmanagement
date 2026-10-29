import { Capacitor } from '@capacitor/core'
import { Link } from 'react-router-dom'

import SubscriptionPlansDisclosure from './SubscriptionPlansDisclosure'

export default function SubscriptionFeesPage() {
  const usesIosStore = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

  return (
    <div className="standalone-card auth-screen">
      <h1>Subscription Fees Disclosure</h1>
      <p className="intro">
        {usesIosStore
          ? 'Apple displays the current localized subscription price before you confirm a purchase.'
          : 'This page shows the latest published subscription plans and billing amounts.'}
      </p>

      <div className="stack-panel auth-panel">
        {usesIosStore ? null : <SubscriptionPlansDisclosure />}
        <p className="status-message">
          {usesIosStore ? 'View Apple purchase options at ' : 'Need payment instructions? Go to '}
          <Link to="/subscription/payment?plan=single">Subscription Payment</Link>
          {usesIosStore ? '.' : ' after signing in.'}
        </p>
      </div>
    </div>
  )
}
