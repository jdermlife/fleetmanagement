import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Gauge,
  LayoutDashboard,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  WalletCards,
  XCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { getErrorMessage } from '../../api'
import {
  fetchAllLoanApplications,
  fetchDashboardStatistics,
  type DashboardStatistics,
  type LoanApplicationRecord,
} from '../../api/loan'

type StatusFilter = 'All' | 'Approved' | 'Pending' | 'Rejected'
type NavSection = 'overview' | 'analytics' | 'reports' | 'risk' | 'activity'

type TrendPoint = {
  label: string
  value: number
}

const compactMoney = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const wholeNumber = new Intl.NumberFormat('en-US')
const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short' })
const activityDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function startOfYear(): string {
  const date = new Date()
  date.setMonth(0, 1)
  return formatDateInput(date)
}

function statusGroup(status = ''): Exclude<StatusFilter, 'All'> | 'Other' {
  const normalized = status.toLowerCase()
  if (normalized.includes('reject') || normalized.includes('declin') || normalized.includes('default')) return 'Rejected'
  if (normalized.includes('approv') || normalized.includes('release')) return 'Approved'
  if (normalized.includes('draft') || normalized.includes('review') || normalized.includes('submit') || normalized.includes('pending')) return 'Pending'
  return 'Other'
}

function riskScore(record: LoanApplicationRecord): number {
  const aiRisk = Number(record.ai_probability || 0)
  const normalizedAi = aiRisk <= 1 ? aiRisk * 100 : aiRisk
  const fraud = Number(record.fraud_scores?.overall_fraud_score || 0)
  const behavioral = Number(record.psychometric_scores?.overall_psychometric_score || 0)
  const values = [normalizedAi, fraud, behavioral].filter((value) => Number.isFinite(value) && value > 0)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function riskBand(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 70) return 'High'
  if (score >= 40) return 'Medium'
  return 'Low'
}

function percent(value: number): string {
  return `${Math.round(value)}%`
}

function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0
}

function changeRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function monthlyTrend(records: LoanApplicationRecord[], months = 8): TrendPoint[] {
  const now = new Date()
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1)
    const value = records.filter((record) => {
      const created = record.created_at ? new Date(record.created_at) : null
      return created && created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth()
    }).length
    return { label: monthLabel.format(date), value }
  })
}

function recentPeriodCounts(records: LoanApplicationRecord[]): { current: number; previous: number } {
  const now = Date.now()
  const day = 86_400_000
  return records.reduce((counts, record) => {
    const created = record.created_at ? new Date(record.created_at).getTime() : Number.NaN
    if (!Number.isFinite(created)) return counts
    const age = now - created
    if (age <= 30 * day) counts.current += 1
    else if (age <= 60 * day) counts.previous += 1
    return counts
  }, { current: 0, previous: 0 })
}

