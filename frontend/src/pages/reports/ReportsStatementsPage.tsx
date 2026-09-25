import {
  BadgeCheck,
  BarChart3,
  FileBadge,
  Landmark,
  LineChart,
  LockKeyhole,
  ReceiptText,
  Scale,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuthorization } from '../../hooks/useAuthorization'
import { usePaidScoreCertificationAccess } from '../../hooks/usePaidScoreCertificationAccess'

type ReportItem = {
  description: string
  destination: string
  icon: typeof FileBadge
  title: string
}

const statementItems: ReportItem[] = [
  {
    title: 'Statement of Net Worth',
    description: 'Review current assets, liabilities, and the resulting net worth position.',
    destination: '/net-worth-positioning',
    icon: Landmark,
  },
  {
    title: 'Balance Sheet',
    description: 'Open the existing assets and liabilities reporting workflow.',
    destination: '/financial-health-summary',
    icon: Scale,
  },
  {
    title: 'Income Statement',
    description: 'Review income, expenses, and the current operating result.',
    destination: '/budget-expense-tracker',
    icon: ReceiptText,
  },
  {
    title: 'Cash Flow Statement',
    description: 'Review monthly inflows, outflows, and available cash flow.',
    destination: '/budget-expense-tracker',
    icon: LineChart,
  },
]

const certificateItems: ReportItem[] = [
  {
    title: 'Credit Score Certificate',
    description: 'Open Credit Health to review and produce the FILSCORE credit certificate.',
    destination: '/lending-scorecard/filscore',
    icon: BadgeCheck,
  },
  {
    title: 'Wealth Protection Score Certificate',
    description: 'Open Wealth Building to review protection readiness and certification results.',
    destination: '/net-worth-positioning',
    icon: ShieldCheck,
  },
  {
    title: 'Wealth Building Score Certificate',
    description: 'Open the existing wealth assessment and certification workflow.',
    destination: '/net-worth-positioning',
    icon: BarChart3,
  },
]

function ReportCard({ item, locked }: { item: ReportItem; locked: boolean }) {
  const Icon = item.icon
  const content = (
    <>
      <div className="reports-statements-card-icon" aria-hidden="true"><Icon /></div>
      <div className="reports-statements-card-copy">
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <span>{locked ? 'Paid account required' : 'Open report'}</span>
      </div>
      {locked ? <LockKeyhole className="reports-statements-card-lock" aria-hidden="true" /> : null}
    </>
  )

  if (locked) {
    return <article className="reports-statements-card is-locked" aria-disabled="true">{content}</article>
  }

  return <Link className="reports-statements-card" to={item.destination}>{content}</Link>
}

export default function ReportsStatementsPage() {
  const { isAdmin } = useAuthorization()
  const { hasPaidScoreAccess, isScoreAccessLoading } = usePaidScoreCertificationAccess(isAdmin)
  const locked = isScoreAccessLoading || !hasPaidScoreAccess

  return (
    <div className="psychometric-page reports-statements-page">
      <header className="reports-statements-header">
        <span>Financial records</span>
        <h1>Reports &amp; Statements</h1>
        <p>Access your existing financial statements and score certificates from one place.</p>
      </header>

      <section className="reports-statements-section" aria-labelledby="financial-statements-heading">
        <div className="reports-statements-section-heading">
          <FileBadge aria-hidden="true" />
          <div>
            <span>Financial position</span>
            <h2 id="financial-statements-heading">Financial Statements</h2>
          </div>
        </div>
        <div className="reports-statements-grid">
          {statementItems.map((item) => <ReportCard key={item.title} item={item} locked={locked} />)}
        </div>
      </section>

      <section className="reports-statements-section" aria-labelledby="score-certificates-heading">
        <div className="reports-statements-section-heading">
          <BadgeCheck aria-hidden="true" />
          <div>
            <span>Verified assessments</span>
            <h2 id="score-certificates-heading">Score Certificates</h2>
          </div>
        </div>
        <div className="reports-statements-grid reports-statements-certificate-grid">
          {certificateItems.map((item) => <ReportCard key={item.title} item={item} locked={locked} />)}
        </div>
      </section>
    </div>
  )
}