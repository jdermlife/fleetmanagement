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
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchAutosaveDraft } from '../../autosave/draftApi'
import { useAuthorization } from '../../hooks/useAuthorization'
import { usePaidScoreCertificationAccess } from '../../hooks/usePaidScoreCertificationAccess'
import { useSelectedAnalysisEntity } from '../../hooks/useSelectedAnalysisEntity'
import FinancialStatementModal from '../admin/AdminFinancialStatementPage'
import LoanCertificationPage from '../scoring/LoanCertificationPage'
import NetWorthPositioningPage from '../scoring/NetWorthPositioningPage'
import type { CreditHealthGraphScores } from '../scoring/CreditHealthScoreGraph'
import { computeBudgetHealthScore, type BudgetHealthDraftInput } from '../scoring/budgetHealthEngine'
import { readReplicatedBuildProfile } from '../scoring/buildProfileReplication'
import {
  computeFinancialHealthSummary,
  type FinancialHealthSummaryResult,
} from '../scoring/financialHealthSummaryEngine'
import {
  deriveLendingLeafScores,
  type LendingLeafScores,
} from '../scoring/lendingLeafScores'
import { toFilscore } from '../scoring/filscoreScale'
import {
  computeNetWorthBuildingScore,
  type NetWorthBuildingDraftInput,
} from '../scoring/netWorthBuildingEngine'
import ReportCertificateModal from './ReportCertificateModal'
import WealthProtectionCertificate from './WealthProtectionCertificate'
import {
  computeWealthProtectionScore,
  type WealthProtectionScoreResult,
} from './wealthProtectionEngine'

