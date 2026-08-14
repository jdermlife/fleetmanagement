import { useId } from 'react';

type WealthBalanceRadarProps = {
  netWorthPositioning: number;
  wealthBehaviour: number;
  wealthFoundation: number;
  wealthAuthenticity: number;
};

const RADAR_DIMENSIONS = [
  { id: 'positioning', label: 'Net Worth Positioning', color: '#166534', maximum: 900, minimum: 200 },
  { id: 'behaviour', label: 'Wealth Behaviour', color: '#d4a72c', maximum: 100, minimum: 0 },
  { id: 'foundation', label: 'Wealth Foundation', color: '#1e3a8a', maximum: 1000, minimum: 0 },
  { id: 'authenticity', label: 'Wealth Authenticity', color: '#f8fafc', maximum: 100, minimum: 0 },
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function normalizedScore(value: number, minimum: number, maximum: number) {
  return clamp(((value - minimum) / (maximum - minimum)) * 100);
}

export default function WealthBalanceRadar({
  netWorthPositioning,
  wealthBehaviour,
  wealthFoundation,
  wealthAuthenticity,
}: WealthBalanceRadarProps) {
  const instanceId = useId().replace(/:/g, '');
  const gradientId = `wealth-radar-gradient-${instanceId}`;
  const titleId = `wealth-radar-title-${instanceId}`;
  const rawScores = [netWorthPositioning, wealthBehaviour, wealthFoundation, wealthAuthenticity];
  const dimensions = RADAR_DIMENSIONS.map((dimension, index) => ({
    ...dimension,
    score: rawScores[index],
    normalized: normalizedScore(rawScores[index], dimension.minimum, dimension.maximum),
  }));
  const center = 100;
  const radius = 76;
  const levels = [0.25, 0.5, 0.75, 1];
  const pointFor = (index: number, scale: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / dimensions.length;
    return {
      x: center + Math.cos(angle) * radius * scale,
      y: center + Math.sin(angle) * radius * scale,
    };
  };
  const polygonPoints = dimensions
    .map((dimension, index) => {
      const point = pointFor(index, dimension.normalized / 100);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  return (
    <figure className="wealth-balance-radar" aria-labelledby={titleId}>
      <figcaption className="wealth-balance-radar-indicators">
        <span className="wealth-balance-radar-kicker">Balance Across Dimensions</span>
        <h2 id={titleId}>Wealth Balance</h2>
        <div className="wealth-balance-radar-indicator-list">
          {dimensions.map((dimension) => (
            <div className="wealth-balance-radar-indicator" key={dimension.id}>
              <i style={{ background: dimension.color }} />
              <span>{dimension.label}</span>
              <strong>{Math.round(dimension.score)}</strong>
            </div>
          ))}
        </div>
      </figcaption>

      <svg
        className="wealth-balance-radar-visual"
        viewBox="0 0 200 200"
        role="img"
        aria-label={dimensions.map((dimension) => `${dimension.label}: ${Math.round(dimension.normalized)} out of 100 normalized`).join(', ')}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#166534" />
            <stop offset="48%" stopColor="#d4a72c" />
            <stop offset="76%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>
        </defs>
        {levels.map((level) => (
          <polygon
            key={level}
            className="wealth-balance-radar-grid"
            points={dimensions.map((_dimension, index) => {
              const point = pointFor(index, level);
              return `${point.x},${point.y}`;
            }).join(' ')}
          />
        ))}
        {dimensions.map((dimension, index) => {
          const axis = pointFor(index, 1);
          return (
            <line
              key={dimension.id}
              className="wealth-balance-radar-axis"
              data-radar-axis={dimension.id}
              x1={center}
              y1={center}
              x2={axis.x}
              y2={axis.y}
              style={{ stroke: dimension.color }}
            />
          );
        })}
        <polygon
          className="wealth-balance-radar-score"
          data-radar-score
          points={polygonPoints}
          fill={`url(#${gradientId})`}
        />
        {dimensions.map((dimension, index) => {
          const point = pointFor(index, dimension.normalized / 100);
          return (
            <circle
              key={dimension.id}
              className="wealth-balance-radar-point"
              data-radar-point={dimension.id}
              cx={point.x}
              cy={point.y}
              r="4"
              style={{ fill: dimension.color }}
            />
          );
        })}
      </svg>
    </figure>
  );
}