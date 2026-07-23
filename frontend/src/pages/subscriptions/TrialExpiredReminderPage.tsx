import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

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

function planById(planId: string | null): PlanOption | null {
  if (planId !== 'single' && planId !== 'multiple') {
    return null
  }

  return PLAN_OPTIONS.find((option) => option.id === planId) ?? null
}

function resolvePaymentLinks(planId: PlanOptionId) {
  const defaultPaymongo = import.meta.env.VITE_PAYMONGO_CHECKOUT_URL?.trim() || '/support'
  const defaultPaypal = import.meta.env.VITE_PAYPAL_CHECKOUT_URL?.trim() || '/support'

  if (planId === 'single') {
    return {
      paymongo:
        import.meta.env.VITE_PAYMONGO_CHECKOUT_SINGLE_PROFILE_URL?.trim()
        || defaultPaymongo,
      paypal:
        import.meta.env.VITE_PAYPAL_CHECKOUT_SINGLE_PROFILE_URL?.trim()
        || defaultPaypal,
    }
  }

  return {
    paymongo:
      import.meta.env.VITE_PAYMONGO_CHECKOUT_MULTIPLE_PROFILE_URL?.trim()
      || defaultPaymongo,
    paypal:
      import.meta.env.VITE_PAYPAL_CHECKOUT_MULTIPLE_PROFILE_URL?.trim()
      || defaultPaypal,
  }
}

export default function TrialExpiredReminderPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const selectedPlan = planById(searchParams.get('plan'))
  const isPaymentStep = location.pathname === '/trial-expired/payment'

  if (isPaymentStep && selectedPlan) {
    const paymentLinks = resolvePaymentLinks(selectedPlan.id)

    return (
      <div className="standalone-card auth-screen trial-expired-page">
        <h1>Trial Expired</h1>
        <p className="intro">
          Your 2-day free trial has ended. Choose a payment channel to continue using FILSCORE.
        </p>

        <section className="stack-panel auth-panel trial-expired-plan-summary">
          <h2>{selectedPlan.title}</h2>
          <p className="trial-expired-price">{selectedPlan.priceLabel}</p>
          <p>{selectedPlan.note}</p>
        </section>

        <section className="stack-panel auth-panel trial-expired-payment-methods" aria-label="Payment channels">
          <h2>Payment Channels</h2>
          <p>Choose your preferred payment gateway:</p>
          <div className="trial-expired-payment-buttons">
            <a className="auth-link-button" href={paymentLinks.paymongo} target="_blank" rel="noreferrer">
              Pay with PayMongo
            </a>
            <a className="auth-link-button" href={paymentLinks.paypal} target="_blank" rel="noreferrer">
              Pay with PayPal
            </a>
          </div>
        </section>

        <div className="form-actions">
          <button
            type="button"
            className="auth-link-button"
            onClick={() => navigate('/trial-expired')}
          >
            Choose Another Plan
          </button>
          <Link className="auth-link-button" to="/login">
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

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
              onClick={() => navigate(`/trial-expired/payment?plan=${plan.id}`)}
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
