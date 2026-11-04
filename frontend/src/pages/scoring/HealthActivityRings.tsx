interface HealthRingInput {
  id: string
  label: string
  color: string
}

interface HealthActivityRingsProps {
  scores: Record<string, number>
}

const RINGS: readonly HealthRingInput[] = [
  { id: 'cash-flow', label: 'Cash Flow Health', color: '#3b82f6' },
  { id: 'credit', label: 'Credit Health', color: '#eab308' },
  { id: 'protection', label: 'Protection Health', color: '#ffffff' },
  { id: 'goal', label: 'Goal Health', color: '#ef4444' },
]

const STROKE = 14
const GAP = 6
const OUTER_RADIUS = 100

export default function HealthActivityRings({ scores }: HealthActivityRingsProps) {
  return (
    <div
      className="health-activity-rings"
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 16, background: '#0b0d10', borderRadius: 16 }}
    >
      <svg viewBox="0 0 240 240" width={240} height={240} role="img" aria-label="Health rings">
        {RINGS.map((ring, index) => {
          const radius = OUTER_RADIUS - index * (STROKE + GAP)
          const score = Math.max(0, Math.min(100, scores[ring.id] ?? 0))
          return (
            <g key={ring.id} transform="rotate(-90 120 120)">
              <circle cx={120} cy={120} r={radius} fill="none" stroke="#1f2937" strokeWidth={STROKE} />
              <circle
                cx={120}
                cy={120}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${score} 100`}
              >
                <title>{`${ring.label}: ${score}/100`}</title>
              </circle>
            </g>
          )
        })}
        <text x={120} y={120} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={28} fontWeight={800}>
          FH
        </text>
      </svg>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, color: '#e5e7eb', display: 'grid', gap: 8 }}>
        {RINGS.map((ring) => (
          <li key={ring.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: ring.color, display: 'inline-block' }} />
            <span>{ring.label}</span>
            <strong style={{ marginLeft: 'auto', paddingLeft: 16 }}>{scores[ring.id] ?? 0}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
