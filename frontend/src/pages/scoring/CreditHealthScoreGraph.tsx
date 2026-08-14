import { useId } from 'react';

export type CreditHealthGraphScores = {
  credit: number | null;
  nonStarter: number | null;
  social: number | null;
  psychometric: number | null;
};

type ScoreRegion = {
  id: keyof CreditHealthGraphScores;
  label: string;
  displayLabel: string;
  path: string;
  labelX: number;
  labelY: number;
  valueX: number;
  valueY: number;
  textClassName: string;
  gradient: [string, string, string];
};

const SCORE_REGIONS: ScoreRegion[] = [
  {
    id: 'credit',
    label: 'Credit Score',
    displayLabel: 'Credit Score',
    path: 'M27 24H130C118 78 143 139 128 200C117 244 138 276 130 296H27Z',
    labelX: 78,
    labelY: 145,
    valueX: 78,
    valueY: 172,
    textClassName: 'credit-health-graph-text-light',
    gradient: ['#60a5fa', '#2563eb', '#1e3a8a'],
  },
  {
    id: 'psychometric',
    label: 'Psychometric Score',
    displayLabel: 'Psychometric',
    path: 'M130 24H233V118C205 104 174 135 134 116C140 82 123 52 130 24Z',
    labelX: 183,
    labelY: 69,
    valueX: 183,
    valueY: 94,
    textClassName: 'credit-health-graph-text-dark',
    gradient: ['#ffffff', '#f8fafc', '#cbd5e1'],
  },
  {
    id: 'social',
    label: 'Social Score',
    displayLabel: 'Social Score',
    path: 'M134 116C174 135 205 104 233 118V205C204 190 171 221 128 200C134 170 140 145 134 116Z',
    labelX: 183,
    labelY: 154,
    valueX: 183,
    valueY: 179,
    textClassName: 'credit-health-graph-text-dark',
    gradient: ['#fef08a', '#facc15', '#ca8a04'],
  },
  {
    id: 'nonStarter',
    label: 'Non-Starter Score',
    displayLabel: 'Non-Starter',
    path: 'M128 200C171 221 204 190 233 205V296H130C138 276 117 244 128 200Z',
    labelX: 183,
    labelY: 238,
    valueX: 183,
    valueY: 263,
    textClassName: 'credit-health-graph-text-light',
    gradient: ['#fb7185', '#dc2626', '#7f1d1d'],
  },
];

function displayScore(score: number | null): string {
  return typeof score === 'number' && Number.isFinite(score) ? Math.round(score).toString() : 'Pending';
}

export default function CreditHealthScoreGraph({ scores }: { scores: CreditHealthGraphScores }) {
  const graphId = useId().replace(/:/g, '');
  const ariaLabel = SCORE_REGIONS
    .map((region) => `${region.label}: ${displayScore(scores[region.id])}`)
    .join(', ');

  return (
    <figure className="credit-health-score-graph">
      <svg viewBox="0 0 260 320" role="img" aria-label={ariaLabel}>
        <defs>
          <clipPath id={`${graphId}-leaf`}>
            <path d="M130 16C80 20 44 64 36 126C28 185 52 248 108 294C117 302 126 308 130 312C134 308 143 302 152 294C208 248 232 185 224 126C216 64 180 20 130 16Z" />
          </clipPath>
          {SCORE_REGIONS.map((region) => (
            <linearGradient key={region.id} id={`${graphId}-${region.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={region.gradient[0]} />
              <stop offset="52%" stopColor={region.gradient[1]} />
              <stop offset="100%" stopColor={region.gradient[2]} />
            </linearGradient>
          ))}
          <linearGradient id={`${graphId}-sheen`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
            <stop offset="48%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.18" />
          </linearGradient>
        </defs>

        <g clipPath={`url(#${graphId}-leaf)`}>
          {SCORE_REGIONS.map((region) => (
            <path
              key={region.id}
              data-score-region={region.id}
              d={region.path}
              fill={`url(#${graphId}-${region.id})`}
            />
          ))}
          <rect x="27" y="24" width="206" height="272" fill={`url(#${graphId}-sheen)`} />
          <path className="credit-health-graph-boundary" d="M130 24C118 78 143 139 128 200C117 244 138 276 130 296" />
          <path className="credit-health-graph-boundary" d="M134 116C174 135 205 104 233 118" />
          <path className="credit-health-graph-boundary" d="M128 200C171 221 204 190 233 205" />
        </g>

        <path className="credit-health-graph-outline" d="M130 16C80 20 44 64 36 126C28 185 52 248 108 294C117 302 126 308 130 312C134 308 143 302 152 294C208 248 232 185 224 126C216 64 180 20 130 16Z" />
        <path className="credit-health-graph-vein" d="M130 30V286" />

        {SCORE_REGIONS.map((region) => (
          <g key={`${region.id}-label`} className={region.textClassName}>
            <text className="credit-health-graph-label" x={region.labelX} y={region.labelY} textAnchor="middle">
              {region.displayLabel}
            </text>
            <text className="credit-health-graph-value" x={region.valueX} y={region.valueY} textAnchor="middle">
              {displayScore(scores[region.id])}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}