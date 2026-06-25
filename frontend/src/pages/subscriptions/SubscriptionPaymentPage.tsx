import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { getErrorMessage, listSubscriptionPlans, type SubscriptionPlan } from '../../api'

function monthlyEquivalent(plan: SubscriptionPlan): number {
  if (plan.monthly_price && plan.monthly_price > 0) {
    return plan.monthly_price
  }
  if (plan.yearly_price && plan.yearly_price > 0) {
    return plan.yearly_price / 12
  }
  return 0
}

export default function SubscriptionPaymentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loadMessage, setLoadMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [paymentMessage, setPaymentMessage] = useState('')

  const selectedPlanId = Number(searchParams.get('planId') ?? 0)

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const rows = await listSubscriptionPlans()
        setPlans(rows)
      } catch (error) {
        setLoadMessage(getErrorMessage(error, 'Unable to load subscription payment details.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadPlans()
  }, [])

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  )

  const handleProceedPayment = () => {
    setPaymentMessage('Payment gateway handoff is ready for integration. Connect your provider checkout URL here.')
  }

  return (
    <div className="standalone-card auth-screen">
      <h1>Subscription Payment</h1>
      <p className="intro">Review your selected plan and continue payment.</p>

      {isLoading ? <p>Loading payment details...</p> : null}
      {loadMessage ? <p className="status-message status-error">{loadMessage}</p> : null}

      {!isLoading && selectedPlan ? (
        <div className="card auth-helper-card">
          <h3>{selectedPlan.plan_name}</h3>
          <p className="intro">
            Plan code: {selectedPlan.plan_code} | Support level: {selectedPlan.support_level}
          </p>
          <p className="status-message">
            Amount due: {selectedPlan.currency} {monthlyEquivalent(selectedPlan).toFixed(2)} / month
          </p>
          <div className="form-actions">
            <button type="button" onClick={() => navigate('/account')}>
              Back to Account
            </button>
            <button type="button" onClick={handleProceedPayment}>
              Proceed to Payment
            </button>
          </div>
          {paymentMessage ? <p className="status-message">{paymentMessage}</p> : null}
        </div>
      ) : null}

      {!isLoading && !selectedPlan ? (
        <div className="card auth-helper-card">
          <p className="status-message">No plan selected. Please choose a plan from your account page first.</p>
          <div className="form-actions">
            <button type="button" onClick={() => navigate('/account')}>
              Go to Account
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
