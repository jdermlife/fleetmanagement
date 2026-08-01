import { useEffect, useMemo, useState } from 'react'

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

export default function SubscriptionPlansDisclosure() {
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

  if (isLoading) {
    return <p className="subscription-fees-state">Loading subscription fees...</p>
  }

  if (message) {
    return <p className="status-message status-error">{message}</p>
  }

  if (displayPlans.length === 0) {
    return <p className="status-message">No public subscription plans are available right now.</p>
  }

  return (
    <div className="subscription-fees-table-wrap">
      <table className="subscription-fees-table">
        <thead>
          <tr>
            <th>Plan</th>
            <th>Billing Cycle</th>
            <th>Monthly</th>
            <th>Yearly</th>
            <th>Minimum Monthly</th>
            <th>Per Record</th>
            <th>Support</th>
          </tr>
        </thead>
        <tbody>
          {displayPlans.map((plan) => (
            <tr key={plan.id}>
              <td>
                <strong>{plan.plan_name}</strong>
                <span>{plan.description || 'No description provided.'}</span>
              </td>
              <td>{plan.billing_cycle}</td>
              <td>{formatMoney(plan.monthly_price, plan.currency)}</td>
              <td>{formatMoney(plan.yearly_price, plan.currency)}</td>
              <td>{formatMoney(plan.minimum_monthly_fee, plan.currency)}</td>
              <td>{formatMoney(plan.per_record_fee, plan.currency)}</td>
              <td>{plan.support_level}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}