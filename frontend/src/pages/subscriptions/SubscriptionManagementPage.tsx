import { useEffect, useState, type FormEvent } from 'react'

import {
  createFeature,
  createSubscription,
  createSubscriptionPlan,
  getErrorMessage,
  listFeatures,
  listPlanFeatures,
  listSubscriptionPlans,
  listSubscriptions,
  type Feature,
  type SubscriptionPlan,
  type SubscriptionRecord,
} from '../../api'

type SubmitEvent = FormEvent<HTMLFormElement>

function toDateValue(value: string): string {
  return value ? value : new Date().toISOString().slice(0, 10)
}

export default function SubscriptionManagementPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [planFeatures, setPlanFeatures] = useState<Record<number, Feature[]>>({})
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState('')

  const [planCode, setPlanCode] = useState('')
  const [planName, setPlanName] = useState('')
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY')
  const [monthlyPrice, setMonthlyPrice] = useState('')

  const [subscriptionNo, setSubscriptionNo] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('')
  const [subscriptionStart, setSubscriptionStart] = useState(toDateValue(''))
  const [subscriptionStatus, setSubscriptionStatus] = useState<'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'>('ACTIVE')

  const [featureCode, setFeatureCode] = useState('')
  const [featureName, setFeatureName] = useState('')

  const loadData = async () => {
    setLoading(true)
    setStatusMessage('')
    try {
      const [planRows, subscriptionRows, featureRows] = await Promise.all([
        listSubscriptionPlans(),
        listSubscriptions(),
        listFeatures(),
      ])
      setPlans(planRows)
      setSubscriptions(subscriptionRows)
      setFeatures(featureRows)

      const planFeatureEntries = await Promise.all(
        planRows.slice(0, 5).map(async (plan) => {
          const planFeatureRows = await listPlanFeatures(plan.id)
          return [plan.id, planFeatureRows] as const
        }),
      )
      setPlanFeatures(Object.fromEntries(planFeatureEntries))
    } catch (error) {
      setStatusMessage(getErrorMessage(error, 'Failed to load subscription billing data.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleCreatePlan = async (event: SubmitEvent) => {
    event.preventDefault()
    setStatusMessage('')

    try {
      await createSubscriptionPlan({
        plan_code: planCode,
        plan_name: planName,
        billing_cycle: billingCycle,
        monthly_price: monthlyPrice ? Number(monthlyPrice) : undefined,
      })
      setPlanCode('')
      setPlanName('')
      setBillingCycle('MONTHLY')
      setMonthlyPrice('')
      await loadData()
      setStatusMessage('Subscription plan created.')
    } catch (error) {
      setStatusMessage(getErrorMessage(error, 'Failed to create subscription plan.'))
    }
  }

  const handleCreateSubscription = async (event: SubmitEvent) => {
    event.preventDefault()
    setStatusMessage('')

    if (!selectedPlanId) {
      setStatusMessage('Please select a plan before creating a subscription.')
      return
    }

    try {
      await createSubscription({
        subscription_no: subscriptionNo,
        plan_id: Number(selectedPlanId),
        status: subscriptionStatus,
        subscription_start: subscriptionStart,
      })
      setSubscriptionNo('')
      setSelectedPlanId('')
      setSubscriptionStart(toDateValue(''))
      setSubscriptionStatus('ACTIVE')
      await loadData()
      setStatusMessage('Subscription created.')
    } catch (error) {
      setStatusMessage(getErrorMessage(error, 'Failed to create subscription.'))
    }
  }

  const handleCreateFeature = async (event: SubmitEvent) => {
    event.preventDefault()
    setStatusMessage('')

    try {
      await createFeature({
        feature_code: featureCode,
        feature_name: featureName,
      })
      setFeatureCode('')
      setFeatureName('')
      await loadData()
      setStatusMessage('Feature created.')
    } catch (error) {
      setStatusMessage(getErrorMessage(error, 'Failed to create feature.'))
    }
  }

  return (
    <div className="standalone-card">
      <h1>Subscription Billing</h1>
      <p className="intro">
        Manage subscription plans, customer subscriptions, and plan features.
      </p>

      {statusMessage ? <p className="status-message">{statusMessage}</p> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Create Plan</h3>
        <form onSubmit={(event) => void handleCreatePlan(event)}>
          <div className="auth-profile-grid">
            <label>
              Plan Code
              <input value={planCode} onChange={(event) => setPlanCode(event.target.value)} required />
            </label>
            <label>
              Plan Name
              <input value={planName} onChange={(event) => setPlanName(event.target.value)} required />
            </label>
            <label>
              Billing Cycle
              <select value={billingCycle} onChange={(event) => setBillingCycle(event.target.value as 'MONTHLY' | 'QUARTERLY' | 'YEARLY')}>
                <option value="MONTHLY">MONTHLY</option>
                <option value="QUARTERLY">QUARTERLY</option>
                <option value="YEARLY">YEARLY</option>
              </select>
            </label>
            <label>
              Monthly Price
              <input value={monthlyPrice} onChange={(event) => setMonthlyPrice(event.target.value)} placeholder="0.00" />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit">Create Plan</button>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Create Subscription</h3>
        <form onSubmit={(event) => void handleCreateSubscription(event)}>
          <div className="auth-profile-grid">
            <label>
              Subscription No
              <input
                value={subscriptionNo}
                onChange={(event) => setSubscriptionNo(event.target.value)}
                placeholder="SUB-2026-0001"
                required
              />
            </label>
            <label>
              Plan
              <select
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value ? Number(event.target.value) : '')}
                required
              >
                <option value="">Select plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.plan_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={subscriptionStatus}
                onChange={(event) =>
                  setSubscriptionStatus(
                    event.target.value as 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED',
                  )
                }
              >
                <option value="TRIAL">TRIAL</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </label>
            <label>
              Start Date
              <input
                type="date"
                value={subscriptionStart}
                onChange={(event) => setSubscriptionStart(event.target.value)}
                required
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit">Create Subscription</button>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Create Feature</h3>
        <form onSubmit={(event) => void handleCreateFeature(event)}>
          <div className="auth-profile-grid">
            <label>
              Feature Code
              <input value={featureCode} onChange={(event) => setFeatureCode(event.target.value)} required />
            </label>
            <label>
              Feature Name
              <input value={featureName} onChange={(event) => setFeatureName(event.target.value)} required />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit">Create Feature</button>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Plans</h3>
        {loading ? (
          <p>Loading plans...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Cycle</th>
                  <th className="px-3 py-2 text-left">Price</th>
                  <th className="px-3 py-2 text-left">Features</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="px-3 py-2">{plan.plan_code}</td>
                    <td className="px-3 py-2">{plan.plan_name}</td>
                    <td className="px-3 py-2">{plan.billing_cycle}</td>
                    <td className="px-3 py-2">
                      {plan.monthly_price ?? plan.yearly_price ?? 0} {plan.currency}
                    </td>
                    <td className="px-3 py-2">
                      {(planFeatures[plan.id] ?? []).map((feature) => feature.feature_name).join(', ') || 'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Subscriptions</h3>
        {loading ? (
          <p>Loading subscriptions...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Subscription No</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Plan</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Next Billing</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td className="px-3 py-2">{subscription.subscription_no}</td>
                    <td className="px-3 py-2">{subscription.user_id}</td>
                    <td className="px-3 py-2">
                      {plans.find((plan) => plan.id === subscription.plan_id)?.plan_name ?? subscription.plan_id}
                    </td>
                    <td className="px-3 py-2">{subscription.status}</td>
                    <td className="px-3 py-2">{subscription.next_billing_date ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Features</h3>
        {loading ? (
          <p>Loading features...</p>
        ) : (
          <ul>
            {features.map((feature) => (
              <li key={feature.id}>
                {feature.feature_code} - {feature.feature_name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
