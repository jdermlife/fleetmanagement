import { ArrowRight, ChevronDown, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

const JOURNEY_MENU_GROUPS = [
  {
    title: 'Journey Overview',
    links: [
      { label: 'Financial Health Journey', route: '/financial-health-journey' },
      { label: 'Financial Health Summary', route: '/financial-health-summary' },
    ],
  },
  {
    title: 'Build Your Foundation',
    links: [
      { label: 'Personalize / Build Profile', route: '/build-profile' },
      { label: 'Loan & Wealth Readiness', route: '/lending-scorecard' },
      { label: 'Wealth Builder', route: '/net-worth-positioning' },
    ],
  },
  {
    title: 'Manage Your Finances',
    links: [
      { label: 'Budget & Expense Tracker', route: '/budget-expense-tracker' },
      { label: 'Resource Optimizer', route: '/loan-monitoring' },
      { label: 'Bill Manager', route: '/bill-reminder' },
    ],
  },
  {
    title: 'Track Progress',
    links: [
      { label: 'Financial Health Dashboard', route: '/financial-health-summary' },
      { label: 'Financial Decisions & Action Plan', route: '/financial-decisions' },
      { label: 'Reports & Statements', route: '/reports-statements' },
    ],
  },
] as const

type FinancialHealthJourneyMenuProps = {
  className?: string
}

export default function FinancialHealthJourneyMenu({ className = '' }: FinancialHealthJourneyMenuProps) {
  return (
    <details className={`financial-health-journey-menu ${className}`.trim()}>
      <summary>
        <span>
          <Compass aria-hidden="true" />
          Financial Health Journey Menu
        </span>
        <ChevronDown className="financial-health-journey-menu-chevron" aria-hidden="true" />
      </summary>
      <nav className="financial-health-journey-menu-panel" aria-label="Financial Health Journey pages">
        {JOURNEY_MENU_GROUPS.map((group) => (
          <section key={group.title} className="financial-health-journey-menu-group">
            <h2>{group.title}</h2>
            {group.links.map((link) => (
              <Link key={`${group.title}-${link.label}`} to={link.route}>
                <span>{link.label}</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            ))}
          </section>
        ))}
      </nav>
    </details>
  )
}