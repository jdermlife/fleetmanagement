import { useId } from 'react';

export type CreditHealthGraphScores = {
  credit: number | null;
  nonStarter: number | null;
  social: number | null;
  psychometric: number | null;
};

type ScoreRing = {
  id: keyof CreditHealthGraphScores;
  label: string;
  radius: number;
  color: string;
  gradient: [string, string, string, string];
};

const SCORE_RINGS: ScoreRing[] = [
  {
    id: 'credit',
    label: 'Credit Score',
    radius: 80,
    color: '#3b82f6',
    gradient: ['#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'],
  },
  {
    id: 'nonStarter',
    label: 'Non-Starter Score',
    radius: 64,
    color: '#ef4444',
    gradient: ['#fecaca', '#fb7185', '#dc2626', '#7f1d1d'],
  },
  {
    id: 'social',
    label: 'Social Score',
    radius: 48,
    color: '#facc15',
    gradient: ['#fef9c3', '#fde047', '#eab308', '#a16207'],
  },
  {
    id: 'psychometric',
    label: 'Psychometric Score',
    radius: 32,
    color: '#ffffff',
    gradient: ['#ffffff', '#f8fafc', '#dbe4ee', '#94a3b8'],
  },
];

function displayScore(score: number | null): string {
  return typeof score === 'number' && Number.isFinite(score) ? Math.round(score).toString() : 'Pending';
}

function ringProgress(score: number | null): number {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, score / 10));
}

export default function CreditHealthScoreGraph({ scores }: { scores: CreditHealthGraphScores }) {
  const graphId = useId().replace(/:/g, '');
  const ariaLabel = SCORE_RINGS
    .map((ring) => `${ring.label}: ${displayScore(scores[ring.id])}`)
    .join(', ');

  return (
    <figure className="credit-health-score-graph">
      <figcaption className="credit-health-score-indicators" aria-label="Credit Health score indicators">
        {SCORE_RINGS.map((ring) => (
          <div key={ring.id} className="credit-health-score-indicator">
            <i
              style={{ background: ring.color, boxShadow: `0 0 8px ${ring.color}` }}
              aria-hidden="true"
            />
            <span>{ring.label}</span>
            <strong>{displayScore(scores[ring.id])}</strong>
          </div>
        ))}
      </figcaption>

      <div className="credit-health-score-ring-visual">
        <svg viewBox="0 0 200 200" role="img" aria-label={ariaLabel}>
          <defs>
            {SCORE_RINGS.map((ring) => (
              <linearGradient key={ring.id} id={`${graphId}-${ring.id}`} x1="25" y1="20" x2="175" y2="180" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={ring.gradient[0]} />
                <stop offset="30%" stopColor={ring.gradient[1]} />
                <stop offset="68%" stopColor={ring.gradient[2]} />
                <stop offset="100%" stopColor={ring.gradient[3]} />
              </linearGradient>
            ))}
          </defs>

          {SCORE_RINGS.map((ring) => {
            const progress = ringProgress(scores[ring.id]);
            return (
              <g key={ring.id} transform="rotate(-90 100 100)">
                <circle className="credit-health-score-ring-track" data-score-track={ring.id} cx="100" cy="100" r={ring.radius} pathLength="100" style={{ stroke: ring.color }} />
                <circle className="credit-health-score-ring-progress" data-score-ring={ring.id} cx="100" cy="100" r={ring.radius} pathLength="100" stroke={`url(#${graphId}-${ring.id})`} strokeDasharray={`${progress} ${100 - progress}`} />
              </g>
            );
          })}
        </svg>
        <div className="credit-health-score-ring-center" aria-hidden="true">
          <strong>FILSCORE</strong>
          <span>Credit Health</span>
        </div>
      </div>
    </figure>
  );
}