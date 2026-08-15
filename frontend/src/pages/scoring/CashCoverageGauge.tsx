import type { CashCoverageResult } from './cashCoverageEngine';

type CashCoverageGaugeProps = {
  result: CashCoverageResult;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CashCoverageGauge({ result }: CashCoverageGaugeProps) {
  const boundedCoverage = Math.max(0, Math.min(300, result.coveragePercent ?? 0));
  const progress = (boundedCoverage / 300) * 100;
  const angle = -180 + ((boundedCoverage / 300) * 180);
  const radians = (angle * Math.PI) / 180;
  const markerX = 100 + (Math.cos(radians) * 70);
  const markerY = 92 + (Math.sin(radians) * 70);
  const coverageLabel = result.coveragePercent === null ? 'Pending' : `${result.coveragePercent.toFixed(1)}%`;

  return (
    <figure className="cash-coverage-gauge" aria-labelledby="cash-coverage-gauge-title">
      <figcaption>
        <span>Liquidity Model</span>
        <h2 id="cash-coverage-gauge-title">Cash Coverage</h2>
      </figcaption>
      <div className="cash-coverage-gauge-visual">
        <svg
          viewBox="0 0 200 118"
          role="meter"
          aria-label={`Cash Coverage: ${coverageLabel}. ${result.interpretation}. Score ${result.score.toFixed(1)} out of 100.`}
          aria-valuemin={0}
          aria-valuemax={300}
          aria-valuenow={result.coveragePercent === null ? undefined : Math.round(boundedCoverage)}
        >
          <defs>
            <linearGradient id="cash-coverage-scale" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="33%" stopColor="#f59e0b" />
              <stop offset="66.67%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <path className="cash-coverage-gauge-track" pathLength="100" d="M 25 92 A 75 75 0 0 1 175 92" />
          <path
            className="cash-coverage-gauge-progress"
            pathLength="100"
            d="M 25 92 A 75 75 0 0 1 175 92"
            style={{ strokeDasharray: `${progress} ${100 - progress}` }}
          />
          <circle className="cash-coverage-gauge-marker" cx={markerX} cy={markerY} r="5" />
          <text className="cash-coverage-gauge-min" x="20" y="111">0%</text>
          <text className="cash-coverage-gauge-optimal" x="100" y="13">200%</text>
          <text className="cash-coverage-gauge-max" x="180" y="111">300%+</text>
        </svg>
        <div className="cash-coverage-gauge-reading">
          <strong>{coverageLabel}</strong>
          <span>{result.interpretation}</span>
        </div>
      </div>
      <div className="cash-coverage-gauge-details">
        <span>Score <strong>{result.score.toFixed(1)} / 100</strong></span>
        <span>Liquid cash <strong>{formatCurrency(result.liquidCash)}</strong></span>
        <span>Monthly expenses <strong>{formatCurrency(result.monthlyExpenses)}</strong></span>
      </div>
    </figure>
  );
}