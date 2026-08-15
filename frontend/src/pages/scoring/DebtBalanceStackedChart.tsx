export type DebtBalanceAccount = {
  id: string;
  label: string;
  balances: Array<{
    monthLabel: string;
    endBalance: number;
  }>;
};

type DebtBalanceStackedChartProps = {
  accounts: DebtBalanceAccount[];
};

const ACCOUNT_COLORS = ['#0284c7', '#f59e0b', '#16a34a', '#dc2626', '#7c3aed', '#0891b2'];

function formatCompactCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

export function buildDebtBalanceChart(accounts: DebtBalanceAccount[], monthLimit = 6) {
  const activeAccounts = accounts
    .map((account) => ({
      ...account,
      balances: account.balances
        .slice(0, monthLimit)
        .map((balance) => ({ ...balance, endBalance: Math.max(0, Number(balance.endBalance) || 0) })),
    }))
    .filter((account) => account.balances.some((balance) => balance.endBalance > 0));
  const monthLabels = activeAccounts[0]?.balances.map((balance) => balance.monthLabel) ?? [];
  const months = monthLabels.map((monthLabel, monthIndex) => {
    const segments = activeAccounts.map((account, accountIndex) => ({
      accountId: account.id,
      label: account.label,
      color: ACCOUNT_COLORS[accountIndex % ACCOUNT_COLORS.length],
      balance: account.balances[monthIndex]?.endBalance ?? 0,
    }));
    return {
      monthLabel,
      segments,
      total: segments.reduce((sum, segment) => sum + segment.balance, 0),
    };
  });

  return {
    accounts: activeAccounts.map((account, index) => ({
      id: account.id,
      label: account.label,
      color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
    })),
    months,
    maximumTotal: Math.max(0, ...months.map((month) => month.total)),
  };
}

export default function DebtBalanceStackedChart({ accounts }: DebtBalanceStackedChartProps) {
  const chart = buildDebtBalanceChart(accounts);
  const chartWidth = 320;
  const chartHeight = 150;
  const barAreaTop = 18;
  const barAreaHeight = 100;
  const barSlot = chart.months.length > 0 ? chartWidth / chart.months.length : chartWidth;
  const barWidth = Math.min(34, barSlot * 0.58);

  return (
    <figure className="debt-balance-stacked-chart" aria-labelledby="debt-balance-chart-title">
      <figcaption>
        <span>Monthly Debt Portfolio</span>
        <h2 id="debt-balance-chart-title">Debt Balances Over Time</h2>
      </figcaption>
      {chart.months.length > 0 ? (
        <>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label={`Stacked debt balance chart for ${chart.months.length} months and ${chart.accounts.length} accounts`}
          >
            <line className="debt-balance-chart-axis" x1="0" y1={barAreaTop + barAreaHeight} x2={chartWidth} y2={barAreaTop + barAreaHeight} />
            {chart.months.map((month, monthIndex) => {
              const x = (monthIndex * barSlot) + ((barSlot - barWidth) / 2);
              let stackedHeight = 0;
              return (
                <g key={`${month.monthLabel}-${monthIndex}`} aria-label={`${month.monthLabel}: ${formatCompactCurrency(month.total)} total debt`}>
                  {month.segments.map((segment) => {
                    const height = chart.maximumTotal > 0 ? (segment.balance / chart.maximumTotal) * barAreaHeight : 0;
                    const y = barAreaTop + barAreaHeight - stackedHeight - height;
                    stackedHeight += height;
                    return (
                      <rect
                        key={segment.accountId}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={height}
                        fill={segment.color}
                        aria-label={`${segment.label}: ${formatCompactCurrency(segment.balance)}`}
                      />
                    );
                  })}
                  <text className="debt-balance-chart-total" x={x + (barWidth / 2)} y={Math.max(10, barAreaTop + barAreaHeight - stackedHeight - 5)}>
                    {formatCompactCurrency(month.total)}
                  </text>
                  <text className="debt-balance-chart-month" x={x + (barWidth / 2)} y={138}>{month.monthLabel.replace(/\s\d{4}$/, '')}</text>
                </g>
              );
            })}
          </svg>
          <div className="debt-balance-chart-legend" aria-label="Debt account segments">
            {chart.accounts.map((account) => (
              <span key={account.id}><i style={{ backgroundColor: account.color }} />{account.label}</span>
            ))}
          </div>
        </>
      ) : (
        <p className="debt-balance-chart-empty">Complete a loan or credit card schedule to display monthly debt balances.</p>
      )}
    </figure>
  );
}