import { ChartNoAxesCombined, CreditCard, WalletCards } from 'lucide-react'

interface FinancialPositionCompositeProps {
  cashFlowScore: number
  creditHealthScore: number
  netWorthGrowthScore: number
}

interface Point {
  x: number
  y: number
}

const CENTER = 260
const OUTER_RADIUS = 238
const INNER_RADIUS = 98

function pointAt(angle: number, radius: number): Point {
  const radians = (angle * Math.PI) / 180
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  }
}

function segmentPath(startAngle: number, endAngle: number) {
  const outerStart = pointAt(startAngle, OUTER_RADIUS)
  const outerEnd = pointAt(endAngle, OUTER_RADIUS)
  const innerEnd = pointAt(endAngle, INNER_RADIUS)
  const innerStart = pointAt(startAngle, INNER_RADIUS)

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
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
      path: segmentPath(154, 266),
      gradient: 'financial-position-cash-gradient',
      Icon: WalletCards,
    },
    {
      id: 'credit-health',
      label: 'Credit Health',
      score: scores.creditHealth,
      description: 'Credit capacity and lending profile',
      path: segmentPath(274, 386),
      gradient: 'financial-position-credit-gradient',
      Icon: CreditCard,
    },
    {
      id: 'net-worth-growth',
      label: 'Net Worth Growth',
      score: scores.netWorthGrowth,
      description: 'Progress toward your net-worth goal',
      path: segmentPath(34, 146),
      gradient: 'financial-position-networth-gradient',
      Icon: ChartNoAxesCombined,
    },
  ]

  return (
    <figure
      className="financial-position-composite"
      aria-label={`Combined Financial Position: ${compositeScore} out of 100`}
    >
      <div className="financial-position-composite-visual">
        <svg viewBox="0 0 520 520" aria-hidden="true">
          <defs>
            <linearGradient id="financial-position-cash-gradient" x1="60" y1="60" x2="270" y2="330">
              <stop offset="0" stopColor="#18a7ff" />
              <stop offset="0.5" stopColor="#075bd8" />
              <stop offset="1" stopColor="#06369b" />
            </linearGradient>
            <linearGradient id="financial-position-credit-gradient" x1="270" y1="60" x2="470" y2="330">
              <stop offset="0" stopColor="#ff3b30" />
              <stop offset="0.55" stopColor="#dc141c" />
              <stop offset="1" stopColor="#9c0d18" />
            </linearGradient>
            <linearGradient id="financial-position-networth-gradient" x1="120" y1="330" x2="400" y2="500">
              <stop offset="0" stopColor="#ffd43b" />
              <stop offset="0.55" stopColor="#f5a900" />
              <stop offset="1" stopColor="#d77b00" />
            </linearGradient>
            <radialGradient id="financial-position-center-gradient">
              <stop offset="0" stopColor="#174d85" />
              <stop offset="1" stopColor="#071d35" />
            </radialGradient>
          </defs>
          {segments.map((segment) => (
            <path
              key={segment.id}
              d={segment.path}
              fill={`url(#${segment.gradient})`}
              opacity={0.58 + (segment.score * 0.0042)}
              stroke="#d99a12"
              strokeWidth="8"
              strokeLinejoin="round"
            />
          ))}
          <circle cx={CENTER} cy={CENTER} r="97" fill="#fff8dc" stroke="#9d6500" strokeWidth="5" />
          <circle cx={CENTER} cy={CENTER} r="87" fill="url(#financial-position-center-gradient)" stroke="#f5bd31" strokeWidth="5" />
        </svg>

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
            <b>{label}</b>
            <div className="financial-position-composite-segment-body">
              <Icon aria-hidden="true" />
              <span className="financial-position-composite-score">
                <strong>{score}</strong>
                <span>/100</span>
              </span>
              <small>{description}</small>
            </div>
            <span className="financial-position-composite-status">{scoreStatus(score)}</span>
          </div>
        ))}

        <div className="financial-position-composite-center" aria-hidden="true">
          <strong>FS</strong>
          <span>{compositeScore}</span>
        </div>
      </div>
      <figcaption>Combined Financial Position</figcaption>
    </figure>
  )
}