import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { getErrorMessage, listPublicSubscriptionPlans, type SubscriptionPlan } from '../../api'

function formatMoney(amount: number | null, currency: string) {
  if (amount === null || Number.isNaN(amount)) {
    return 'Not available'
  }

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency || 'PHP',
    maximumFractionDigits: 2,
  }).format(amount)
}

export default function SubscriptionFeesPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const rows = await listPublicSubscriptionPlans()
        setPlans(rows)
      } catch (error) {
        setMessage(getErrorMessage(error, 'Unable to load subscription fees right now.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadPlans()
  }, [])

  const displayPlans = useMemo(
    () => plans
      .filter((plan) => plan.is_active && plan.is_public)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [plans],
  )

  return (
    <div className="standalone-card auth-screen">
      <h1>Subscription Fees Disclosure</h1>
      <p className="intro">
        This page shows the latest published subscription plans and billing amounts.
      </p>

      {isLoading ? <p>Loading subscription fees...</p> : null}
      {message ? <p className="status-message status-error">{message}</p> : null}

      {!isLoading && !message ? (
        <div className="stack-panel auth-panel">
          {displayPlans.length === 0 ? (
            <p className="status-message">No public subscription plans are available right now.</p>
          ) : (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Billing Cycle</th>
                    <th>Monthly Fee</th>
                    <th>Yearly Fee</th>
                    <th>Support</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPlans.map((plan) => (
                    <tr key={plan.id}>
                      <td>
                        <strong>{plan.plan_name}</strong>
                        <div>{plan.description || 'No description provided.'}</div>
                      </td>
                      <td>{plan.billing_cycle}</td>
                      <td>{formatMoney(plan.monthly_price, plan.currency)}</td>
                      <td>{formatMoney(plan.yearly_price, plan.currency)}</td>
                      <td>{plan.support_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="status-message">
            Need payment instructions? Go to <Link to="/subscription-payment">Subscription Payment</Link> after signing in.
          </p>
        </div>
      ) : null}
    </div>
  )
}
