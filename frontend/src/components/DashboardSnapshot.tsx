type MetricPoint = {
  label: string
  value: number
}


const leaseInventoryData: MetricPoint[] = [
  { label: 'Jan', value: 42 },
  { label: 'Feb', value: 46 },
  { label: 'Mar', value: 51 },
  { label: 'Apr', value: 49 },
  { label: 'May', value: 55 },
  { label: 'Jun', value: 61 },
]

const monthlyRevenueData: MetricPoint[] = [
  { label: 'Jan', value: 185000 },
  { label: 'Feb', value: 212000 },
  { label: 'Mar', value: 228000 },
  { label: 'Apr', value: 241000 },
  { label: 'May', value: 255000 },
  { label: 'Jun', value: 276000 },
]

const gasolinePriceData: MetricPoint[] = [
  { label: 'Week 1', value: 3.66 },
  { label: 'Week 2', value: 3.71 },
  { label: 'Week 3', value: 3.68 },
  { label: 'Week 4', value: 3.75 },
  { label: 'Week 5', value: 3.81 },
  { label: 'Week 6', value: 3.78 },
]

const maintenanceBacklogData: MetricPoint[] = [
  { label: 'Jan', value: 18 },
  { label: 'Feb', value: 16 },
  { label: 'Mar', value: 21 },
  { label: 'Apr', value: 14 },
  { label: 'May', value: 11 },
  { label: 'Jun', value: 9 },
]

const onTimeDispatchData: MetricPoint[] = [
  { label: 'Jan', value: 89 },
  { label: 'Feb', value: 91 },
  { label: 'Mar', value: 90 },
  { label: 'Apr', value: 93 },
  { label: 'May', value: 95 },
  { label: 'Jun', value: 96 },
]


function DashboardSnapshot() {
  return (
    <div className="dashboard-snapshot">
      <div className="dashboard-header">
        <div>
          <h2>Dashboard Snapshot</h2>
          <p>Illustrative executive view of fleet growth, leasing demand, revenue performance, fuel costs, and service pressure.</p>
        </div>
        <div className="dashboard-badge">Illustrative Analytics</div>
      </div>

      <div className="snapshot-kpis">
        <KpiCard label="Assets Ready for Lease" value="61" detail="+12 from January" tone="gold" />
        <KpiCard label="Projected Monthly Revenue" value="$276K" detail="+49.2% in six months" tone="teal" />
        <KpiCard label="Average Gasoline Price" value="$3.78" detail="Per gallon, trailing 6 weeks" tone="coral" />
        <KpiCard label="On-Time Dispatch Rate" value="96%" detail="Best level in the current trend" tone="slate" />
      </div>

      <div className="dashboard-grid">
        <ChartCard
          title="Items Available for Lease"
          subtitle="Bar chart showing how lease-ready fleet inventory has trended over the last six months."
        >
          <BarChart data={leaseInventoryData} formatter={(value) => `${value}`} />
        </ChartCard>

        <ChartCard
          title="Revenue per Month"
          subtitle="Trend chart showing the current revenue climb from contract utilization and dispatch efficiency."
        >
          <TrendChart
            data={monthlyRevenueData}
            formatter={(value) => `$${Math.round(value / 1000)}K`}
            strokeClassName="trend-line revenue"
            areaClassName="trend-area revenue"
          />
        </ChartCard>

        <ChartCard
          title="Gasoline Prices"
          subtitle="Weekly price movement to illustrate fuel volatility and purchasing pressure."
        >
          <TrendChart
            data={gasolinePriceData}
            formatter={(value) => `$${value.toFixed(2)}`}
            strokeClassName="trend-line gasoline"
            areaClassName="trend-area gasoline"
          />
        </ChartCard>

        <ChartCard
          title="Maintenance Backlog"
          subtitle="Open service tasks trending down as workshop throughput improves."
        >
          <TrendChart
            data={maintenanceBacklogData}
            formatter={(value) => `${value} jobs`}
            strokeClassName="trend-line maintenance"
            areaClassName="trend-area maintenance"
          />
        </ChartCard>

        <ChartCard
          title="On-Time Dispatch Trend"
          subtitle="Operational reliability trend across the same reporting window."
        >
          <TrendChart
            data={onTimeDispatchData}
            formatter={(value) => `${value}%`}
            strokeClassName="trend-line dispatch"
            areaClassName="trend-area dispatch"
          />
        </ChartCard>
      </div>
    </div>
  )
}


function KpiCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: 'gold' | 'teal' | 'coral' | 'slate'
}) {
  return (
    <article className={`snapshot-kpi snapshot-kpi-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}


function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <article className="snapshot-chart-card">
      <div className="snapshot-chart-copy">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {children}
    </article>
  )
}


function BarChart({
  data,
  formatter,
}: {
  data: MetricPoint[]
  formatter: (value: number) => string
}) {
  const maxValue = Math.max(...data.map((item) => item.value))

  return (
    <div className="bar-chart">
      {data.map((item) => {
        const height = `${(item.value / maxValue) * 100}%`

        return (
          <div className="bar-chart-column" key={item.label}>
            <span className="bar-chart-value">{formatter(item.value)}</span>
            <div className="bar-chart-track">
              <div className="bar-chart-bar" style={{ height }} />
            </div>
            <span className="bar-chart-label">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}


function TrendChart({
  data,
  formatter,
  strokeClassName,
  areaClassName,
}: {
  data: MetricPoint[]
  formatter: (value: number) => string
  strokeClassName: string
  areaClassName: string
}) {
  const width = 520
  const height = 220
  const padding = 24
  const minValue = Math.min(...data.map((item) => item.value))
  const maxValue = Math.max(...data.map((item) => item.value))
  const range = maxValue - minValue || 1

  const points = data.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1)
    const y = height - padding - ((item.value - minValue) / range) * (height - padding * 2)
    return { ...item, x, y }
  })

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id={areaClassName.replace(/\s+/g, '-')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path
          d={areaPath}
          className={areaClassName}
          fill={`url(#${areaClassName.replace(/\s+/g, '-')})`}
        />
        <path d={linePath} className={strokeClassName} fill="none" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" className={`${strokeClassName} trend-dot`} />
            <text x={point.x} y={height - 6} textAnchor="middle" className="trend-axis-label">
              {point.label}
            </text>
            <text x={point.x} y={point.y - 12} textAnchor="middle" className="trend-value-label">
              {formatter(point.value)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}


export default DashboardSnapshot