type ReportItem = {
  actionLabel?: string | null
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
    actionLabel: 'Statement of Networth',
    description: 'Open the existing assets and liabilities reporting workflow.',
    destination: '/financial-health-summary',
    icon: Scale,
  },
  {
    title: 'Income Statement',
    actionLabel: 'See statement of Networth',
    description: 'Review income, expenses, and the current operating result.',
    destination: '/budget-expense-tracker',
    icon: ReceiptText,
  },
  {
    title: 'Cash Flow Statement',
    actionLabel: null,
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

const EMPTY_CREDIT_SCORES: CreditHealthGraphScores = {
  credit: null,
  nonStarter: null,
  social: null,
  psychometric: null,
}

function averageAvailable(values: Array<number | null>): number | null {
  const available = values.filter((value): value is number => value !== null)
  return available.length > 0
    ? available.reduce((total, value) => total + value, 0) / available.length
    : null
}

function profileNetWorthPayload(): NetWorthBuildingDraftInput | null {
  const profile = readReplicatedBuildProfile()
  if (!profile) return null

  const actualEntries = Object.fromEntries(Object.entries(profile.values)
    .filter(([key, value]) => key.startsWith('wealthActual.') && value.trim() !== '')
    .map(([key, value]) => [key.slice('wealthActual.'.length), value]))
  const amounts = Object.fromEntries(Object.entries(profile.values)
    .filter(([key, value]) => !key.includes('.') && value.trim() !== ''))

  if (Object.keys(actualEntries).length > 0) return { amounts: {}, actualEntries }
  return Object.keys(amounts).length > 0 ? { amounts } : null
}

function buildLiveSummary(
  netWorthPayload: NetWorthBuildingDraftInput | null,
  budgetPayload: BudgetHealthDraftInput | null,
  lendingScores: LendingLeafScores | null,
): FinancialHealthSummaryResult {
  const netWorthScore = netWorthPayload ? computeNetWorthBuildingScore(netWorthPayload) : null
  const components = netWorthScore?.componentScores
  const investmentScore = components
    ? averageAvailable([
        components.investmentReadiness,
        components.retirementReadiness,
        components.financialIndependence,
      ])
    : null

  return computeFinancialHealthSummary({
    credit: lendingScores?.creditScore ?? null,
    'cash-flow': components?.cashFlowStrength ?? null,
    wealth: netWorthScore?.normalizedScore ?? null,
    budget: budgetPayload ? computeBudgetHealthScore(budgetPayload).score : null,
    payment: components?.leverageControl ?? null,
    protection: components?.protectionCoverage ?? null,
    investment: investmentScore,
    goal: components?.goalMomentum ?? null,
  })
}

function ReportCard({
  item,
  loading = false,
  locked,
  onOpen,
}: {
  item: ReportItem
  loading?: boolean
  locked: boolean
  onOpen?: () => void
}) {
  const Icon = item.icon
  const content = (
    <>
      <div className="reports-statements-card-icon" aria-hidden="true"><Icon /></div>
      <div className="reports-statements-card-copy">
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        {locked || loading || item.actionLabel !== null ? (
          <span>{locked ? 'Paid account required' : loading ? 'Loading report data' : item.actionLabel ?? 'Open report'}</span>
        ) : null}
      </div>
      {locked ? <LockKeyhole className="reports-statements-card-lock" aria-hidden="true" /> : null}
    </>
  )

  if (locked) {
    return <article className="reports-statements-card is-locked" aria-disabled="true">{content}</article>
  }

  if (loading) {
    return <article className="reports-statements-card is-loading" aria-disabled="true">{content}</article>
  }

  if (onOpen) {
    return <button className="reports-statements-card" type="button" onClick={onOpen}>{content}</button>
  }

  return <Link className="reports-statements-card" to={item.destination}>{content}</Link>
}

export default function ReportsStatementsPage() {
  const { isAdmin } = useAuthorization()
  const statementAccess = usePaidScoreCertificationAccess(isAdmin, 'STATEMENTS')
  const certificateAccess = usePaidScoreCertificationAccess(isAdmin, 'CERTIFICATIONS')
  const { entityKey, isIdentityReady, selectedApplicationNo } = useSelectedAnalysisEntity()
  const [isNetWorthStatementOpen, setIsNetWorthStatementOpen] = useState(false)
  const [openCertificate, setOpenCertificate] = useState<'credit' | 'protection' | 'wealth' | null>(null)
  const [financialHealthSummary, setFinancialHealthSummary] = useState<FinancialHealthSummaryResult | null>(null)
  const [wealthProtectionScore, setWealthProtectionScore] = useState<WealthProtectionScoreResult | null>(null)
  const [creditScores, setCreditScores] = useState<CreditHealthGraphScores>(EMPTY_CREDIT_SCORES)
  const statementsLocked = statementAccess.isScoreAccessLoading || !statementAccess.hasPaidScoreAccess
  const certificatesLocked = certificateAccess.isScoreAccessLoading || !certificateAccess.hasPaidScoreAccess

  useEffect(() => {
    let disposed = false
    if (!isIdentityReady) return

    const loadStatementMetrics = async () => {
      const [netWorthDraft, budgetDraft, lendingDraft] = await Promise.all([
        fetchAutosaveDraft<NetWorthBuildingDraftInput>('net-worth-positioning', entityKey).catch(() => null),
        fetchAutosaveDraft<BudgetHealthDraftInput>('budget-expense-tracker', entityKey).catch(() => null),
        fetchAutosaveDraft<unknown>('loan-application', selectedApplicationNo || 'new').catch(() => null),
      ])
      if (disposed) return

      const lendingScores = lendingDraft?.payload ? deriveLendingLeafScores(lendingDraft.payload) : null
      const profile = readReplicatedBuildProfile()
      const netWorthInput = netWorthDraft?.payload ?? profileNetWorthPayload()
      setFinancialHealthSummary(buildLiveSummary(
        netWorthInput,
        budgetDraft?.payload ?? null,
        lendingScores,
      ))
      setWealthProtectionScore(computeWealthProtectionScore(netWorthInput, profile?.values))
      setCreditScores({
        credit: toFilscore(lendingScores?.creditScore ?? null),
        nonStarter: toFilscore(lendingScores?.nonStarterScore ?? null),
        social: toFilscore(lendingScores?.socialScore ?? null),
        psychometric: toFilscore(lendingScores?.psychometricScore ?? null),
      })
    }

    void loadStatementMetrics()
    return () => {
      disposed = true
    }
  }, [entityKey, isIdentityReady, selectedApplicationNo])

  return (
    <div className="psychometric-page reports-statements-page">
      {isNetWorthStatementOpen ? (
        <FinancialStatementModal
          onClose={() => setIsNetWorthStatementOpen(false)}
          financialHealthSummary={financialHealthSummary ?? computeFinancialHealthSummary()}
          creditScores={creditScores}
        />
      ) : null}
      {openCertificate === 'credit' ? (
        <ReportCertificateModal
          mode="credit"
          onClose={() => setOpenCertificate(null)}
          title="FILSCORE Credit Health Certificate"
        >
          <LoanCertificationPage />
        </ReportCertificateModal>
      ) : null}
      {openCertificate === 'protection' ? (
        <ReportCertificateModal
          mode="protection"
          onClose={() => setOpenCertificate(null)}
          title="Wealth Protection Score Certificate"
        >
          <WealthProtectionCertificate result={wealthProtectionScore} />
        </ReportCertificateModal>
      ) : null}
      {openCertificate === 'wealth' ? (
        <ReportCertificateModal
          mode="wealth"
          onClose={() => setOpenCertificate(null)}
          title="FILSCORE Wealth Building Score Certificate"
        >
          <NetWorthPositioningPage />
        </ReportCertificateModal>
      ) : null}
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
          {statementItems.map((item) => (
            <ReportCard
              key={item.title}
              item={item}
              loading={item.title === 'Statement of Net Worth' && !financialHealthSummary}
              locked={statementsLocked}
              onOpen={item.title === 'Statement of Net Worth' ? () => setIsNetWorthStatementOpen(true) : undefined}
            />
          ))}
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
          {certificateItems.map((item) => (
            <ReportCard
              key={item.title}
              item={item}
              locked={certificatesLocked}
              onOpen={item.title === 'Credit Score Certificate'
                ? () => setOpenCertificate('credit')
                : item.title === 'Wealth Protection Score Certificate'
                  ? () => setOpenCertificate('protection')
                : item.title === 'Wealth Building Score Certificate'
                  ? () => setOpenCertificate('wealth')
                  : undefined}
            />
          ))}
        </div>
      </section>
    </div>
  )
}