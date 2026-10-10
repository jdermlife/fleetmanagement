import { ChartNoAxesCombined, CreditCard, WalletCards } from 'lucide-react'

interface FinancialPositionCompositeProps {
  cashFlowScore: number
  creditHealthScore: number
  netWorthGrowthScore: number
}

function normalizeScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function scoreStatus(score: number) {
  if (score >= 80) return 'Strong'
  if (score >= 60) return 'Watch'
  return 'Action needed'
}

export default function FinancialPositionComposite({
  cashFlowScore,
  creditHealthScore,
  netWorthGrowthScore,
}: FinancialPositionCompositeProps) {
  const scores = {
    cashFlow: normalizeScore(cashFlowScore),
    creditHealth: normalizeScore(creditHealthScore),
    netWorthGrowth: normalizeScore(netWorthGrowthScore),
  }
  const compositeScore = Math.round((scores.cashFlow + scores.creditHealth + scores.netWorthGrowth) / 3)
  const segments = [
    {
      id: 'cash-flow',
      label: 'Cash Flow Position',
      score: scores.cashFlow,
      description: 'Income, expenses and savings strength',
      Icon: WalletCards,
    },
    {
      id: 'credit-health',
      label: 'Credit Health',
      score: scores.creditHealth,
      description: 'Credit capacity and lending profile',
      Icon: CreditCard,
    },
    {
      id: 'net-worth-growth',
      label: 'Net Worth Growth',
      score: scores.netWorthGrowth,
      description: 'Progress toward your net-worth goal',
      Icon: ChartNoAxesCombined,
    },
  ]

  return (
    <figure
      className="financial-position-composite"
      aria-label={`Combined Financial Position: ${compositeScore} out of 100`}
    >
      <figcaption>
        <span className="financial-position-composite-mark" aria-hidden="true">FS</span>
        <span className="financial-position-composite-title">
          <strong>Combined Financial Position</strong>
          <small>Cash flow, credit health and net-worth growth</small>
        </span>
        <span className="financial-position-composite-total" aria-label={`Composite score: ${compositeScore} out of 100`}>
          <strong>{compositeScore}</strong>
          <small>/100</small>
        </span>
      </figcaption>
      <div className="financial-position-composite-visual">
        {segments.map(({ id, label, score, description, Icon }) => (
          <div
            key={id}
            className={`financial-position-composite-segment financial-position-composite-segment-${id}`}
            role="progressbar"
            aria-label={`${label}: ${score} out of 100`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={score}
          >
            <span className="financial-position-composite-segment-heading">
              <Icon aria-hidden="true" />
              <b>{label}</b>
            </span>
            <span className="financial-position-composite-score">
              <strong>{score}</strong>
              <span>/100</span>
            </span>
            <small>{description}</small>
            <span className="financial-position-composite-track" aria-hidden="true">
              <span style={{ width: `${score}%` }} />
            </span>
            <span className="financial-position-composite-status">{scoreStatus(score)}</span>
          </div>
        ))}
      </div>
    </figure>
  )
}