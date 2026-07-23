import { Link, useNavigate, useSearchParams } from 'react-router-dom'

type PlanOptionId = 'single' | 'multiple'

type PlanOption = {
  id: PlanOptionId
  title: string
  priceLabel: string
  note: string
}

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

export default function TrialExpiredReminderPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const accountQuery = searchParams.get('account')?.trim() || ''
  return (
    <div className="standalone-card auth-screen trial-expired-page">
      <h1>Trial Reminder</h1>
      <p className="intro">
        Your 2-day free trial has expired. Select a subscription plan to continue your account access.
      </p>

      <div className="stack-panel auth-panel trial-expired-plan-grid" role="list" aria-label="Subscription plans">
        {PLAN_OPTIONS.map((plan) => (
          <article key={plan.id} className="trial-expired-plan-card" role="listitem">
            <h2>{plan.title}</h2>
            <p className="trial-expired-price">{plan.priceLabel}</p>
            <p>{plan.note}</p>
            <button
              type="button"
              className="auth-link-button"
              onClick={() => navigate(`/subscription/payment?plan=${plan.id}${accountQuery ? `&account=${encodeURIComponent(accountQuery)}` : ''}`)}
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
