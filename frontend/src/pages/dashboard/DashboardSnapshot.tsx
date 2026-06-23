import { useEffect, useMemo, useState } from "react";

import { getErrorMessage } from "../../api";
import {
  fetchAllLoanApplications,
  type LoanApplicationRecord,
} from "../../api/loan";

type MetricCard = {
  detail: string;
  label: string;
  tone: string;
  value: string;
};

type TrendPoint = {
  label: string;
  value: number;
};

type StackedPoint = {
  approved: number;
  label: string;
  rejected: number;
};

type HistogramBucket = {
  label: string;
  value: number;
};

type PieSlice = {
  color: string;
  label: string;
  value: number;
};

type HeatmapCell = {
  label: string;
  value: number;
};

type HeatmapRow = {
  cells: HeatmapCell[];
  label: string;
};

type GeoPoint = {
  count: number;
  label: string;
  x: number;
  y: number;
};

type ScatterPoint = {
  income: number;
  label: string;
  loanAmount: number;
};

type DonutSegment = {
  color: string;
  label: string;
  value: number;
};

type DashboardData = {
  ageBands: TrendPoint[];
  ageCoverage: number;
  approvalByPeriod: StackedPoint[];
  averageProcessingTime: TrendPoint[];
  averageProcessingTimeCoverage: number;
  defaultHeatmapColumns: string[];
  defaultHeatmapRows: HeatmapRow[];
  geographicCoverage: number;
  geographicPoints: GeoPoint[];
  incomeCorrelation: ScatterPoint[];
  kpis: MetricCard[];
  loanAmountDistribution: HistogramBucket[];
  monthlyVolume: TrendPoint[];
  quarterVolume: TrendPoint[];
  repeatMix: DonutSegment[];
  topPurposes: PieSlice[];
};

const cardStyles = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))",
  border: "1px solid rgba(148,163,184,0.2)",
  borderRadius: "28px",
  boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)",
};

const piePalette = [
  "#0f766e",
  "#2563eb",
  "#d97706",
  "#7c3aed",
  "#dc2626",
  "#475569",
];

const repeatPalette = ["#0f766e", "#f97316"];

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "PHP",
  maximumFractionDigits: 1,
  notation: "compact",
  style: "currency",
});

const stateCoordinates: Record<string, { x: number; y: number }> = {
  AL: { x: 705, y: 420 },
  AK: { x: 120, y: 520 },
  AZ: { x: 225, y: 360 },
  AR: { x: 585, y: 360 },
  CA: { x: 120, y: 315 },
  CO: { x: 335, y: 280 },
  CT: { x: 880, y: 195 },
  DC: { x: 835, y: 245 },
  DE: { x: 852, y: 232 },
  FL: { x: 800, y: 485 },
  GA: { x: 750, y: 390 },
  GU: { x: 930, y: 535 },
  HI: { x: 220, y: 555 },
  IA: { x: 515, y: 220 },
  ID: { x: 205, y: 185 },
  IL: { x: 620, y: 230 },
  IN: { x: 660, y: 235 },
  KS: { x: 440, y: 300 },
  KY: { x: 700, y: 290 },
  LA: { x: 590, y: 430 },
  MA: { x: 900, y: 182 },
  MD: { x: 845, y: 238 },
  ME: { x: 935, y: 135 },
  MI: { x: 670, y: 175 },
  MN: { x: 515, y: 150 },
  MO: { x: 545, y: 285 },
  MS: { x: 650, y: 410 },
  MT: { x: 285, y: 155 },
  NC: { x: 815, y: 310 },
  ND: { x: 465, y: 115 },
  NE: { x: 435, y: 240 },
  NH: { x: 915, y: 160 },
  NJ: { x: 865, y: 215 },
  NM: { x: 300, y: 350 },
  NV: { x: 175, y: 265 },
  NY: { x: 850, y: 185 },
  OH: { x: 710, y: 225 },
  OK: { x: 470, y: 345 },
  OR: { x: 125, y: 195 },
  PA: { x: 815, y: 210 },
  PR: { x: 905, y: 500 },
  RI: { x: 908, y: 190 },
  SC: { x: 790, y: 350 },
  SD: { x: 455, y: 165 },
  TN: { x: 700, y: 330 },
  TX: { x: 465, y: 425 },
  UT: { x: 245, y: 260 },
  VA: { x: 820, y: 270 },
  VI: { x: 940, y: 505 },
  VT: { x: 890, y: 155 },
  WA: { x: 145, y: 130 },
  WI: { x: 590, y: 175 },
  WV: { x: 770, y: 250 },
  WY: { x: 305, y: 215 },
};

