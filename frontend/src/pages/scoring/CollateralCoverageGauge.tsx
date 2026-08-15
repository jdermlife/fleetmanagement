import { useId } from 'react';

import type { CollateralCoverageResult } from './collateralCoverageEngine';

type CollateralCoverageGaugeProps = {
  result: CollateralCoverageResult;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CollateralCoverageGauge({ result }: CollateralCoverageGaugeProps) {
  const gradientId = `collateral-coverage-scale-${useId().replace(/:/g, '')}`;
  const boundedCoverage = Math.max(0, Math.min(300, result.coveragePercent ?? 0));
  const angle = 135 + ((boundedCoverage / 300) * 270);
  const radians = (angle * Math.PI) / 180;
  const needleX = 100 + (Math.cos(radians) * 58);
  const needleY = 100 + (Math.sin(radians) * 58);
  const coverageLabel = result.coveragePercent === null ? 'Pending' : `${result.coveragePercent.toFixed(1)}%`;

  return (
    <figure className="collateral-coverage-gauge" aria-labelledby="collateral-coverage-gauge-title">
      <figcaption>
        <span>Collateral Optimization Model</span>
        <h2 id="collateral-coverage-gauge-title">Collateral Coverage</h2>
      </figcaption>
      <div className="collateral-coverage-dial">
        <svg
          viewBox="0 0 200 178"
          role="meter"
          aria-label={`Collateral Coverage: ${coverageLabel}. ${result.optimization}. Score ${result.score.toFixed(1)} out of 100.`}
          aria-valuemin={0}
          aria-valuemax={300}
          aria-valuenow={result.coveragePercent === null ? undefined : Math.round(boundedCoverage)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="33%" stopColor="#f59e0b" />
              <stop offset="66.67%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <path className="collateral-coverage-arc" d="M 43 157 A 80 80 0 1 1 157 157" style={{ stroke: `url(#${gradientId})` }} />
          <line className="collateral-coverage-needle" x1="100" y1="100" x2={needleX} y2={needleY} />
          <circle className="collateral-coverage-hub" cx="100" cy="100" r="8" />
          <text x="31" y="169">0</text>
          <text x="44" y="45">100</text>
          <text x="156" y="45">200</text>
          <text x="169" y="169">300+</text>
        </svg>
        <div className="collateral-coverage-reading">
          <strong>{coverageLabel}</strong>
          <span>{result.optimization}</span>
        </div>
      </div>
      <div className="collateral-coverage-details">
        <span>Optimization score <strong>{result.score.toFixed(1)} / 100</strong></span>
        <span>Collateral value <strong>{formatCurrency(result.collateralValue)}</strong></span>
        <span>Loan balance <strong>{formatCurrency(result.loanBalance)}</strong></span>
      </div>
    </figure>
  );
}