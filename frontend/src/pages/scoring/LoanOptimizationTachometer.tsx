export type LoanOptimizationInput = {
  prioritizedLoanSavingsPercent: number;
  cashOptimizationScore: number;
  collateralOptimizationScore: number;
};

type LoanOptimizationTachometerProps = {
  input: LoanOptimizationInput;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

export function computeLoanOptimizationOpportunity(input: LoanOptimizationInput) {
  const prioritizedLoanSavingsPercent = clampScore(input.prioritizedLoanSavingsPercent);
  const cashOptimizationScore = clampScore(input.cashOptimizationScore);
  const collateralOptimizationScore = clampScore(input.collateralOptimizationScore);
  const opportunityPercent = (
    prioritizedLoanSavingsPercent
    + cashOptimizationScore
    + collateralOptimizationScore
  ) / 3;

  return {
    prioritizedLoanSavingsPercent,
    cashOptimizationScore,
    collateralOptimizationScore,
    opportunityPercent: Math.round(opportunityPercent * 10) / 10,
    interpretation: opportunityPercent >= 75
      ? 'High optimization potential'
      : opportunityPercent >= 45
        ? 'Moderate optimization potential'
        : 'Limited optimization potential',
  };
}

function polarPoint(centerX: number, centerY: number, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: centerX + (radius * Math.cos(radians)),
    y: centerY + (radius * Math.sin(radians)),
  };
}

function arcPath(startAngle: number, endAngle: number, radius: number) {
  const start = polarPoint(150, 145, radius, startAngle);
  const end = polarPoint(150, 145, radius, endAngle);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${endAngle - startAngle > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

export default function LoanOptimizationTachometer({ input }: LoanOptimizationTachometerProps) {
  const result = computeLoanOptimizationOpportunity(input);
  const needleAngle = 135 + ((result.opportunityPercent / 100) * 270);
  const needleTip = polarPoint(150, 145, 78, needleAngle);

  return (
    <section className="loan-optimization-tachometer" aria-labelledby="loan-optimization-title">
      <div className="loan-optimization-heading">
        <div>
          <span>Debt Cash Collateral Optimizer</span>
          <h2 id="loan-optimization-title">Loan Optimization Opportunity</h2>
        </div>
        <p>Equal-weight composite of debt savings, cash efficiency, and collateral efficiency.</p>
      </div>

      <div
        className="loan-optimization-dial"
        role="meter"
        aria-label={`Loan Optimization Opportunity: ${result.opportunityPercent.toFixed(1)}%. ${result.interpretation}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={result.opportunityPercent}
      >
        <svg viewBox="0 0 300 250" aria-hidden="true">
          <path className="loan-optimization-zone loan-optimization-zone-low" d={arcPath(135, 256.5, 102)} />
          <path className="loan-optimization-zone loan-optimization-zone-medium" d={arcPath(256.5, 337.5, 102)} />
          <path className="loan-optimization-zone loan-optimization-zone-high" d={arcPath(337.5, 405, 102)} />
          {[0, 20, 40, 60, 80, 100].map((value) => {
            const angle = 135 + ((value / 100) * 270);
            const inner = polarPoint(150, 145, 87, angle);
            const outer = polarPoint(150, 145, 96, angle);
            const label = polarPoint(150, 145, 74, angle);
            return (
              <g key={value}>
                <line className="loan-optimization-tick" x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />
                <text className="loan-optimization-tick-label" x={label.x} y={label.y + 3}>{value}</text>
              </g>
            );
          })}
          <text className="loan-optimization-dial-label" x="150" y="72">OPTIMIZATION</text>
          <line className="loan-optimization-needle" x1="150" y1="145" x2={needleTip.x} y2={needleTip.y} />
          <circle className="loan-optimization-needle-hub" cx="150" cy="145" r="10" />
          <text className="loan-optimization-reading" x="150" y="185">{result.opportunityPercent.toFixed(1)}%</text>
          <text className="loan-optimization-interpretation" x="150" y="205">{result.interpretation}</text>
        </svg>
      </div>

      <div className="loan-optimization-inputs">
        <article>
          <span>Prioritized Loan Savings</span>
          <strong>{result.prioritizedLoanSavingsPercent.toFixed(1)}%</strong>
          <small>Projected interest savings</small>
        </article>
        <article>
          <span>Cash Optimization</span>
          <strong>{result.cashOptimizationScore.toFixed(1)}%</strong>
          <small>Liquidity efficiency result</small>
        </article>
        <article>
          <span>Collateral Optimization</span>
          <strong>{result.collateralOptimizationScore.toFixed(1)}%</strong>
          <small>Collateral efficiency result</small>
        </article>
      </div>
    </section>
  );
}