function DashboardSnapshot() {
  const [applications, setApplications] = useState<LoanApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadApplications = async () => {
      setLoading(true);
      setMessage("");

      try {
        const records = await fetchAllLoanApplications();
        setApplications(records);
      } catch (error) {
        setMessage(
          getErrorMessage(
            error,
            "Failed to load dashboard analytics. Please try again.",
          ),
        );
      } finally {
        setLoading(false);
      }
    };

    void loadApplications();
  }, []);

  const dashboardData = useMemo(
    () => buildDashboardData(applications),
    [applications],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] px-4 py-6 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section
          className="overflow-hidden rounded-[32px] border border-slate-900/10 bg-slate-950 px-6 py-7 text-white shadow-[0_28px_70px_rgba(15,23,42,0.24)] md:px-8"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-cyan-300">
                Credit Analytics Command Center
              </p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Loan Demand, Risk, and Processing Dashboard
              </h1>
              <p className="max-w-3xl text-sm text-slate-300 md:text-base">
                Portfolio-wide view of application flow, approval mix, demand
                seasonality, customer patterns, and risk concentration using
                live loan repository records.
              </p>
            </div>

            <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-slate-200 md:grid-cols-3">
              <StatChip
                label="Records Loaded"
                value={applications.length.toLocaleString()}
              />
              <StatChip
                label="Monthly Buckets"
                value={dashboardData.monthlyVolume.length.toString()}
              />
              <StatChip
                label="Quarter Buckets"
                value={dashboardData.quarterVolume.length.toString()}
              />
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {message}
          </div>
        )}

        {loading ? (
          <div
            className="rounded-[28px] border border-slate-200 bg-white/90 px-6 py-12 text-center text-slate-600 shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
          >
            Loading dashboard analytics from the loan repository...
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {dashboardData.kpis.map((metric) => (
                <KpiCard key={metric.label} metric={metric} />
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
              <AnalyticsCard
                subtitle="Monthly trendline with quarter rollups to surface seasonality, surges, and timing gaps in borrower demand."
                title="Application Volume by Month / Quarter"
              >
                <div className="space-y-4">
                  <TrendChart
                    accent="#06b6d4"
                    data={dashboardData.monthlyVolume}
                    formatter={(value) => value.toLocaleString()}
                    valueSuffix=" apps"
                  />
                  <div className="grid gap-3 md:grid-cols-4">
                    {dashboardData.quarterVolume.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {item.label}
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900">
                          {item.value.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500">
                          Applications in quarter
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </AnalyticsCard>

              <AnalyticsCard
                subtitle="Top reported reasons for borrowing, helping credit and product teams see where demand clusters."
                title="Top Loan Purposes"
              >
                <PieChart data={dashboardData.topPurposes} />
              </AnalyticsCard>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <AnalyticsCard
                subtitle="Stacked view of positive and adverse outcomes across time to reveal swings in underwriting posture."
                title="Approval vs. Rejection Rates"
              >
                <StackedBarChart data={dashboardData.approvalByPeriod} />
              </AnalyticsCard>

              <AnalyticsCard
                subtitle="Histogram of requested loan sizes, highlighting the typical range and the tail of larger facilities."
                title="Loan Amount Distribution"
              >
                <HistogramChart data={dashboardData.loanAmountDistribution} />
              </AnalyticsCard>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
              <AnalyticsCard
                subtitle="Average days between record creation and latest update, showing faster lanes and emerging bottlenecks."
                title="Average Processing Time"
              >
                <div className="space-y-3">
                  <TrendChart
                    accent="#f97316"
                    data={dashboardData.averageProcessingTime}
                    formatter={(value) => `${value.toFixed(1)}d`}
                    valueSuffix=""
                  />
                  <p className="text-xs text-slate-500">
                    Coverage:{" "}
                    {formatPercentValue(
                      dashboardData.averageProcessingTimeCoverage,
                    )}{" "}
                    of records include both created and updated timestamps.
                  </p>
                </div>
              </AnalyticsCard>

              <AnalyticsCard
                subtitle="Age band participation based on captured applicant data. Imported rows without age details are excluded."
                title="Customer Demographics (Age Bands)"
              >
                <div className="space-y-3">
                  <ColumnChart
                    accent="#8b5cf6"
                    data={dashboardData.ageBands}
                    formatter={(value) => value.toLocaleString()}
                  />
                  <p className="text-xs text-slate-500">
                    Coverage: {formatPercentValue(dashboardData.ageCoverage)} of
                    repository records have age information.
                  </p>
                </div>
              </AnalyticsCard>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
              <AnalyticsCard
                subtitle="Quarter-by-quarter risk heatmap comparing default or delinquency concentration across product categories."
                title="Default / Delinquency Rates by Loan Type"
              >
                <HeatmapChart
                  columns={dashboardData.defaultHeatmapColumns}
                  rows={dashboardData.defaultHeatmapRows}
                />
              </AnalyticsCard>

              <AnalyticsCard
                subtitle="Distinct customers grouped by whether they appear once or return for multiple applications."
                title="Repeat vs. First-Time Applicants"
              >
                <DonutChart data={dashboardData.repeatMix} />
              </AnalyticsCard>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
              <AnalyticsCard
                subtitle="Recognized state and territory locations plotted as hotspot bubbles to show where loan demand concentrates."
                title="Geographic Distribution of Applications"
              >
                <div className="space-y-3">
                  <GeographicMap data={dashboardData.geographicPoints} />
                  <p className="text-xs text-slate-500">
                    Coverage:{" "}
                    {formatPercentValue(dashboardData.geographicCoverage)} of
                    records had a mappable state or territory code.
                  </p>
                </div>
              </AnalyticsCard>

              <AnalyticsCard
                subtitle="Scatter view of borrower income against requested amount to highlight affordability clusters and outliers."
                title="Income vs. Loan Amount Correlation"
              >
                <ScatterChart data={dashboardData.incomeCorrelation} />
              </AnalyticsCard>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function KpiCard({ metric }: { metric: MetricCard }) {
  return (
    <article
      className="rounded-[28px] px-5 py-5"
      style={{
        ...cardStyles,
        background: `linear-gradient(180deg, rgba(255,255,255,0.98), ${metric.tone})`,
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
        {metric.label}
      </div>
      <div className="mt-3 text-3xl font-semibold text-slate-950">
        {metric.value}
      </div>
      <div className="mt-2 text-sm text-slate-600">{metric.detail}</div>
    </article>
  );
}

function AnalyticsCard({
  children,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <article className="rounded-[30px] p-5 md:p-6" style={cardStyles}>
      <div className="mb-5 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Portfolio Lens
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>
      </div>
      {children}
    </article>
  );
}

function TrendChart({
  accent,
  data,
  formatter,
  valueSuffix,
}: {
  accent: string;
  data: TrendPoint[];
  formatter: (value: number) => string;
  valueSuffix: string;
}) {
  if (data.length === 0) {
    return <EmptyChartState message="Not enough dated records to render this trend." />;
  }

  const width = 760;
  const height = 260;
  const paddingX = 40;
  const paddingY = 28;
  const minValue = Math.min(...data.map((item) => item.value));
  const maxValue = Math.max(...data.map((item) => item.value));
  const range = maxValue - minValue || 1;

  const points = data.map((item, index) => {
    const x =
      paddingX + (index * (width - paddingX * 2)) / Math.max(data.length - 1, 1);
    const y =
      height -
      paddingY -
      ((item.value - minValue) / range) * (height - paddingY * 2);
    return { ...item, x, y };
  });

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${path} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;
  const gradientId = `trend-${accent.replace("#", "")}`;

  return (
    <div className="overflow-x-auto">
      <svg
        className="min-w-[720px]"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Trend chart"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.34" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((step) => {
          const y = paddingY + (step * (height - paddingY * 2)) / 3;
          return (
            <line
              key={step}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="rgba(148, 163, 184, 0.22)"
              strokeDasharray="6 8"
            />
          );
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke={accent} strokeWidth="4" />

        {points.map((point) => (
          <g key={point.label}>
            <circle
              cx={point.x}
              cy={point.y}
              fill="#ffffff"
              r="5"
              stroke={accent}
              strokeWidth="3"
            />
            <text
              x={point.x}
              y={height - 6}
              textAnchor="middle"
              className="fill-slate-500 text-[11px] font-medium"
            >
              {point.label}
            </text>
            <text
              x={point.x}
              y={point.y - 12}
              textAnchor="middle"
              className="fill-slate-700 text-[11px] font-semibold"
            >
              {formatter(point.value)}
              {valueSuffix}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function StackedBarChart({ data }: { data: StackedPoint[] }) {
  if (data.length === 0) {
    return (
      <EmptyChartState message="No dated outcome records are available for this comparison." />
    );
  }

  const maxValue = Math.max(
    ...data.map((item) => item.approved + item.rejected),
    1,
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map((item) => {
        const approvedHeight = `${(item.approved / maxValue) * 100}%`;
        const rejectedHeight = `${(item.rejected / maxValue) * 100}%`;

        return (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {item.label}
                </div>
                <div className="text-xs text-slate-500">
                  Approved vs rejected outcomes
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div className="font-semibold text-emerald-700">
                  {item.approved.toLocaleString()} approved
                </div>
                <div className="font-semibold text-rose-700">
                  {item.rejected.toLocaleString()} rejected
                </div>
              </div>
            </div>

            <div className="flex h-56 items-end gap-3">
              <div className="flex h-full w-12 flex-col justify-end overflow-hidden rounded-full bg-slate-200">
                <div
                  className="w-full bg-rose-500"
                  style={{ height: rejectedHeight }}
                />
                <div
                  className="w-full bg-emerald-500"
                  style={{ height: approvedHeight }}
                />
              </div>
              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-500" />
                  Approval volume for the period
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500" />
                  Rejections and adverse outcomes
                </div>
                <div className="rounded-xl bg-white px-3 py-2 text-slate-700 shadow-sm">
                  Total decisions: {(item.approved + item.rejected).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistogramChart({ data }: { data: HistogramBucket[] }) {
  if (data.length === 0) {
    return <EmptyChartState message="Loan amount data is unavailable for this distribution." />;
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {data.map((bucket) => (
        <div key={bucket.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {bucket.label}
          </div>
          <div className="mt-3 h-40 overflow-hidden rounded-[20px] bg-slate-200">
            <div
              className="h-full rounded-[20px] bg-gradient-to-t from-cyan-600 to-sky-400"
              style={{ marginTop: `${100 - (bucket.value / maxValue) * 100}%` }}
            />
          </div>
          <div className="mt-3 text-xl font-semibold text-slate-900">
            {bucket.value.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500">Applications in bucket</div>
        </div>
      ))}
    </div>
  );
}

function PieChart({ data }: { data: PieSlice[] }) {
  if (data.length === 0) {
    return <EmptyChartState message="Loan purpose categories are unavailable." />;
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const gradient = buildConicGradient(data, total);

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr] md:items-center">
      <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-full border border-slate-200 bg-white shadow-inner">
        <div
          className="h-52 w-52 rounded-full"
          style={{ background: gradient }}
        />
      </div>
      <div className="space-y-3">
        {data.map((slice) => (
          <div
            key={slice.label}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span
                className="h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-sm font-medium text-slate-800">
                {slice.label}
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900">
                {slice.value.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">
                {formatPercentValue(slice.value / total)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColumnChart({
  accent,
  data,
  formatter,
}: {
  accent: string;
  data: TrendPoint[];
  formatter: (value: number) => string;
}) {
  if (data.length === 0 || data.every((item) => item.value === 0)) {
    return <EmptyChartState message="Age information is not available for the current repository records." />;
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      {data.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {item.label}
          </div>
          <div className="mt-4 h-36 overflow-hidden rounded-[20px] bg-slate-200">
            <div
              className="h-full rounded-[20px]"
              style={{
                background: `linear-gradient(180deg, ${accent}, ${accent}bb)`,
                marginTop: `${100 - (item.value / maxValue) * 100}%`,
              }}
            />
          </div>
          <div className="mt-3 text-lg font-semibold text-slate-900">
            {formatter(item.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function HeatmapChart({
  columns,
  rows,
}: {
  columns: string[];
  rows: HeatmapRow[];
}) {
  if (columns.length === 0 || rows.length === 0) {
    return (
      <EmptyChartState message="Not enough product and status history is available to calculate the heatmap." />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-3">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Loan Type
            </th>
            {columns.map((column) => (
              <th
                key={column}
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                {row.label}
              </td>
              {row.cells.map((cell) => (
                <td
                  key={`${row.label}-${cell.label}`}
                  className="rounded-2xl px-4 py-4 text-center text-sm font-semibold text-slate-900"
                  style={{
                    backgroundColor: `rgba(220, 38, 38, ${0.08 + Math.min(cell.value, 1) * 0.78})`,
                  }}
                >
                  {formatPercentValue(cell.value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GeographicMap({ data }: { data: GeoPoint[] }) {
  if (data.length === 0) {
    return <EmptyChartState message="No recognizable geographic codes were found in the repository addresses." />;
  }

  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="overflow-x-auto">
      <svg
        className="min-w-[720px]"
        viewBox="0 0 1000 620"
        role="img"
        aria-label="Geographic distribution map"
      >
        <rect
          x="24"
          y="24"
          width="952"
          height="572"
          rx="36"
          fill="url(#mapSurface)"
          stroke="rgba(148, 163, 184, 0.3)"
        />
        <defs>
          <linearGradient id="mapSurface" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eff6ff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>
        <path
          d="M120 180 C180 120, 315 105, 420 135 C520 102, 700 110, 845 165 C900 190, 920 235, 910 290 C915 360, 850 438, 760 474 C675 510, 480 515, 330 488 C205 464, 126 390, 110 312 C95 268, 90 212, 120 180 Z"
          fill="rgba(148, 163, 184, 0.14)"
          stroke="rgba(100, 116, 139, 0.18)"
          strokeWidth="2"
        />

        {data.map((point) => {
          const radius = 10 + (point.count / maxCount) * 22;
          return (
            <g key={point.label}>
              <circle
                cx={point.x}
                cy={point.y}
                fill="rgba(8,145,178,0.22)"
                r={radius}
                stroke="#0891b2"
                strokeWidth="3"
              />
              <text
                x={point.x}
                y={point.y + 4}
                textAnchor="middle"
                className="fill-slate-900 text-[11px] font-bold"
              >
                {point.label}
              </text>
              <text
                x={point.x}
                y={point.y + radius + 18}
                textAnchor="middle"
                className="fill-slate-600 text-[11px] font-medium"
              >
                {point.count.toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ScatterChart({ data }: { data: ScatterPoint[] }) {
  if (data.length === 0) {
    return (
      <EmptyChartState message="Income and loan amount values are required to render the correlation chart." />
    );
  }

  const width = 720;
  const height = 360;
  const paddingX = 56;
  const paddingY = 32;
  const minIncome = Math.min(...data.map((point) => point.income));
  const maxIncome = Math.max(...data.map((point) => point.income));
  const minLoan = Math.min(...data.map((point) => point.loanAmount));
  const maxLoan = Math.max(...data.map((point) => point.loanAmount));
  const incomeRange = maxIncome - minIncome || 1;
  const loanRange = maxLoan - minLoan || 1;

  return (
    <div className="overflow-x-auto">
      <svg
        className="min-w-[700px]"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Income and loan amount scatter chart"
      >
        <rect
          x={paddingX}
          y={paddingY}
          width={width - paddingX * 2}
          height={height - paddingY * 2}
          rx="28"
          fill="#f8fafc"
        />
        {[0, 1, 2, 3].map((step) => {
          const y = paddingY + (step * (height - paddingY * 2)) / 3;
          return (
            <line
              key={`grid-y-${step}`}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="rgba(148,163,184,0.2)"
              strokeDasharray="6 8"
            />
          );
        })}
        {[0, 1, 2, 3].map((step) => {
          const x = paddingX + (step * (width - paddingX * 2)) / 3;
          return (
            <line
              key={`grid-x-${step}`}
              x1={x}
              x2={x}
              y1={paddingY}
              y2={height - paddingY}
              stroke="rgba(148,163,184,0.2)"
              strokeDasharray="6 8"
            />
          );
        })}

        {data.map((point) => {
          const x =
            paddingX +
            ((point.income - minIncome) / incomeRange) * (width - paddingX * 2);
          const y =
            height -
            paddingY -
            ((point.loanAmount - minLoan) / loanRange) * (height - paddingY * 2);
          return (
            <circle
              key={point.label}
              cx={x}
              cy={y}
              fill="rgba(14,165,233,0.45)"
              r="4.2"
            />
          );
        })}

        <text
          x={width / 2}
          y={height - 6}
          textAnchor="middle"
          className="fill-slate-500 text-[12px] font-medium"
        >
          Borrower monthly income
        </text>
        <text
          transform={`translate(16 ${height / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-slate-500 text-[12px] font-medium"
        >
          Loan amount requested
        </text>
      </svg>
    </div>
  );
}

function DonutChart({ data }: { data: DonutSegment[] }) {
  if (data.length === 0) {
    return <EmptyChartState message="Borrower repeat behavior could not be calculated." />;
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const circumference = 2 * Math.PI * 72;
  let offset = 0;

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
      <div className="mx-auto">
        <svg viewBox="0 0 200 200" className="h-56 w-56" role="img" aria-label="Applicant repeat mix donut chart">
          <circle cx="100" cy="100" fill="none" r="72" stroke="#e2e8f0" strokeWidth="26" />
          {data.map((segment) => {
            const dash = (segment.value / total) * circumference;
            const strokeDasharray = `${dash} ${circumference - dash}`;
            const strokeDashoffset = -offset;
            offset += dash;

            return (
              <circle
                key={segment.label}
                cx="100"
                cy="100"
                fill="none"
                r="72"
                stroke={segment.color}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                strokeWidth="26"
                transform="rotate(-90 100 100)"
              />
            );
          })}
          <text
            x="100"
            y="95"
            textAnchor="middle"
            className="fill-slate-500 text-[12px] font-semibold uppercase tracking-[0.18em]"
          >
            Applicants
          </text>
          <text
            x="100"
            y="118"
            textAnchor="middle"
            className="fill-slate-950 text-[24px] font-semibold"
          >
            {total.toLocaleString()}
          </text>
        </svg>
      </div>

      <div className="space-y-3">
        {data.map((segment) => (
          <div
            key={segment.label}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span
                className="h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-sm font-medium text-slate-800">
                {segment.label}
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900">
                {segment.value.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">
                {formatPercentValue(segment.value / total)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm text-slate-500">
      {message}
    </div>
  );
}

function buildDashboardData(applications: LoanApplicationRecord[]): DashboardData {
  const maxScorecard =
    Math.max(...applications.map((item) => item.scorecard_total || 0), 1) || 1;
  const enrichedRecords = applications
    .map((record) => ({
      age: extractAge(record),
      applicantKey: getApplicantKey(record),
      createdAt: parseDate(record.created_at),
      income: record.monthly_income,
      loanAmount: record.loan_amount,
      processingDays: getProcessingDays(record),
      scoreSignal: getScoreSignal(record, maxScorecard),
      stateCode: extractStateCode(record.address),
      statusCategory: getStatusCategory(record.status),
      updatedAt: parseDate(record.updated_at),
      ...record,
    }))
    .filter((record) => record.application_no);

  const submittedRecords = enrichedRecords.filter(
    (record) => record.statusCategory !== "draft",
  );
  const approvalCount = submittedRecords.filter(
    (record) => record.statusCategory === "approved",
  ).length;
  const defaultCount = submittedRecords.filter(
    (record) => record.statusCategory === "defaulted",
  ).length;
  const averageLoanAmount = average(
    submittedRecords.map((record) => record.loanAmount).filter(isPositiveNumber),
  );
  const scoreAccuracy = getScoreAccuracy(enrichedRecords);

  const monthlyVolume = buildMonthlyVolume(submittedRecords);
  const quarterVolume = buildQuarterVolume(submittedRecords);
  const approvalByPeriod = buildApprovalByPeriod(submittedRecords);
  const loanAmountDistribution = buildHistogram(submittedRecords);
  const topPurposes = buildPurposeSlices(submittedRecords);
  const averageProcessingTime = buildProcessingTrend(submittedRecords);
  const averageProcessingTimeCoverage =
    submittedRecords.length === 0
      ? 0
      : submittedRecords.filter(
          (record) => record.processingDays !== null,
        ).length / submittedRecords.length;
  const { columns: defaultHeatmapColumns, rows: defaultHeatmapRows } =
    buildDefaultHeatmap(submittedRecords);
  const { points: ageBands, coverage: ageCoverage } =
    buildAgeBandDistribution(submittedRecords);
  const { points: geographicPoints, coverage: geographicCoverage } =
    buildGeographicDistribution(submittedRecords);
  const incomeCorrelation = buildIncomeCorrelation(submittedRecords);
  const repeatMix = buildRepeatMix(submittedRecords);

  return {
    ageBands,
    ageCoverage,
    approvalByPeriod,
    averageProcessingTime,
    averageProcessingTimeCoverage,
    defaultHeatmapColumns,
    defaultHeatmapRows,
    geographicCoverage,
    geographicPoints,
    incomeCorrelation,
    kpis: [
      {
        detail: "Repository records beyond draft stage",
        label: "Total Applications Submitted",
        tone: "rgba(224, 242, 254, 0.95)",
        value: submittedRecords.length.toLocaleString(),
      },
      {
        detail: `${approvalCount.toLocaleString()} approvals and released accounts`,
        label: "Approval Rate %",
        tone: "rgba(220, 252, 231, 0.95)",
        value: formatPercentValue(
          safeDivide(approvalCount, submittedRecords.length),
        ),
      },
      {
        detail: "Average requested principal across submitted files",
        label: "Average Loan Amount",
        tone: "rgba(254, 243, 199, 0.95)",
        value: compactCurrencyFormatter.format(averageLoanAmount),
      },
      {
        detail: `${defaultCount.toLocaleString()} defaulted or delinquent outcomes`,
        label: "Default Rate %",
        tone: "rgba(254, 226, 226, 0.95)",
        value: formatPercentValue(
          safeDivide(defaultCount, submittedRecords.length),
        ),
      },
      {
        detail: "Decision-to-score alignment across resolved applications",
        label: "Score Accuracy %",
        tone: "rgba(237, 233, 254, 0.95)",
        value: formatPercentValue(scoreAccuracy),
      },
    ],
    loanAmountDistribution,
    monthlyVolume,
    quarterVolume,
    repeatMix,
    topPurposes,
  };
}

function buildMonthlyVolume(records: Array<{ createdAt: Date | null }>): TrendPoint[] {
  const monthMap = new Map<string, number>();

  for (const record of records) {
    if (!record.createdAt) {
      continue;
    }
    const key = getMonthKey(record.createdAt);
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }

  return Array.from(monthMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([key, value]) => ({
      label: formatMonthKey(key),
      value,
    }));
}

function buildQuarterVolume(records: Array<{ createdAt: Date | null }>): TrendPoint[] {
  const quarterMap = new Map<string, number>();

  for (const record of records) {
    if (!record.createdAt) {
      continue;
    }
    const key = getQuarterKey(record.createdAt);
    quarterMap.set(key, (quarterMap.get(key) ?? 0) + 1);
  }

  return Array.from(quarterMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-4)
    .map(([label, value]) => ({ label, value }));
}

function buildApprovalByPeriod(
  records: Array<{ createdAt: Date | null; statusCategory: StatusCategory }>,
): StackedPoint[] {
  const periodMap = new Map<string, { approved: number; rejected: number }>();

  for (const record of records) {
    if (!record.createdAt) {
      continue;
    }
    if (record.statusCategory !== "approved" && record.statusCategory !== "rejected" && record.statusCategory !== "defaulted") {
      continue;
    }

    const key = getMonthKey(record.createdAt);
    const existing = periodMap.get(key) ?? { approved: 0, rejected: 0 };

    if (record.statusCategory === "approved") {
      existing.approved += 1;
    } else {
      existing.rejected += 1;
    }

    periodMap.set(key, existing);
  }

  return Array.from(periodMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([key, value]) => ({
      approved: value.approved,
      label: formatMonthKey(key),
      rejected: value.rejected,
    }));
}

function buildHistogram(
  records: Array<{ loanAmount: number }>,
): HistogramBucket[] {
  const values = records.map((record) => record.loanAmount).filter(isPositiveNumber);

  if (values.length === 0) {
    return [];
  }

  const bucketCount = 8;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const width = (maxValue - minValue || 1) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    label: `${compactCurrencyFormatter.format(minValue + width * index)} - ${compactCurrencyFormatter.format(
      minValue + width * (index + 1),
    )}`,
    value: 0,
  }));

  for (const value of values) {
    const bucketIndex = Math.min(
      Math.floor((value - minValue) / width),
      bucketCount - 1,
    );
    buckets[bucketIndex].value += 1;
  }

  return buckets;
}

function buildPurposeSlices(
  records: Array<{ purpose: string }>,
): PieSlice[] {
  const purposeMap = new Map<string, number>();

  for (const record of records) {
    const purpose = normalizeLabel(record.purpose, "Unspecified");
    purposeMap.set(purpose, (purposeMap.get(purpose) ?? 0) + 1);
  }

  const ranked = Array.from(purposeMap.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);

  return ranked.map(([label, value], index) => ({
    color: piePalette[index % piePalette.length],
    label,
    value,
  }));
}

function buildProcessingTrend(
  records: Array<{ createdAt: Date | null; processingDays: number | null }>,
): TrendPoint[] {
  const processingMap = new Map<string, number[]>();

  for (const record of records) {
    if (!record.createdAt || record.processingDays === null) {
      continue;
    }
    const key = getMonthKey(record.createdAt);
    const bucket = processingMap.get(key) ?? [];
    bucket.push(record.processingDays);
    processingMap.set(key, bucket);
  }

  return Array.from(processingMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([key, values]) => ({
      label: formatMonthKey(key),
      value: average(values),
    }));
}

function buildDefaultHeatmap(
  records: Array<{
    createdAt: Date | null;
    product_type: string;
    statusCategory: StatusCategory;
  }>,
) {
  const quarterLabels = Array.from(
    new Set(
      records
        .filter((record) => record.createdAt)
        .map((record) => getQuarterKey(record.createdAt as Date)),
    ),
  )
    .sort((left, right) => left.localeCompare(right))
    .slice(-4);

  const productTypes = Array.from(
    records.reduce((map, record) => {
      const label = normalizeLabel(record.product_type, "Unspecified");
      map.set(label, (map.get(label) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([label]) => label);

  const rows: HeatmapRow[] = productTypes.map((productType) => ({
    cells: quarterLabels.map((quarterLabel) => {
      const relevant = records.filter(
        (record) =>
          record.createdAt &&
          normalizeLabel(record.product_type, "Unspecified") === productType &&
          getQuarterKey(record.createdAt) === quarterLabel,
      );
      const atRisk = relevant.filter(
        (record) => record.statusCategory === "defaulted",
      ).length;

      return {
        label: quarterLabel,
        value: safeDivide(atRisk, relevant.length),
      };
    }),
    label: productType,
  }));

  return {
    columns: quarterLabels,
    rows,
  };
}

function buildAgeBandDistribution(
  records: Array<{ age: number | null }>,
): { coverage: number; points: TrendPoint[] } {
  const bands = [
    { label: "18-24", min: 18, max: 24, value: 0 },
    { label: "25-34", min: 25, max: 34, value: 0 },
    { label: "35-44", min: 35, max: 44, value: 0 },
    { label: "45-54", min: 45, max: 54, value: 0 },
    { label: "55-64", min: 55, max: 64, value: 0 },
    { label: "65+", min: 65, max: Number.POSITIVE_INFINITY, value: 0 },
  ];

  const ages = records.map((record) => record.age).filter(isPositiveNumber);

  for (const age of ages) {
    const band = bands.find((item) => age >= item.min && age <= item.max);
    if (band) {
      band.value += 1;
    }
  }

  return {
    coverage: safeDivide(ages.length, records.length),
    points: bands.map((band) => ({ label: band.label, value: band.value })),
  };
}

function buildGeographicDistribution(
  records: Array<{ stateCode: string | null }>,
): { coverage: number; points: GeoPoint[] } {
  const geographyMap = new Map<string, number>();

  for (const record of records) {
    if (!record.stateCode || !stateCoordinates[record.stateCode]) {
      continue;
    }
    geographyMap.set(record.stateCode, (geographyMap.get(record.stateCode) ?? 0) + 1);
  }

  const ranked = Array.from(geographyMap.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([code, count]) => ({
      count,
      label: code,
      x: stateCoordinates[code].x,
      y: stateCoordinates[code].y,
    }));

  return {
    coverage: safeDivide(
      Array.from(geographyMap.values()).reduce((sum, count) => sum + count, 0),
      records.length,
    ),
    points: ranked,
  };
}

function buildIncomeCorrelation(
  records: Array<{
    application_no: string;
    income: number;
    loanAmount: number;
  }>,
): ScatterPoint[] {
  const points = records.filter(
    (record) => isPositiveNumber(record.income) && isPositiveNumber(record.loanAmount),
  );

  if (points.length <= 320) {
    return points.map((record) => ({
      income: record.income,
      label: record.application_no,
      loanAmount: record.loanAmount,
    }));
  }

  const stride = Math.ceil(points.length / 320);
  return points
    .filter((_record, index) => index % stride === 0)
    .map((record) => ({
      income: record.income,
      label: record.application_no,
      loanAmount: record.loanAmount,
    }));
}

function buildRepeatMix(
  records: Array<{ applicantKey: string }>,
): DonutSegment[] {
  const applicantMap = new Map<string, number>();

  for (const record of records) {
    applicantMap.set(
      record.applicantKey,
      (applicantMap.get(record.applicantKey) ?? 0) + 1,
    );
  }

  const firstTime = Array.from(applicantMap.values()).filter(
    (count) => count === 1,
  ).length;
  const repeat = Array.from(applicantMap.values()).filter(
    (count) => count > 1,
  ).length;

  return [
    {
      color: repeatPalette[0],
      label: "First-time applicants",
      value: firstTime,
    },
    {
      color: repeatPalette[1],
      label: "Repeat applicants",
      value: repeat,
    },
  ];
}

type StatusCategory =
  | "approved"
  | "defaulted"
  | "draft"
  | "pending"
  | "rejected";

function getStatusCategory(status: string): StatusCategory {
  const normalized = status.trim().toLowerCase();

  if (normalized.includes("draft")) {
    return "draft";
  }

  if (normalized.includes("reject")) {
    return "rejected";
  }

  if (
    normalized.includes("default") ||
    normalized.includes("delin") ||
    normalized.includes("past due")
  ) {
    return "defaulted";
  }

  if (
    normalized.includes("approv") ||
    normalized.includes("releas") ||
    normalized.includes("active") ||
    normalized.includes("closed")
  ) {
    return "approved";
  }

  return "pending";
}

function getProcessingDays(record: LoanApplicationRecord): number | null {
  const createdAt = parseDate(record.created_at);
  const updatedAt = parseDate(record.updated_at);

  if (!createdAt || !updatedAt) {
    return null;
  }

  const diffMs = updatedAt.getTime() - createdAt.getTime();

  if (diffMs < 0) {
    return null;
  }

  return diffMs / (1000 * 60 * 60 * 24);
}

function getApplicantKey(record: LoanApplicationRecord): string {
  const email = record.email?.trim().toLowerCase();
  if (email) {
    return `email:${email}`;
  }

  const governmentId = record.gov_id?.trim().toLowerCase();
  if (governmentId) {
    return `gov:${governmentId}`;
  }

  return `borrower:${normalizeLabel(record.borrower_name, record.application_no)}`;
}

function getScoreAccuracy(
  records: Array<{
    scoreSignal: number | null;
    statusCategory: StatusCategory;
  }>,
): number {
  const scoredRecords = records.filter(
    (record) =>
      record.scoreSignal !== null &&
      (record.statusCategory === "approved" ||
        record.statusCategory === "rejected" ||
        record.statusCategory === "defaulted"),
  );

  if (scoredRecords.length === 0) {
    return 0;
  }

  const matches = scoredRecords.filter((record) => {
    const predictedPositive = (record.scoreSignal as number) >= 0.55;
    const actualPositive = record.statusCategory === "approved";
    return predictedPositive === actualPositive;
  }).length;

  return matches / scoredRecords.length;
}

function getScoreSignal(
  record: LoanApplicationRecord,
  maxScorecard: number,
): number | null {
  const normalizedScorecard = isPositiveNumber(record.scorecard_total)
    ? record.scorecard_total / maxScorecard
    : null;
  const normalizedProbability = normalizeProbability(record.ai_probability);

  if (normalizedScorecard === null && normalizedProbability === null) {
    return null;
  }

  if (normalizedScorecard === null) {
    return normalizedProbability;
  }

  if (normalizedProbability === null) {
    return normalizedScorecard;
  }

  return (normalizedScorecard + normalizedProbability) / 2;
}

function normalizeProbability(value: number): number | null {
  if (!isPositiveNumber(value) && value !== 0) {
    return null;
  }
  return value > 1 ? value / 100 : value;
}

function extractAge(record: LoanApplicationRecord): number | null {
  const requirements = toRecord(record.requirements);
  const applicantPersonal = toRecord(requirements?.applicantPersonal);
  const age = applicantPersonal?.age;

  if (typeof age === "number" && age > 0) {
    return age;
  }

  const dateOfBirth = applicantPersonal?.dateOfBirth;
  if (typeof dateOfBirth === "string") {
    const parsed = parseDate(dateOfBirth);
    if (parsed) {
      const today = new Date();
      let years = today.getFullYear() - parsed.getFullYear();
      const monthDifference = today.getMonth() - parsed.getMonth();
      if (
        monthDifference < 0 ||
        (monthDifference === 0 && today.getDate() < parsed.getDate())
      ) {
        years -= 1;
      }
      return years > 0 ? years : null;
    }
  }

  return null;
}

function extractStateCode(address: string): string | null {
  const match =
    address.match(/,\s([A-Z]{2})\s\d{5}(?:-\d{4})?$/) ??
    address.match(/,\s([A-Z]{2})\s/);

  if (!match) {
    return null;
  }

  return match[1];
}

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const normalized = value.trim();
  const fallbackMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!fallbackMatch) {
    return null;
  }

  const month = Number(fallbackMatch[1]) - 1;
  const day = Number(fallbackMatch[2]);
  const year = Number(fallbackMatch[3]);
  const fallbackDate = new Date(year, month, day);

  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return monthFormatter.format(new Date(year, month - 1, 1));
}

function getQuarterKey(date: Date): string {
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function formatPercentValue(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function normalizeLabel(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function buildConicGradient(data: PieSlice[], total: number): string {
  let current = 0;
  const stops = data.map((slice) => {
    const start = current;
    const end = current + (slice.value / total) * 360;
    current = end;
    return `${slice.color} ${start}deg ${end}deg`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

export default DashboardSnapshot;
