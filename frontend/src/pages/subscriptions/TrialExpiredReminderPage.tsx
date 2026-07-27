import { Link, useNavigate, useSearchParams } from 'react-router-dom'

type PlanOptionId = 'single' | 'multiple'

type PlanOption = {
  id: PlanOptionId
  title: string
  priceLabel: string
  note: string
}

type TrialState = 'reminder' | 'grace' | 'locked'

const PLAN_OPTIONS: PlanOption[] = [
  {
    id: 'single',
    title: 'Subscriber Single Profile Plan',
    priceLabel: 'Php 160.00 per month',
    note: 'Recommended for individual applicants',
  },
  {
    id: 'multiple',
    title: 'Subscriber Multiple Profile Plan',
    priceLabel: 'Php 1,600.00 per month',
    note: 'Recommended for teams and multi-profile users',
  },
]

function resolveTrialState(searchParams: URLSearchParams): TrialState {
  const state = searchParams.get('state')?.trim().toLowerCase()
  if (state === 'reminder') {
    return 'reminder'
  }

  if (state === 'locked') {
    return 'locked'
  }

  return 'locked'
}

export default function TrialExpiredReminderPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const state = resolveTrialState(searchParams)
  const accountQuery = searchParams.get('account')?.trim() || ''
  const isLocked = state === 'locked'
  const isReminder = state === 'reminder'

  return (
    <div className="standalone-card auth-screen trial-expired-page">
      <h1>{isLocked ? 'Account Locked' : isReminder ? 'Trial Expiry Reminder' : 'Trial Expired'}</h1>

      {isReminder ? (
        <p className="intro">
          Your 2-day free trial will expire in 8 hours. Choose a subscription plan now to keep
          uninterrupted access.
        </p>
      ) : isLocked ? (
        <p className="intro">
          Your account has been locked because payment was not completed within the grace period.
          Select a subscription plan below to reactivate your access.
        </p>
      ) : (
        <p className="intro">
          Your 2-day free trial has expired. You have 24 hours to complete payment and keep your
          account active. Select a subscription plan below to continue.
        </p>
      ) }

      {isLocked ? (
        <div className="stack-panel auth-panel">
          <p className="status-message status-error">
            Contact your administrator to request billing permissions or select a plan below to
            restart access.
          </p>
        </div>
      ) : null }

      <div className="stack-panel auth-panel trial-expired-plan-grid" role="list" aria-label="Subscription plans">
        {PLAN_OPTIONS.map((plan) => (
          <article key={plan.id} className="trial-expired-plan-card" role="listitem">
            <h2>{plan.title}</h2>
            <p className="trial-expired-price">{plan.priceLabel}</p>
            <p>{plan.note}</p>
            <button
              type="button"
              className="auth-link-button"
              onClick={() =>
                navigate(
                  `/subscription/payment?plan=${plan.id}${accountQuery ? `&account=${encodeURIComponent(accountQuery)}` : ''}`,
                )
              }
            >
              Select Plan
            </button>
          </article>
        ))}
      </div>

      <div className="form-actions">
        <Link className="auth-link-button" to="/login">
          Back to Login
        </Link>
      </div>
    </div>
  )
}