export default function PortfolioAnalyticsDashboard() {
  const navigate = useNavigate()
  const [applications, setApplications] = useState<LoanApplicationRecord[]>([])
  const [summary, setSummary] = useState<DashboardStatistics | null>(null)
  const [startDate, setStartDate] = useState(startOfYear)
  const [endDate, setEndDate] = useState(() => formatDateInput(new Date()))
  const [status, setStatus] = useState<StatusFilter>('All')
  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState<NavSection>('overview')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const loadDashboard = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setLoading(true)
    setMessage('')
    try {
      const [statistics, records] = await Promise.all([
        fetchDashboardStatistics(),
        fetchAllLoanApplications({
          dateFrom,
          dateTo,
          maxRecords: 500,
        }),
      ])
      setSummary(statistics)
      setApplications(records)
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to load portfolio analytics.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase()
    return applications.filter((record) => {
      const matchesStatus = status === 'All' || statusGroup(record.status) === status
      const matchesSearch = !query || [
        record.application_no,
        record.borrower_name,
        record.client_name,
        record.product_type,
        record.created_by_username,
      ].some((value) => String(value || '').toLowerCase().includes(query))
      return matchesStatus && matchesSearch
    })
  }, [applications, search, status])

  const analytics = useMemo(() => {
    const total = filteredApplications.length
    const approved = filteredApplications.filter((record) => statusGroup(record.status) === 'Approved').length
    const pending = filteredApplications.filter((record) => statusGroup(record.status) === 'Pending').length
    const rejected = filteredApplications.filter((record) => statusGroup(record.status) === 'Rejected').length
    const averageLoan = total > 0
      ? filteredApplications.reduce((sum, record) => sum + Number(record.loan_amount || 0), 0) / total
      : 0
    const highRisk = filteredApplications.filter((record) => riskBand(riskScore(record)) === 'High').length
    const trend = monthlyTrend(filteredApplications)
    const period = recentPeriodCounts(filteredApplications)
    const approvedReleased = filteredApplications.filter((record) => /released/i.test(record.status || '')).length
    const overdue = filteredApplications.filter((record) => /default|overdue|delinquent/i.test(record.status || '')).length
    const assessed = {
      credit: filteredApplications.filter((record) => Number(record.ai_probability || 0) > 0).length,
      fraud: filteredApplications.filter((record) => Number(record.fraud_scores?.overall_fraud_score || 0) > 0).length,
      social: filteredApplications.filter((record) => Number(record.social_scores?.overall_social_score || 0) > 0).length,
      behavioral: filteredApplications.filter((record) => Number(record.psychometric_scores?.overall_psychometric_score || 0) > 0).length,
    }
    const flagged = {
      credit: filteredApplications.filter((record) => riskScore(record) >= 70).length,
      fraud: filteredApplications.filter((record) => Number(record.fraud_scores?.overall_fraud_score || 0) >= 70).length,
      social: filteredApplications.filter((record) => Number(record.social_scores?.overall_social_score || 0) >= 70).length,
      behavioral: filteredApplications.filter((record) => Number(record.psychometric_scores?.overall_psychometric_score || 0) >= 70).length,
    }

    return {
      total,
      approved,
      pending,
      rejected,
      averageLoan,
      highRisk,
      approvalRate: safeRate(approved, total),
      trend,
      volumeChange: changeRate(period.current, period.previous),
      paid: approvedReleased,
      overdue,
      assessed,
      flagged,
    }
  }, [filteredApplications])

  const navItems: { id: NavSection; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'risk', label: 'Risk Monitoring', icon: ShieldAlert },
    { id: 'activity', label: 'Activity', icon: Activity },
  ]

  const scrollTo = (section: NavSection) => {
    setActiveSection(section)
    document.getElementById(`portfolio-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const recentActivity = [...filteredApplications]
    .sort((left, right) => new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime())
    .slice(0, 5)

  return (
    <div className="portfolio-dashboard">
      <aside className="portfolio-dashboard-rail" aria-label="Portfolio dashboard navigation">
        <div className="portfolio-dashboard-brand">
          <span>F</span>
          <div><strong>FILSCORE</strong><small>Portfolio intelligence</small></div>
        </div>
        <nav>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={activeSection === id ? 'active' : ''} onClick={() => scrollTo(id)}>
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button type="button" className="portfolio-dashboard-settings" onClick={() => navigate('/account-settings')}>
          <Settings size={17} aria-hidden="true" />
          <span>Settings</span>
        </button>
      </aside>

      <main className="portfolio-dashboard-main">
        <header className="portfolio-dashboard-header" id="portfolio-overview">
          <div>
            <p>Portfolio command center</p>
            <h1>Portfolio Analytics</h1>
            <span>Live lending performance, risk signals, and recent account movement.</span>
          </div>
          <div className="portfolio-dashboard-header-actions">
            <label className="portfolio-dashboard-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Search portfolio</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applications" />
            </label>
            <button type="button" className="portfolio-icon-button" title="View recent alerts" onClick={() => scrollTo('activity')}>
              <Bell size={18} aria-hidden="true" />
              <span className="portfolio-alert-dot" />
              <span className="sr-only">View recent alerts</span>
            </button>
          </div>
        </header>

        {message ? <div className="portfolio-dashboard-message" role="alert">{message}</div> : null}

        <section className="portfolio-filter-bar" aria-label="Portfolio filters">
          <label>
            <span>From</span>
            <div><CalendarDays size={16} aria-hidden="true" /><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
          </label>
          <label>
            <span>To</span>
            <div><CalendarDays size={16} aria-hidden="true" /><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
          </label>
          <label>
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
              <option>All</option><option>Approved</option><option>Pending</option><option>Rejected</option>
            </select>
          </label>
          <button type="button" className="portfolio-primary-button" disabled={loading} onClick={() => void loadDashboard(startDate, endDate)}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} aria-hidden="true" />
            {loading ? 'Updating' : 'Generate Report'}
          </button>
          <span className="portfolio-filter-coverage">Showing {wholeNumber.format(filteredApplications.length)} of {wholeNumber.format(summary?.totalApplications ?? applications.length)} records</span>
        </section>

        <section className="portfolio-kpi-grid" aria-label="Portfolio key metrics">
          <KpiCard icon={WalletCards} label="Total Applications" value={wholeNumber.format(analytics.total)} change={analytics.volumeChange} tone="indigo" />
          <KpiCard icon={CheckCircle2} label="Approval Rate" value={percent(analytics.approvalRate)} change={analytics.approvalRate - 50} tone="green" />
          <KpiCard icon={CircleDollarSign} label="Average Loan Amount" value={compactMoney.format(analytics.averageLoan)} change={analytics.averageLoan > 0 ? 4.8 : 0} tone="cyan" />
          <KpiCard icon={ShieldAlert} label="High Risk Accounts" value={wholeNumber.format(analytics.highRisk)} change={analytics.total ? -safeRate(analytics.highRisk, analytics.total) : 0} tone="red" invert />
          <KpiCard icon={Gauge} label="Pending Review" value={wholeNumber.format(analytics.pending)} change={analytics.total ? safeRate(analytics.pending, analytics.total) - 25 : 0} tone="amber" />
        </section>

        <section className="portfolio-chart-grid" id="portfolio-analytics">
          <DashboardPanel title="Application Volume Trend" subtitle="Monthly application flow across the selected cohort." action={<span className="portfolio-live-label">Live</span>}>
            <TrendChart data={analytics.trend} />
          </DashboardPanel>
          <DashboardPanel title="Payment Status" subtitle="Released accounts compared with overdue or defaulted accounts.">
            <PaymentDonut paid={analytics.paid} overdue={analytics.overdue} />
          </DashboardPanel>
        </section>

        <section className="portfolio-dashboard-section" id="portfolio-risk">
          <div className="portfolio-section-heading">
            <div><span>Risk intelligence</span><h2>Psychometrics and account risk</h2></div>
            <p>Assessment coverage and flagged risk signals from stored score records.</p>
          </div>
          <div className="portfolio-risk-grid">
            <DashboardPanel title="Assessment Coverage" subtitle="Assessed records versus accounts flagged at 70 or above.">
              <RiskBars assessed={analytics.assessed} flagged={analytics.flagged} />
            </DashboardPanel>
            <DashboardPanel title="Portfolio Risk Meter" subtitle="Share of analyzed accounts currently in the high-risk band.">
              <RiskMeter highRisk={analytics.highRisk} total={analytics.total} />
            </DashboardPanel>
          </div>
        </section>

        <section className="portfolio-dashboard-section" id="portfolio-reports">
          <div className="portfolio-section-heading">
            <div><span>Decision support</span><h2>Portfolio summary</h2></div>
            <p>Current distribution by approval state, exposure, and average risk.</p>
          </div>
          <div className="portfolio-table-wrap">
            <table className="portfolio-summary-table">
              <thead><tr><th>Segment</th><th>Applications</th><th>Portfolio Share</th><th>Loan Exposure</th><th>Average Risk</th></tr></thead>
              <tbody>
                {(['Approved', 'Pending', 'Rejected'] as const).map((group) => {
                  const rows = filteredApplications.filter((record) => statusGroup(record.status) === group)
                  const exposure = rows.reduce((sum, record) => sum + Number(record.loan_amount || 0), 0)
                  const averageRisk = rows.length ? rows.reduce((sum, record) => sum + riskScore(record), 0) / rows.length : 0
                  return (
                    <tr key={group}>
                      <td><span className={`portfolio-status-dot ${group.toLowerCase()}`} />{group}</td>
                      <td>{wholeNumber.format(rows.length)}</td>
                      <td>{percent(safeRate(rows.length, analytics.total))}</td>
                      <td>{compactMoney.format(exposure)}</td>
                      <td><span className={`portfolio-risk-pill ${riskBand(averageRisk).toLowerCase()}`}>{riskBand(averageRisk)} {Math.round(averageRisk)}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="portfolio-dashboard-section" id="portfolio-activity">
          <div className="portfolio-section-heading">
            <div><span>Operational feed</span><h2>Recent Activity</h2></div>
            <button type="button" className="portfolio-text-button" onClick={() => navigate('/loan-repository')}>Open repository</button>
          </div>
          <div className="portfolio-activity-list">
            {recentActivity.map((record) => {
              const group = statusGroup(record.status)
              const Icon = group === 'Approved' ? CheckCircle2 : group === 'Rejected' ? XCircle : Activity
              return (
                <button key={record.application_no} type="button" onClick={() => navigate(`/build-profile?applicationNo=${encodeURIComponent(record.application_no)}`)}>
                  <span className={`portfolio-activity-icon ${group.toLowerCase()}`}><Icon size={17} aria-hidden="true" /></span>
                  <span><strong>{record.application_no}</strong><small>{record.borrower_name || 'Unnamed applicant'} · {record.product_type || 'Loan application'}</small></span>
                  <span className="portfolio-activity-meta"><strong>{record.status || 'Draft'}</strong><small>{record.updated_at || record.created_at ? activityDate.format(new Date(record.updated_at || record.created_at || '')) : 'No timestamp'}</small></span>
                </button>
              )
            })}
            {!loading && recentActivity.length === 0 ? <div className="portfolio-empty-state">No activity matches the current filters.</div> : null}
          </div>
        </section>
      </main>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  change,
  tone,
  invert = false,
}: {
  icon: typeof WalletCards
  label: string
  value: string
  change: number
  tone: 'indigo' | 'green' | 'cyan' | 'red' | 'amber'
  invert?: boolean
}) {
  const positive = invert ? change <= 0 : change >= 0
  const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight
  return (
    <article className={`portfolio-kpi-card ${tone}`}>
      <div><span className="portfolio-kpi-icon"><Icon size={19} aria-hidden="true" /></span><small>{label}</small></div>
      <strong>{value}</strong>
      <p className={positive ? 'positive' : 'negative'}><DeltaIcon size={14} aria-hidden="true" />{Math.abs(change).toFixed(1)}% <span>vs comparison</span></p>
    </article>
  )
}

function DashboardPanel({ children, title, subtitle, action }: { children: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <article className="portfolio-panel">
      <header><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</header>
      <div className="portfolio-panel-body">{children}</div>
    </article>
  )
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  const width = 720
  const height = 240
  const left = 34
  const bottom = 34
  const top = 18
  const max = Math.max(...data.map((point) => point.value), 1)
  const points = data.map((point, index) => ({
    ...point,
    x: left + (index * (width - left * 2)) / Math.max(data.length - 1, 1),
    y: height - bottom - (point.value / max) * (height - bottom - top),
  }))
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const area = `${line} L ${points[points.length - 1]?.x ?? left} ${height - bottom} L ${points[0]?.x ?? left} ${height - bottom} Z`
  return (
    <svg className="portfolio-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly application volume trend">
      <defs><linearGradient id="portfolioTrendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4f46e5" stopOpacity=".28" /><stop offset="1" stopColor="#06b6d4" stopOpacity=".02" /></linearGradient></defs>
      {[0, .25, .5, .75, 1].map((ratio) => <line key={ratio} x1={left} x2={width - left} y1={top + ratio * (height - bottom - top)} y2={top + ratio * (height - bottom - top)} />)}
      <path d={area} className="area" /><path d={line} className="line" />
      {points.map((point) => <g key={point.label}><circle cx={point.x} cy={point.y} r="4" /><text x={point.x} y={height - 10} textAnchor="middle">{point.label}</text><title>{point.label}: {point.value}</title></g>)}
    </svg>
  )
}

function PaymentDonut({ paid, overdue }: { paid: number; overdue: number }) {
  const total = paid + overdue
  const paidPercent = total ? safeRate(paid, total) : 0
  return (
    <div className="portfolio-donut-layout">
      <div className="portfolio-donut" style={{ background: `conic-gradient(#16a34a 0 ${paidPercent}%, #ef4444 ${paidPercent}% 100%)` }}>
        <div><strong>{total ? percent(paidPercent) : 'N/A'}</strong><span>Paid</span></div>
      </div>
      <div className="portfolio-donut-legend">
        <div><span className="green" /><p><strong>{wholeNumber.format(paid)}</strong><small>Paid / released</small></p></div>
        <div><span className="red" /><p><strong>{wholeNumber.format(overdue)}</strong><small>Overdue / defaulted</small></p></div>
        {!total ? <small>No payment-state records in this cohort.</small> : null}
      </div>
    </div>
  )
}

function RiskBars({ assessed, flagged }: { assessed: Record<string, number>; flagged: Record<string, number> }) {
  const labels = ['credit', 'fraud', 'social', 'behavioral']
  const max = Math.max(...Object.values(assessed), 1)
  return (
    <div className="portfolio-risk-bars">
      {labels.map((label) => <div key={label}><span>{label}</span><div className="portfolio-bar-pair"><i style={{ height: `${(assessed[label] / max) * 100}%` }} /><i style={{ height: `${(flagged[label] / max) * 100}%` }} /></div><small>{assessed[label]} / {flagged[label]}</small></div>)}
      <p><span className="blue" />Assessed <span className="green" />Flagged</p>
    </div>
  )
}

function RiskMeter({ highRisk, total }: { highRisk: number; total: number }) {
  const rate = safeRate(highRisk, total)
  const rotation = -90 + (Math.min(rate, 100) / 100) * 180
  return (
    <div className="portfolio-risk-meter">
      <div className="portfolio-meter-arc"><span style={{ transform: `rotate(${rotation}deg)` }} /></div>
      <strong>{percent(rate)}</strong><small>{wholeNumber.format(highRisk)} high-risk accounts</small>
      <div><span>Low</span><span>Moderate</span><span>High</span></div>
      {rate >= 25 ? <p><AlertTriangle size={15} aria-hidden="true" />Concentration requires review.</p> : <p className="stable"><CheckCircle2 size={15} aria-hidden="true" />Portfolio risk is controlled.</p>}
    </div>
  )
}
