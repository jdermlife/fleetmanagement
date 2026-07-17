import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

import {
  createFeature,
  createSubscription,
  createSubscriptionPlan,
  getErrorMessage,
  listFeatures,
  listSubscriptionPayments,
  listPlanFeatures,
  listPaymentProviders,
  listSubscriptionPlans,
  listSubscriptions,
  updateSubscriptionPayment,
  updateSubscription,
  updateSubscriptionPlan,
  type Feature,
  type PaymentProvider,
  type SubscriptionPayment,
  type SubscriptionPlan,
  type SubscriptionRecord,
} from '../../api'
import { useAutosaveDraft } from '../../autosave/useAutosaveDraft'
import SubscriptionAccessDeniedCard from './SubscriptionAccessDeniedCard'

type SubmitEvent = FormEvent<HTMLFormElement>

function toDateValue(value: string): string {
  return value ? value : new Date().toISOString().slice(0, 10)
}

export default function SubscriptionManagementPage() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [payments, setPayments] = useState<SubscriptionPayment[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [providers, setProviders] = useState<PaymentProvider[]>([])
  const [planFeatures, setPlanFeatures] = useState<Record<number, Feature[]>>({})
  const [loading, setLoading] = useState(true)
  const [hasBillingAccessDenied, setHasBillingAccessDenied] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const [planCode, setPlanCode] = useState('')
  const [planName, setPlanName] = useState('')
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY')
  const [monthlyPrice, setMonthlyPrice] = useState('')
  const [trialDays, setTrialDays] = useState('30')
  const [supportLevel, setSupportLevel] = useState<'STANDARD' | 'PRIORITY' | 'PREMIUM' | 'ENTERPRISE'>('STANDARD')
  const [displayOrder, setDisplayOrder] = useState('1')
  const [isPublicPlan, setIsPublicPlan] = useState(true)
  const [isCustomPricing, setIsCustomPricing] = useState(false)

  const [subscriptionNo, setSubscriptionNo] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('')
  const [selectedProviderId, setSelectedProviderId] = useState<number | ''>('')
  const [subscriptionStart, setSubscriptionStart] = useState(toDateValue(''))
  const [subscriptionStatus, setSubscriptionStatus] = useState<'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'>('ACTIVE')
  const [subscriptionType, setSubscriptionType] = useState<'FREE' | 'TRIAL' | 'PAID' | 'LIFETIME'>('TRIAL')

  const [featureCode, setFeatureCode] = useState('')
  const [featureName, setFeatureName] = useState('')
  const [editPlanId, setEditPlanId] = useState<number | ''>('')
  const [editPlanSupportLevel, setEditPlanSupportLevel] = useState<'STANDARD' | 'PRIORITY' | 'PREMIUM' | 'ENTERPRISE'>('STANDARD')
  const [editPlanTrialDays, setEditPlanTrialDays] = useState('30')
  const [editPlanPublic, setEditPlanPublic] = useState(true)
  const [editSubscriptionId, setEditSubscriptionId] = useState<number | ''>('')
  const [editSubscriptionStatus, setEditSubscriptionStatus] = useState<'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'>('ACTIVE')
  const [editSubscriptionType, setEditSubscriptionType] = useState<'FREE' | 'TRIAL' | 'PAID' | 'LIFETIME'>('TRIAL')
  const [editRenewalCount, setEditRenewalCount] = useState('0')
  const [editCurrentUsers, setEditCurrentUsers] = useState('1')

  const planAutosave = useAutosaveDraft({
    scope: 'subscription-plan-create',
    entityKey: 'default',
    value: { planCode, planName, billingCycle, monthlyPrice, trialDays, supportLevel, displayOrder, isPublicPlan, isCustomPricing },
    defaults: { planCode: '', planName: '', billingCycle: 'MONTHLY' as typeof billingCycle, monthlyPrice: '', trialDays: '30', supportLevel: 'STANDARD' as typeof supportLevel, displayOrder: '1', isPublicPlan: true, isCustomPricing: false },
    onHydrate: (draft) => {
      setPlanCode(draft.planCode)
      setPlanName(draft.planName)
      setBillingCycle(draft.billingCycle)
      setMonthlyPrice(draft.monthlyPrice)
      setTrialDays(draft.trialDays)
      setSupportLevel(draft.supportLevel)
      setDisplayOrder(draft.displayOrder)
      setIsPublicPlan(draft.isPublicPlan)
      setIsCustomPricing(draft.isCustomPricing)
    },
  })
  const subscriptionAutosave = useAutosaveDraft({
    scope: 'subscription-create',
    entityKey: 'default',
    value: { subscriptionNo, selectedPlanId, selectedProviderId, subscriptionStart, subscriptionStatus, subscriptionType },
    defaults: { subscriptionNo: '', selectedPlanId: '' as number | '', selectedProviderId: '' as number | '', subscriptionStart: toDateValue(''), subscriptionStatus: 'ACTIVE' as typeof subscriptionStatus, subscriptionType: 'TRIAL' as typeof subscriptionType },
    onHydrate: (draft) => {
      setSubscriptionNo(draft.subscriptionNo)
      setSelectedPlanId(draft.selectedPlanId)
      setSelectedProviderId(draft.selectedProviderId)
      setSubscriptionStart(draft.subscriptionStart)
      setSubscriptionStatus(draft.subscriptionStatus)
      setSubscriptionType(draft.subscriptionType)
    },
  })
  const featureAutosave = useAutosaveDraft({
    scope: 'subscription-feature-create',
    entityKey: 'default',
    value: { featureCode, featureName },
    defaults: { featureCode: '', featureName: '' },
    onHydrate: (draft) => {
      setFeatureCode(draft.featureCode)
      setFeatureName(draft.featureName)
    },
  })
  const editPlanAutosave = useAutosaveDraft({
    scope: 'subscription-plan-edit',
    entityKey: 'default',
    value: { editPlanId, editPlanSupportLevel, editPlanTrialDays, editPlanPublic },
    defaults: { editPlanId: '' as number | '', editPlanSupportLevel: 'STANDARD' as typeof editPlanSupportLevel, editPlanTrialDays: '30', editPlanPublic: true },
    onHydrate: (draft) => {
      setEditPlanId(draft.editPlanId)
      setEditPlanSupportLevel(draft.editPlanSupportLevel)
      setEditPlanTrialDays(draft.editPlanTrialDays)
      setEditPlanPublic(draft.editPlanPublic)
    },
  })
  const editSubscriptionAutosave = useAutosaveDraft({
    scope: 'subscription-edit',
    entityKey: 'default',
    value: { editSubscriptionId, editSubscriptionStatus, editSubscriptionType, editRenewalCount, editCurrentUsers },
    defaults: { editSubscriptionId: '' as number | '', editSubscriptionStatus: 'ACTIVE' as typeof editSubscriptionStatus, editSubscriptionType: 'TRIAL' as typeof editSubscriptionType, editRenewalCount: '0', editCurrentUsers: '1' },
    onHydrate: (draft) => {
      setEditSubscriptionId(draft.editSubscriptionId)
      setEditSubscriptionStatus(draft.editSubscriptionStatus)
      setEditSubscriptionType(draft.editSubscriptionType)
      setEditRenewalCount(draft.editRenewalCount)
      setEditCurrentUsers(draft.editCurrentUsers)
    },
  })

  const activeSubscription = subscriptions.find((subscription) => subscription.status === 'ACTIVE') ?? null
  const activePlan = activeSubscription
    ? plans.find((plan) => plan.id === activeSubscription.plan_id) ?? null
    : null

  const loadData = async () => {
    setLoading(true)
    setStatusMessage('')
    try {
      const [planRows, subscriptionRows, paymentRows, featureRows, providerRows] = await Promise.all([
        listSubscriptionPlans(),
        listSubscriptions(),
        listSubscriptionPayments(),
        listFeatures(),
        listPaymentProviders(),
      ])
      setPlans(planRows)
      setSubscriptions(subscriptionRows)
      setPayments(paymentRows)
      setFeatures(featureRows)
      setProviders(providerRows)
      setHasBillingAccessDenied(false)

      const planFeatureEntries = await Promise.all(
        planRows.slice(0, 5).map(async (plan) => {
          const planFeatureRows = await listPlanFeatures(plan.id)
          return [plan.id, planFeatureRows] as const
        }),
      )
      setPlanFeatures(Object.fromEntries(planFeatureEntries))
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        setHasBillingAccessDenied(true)
        setStatusMessage('You do not have access to subscription management. Contact your administrator to request billing permissions.')
        return
      }

      setHasBillingAccessDenied(false)
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
        trial_days: Number(trialDays),
        support_level: supportLevel,
        display_order: Number(displayOrder),
        is_public: isPublicPlan,
        is_custom_pricing: isCustomPricing,
      })
      await planAutosave.clear()
      setPlanCode('')
      setPlanName('')
      setBillingCycle('MONTHLY')
      setMonthlyPrice('')
      setTrialDays('30')
      setSupportLevel('STANDARD')
      setDisplayOrder('1')
      setIsPublicPlan(true)
      setIsCustomPricing(false)
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
        subscription_type: subscriptionType,
        subscription_start: subscriptionStart,
        payment_provider_id: selectedProviderId ? Number(selectedProviderId) : undefined,
      })
      await subscriptionAutosave.clear()
      setSubscriptionNo('')
      setSelectedPlanId('')
      setSelectedProviderId('')
      setSubscriptionStart(toDateValue(''))
      setSubscriptionStatus('ACTIVE')
      setSubscriptionType('TRIAL')
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
      await featureAutosave.clear()
      setFeatureCode('')
      setFeatureName('')
      await loadData()
      setStatusMessage('Feature created.')
    } catch (error) {
      setStatusMessage(getErrorMessage(error, 'Failed to create feature.'))
    }
  }

  const handleUpdatePlan = async (event: SubmitEvent) => {
    event.preventDefault()
    setStatusMessage('')

    if (!editPlanId) {
      setStatusMessage('Please select a plan to update.')
      return
    }

    try {
      await updateSubscriptionPlan(Number(editPlanId), {
        support_level: editPlanSupportLevel,
        trial_days: Number(editPlanTrialDays),
        is_public: editPlanPublic,
      })
      await editPlanAutosave.clear()
      await loadData()
      setStatusMessage('Plan updated.')
    } catch (error) {
      setStatusMessage(getErrorMessage(error, 'Failed to update plan.'))
    }
  }

  const handleUpdateSubscription = async (event: SubmitEvent) => {
    event.preventDefault()
    setStatusMessage('')

    if (!editSubscriptionId) {
      setStatusMessage('Please select a subscription to update.')
      return
    }

    try {
      await updateSubscription(Number(editSubscriptionId), {
        status: editSubscriptionStatus,
        subscription_type: editSubscriptionType,
        renewal_count: Number(editRenewalCount),
        current_users: Number(editCurrentUsers),
      })
      await editSubscriptionAutosave.clear()
      await loadData()
      setStatusMessage('Subscription updated.')
    } catch (error) {
      setStatusMessage(getErrorMessage(error, 'Failed to update subscription.'))
    }
  }

  const handleUpdatePaymentStatus = async (
    paymentId: number,
    paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED',
  ) => {
    setStatusMessage('')

    try {
      await updateSubscriptionPayment(paymentId, { payment_status: paymentStatus })
      await loadData()
      setStatusMessage(`Payment ${paymentId} marked as ${paymentStatus}.`)
    } catch (error) {
      setStatusMessage(getErrorMessage(error, 'Failed to update payment status.'))
    }
  }

  return (
    <div className="standalone-card">
      <h1>Subscription Billing</h1>
      <p className="intro">
        Manage subscription plans, customer subscriptions, and plan features.
      </p>

      <div className="auth-profile-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Current Plan</h3>
          <p className="status-message">{activePlan?.plan_name ?? 'Professional'}</p>
        </div>
        <div className="card">
          <h3>Status</h3>
          <p className="status-message">{activeSubscription?.status ?? 'ACTIVE'}</p>
        </div>
        <div className="card">
          <h3>Expires</h3>
          <p className="status-message">{activeSubscription?.subscription_end ?? 'August 1 2026'}</p>
        </div>
      </div>

      <div className="form-actions" style={{ marginBottom: 16 }}>
        <button type="button" onClick={() => setStatusMessage('Upgrade flow opens from Subscription Payment.')}>Upgrade</button>
        <button type="button" onClick={() => setStatusMessage('Renew flow opens from Subscription Payment.')}>Renew</button>
        <button type="button" onClick={() => setStatusMessage('Cancel request noted. Use status update controls below to finalize.')}>Cancel</button>
      </div>

      {statusMessage ? <p className="status-message">{statusMessage}</p> : null}

      {!loading && hasBillingAccessDenied ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <SubscriptionAccessDeniedCard onGoToAccount={() => navigate('/account')} />
        </div>
      ) : null}

      {!hasBillingAccessDenied ? (
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
            <label>
              Trial Days
              <input value={trialDays} onChange={(event) => setTrialDays(event.target.value)} type="number" min={0} />
            </label>
            <label>
              Support Level
              <select
                value={supportLevel}
                onChange={(event) =>
                  setSupportLevel(event.target.value as 'STANDARD' | 'PRIORITY' | 'PREMIUM' | 'ENTERPRISE')
                }
              >
                <option value="STANDARD">STANDARD</option>
                <option value="PRIORITY">PRIORITY</option>
                <option value="PREMIUM">PREMIUM</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </label>
            <label>
              Display Order
              <input value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} type="number" min={1} />
            </label>
            <label>
              Public Plan
              <select value={isPublicPlan ? 'true' : 'false'} onChange={(event) => setIsPublicPlan(event.target.value === 'true')}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label>
              Custom Pricing
              <select
                value={isCustomPricing ? 'true' : 'false'}
                onChange={(event) => setIsCustomPricing(event.target.value === 'true')}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit">Create Plan</button>
          </div>
        </form>
      </div>
      ) : null}

      {!hasBillingAccessDenied ? (
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
                    {plan.plan_name} ({plan.plan_code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Payment Provider
              <select
                value={selectedProviderId}
                onChange={(event) => setSelectedProviderId(event.target.value ? Number(event.target.value) : '')}
              >
                <option value="">None</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.provider_name}
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
              Type
              <select
                value={subscriptionType}
                onChange={(event) => setSubscriptionType(event.target.value as 'FREE' | 'TRIAL' | 'PAID' | 'LIFETIME')}
              >
                <option value="FREE">FREE</option>
                <option value="TRIAL">TRIAL</option>
                <option value="PAID">PAID</option>
                <option value="LIFETIME">LIFETIME</option>
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
      ) : null}

      {!hasBillingAccessDenied ? (
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
      ) : null}

      {!hasBillingAccessDenied ? (
        <div className="card" style={{ marginBottom: 16 }}>
        <h3>Edit Plan</h3>
        <form onSubmit={(event) => void handleUpdatePlan(event)}>
          <div className="auth-profile-grid">
            <label>
              Plan
              <select
                value={editPlanId}
                onChange={(event) => setEditPlanId(event.target.value ? Number(event.target.value) : '')}
                required
              >
                <option value="">Select plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.plan_name} ({plan.plan_code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Support Level
              <select
                value={editPlanSupportLevel}
                onChange={(event) =>
                  setEditPlanSupportLevel(event.target.value as 'STANDARD' | 'PRIORITY' | 'PREMIUM' | 'ENTERPRISE')
                }
              >
                <option value="STANDARD">STANDARD</option>
                <option value="PRIORITY">PRIORITY</option>
                <option value="PREMIUM">PREMIUM</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </label>
            <label>
              Trial Days
              <input
                value={editPlanTrialDays}
                onChange={(event) => setEditPlanTrialDays(event.target.value)}
                type="number"
                min={0}
              />
            </label>
            <label>
              Public Plan
              <select value={editPlanPublic ? 'true' : 'false'} onChange={(event) => setEditPlanPublic(event.target.value === 'true')}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit">Update Plan</button>
          </div>
        </form>
      </div>
      ) : null}

      {!hasBillingAccessDenied ? (
        <div className="card" style={{ marginBottom: 16 }}>
        <h3>Edit Subscription</h3>
        <form onSubmit={(event) => void handleUpdateSubscription(event)}>
          <div className="auth-profile-grid">
            <label>
              Subscription
              <select
                value={editSubscriptionId}
                onChange={(event) => setEditSubscriptionId(event.target.value ? Number(event.target.value) : '')}
                required
              >
                <option value="">Select subscription</option>
                {subscriptions.map((subscription) => (
                  <option key={subscription.id} value={subscription.id}>
                    {subscription.subscription_no}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={editSubscriptionStatus}
                onChange={(event) =>
                  setEditSubscriptionStatus(
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
              Type
              <select
                value={editSubscriptionType}
                onChange={(event) => setEditSubscriptionType(event.target.value as 'FREE' | 'TRIAL' | 'PAID' | 'LIFETIME')}
              >
                <option value="FREE">FREE</option>
                <option value="TRIAL">TRIAL</option>
                <option value="PAID">PAID</option>
                <option value="LIFETIME">LIFETIME</option>
              </select>
            </label>
            <label>
              Renewal Count
              <input
                value={editRenewalCount}
                onChange={(event) => setEditRenewalCount(event.target.value)}
                type="number"
                min={0}
              />
            </label>
            <label>
              Current Users
              <input
                value={editCurrentUsers}
                onChange={(event) => setEditCurrentUsers(event.target.value)}
                type="number"
                min={0}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit">Update Subscription</button>
          </div>
        </form>
      </div>
      ) : null}

      {!hasBillingAccessDenied ? (
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
                  <th className="px-3 py-2 text-left">Monthly</th>
                  <th className="px-3 py-2 text-left">Yearly</th>
                  <th className="px-3 py-2 text-left">Trial Days</th>
                  <th className="px-3 py-2 text-left">Support</th>
                  <th className="px-3 py-2 text-left">Public</th>
                  <th className="px-3 py-2 text-left">Max Users</th>
                  <th className="px-3 py-2 text-left">Features</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="px-3 py-2">{plan.plan_code}</td>
                    <td className="px-3 py-2">{plan.plan_name}</td>
                    <td className="px-3 py-2">{plan.billing_cycle}</td>
                    <td className="px-3 py-2">{plan.monthly_price ?? 0} {plan.currency}</td>
                    <td className="px-3 py-2">{plan.yearly_price ?? 0} {plan.currency}</td>
                    <td className="px-3 py-2">{plan.trial_days}</td>
                    <td className="px-3 py-2">{plan.support_level}</td>
                    <td className="px-3 py-2">{plan.is_public ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2">{plan.max_users ?? '∞'}</td>
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
      ) : null}

      {!hasBillingAccessDenied ? (
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
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Renewals</th>
                  <th className="px-3 py-2 text-left">Usage (Users/Vehicles/Drivers)</th>
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
                    <td className="px-3 py-2">{subscription.subscription_type}</td>
                    <td className="px-3 py-2">{subscription.renewal_count}</td>
                    <td className="px-3 py-2">
                      {subscription.current_users}/{subscription.current_vehicles}/{subscription.current_drivers}
                    </td>
                    <td className="px-3 py-2">{subscription.next_billing_date ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      ) : null}

      {!hasBillingAccessDenied ? (
        <div className="card" style={{ marginBottom: 16 }}>
        <h3>Payment Providers</h3>
        {loading ? (
          <p>Loading providers...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">API Endpoint</th>
                  <th className="px-3 py-2 text-left">Webhook URL</th>
                  <th className="px-3 py-2 text-left">Active</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.id}>
                    <td className="px-3 py-2">{provider.provider_code}</td>
                    <td className="px-3 py-2">{provider.provider_name}</td>
                    <td className="px-3 py-2">{provider.api_endpoint ?? 'N/A'}</td>
                    <td className="px-3 py-2">{provider.webhook_url ?? 'N/A'}</td>
                    <td className="px-3 py-2">{provider.is_active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      ) : null}

      {!hasBillingAccessDenied ? (
        <div className="card" style={{ marginBottom: 16 }}>
        <h3>Subscription Payments</h3>
        {loading ? (
          <p>Loading payments...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Reference</th>
                  <th className="px-3 py-2 text-left">Subscription</th>
                  <th className="px-3 py-2 text-left">Plan</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Method</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Paid At</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const subscription = subscriptions.find((row) => row.id === payment.subscription_id) ?? null
                  const plan = subscription ? plans.find((row) => row.id === subscription.plan_id) ?? null : null
                  return (
                    <tr key={payment.id}>
                      <td className="px-3 py-2">{payment.payment_reference}</td>
                      <td className="px-3 py-2">{subscription?.subscription_no ?? payment.subscription_id}</td>
                      <td className="px-3 py-2">{plan?.plan_name ?? subscription?.plan_id ?? 'N/A'}</td>
                      <td className="px-3 py-2">
                        {payment.amount ?? 0} {payment.currency ?? 'PHP'}
                      </td>
                      <td className="px-3 py-2">{payment.payment_method ?? 'N/A'}</td>
                      <td className="px-3 py-2">{payment.payment_status}</td>
                      <td className="px-3 py-2">{payment.paid_at ?? 'N/A'}</td>
                      <td className="px-3 py-2">
                        <div className="form-actions">
                          {payment.payment_status !== 'SUCCESS' ? (
                            <button
                              type="button"
                              onClick={() => void handleUpdatePaymentStatus(payment.id, 'SUCCESS')}
                            >
                              Mark Success
                            </button>
                          ) : null}
                          {payment.payment_status !== 'FAILED' ? (
                            <button
                              type="button"
                              onClick={() => void handleUpdatePaymentStatus(payment.id, 'FAILED')}
                            >
                              Mark Failed
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      ) : null}

      {!hasBillingAccessDenied ? (
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
      ) : null}
    </div>
  )
}
