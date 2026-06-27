import { useEffect, useMemo, useState } from "react";

import { getErrorMessage } from "../../api";
import {
  fetchDashboardStatistics,
  fetchAllLoanApplications,
  type LoanApplicationRecord,
} from "../../api/loan";

type StatusBucket = "approved" | "defaulted" | "draft" | "pending" | "rejected";

type EnrichedLoan = LoanApplicationRecord & {
  age: number | null;
  applicantKey: string;
  createdDate: Date | null;
  processingDays: number | null;
  scoreSignal: number | null;
  stateCode: string | null;
  statusBucket: StatusBucket;
  updatedDate: Date | null;
};

type MetricCardData = {
  accent: string;
  detail: string;
  label: string;
  value: string;
};

type TrendPoint = {
  label: string;
  value: number;
};

type OutcomePoint = {
  approved: number;
  label: string;
  rejected: number;
};

type PurposeSlice = {
  color: string;
  label: string;
  value: number;
};

type RiskProfilePoint = {
  label: string;
  riskRate: number;
  total: number;
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

type DashboardData = {
  ageBands: TrendPoint[];
  ageCoverage: number;
  amountHistogram: TrendPoint[];
  applicationVolume: TrendPoint[];
  approvalOutcomes: OutcomePoint[];
  geoCoverage: number;
  geoPoints: GeoPoint[];
  kpis: MetricCardData[];
  processingCoverage: number;
  processingTrend: TrendPoint[];
  purposeSlices: PurposeSlice[];
  quarterVolume: TrendPoint[];
  riskByLoanType: RiskProfilePoint[];
  repeatMix: PurposeSlice[];
  scatterPoints: ScatterPoint[];
};

const compactCurrency = new Intl.NumberFormat("en-US", {
  currency: "PHP",
  maximumFractionDigits: 1,
  notation: "compact",
  style: "currency",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
});

const asOfFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDefaultStartDate(): string {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 7);
  return formatDateInput(startDate);
}

function getDateRange(startDateInput: string, endDateInput: string): { dateFrom: string; dateTo: string } {
  const parsedStart = new Date(`${startDateInput}T00:00:00`);
  const parsedEnd = new Date(`${endDateInput}T00:00:00`);

  const safeStart = Number.isNaN(parsedStart.getTime()) ? new Date() : parsedStart;
  const safeEnd = Number.isNaN(parsedEnd.getTime()) ? new Date() : parsedEnd;

  const fromDate = safeStart <= safeEnd ? safeStart : safeEnd;
  const toDate = safeStart <= safeEnd ? safeEnd : safeStart;

  return {
    dateFrom: formatDateInput(fromDate),
    dateTo: formatDateInput(toDate),
  };
}

const sectionTitleStyle: React.CSSProperties = {
  color: "#1e293b",
  fontSize: "1.45rem",
  fontWeight: 700,
  lineHeight: 1.2,
  margin: 0,
};

const subtleTextStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: "0.92rem",
  lineHeight: 1.6,
  margin: 0,
};

const panelStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,252,244,0.88))",
  border: "1px solid rgba(218,165,32,0.28)",
  borderRadius: "18px",
  boxShadow: "0 10px 26px rgba(15,23,42,0.05)",
  padding: "16px",
};

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

export default function DashboardSnapshot() {
  const [applications, setApplications] = useState<LoanApplicationRecord[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<{
    totalApplications: number;
    approved: number;
    pending: number;
    rejected: number;
  } | null>(null);
  const [startDate, setStartDate] = useState(() => getDefaultStartDate());
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState(() => formatDateInput(new Date()));
  const [endTime, setEndTime] = useState("23:59");
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const loadDetailedApplications = async (startDateValue: string, endDateValue: string) => {
    setDetailsLoading(true);
    setMessage("");

    try {
      const dateRange = getDateRange(startDateValue, endDateValue);
      const records = await fetchAllLoanApplications({
        ...dateRange,
        maxRecords: 100,
      });
      setApplications(records);
      setDetailsLoaded(true);
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Failed to load dashboard analytics. Please try again.",
        ),
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      setMessage("");

      try {
        const summary = await fetchDashboardStatistics();
        setDashboardSummary(summary);
      } catch (error) {
        setMessage(
          getErrorMessage(
            error,
            "Failed to load dashboard summary. Please try again.",
          ),
        );
      } finally {
        setLoading(false);
      }
    };

    void loadSummary();
  }, []);

  useEffect(() => {
    if (detailsLoaded) {
      return;
    }

    void loadDetailedApplications(startDate, endDate);
  }, [detailsLoaded, endDate, startDate]);

  const handleGenerateReport = async () => {
    setProcessing(true);
    try {
      await loadDetailedApplications(startDate, endDate);
    } finally {
      setProcessing(false);
    }
  };

  const dashboard = useMemo(() => buildDashboardData(applications), [applications]);
  const asOfDateLabel = useMemo(() => {
    const parsed = new Date(`${endDate}T00:00:00`);
    const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return asOfFormatter.format(safeDate);
  }, [endDate]);
  const summaryCards = useMemo(() => {
    const totalApplications = dashboardSummary?.totalApplications ?? 0;
    const approved = dashboardSummary?.approved ?? 0;
    const pending = dashboardSummary?.pending ?? 0;
    const rejected = dashboardSummary?.rejected ?? 0;

    const highRiskCount = applications.filter((record) => {
      const defaulted = getStatusBucket(record.status) === "defaulted";
      const highAiRisk = normalizeRiskScore(record.ai_probability) >= 0.75;
      return defaulted || highAiRisk;
    }).length;

    const fraudHighScoreCount = applications.filter((record) => {
      const fraudScore = normalizeRiskScore(record.fraud_scores?.overall_fraud_score);
      const fraudRiskLevel = record.fraud_scores?.fraud_risk_level?.toLowerCase() ?? "";
      return (
        fraudScore >= 0.75 ||
        fraudRiskLevel.includes("high") ||
        fraudRiskLevel.includes("critical")
      );
    }).length;

    const psychometricHighScoreCount = applications.filter(
    loan =>
        loan.psychometric_scores?.overall_psychometric_score >= 75 ||
        loan.psychometric_scores?.psychometric_risk_level === "High" ||
        loan.psychometric_scores?.psychometric_risk_level === "Critical"
).length;

    const socialHighRiskScoreCount = applications.filter(
      (loan) => (loan.social_scores?.overall_social_score ?? 0) >= 75,
    ).length;

    return [
      {
        label: "Total Applications",
        value: totalApplications,
        note: "Loaded from the lightweight summary endpoint",
      },
      {
        label: "Approved",
        value: approved,
        note: "Approved records",
      },
      {
        label: "Pending",
        value: pending,
        note: "Active pipeline records",
      },
      {
        label: "Rejected",
        value: rejected,
        note: "Closed-out decisions",
      },
      {
        label: "High Credit Risk Accounts",
        value: highRiskCount,
        note: "Defaulted or high AI risk (>=75%)",
      },
      {
        label: "Fraud Accounts (High Score)",
        value: fraudHighScoreCount,
        note: "High/critical fraud risk or score >=75%",
      },
      {
        label: "% Approval (Total Applications)",
        value: formatPercent(safeDivide(approved, totalApplications)),
        note: "Approved divided by total applications",
      },
            {
        label: "High Behavioral Risk Accounts",
        value: psychometricHighScoreCount,
        note: "High/critical behavioral risk or score >=75%",
      },
      {
        label: "Social Risk Accounts (High Score)",
        value: socialHighRiskScoreCount,
        note: "High/critical social risk or score >=75%",
      },
      {
        label: "% Recommended with Enhancement",
        value: formatPercent(safeDivide(approved, totalApplications)),
        note: "Approved divided by total applications",
      },

    ];
  }, [applications, dashboardSummary]);

  return (
    <div
      style={{
        background:
          "radial-gradient(circle at top left, rgba(255,215,0,0.09), transparent 30%), linear-gradient(180deg, #ffffff 0%, #f8fafc 46%, #ffffff 100%)",
        minHeight: "100vh",
        padding: "24px 0 36px",
      }}
    >
      <div style={{ margin: "0 auto", maxWidth: "1280px", padding: "0 20px" }}>
        <section
          style={{
            alignItems: "flex-start",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "space-between",
            marginBottom: "24px",
            ...panelStyle,
            padding: "16px 6px 2px 6px",
            background: "transparent",
            border: "none",
            boxShadow: "none",
          }}
        >
          <div style={{ flex: "1 1 620px", padding: "0 10px" }}>
            <h1 style={{ color: "#1e293b", fontSize: "1.05rem", lineHeight: 1.1, margin: 0 }}>
              Dashboard Snapshot
            </h1>
            <p style={{ ...subtleTextStyle, marginTop: "8px", maxWidth: "760px", fontSize: "0.88rem" }}>
              Executive analytics for application flow, loan demand, processing
              efficiency, customer patterns, and risk concentration.
            </p>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg, #fff2b3, #ffd24d)",
              borderRadius: "999px",
              color: "#6d4c00",
              fontSize: "0.76rem",
              fontWeight: 700,
              padding: "8px 12px",
              whiteSpace: "nowrap",
            }}
          >
            Portfolio Analytics
          </div>
        </section>

        {message ? (
          <div
            style={{
              ...panelStyle,
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              color: "#be123c",
              marginBottom: "20px",
            }}
          >
            {message}
          </div>
        ) : null}

        {loading && !dashboardSummary ? (
          <div style={{ ...panelStyle, marginBottom: "20px" }}>
            <h2 style={sectionTitleStyle}>Loading dashboard summary...</h2>
            <p style={{ ...subtleTextStyle, marginTop: "10px" }}>
              The dashboard is fetching a lightweight statistics snapshot first.
            </p>
          </div>
        ) : null}

        {!loading ? (
          <>
            <div style={{ ...panelStyle, marginBottom: "12px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
                <button
                  type="button"
                  style={{
                    background: "#e74c3c",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    padding: "10px 16px",
                  }}
                >
                  Export PDF
                </button>
                <button
                  type="button"
                  style={{
                    background: "#27ae60",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    padding: "10px 16px",
                  }}
                >
                  Export Excel
                </button>
                <button
                  type="button"
                  style={{
                    background: "#3498db",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    padding: "10px 16px",
                  }}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    background: "#8e44ad",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    padding: "10px 16px",
                  }}
                >
                  Print Report
                </button>
              </div>

              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ alignItems: "center", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label htmlFor="dashboard-start-date" style={{ color: "#334155", fontSize: "0.78rem", fontWeight: 700 }}>
                      Start Date:
                    </label>
                    <input
                      id="dashboard-start-date"
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      style={{
                        border: "1px solid rgba(148,163,184,0.45)",
                        borderRadius: "10px",
                        color: "#0f172a",
                        fontSize: "0.82rem",
                        padding: "8px 10px",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label htmlFor="dashboard-start-time" style={{ color: "#334155", fontSize: "0.78rem", fontWeight: 700 }}>
                      Start Time:
                    </label>
                    <input
                      id="dashboard-start-time"
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      style={{
                        border: "1px solid rgba(148,163,184,0.45)",
                        borderRadius: "10px",
                        color: "#0f172a",
                        fontSize: "0.82rem",
                        padding: "8px 10px",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label htmlFor="dashboard-end-date" style={{ color: "#334155", fontSize: "0.78rem", fontWeight: 700 }}>
                      End Date:
                    </label>
                    <input
                      id="dashboard-end-date"
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      style={{
                        border: "1px solid rgba(148,163,184,0.45)",
                        borderRadius: "10px",
                        color: "#0f172a",
                        fontSize: "0.82rem",
                        padding: "8px 10px",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label htmlFor="dashboard-end-time" style={{ color: "#334155", fontSize: "0.78rem", fontWeight: 700 }}>
                      End Time:
                    </label>
                    <input
                      id="dashboard-end-time"
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      style={{
                        border: "1px solid rgba(148,163,184,0.45)",
                        borderRadius: "10px",
                        color: "#0f172a",
                        fontSize: "0.82rem",
                        padding: "8px 10px",
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleGenerateReport()}
                    disabled={processing || detailsLoading}
                    style={{
                      background: "#2ecc71",
                      border: "none",
                      borderRadius: "10px",
                      color: "#fff",
                      cursor: processing || detailsLoading ? "not-allowed" : "pointer",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      opacity: processing || detailsLoading ? 0.7 : 1,
                      padding: "12px 16px",
                    }}
                  >
                    {processing ? "Generating..." : "Generate Report"}
                  </button>
                </div>
              </div>

              <p style={{ ...subtleTextStyle, fontSize: "0.83rem", margin: "10px 0 0" }}>
                Coverage notice: last 7 days or 100 records, whichever is lower.
              </p>
            </div>

            <ResponsiveGrid minWidth={220}>
              {summaryCards.map((metric) => (
                <MetricCard
                  key={metric.label}
                  metric={{
                    accent: "linear-gradient(180deg, #fff8db, #fef3c7)",
                    detail: metric.note,
                    label: metric.label,
                    value: metric.value.toLocaleString(),
                  }}
                />
              ))}
            </ResponsiveGrid>

            <div style={{ marginTop: "18px", marginBottom: "6px" }}>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid rgba(148,163,184,0.25)",
                  borderRadius: "999px",
                  color: "#334155",
                  display: "inline-flex",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  gap: "8px",
                  padding: "10px 16px",
                }}
              >
                <span>As of - {asOfDateLabel}</span>
                {detailsLoading ? <span style={{ color: "#64748b" }}>(Updating...)</span> : null}
              </div>
            </div>

            {detailsLoaded ? (
              <>
                <SectionGrid>
                  <Panel
                    subtitle="Trend line with month and quarter views to surface seasonality, spikes, and reporting momentum."
                    title="Application Volume Over Time"
                  >
                    <LineChart
                      accent="#0891b2"
                      data={dashboard.applicationVolume}
                      formatValue={(value) => value.toLocaleString()}
                    />
                    <ResponsiveGrid minWidth={160} style={{ marginTop: "18px" }}>
                      {dashboard.quarterVolume.map((item) => (
                        <InfoTile
                          key={item.label}
                          label={item.label}
                          note="Applications in quarter"
                          value={item.value.toLocaleString()}
                        />
                      ))}
                    </ResponsiveGrid>
                  </Panel>

                  <Panel
                    subtitle="Most common stated borrowing reasons across the repository."
                    title="Loan Purpose Distribution"
                  >
                    <PieChart data={dashboard.purposeSlices} />
                  </Panel>
                </SectionGrid>

                <SectionGrid>
                  <Panel
                    subtitle="Stacked outcome view comparing approved and rejected flows across time."
                    title="Approval vs. Rejection Rates"
                  >
                    <StackedBarChart data={dashboard.approvalOutcomes} />
                  </Panel>

                  <Panel
                    subtitle="Histogram of requested loan sizes showing the typical range and larger outliers."
                    title="Loan Amount Distribution"
                  >
                    <VerticalBars accent="#0ea5e9" data={dashboard.amountHistogram} />
                  </Panel>
                </SectionGrid>

                <SectionGrid>
                  <Panel
                    subtitle="Average days between record creation and latest update, showing operational efficiency and bottlenecks."
                    title="Average Processing Time"
                  >
                    <LineChart
                      accent="#f97316"
                      data={dashboard.processingTrend}
                      formatValue={(value) => `${value.toFixed(1)}d`}
                    />
                    <p style={{ ...subtleTextStyle, fontSize: "0.82rem", marginTop: "12px" }}>
                      Coverage: {formatPercent(dashboard.processingCoverage)} of records include both
                      created and updated timestamps.
                    </p>
                  </Panel>

                  <Panel
                    subtitle="Application counts grouped into age bands from available applicant profile data."
                    title="Customer Demographics (Age Bands)"
                  >
                    <VerticalBars accent="#8b5cf6" data={dashboard.ageBands} />
                    <p style={{ ...subtleTextStyle, fontSize: "0.82rem", marginTop: "12px" }}>
                      Coverage: {formatPercent(dashboard.ageCoverage)} of records contain age details.
                    </p>
                  </Panel>
                </SectionGrid>

                <SectionGrid>
                  <Panel
                    subtitle="Spider chart of default and delinquency rates across loan types to show where risk is concentrated."
                    title="Risk Profile by Loan Type"
                  >
                    <RadarRiskChart data={dashboard.riskByLoanType} />
                  </Panel>

                  <Panel
                    subtitle="Distinct borrower mix split between first-time and repeat applicants."
                    title="Repeat vs. First-Time Applicants"
                  >
                    <DonutChart data={dashboard.repeatMix} />
                  </Panel>
                </SectionGrid>

                <SectionGrid>
                  <Panel
                    subtitle="Recognized state and territory codes plotted as hotspots to show where demand is concentrated."
                    title="Geographic Distribution of Applications"
                  >
                    <GeoChart data={dashboard.geoPoints} />
                    <p style={{ ...subtleTextStyle, fontSize: "0.82rem", marginTop: "12px" }}>
                      Coverage: {formatPercent(dashboard.geoCoverage)} of addresses were mappable.
                    </p>
                  </Panel>

                  <Panel
                    subtitle="Scatter plot of borrower income against requested amount to reveal affordability patterns."
                    title="Income vs. Loan Amount Correlation"
                  >
                    <ScatterChart data={dashboard.scatterPoints} />
                  </Panel>
                </SectionGrid>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: MetricCardData }) {
  return (
    <div
      style={{
        background: metric.accent,
        border: "1px solid rgba(184,134,11,0.18)",
        borderRadius: "16px",
        boxShadow: "0 8px 18px rgba(15,23,42,0.05)",
        minHeight: "94px",
        padding: "14px 14px 12px",
      }}
    >
      <div
        style={{
          color: "#334155",
          fontSize: "0.86rem",
          fontWeight: 500,
          marginBottom: "8px",
        }}
      >
        {metric.label}
      </div>
      <div style={{ color: "#0f172a", fontSize: "1.46rem", fontWeight: 700, lineHeight: 1.02 }}>
        {metric.value}
      </div>
      <div style={{ color: "#334155", fontSize: "0.72rem", marginTop: "7px" }}>
        {metric.detail}
      </div>
    </div>
  );
}

function Panel({
  children,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <section
      style={{
        ...panelStyle,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        marginTop: "18px",
        minHeight: "330px",
      }}
    >
      <div
        style={{
          borderBottom: "1px solid rgba(218,165,32,0.14)",
          marginBottom: "12px",
          minHeight: "70px",
          paddingBottom: "10px",
        }}
      >
        <h2 style={{ ...sectionTitleStyle, fontSize: "0.98rem" }}>{title}</h2>
        <p style={{ ...subtleTextStyle, marginTop: "5px", fontSize: "0.8rem", lineHeight: 1.5 }}>{subtitle}</p>
      </div>
      <div
        style={{
          display: "grid",
          flex: 1,
          alignContent: "start",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function ResponsiveGrid({
  children,
  minWidth,
  style,
}: {
  children: React.ReactNode;
  minWidth: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "18px",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        alignItems: "stretch",
        columnGap: "12px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(410px, 1fr))",
        rowGap: "0px",
      }}
    >
      {children}
    </div>
  );
}

function InfoTile({
  label,
  note,
  value,
}: {
  label: string;
  note: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid rgba(148,163,184,0.18)",
        borderRadius: "18px",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ color: "#0f172a", fontSize: "1.55rem", fontWeight: 700, marginTop: "10px" }}>
        {value}
      </div>
      <div style={{ color: "#64748b", fontSize: "0.82rem", marginTop: "4px" }}>{note}</div>
    </div>
  );
}

function LineChart({
  accent,
  data,
  formatValue,
}: {
  accent: string;
  data: TrendPoint[];
  formatValue: (value: number) => string;
}) {
  if (data.length === 0) {
    return <EmptyState message="Not enough dated records are available for this trend." />;
  }

  const width = 480;
  const height = 156;
  const padX = 40;
  const padY = 26;
  const max = Math.max(...data.map((item) => item.value), 1);
  const min = Math.min(...data.map((item) => item.value));
  const range = max - min || 1;
  const points = data.map((item, index) => {
    const x = padX + (index * (width - padX * 2)) / Math.max(data.length - 1, 1);
    const y = height - padY - ((item.value - min) / range) * (height - padY * 2);
    return { ...item, x, y };
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const area = `${path} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`;
  const gradientId = `line-${accent.replace("#", "")}`;

  return (
    <div style={{ minHeight: "170px", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: "400px", width: "100%" }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.3" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((step) => {
          const y = padY + (step * (height - padY * 2)) / 3;
          return (
            <line
              key={step}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke="rgba(148,163,184,0.2)"
              strokeDasharray="6 8"
            />
          );
        })}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke={accent} strokeWidth="4" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} fill="#fff" r="5" stroke={accent} strokeWidth="3" />
            <text
              x={point.x}
              y={point.y - 12}
              textAnchor="middle"
              style={{ fill: "#334155", fontSize: "11px", fontWeight: 700 }}
            >
              {formatValue(point.value)}
            </text>
            <text
              x={point.x}
              y={height - 6}
              textAnchor="middle"
              style={{ fill: "#64748b", fontSize: "11px", fontWeight: 600 }}
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function VerticalBars({ accent, data }: { accent: string; data: TrendPoint[] }) {
  if (data.length === 0) {
    return <EmptyState message="No records are available for this chart." />;
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <ResponsiveGrid minWidth={120} style={{ alignItems: "end", minHeight: "185px" }}>
      {data.map((item) => (
        <div
          key={item.label}
          style={{
            background: "#f8fafc",
            border: "1px solid rgba(148,163,184,0.18)",
            borderRadius: "18px",
            padding: "14px",
          }}
        >
          <div
            style={{
              color: "#64748b",
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {item.label}
          </div>
          <div
            style={{
              alignItems: "flex-end",
              background: "rgba(226,232,240,0.7)",
              borderRadius: "18px",
              display: "flex",
              height: "86px",
              marginTop: "12px",
              overflow: "hidden",
              padding: "6px",
            }}
          >
            <div
              style={{
                background: `linear-gradient(180deg, ${accent}, ${accent}cc)`,
                borderRadius: "14px",
                height: `${(item.value / max) * 100}%`,
                width: "100%",
              }}
            />
          </div>
          <div style={{ color: "#0f172a", fontSize: "1.15rem", fontWeight: 700, marginTop: "10px" }}>
            {item.value.toLocaleString()}
          </div>
        </div>
      ))}
    </ResponsiveGrid>
  );
}

function StackedBarChart({ data }: { data: OutcomePoint[] }) {
  if (data.length === 0) {
    return <EmptyState message="No resolved outcomes are available for this chart." />;
  }

  const max = Math.max(...data.map((item) => item.approved + item.rejected), 1);

  return (
    <ResponsiveGrid minWidth={170} style={{ alignItems: "end", minHeight: "185px" }}>
      {data.map((item) => (
        <div
          key={item.label}
          style={{
            background: "#f8fafc",
            border: "1px solid rgba(148,163,184,0.18)",
            borderRadius: "18px",
            padding: "14px",
          }}
        >
          <div style={{ color: "#0f172a", fontSize: "0.92rem", fontWeight: 700 }}>{item.label}</div>
          <div
            style={{
              background: "rgba(226,232,240,0.72)",
              borderRadius: "20px",
              height: "96px",
              marginTop: "14px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                background: "#ef4444",
                bottom: `${(item.approved / max) * 100}%`,
                height: `${(item.rejected / max) * 100}%`,
                left: 0,
                position: "absolute",
                right: 0,
              }}
            />
            <div
              style={{
                background: "#10b981",
                bottom: 0,
                height: `${(item.approved / max) * 100}%`,
                left: 0,
                position: "absolute",
                right: 0,
              }}
            />
          </div>
          <div style={{ color: "#10b981", fontSize: "0.84rem", fontWeight: 700, marginTop: "12px" }}>
            Approved: {item.approved.toLocaleString()}
          </div>
          <div style={{ color: "#ef4444", fontSize: "0.84rem", fontWeight: 700, marginTop: "4px" }}>
            Rejected: {item.rejected.toLocaleString()}
          </div>
        </div>
      ))}
    </ResponsiveGrid>
  );
}

function PieChart({ data }: { data: PurposeSlice[] }) {
  if (data.length === 0) {
    return <EmptyState message="Purpose data is unavailable." />;
  }

  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  let cursor = 0;
  const gradient = `conic-gradient(${data
    .map((slice) => {
      const start = cursor;
      const end = cursor + (slice.value / total) * 360;
      cursor = end;
      return `${slice.color} ${start}deg ${end}deg`;
    })
    .join(", ")})`;

  return (
    <div
      style={{
        alignItems: "center",
        display: "grid",
        gap: "18px",
        gridTemplateColumns: "minmax(140px, 180px) minmax(0, 1fr)",
        minHeight: "185px",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background: "#fff",
          border: "1px solid rgba(148,163,184,0.18)",
          borderRadius: "999px",
          display: "flex",
          height: "148px",
          justifyContent: "center",
          margin: "0 auto",
          width: "148px",
        }}
      >
        <div style={{ background: gradient, borderRadius: "999px", height: "116px", width: "116px" }} />
      </div>
      <div style={{ display: "grid", gap: "10px" }}>
        {data.map((slice) => (
          <div
            key={slice.label}
            style={{
              alignItems: "center",
              background: "#f8fafc",
              border: "1px solid rgba(148,163,184,0.18)",
              borderRadius: "16px",
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 14px",
            }}
          >
            <div style={{ alignItems: "center", display: "flex", gap: "10px" }}>
              <span style={{ background: slice.color, borderRadius: "999px", display: "inline-block", height: "12px", width: "12px" }} />
              <span style={{ color: "#0f172a", fontWeight: 600 }}>{slice.label}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#0f172a", fontWeight: 700 }}>{slice.value.toLocaleString()}</div>
              <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{formatPercent(slice.value / total)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RadarRiskChart({ data }: { data: RiskProfilePoint[] }) {
  if (data.length === 0) {
    return <EmptyState message="Risk profile data is unavailable." />;
  }

  const size = 320;
  const center = size / 2;
  const radius = 108;
  const maxRate = Math.max(...data.map((point) => point.riskRate), 0.01);
  const levels = [0.25, 0.5, 0.75, 1];

  const vertices = data.map((point, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / data.length;
    const scaled = point.riskRate / maxRate;
    const x = center + Math.cos(angle) * radius * scaled;
    const y = center + Math.sin(angle) * radius * scaled;
    const axisX = center + Math.cos(angle) * radius;
    const axisY = center + Math.sin(angle) * radius;
    const labelX = center + Math.cos(angle) * (radius + 26);
    const labelY = center + Math.sin(angle) * (radius + 26);

    return {
      ...point,
      axisX,
      axisY,
      labelX,
      labelY,
      x,
      y,
    };
  });

  const polygon = vertices.map((vertex) => `${vertex.x},${vertex.y}`).join(" ");

  return (
    <div
      style={{
        alignItems: "center",
        display: "grid",
        gap: "18px",
        gridTemplateColumns: "minmax(180px, 340px) minmax(0, 1fr)",
        minHeight: "190px",
      }}
    >
      <div style={{ margin: "0 auto", overflowX: "auto", width: "100%" }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: "320px", minWidth: "240px", width: "100%" }}>
          {levels.map((level) => {
            const points = data
              .map((_point, index) => {
                const angle = -Math.PI / 2 + (index * Math.PI * 2) / data.length;
                const x = center + Math.cos(angle) * radius * level;
                const y = center + Math.sin(angle) * radius * level;
                return `${x},${y}`;
              })
              .join(" ");

            return (
              <polygon
                key={level}
                fill="none"
                points={points}
                stroke="rgba(148,163,184,0.28)"
                strokeDasharray="5 7"
                strokeWidth="1.5"
              />
            );
          })}

          {vertices.map((vertex) => (
            <line
              key={`axis-${vertex.label}`}
              x1={center}
              x2={vertex.axisX}
              y1={center}
              y2={vertex.axisY}
              stroke="rgba(148,163,184,0.35)"
              strokeWidth="1.2"
            />
          ))}

          <polygon
            fill="rgba(239,68,68,0.2)"
            points={polygon}
            stroke="#ef4444"
            strokeLinejoin="round"
            strokeWidth="3"
          />

          {vertices.map((vertex) => (
            <g key={`point-${vertex.label}`}>
              <circle cx={vertex.x} cy={vertex.y} fill="#ef4444" r="5" />
              <text
                style={{ fill: "#0f172a", fontSize: "11px", fontWeight: 700 }}
                textAnchor="middle"
                x={vertex.labelX}
                y={vertex.labelY}
              >
                {vertex.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div style={{ display: "grid", gap: "10px" }}>
        {data.map((point) => (
          <div
            key={point.label}
            style={{
              alignItems: "center",
              background: "#f8fafc",
              border: "1px solid rgba(148,163,184,0.18)",
              borderRadius: "16px",
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 12px",
            }}
          >
            <span style={{ color: "#0f172a", fontSize: "0.84rem", fontWeight: 700 }}>
              {point.label}
            </span>
            <span style={{ color: "#ef4444", fontSize: "0.84rem", fontWeight: 700 }}>
              {formatPercent(point.riskRate)}
            </span>
          </div>
        ))}
        <p style={{ ...subtleTextStyle, fontSize: "0.78rem", marginTop: "2px" }}>
          Radar area is normalized to the highest observed default or delinquency rate.
        </p>
      </div>
    </div>
  );
}

function GeoChart({ data }: { data: GeoPoint[] }) {
  if (data.length === 0) {
    return <EmptyState message="No mappable addresses were found." />;
  }

  const max = Math.max(...data.map((point) => point.count), 1);

  return (
    <div style={{ minHeight: "190px", overflowX: "auto" }}>
      <svg viewBox="0 0 1000 620" style={{ minWidth: "400px", width: "100%", maxHeight: "220px" }}>
        <defs>
          <linearGradient id="geo-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eff6ff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>
        <rect x="24" y="24" width="952" height="572" rx="34" fill="url(#geo-gradient)" />
        <path
          d="M120 180 C180 120, 315 105, 420 135 C520 102, 700 110, 845 165 C900 190, 920 235, 910 290 C915 360, 850 438, 760 474 C675 510, 480 515, 330 488 C205 464, 126 390, 110 312 C95 268, 90 212, 120 180 Z"
          fill="rgba(148,163,184,0.12)"
          stroke="rgba(100,116,139,0.18)"
          strokeWidth="2"
        />
        {data.map((point) => {
          const radius = 11 + (point.count / max) * 22;
          return (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r={radius} fill="rgba(8,145,178,0.22)" stroke="#0891b2" strokeWidth="3" />
              <text x={point.x} y={point.y + 4} textAnchor="middle" style={{ fill: "#0f172a", fontSize: "11px", fontWeight: 700 }}>
                {point.label}
              </text>
              <text x={point.x} y={point.y + radius + 16} textAnchor="middle" style={{ fill: "#64748b", fontSize: "11px", fontWeight: 600 }}>
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
    return <EmptyState message="Income and loan amount pairs are unavailable." />;
  }

  const width = 480;
  const height = 168;
  const padX = 54;
  const padY = 30;
  const minIncome = Math.min(...data.map((point) => point.income));
  const maxIncome = Math.max(...data.map((point) => point.income));
  const minLoan = Math.min(...data.map((point) => point.loanAmount));
  const maxLoan = Math.max(...data.map((point) => point.loanAmount));
  const incomeRange = maxIncome - minIncome || 1;
  const loanRange = maxLoan - minLoan || 1;

  return (
    <div style={{ minHeight: "170px", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: "400px", width: "100%" }}>
        <rect x={padX} y={padY} width={width - padX * 2} height={height - padY * 2} rx="24" fill="#f8fafc" />
        {[0, 1, 2, 3].map((step) => {
          const y = padY + (step * (height - padY * 2)) / 3;
          return (
            <line
              key={`y-${step}`}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke="rgba(148,163,184,0.2)"
              strokeDasharray="6 8"
            />
          );
        })}
        {data.map((point) => {
          const x = padX + ((point.income - minIncome) / incomeRange) * (width - padX * 2);
          const y = height - padY - ((point.loanAmount - minLoan) / loanRange) * (height - padY * 2);
          return <circle key={point.label} cx={x} cy={y} fill="rgba(14,165,233,0.45)" r="4.2" />;
        })}
        <text x={width / 2} y={height - 6} textAnchor="middle" style={{ fill: "#64748b", fontSize: "11px", fontWeight: 600 }}>
          Borrower monthly income
        </text>
        <text transform={`translate(18 ${height / 2}) rotate(-90)`} textAnchor="middle" style={{ fill: "#64748b", fontSize: "11px", fontWeight: 600 }}>
          Loan amount requested
        </text>
      </svg>
    </div>
  );
}

function DonutChart({ data }: { data: PurposeSlice[] }) {
  if (data.length === 0) {
    return <EmptyState message="Applicant repeat mix is unavailable." />;
  }

  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const circumference = 2 * Math.PI * 72;
  let offset = 0;

  return (
    <div
      style={{
        alignItems: "center",
        display: "grid",
        gap: "18px",
        gridTemplateColumns: "minmax(135px, 170px) minmax(0, 1fr)",
        minHeight: "185px",
      }}
    >
      <div style={{ margin: "0 auto" }}>
        <svg viewBox="0 0 200 200" style={{ height: "136px", width: "136px" }}>
          <circle cx="100" cy="100" fill="none" r="72" stroke="#e2e8f0" strokeWidth="26" />
          {data.map((slice) => {
            const dash = (slice.value / total) * circumference;
            const strokeDasharray = `${dash} ${circumference - dash}`;
            const strokeDashoffset = -offset;
            offset += dash;

            return (
              <circle
                key={slice.label}
                cx="100"
                cy="100"
                fill="none"
                r="72"
                stroke={slice.color}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                strokeWidth="26"
                transform="rotate(-90 100 100)"
              />
            );
          })}
          <text x="100" y="96" textAnchor="middle" style={{ fill: "#64748b", fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Applicants
          </text>
          <text x="100" y="120" textAnchor="middle" style={{ fill: "#0f172a", fontSize: "26px", fontWeight: 700 }}>
            {total.toLocaleString()}
          </text>
        </svg>
      </div>
      <div style={{ display: "grid", gap: "10px" }}>
        {data.map((slice) => (
          <div
            key={slice.label}
            style={{
              alignItems: "center",
              background: "#f8fafc",
              border: "1px solid rgba(148,163,184,0.18)",
              borderRadius: "16px",
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 14px",
            }}
          >
            <div style={{ alignItems: "center", display: "flex", gap: "10px" }}>
              <span style={{ background: slice.color, borderRadius: "999px", display: "inline-block", height: "12px", width: "12px" }} />
              <span style={{ color: "#0f172a", fontWeight: 600 }}>{slice.label}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#0f172a", fontWeight: 700 }}>{slice.value.toLocaleString()}</div>
              <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{formatPercent(slice.value / total)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px dashed rgba(148,163,184,0.35)",
        borderRadius: "18px",
        color: "#64748b",
        fontSize: "0.92rem",
        padding: "26px 18px",
      }}
    >
      {message}
    </div>
  );
}

function buildDashboardData(applications: LoanApplicationRecord[]): DashboardData {
  const maxScorecard = Math.max(...applications.map((item) => item.scorecard_total || 0), 1);
  const enriched: EnrichedLoan[] = applications.map((record) => ({
    ...record,
    age: extractAge(record),
    applicantKey: buildApplicantKey(record),
    createdDate: parseDate(record.created_at),
    processingDays: getProcessingDays(record),
    scoreSignal: getScoreSignal(record, maxScorecard),
    stateCode: extractStateCode(record.address),
    statusBucket: getStatusBucket(record.status),
    updatedDate: parseDate(record.updated_at),
  }));

  const submitted = enriched.filter((record) => record.statusBucket !== "draft");
  const approved = submitted.filter((record) => record.statusBucket === "approved").length;
  const defaulted = submitted.filter((record) => record.statusBucket === "defaulted").length;
  const averageLoanAmount = average(submitted.map((record) => record.loan_amount).filter(isFiniteNumber));

  const kpis: MetricCardData[] = [
    {
      accent: "linear-gradient(180deg, #fff8cf, #ffeaa0)",
      detail: "Repository records beyond draft status",
      label: "Total Applications Submitted",
      value: submitted.length.toLocaleString(),
    },
    {
      accent: "linear-gradient(180deg, #daf7f2, #b8efe5)",
      detail: `${approved.toLocaleString()} approved or released applications`,
      label: "Approval Rate %",
      value: formatPercent(safeDivide(approved, submitted.length)),
    },
    {
      accent: "linear-gradient(180deg, #ffe3d7, #ffd0bd)",
      detail: "Average requested principal across submitted files",
      label: "Average Loan Amount",
      value: compactCurrency.format(averageLoanAmount),
    },
    {
      accent: "linear-gradient(180deg, #e9eef8, #d8e1f0)",
      detail: `${defaulted.toLocaleString()} defaulted or delinquent outcomes`,
      label: "Default Rate %",
      value: formatPercent(safeDivide(defaulted, submitted.length)),
    },
    {
      accent: "linear-gradient(180deg, #efe7ff, #ddd2fe)",
      detail: "Decision alignment against score and probability signals",
      label: "Score Accuracy %",
      value: formatPercent(getScoreAccuracy(submitted)),
    },
  ];

  const applicationVolume = toOrderedTrendMap(
    submitted,
    (record) => record.createdDate,
    (record, bucket) => incrementMapValue(record, bucket),
  );
  const quarterVolume = toQuarterTrend(submitted);
  const approvalOutcomes = buildApprovalOutcomes(submitted);
  const amountHistogram = buildHistogram(submitted.map((record) => record.loan_amount).filter(isFiniteNumber));
  const purposeSlices = buildPurposeSlices(submitted);
  const processingTrend = toOrderedTrendMap(
    submitted.filter((record) => record.processingDays !== null),
    (record) => record.createdDate,
    (record, bucket) => {
      bucket.push(record.processingDays as number);
    },
    (values) => average(values),
  );
  const processingCoverage = safeDivide(
    submitted.filter((record) => record.processingDays !== null).length,
    submitted.length,
  );
  const ageBands = buildAgeBands(submitted);
  const ageCoverage = safeDivide(
    submitted.filter((record) => record.age !== null).length,
    submitted.length,
  );
  const riskByLoanType = buildRiskByLoanType(submitted);
  const { geoCoverage, geoPoints } = buildGeoData(submitted);
  const scatterPoints = buildScatterPoints(submitted);
  const repeatMix = buildRepeatMix(submitted);

  return {
    ageBands,
    ageCoverage,
    amountHistogram,
    applicationVolume,
    approvalOutcomes,
    geoCoverage,
    geoPoints,
    kpis,
    processingCoverage,
    processingTrend,
    purposeSlices,
    quarterVolume,
    riskByLoanType,
    repeatMix,
    scatterPoints,
  };
}

function buildApprovalOutcomes(records: EnrichedLoan[]): OutcomePoint[] {
  const monthMap = new Map<string, { approved: number; rejected: number }>();

  for (const record of records) {
    if (!record.createdDate) {
      continue;
    }
    const isApproved = record.statusBucket === "approved";
    const isRejected = record.statusBucket === "rejected" || record.statusBucket === "defaulted";
    if (!isApproved && !isRejected) {
      continue;
    }

    const key = monthKey(record.createdDate);
    const bucket = monthMap.get(key) ?? { approved: 0, rejected: 0 };
    if (isApproved) {
      bucket.approved += 1;
    } else {
      bucket.rejected += 1;
    }
    monthMap.set(key, bucket);
  }

  return Array.from(monthMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([key, bucket]) => ({
      approved: bucket.approved,
      label: formatMonthKey(key),
      rejected: bucket.rejected,
    }));
}

function buildHistogram(values: number[]): TrendPoint[] {
  if (values.length === 0) {
    return [];
  }

  const bucketCount = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min || 1) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    label: `${compactCurrency.format(min + width * index)}-${compactCurrency.format(min + width * (index + 1))}`,
    value: 0,
  }));

  for (const value of values) {
    const index = Math.min(Math.floor((value - min) / width), bucketCount - 1);
    buckets[index].value += 1;
  }

  return buckets;
}

function buildPurposeSlices(records: EnrichedLoan[]): PurposeSlice[] {
  const counts = new Map<string, number>();
  const palette = ["#0f766e", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#475569"];

  for (const record of records) {
    const label = normalizeText(record.purpose, "Unspecified");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([label, value], index) => ({
      color: palette[index % palette.length],
      label,
      value,
    }));
}

function buildAgeBands(records: EnrichedLoan[]): TrendPoint[] {
  const bands = [
    { label: "18-24", min: 18, max: 24, value: 0 },
    { label: "25-34", min: 25, max: 34, value: 0 },
    { label: "35-44", min: 35, max: 44, value: 0 },
    { label: "45-54", min: 45, max: 54, value: 0 },
    { label: "55-64", min: 55, max: 64, value: 0 },
    { label: "65+", min: 65, max: Number.POSITIVE_INFINITY, value: 0 },
  ];

  for (const record of records) {
    if (record.age === null) {
      continue;
    }
    const band = bands.find((item) => record.age! >= item.min && record.age! <= item.max);
    if (band) {
      band.value += 1;
    }
  }

  return bands.map(({ label, value }) => ({ label, value }));
}

function buildRiskByLoanType(records: EnrichedLoan[]): RiskProfilePoint[] {
  const loanTypeMap = new Map<string, { risky: number; total: number }>();

  for (const record of records) {
    const label = normalizeText(record.product_type, normalizeText(record.purpose, "Unspecified"));
    const bucket = loanTypeMap.get(label) ?? { risky: 0, total: 0 };
    bucket.total += 1;
    if (record.statusBucket === "defaulted") {
      bucket.risky += 1;
    }
    loanTypeMap.set(label, bucket);
  }

  return Array.from(loanTypeMap.entries())
    .sort((left, right) => right[1].total - left[1].total)
    .slice(0, 6)
    .map(([label, bucket]) => ({
      label,
      riskRate: safeDivide(bucket.risky, bucket.total),
      total: bucket.total,
    }));
}

function buildGeoData(records: EnrichedLoan[]): { geoCoverage: number; geoPoints: GeoPoint[] } {
  const counts = new Map<string, number>();

  for (const record of records) {
    if (!record.stateCode || !stateCoordinates[record.stateCode]) {
      continue;
    }
    counts.set(record.stateCode, (counts.get(record.stateCode) ?? 0) + 1);
  }

  const geoPoints = Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([label, count]) => ({
      count,
      label,
      x: stateCoordinates[label].x,
      y: stateCoordinates[label].y,
    }));

  const totalMapped = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  return {
    geoCoverage: safeDivide(totalMapped, records.length),
    geoPoints,
  };
}

function buildScatterPoints(records: EnrichedLoan[]): ScatterPoint[] {
  const points = records.filter(
    (record) => isFiniteNumber(record.monthly_income) && isFiniteNumber(record.loan_amount),
  );
  const stride = points.length > 320 ? Math.ceil(points.length / 320) : 1;

  return points
    .filter((_record, index) => index % stride === 0)
    .map((record) => ({
      income: record.monthly_income,
      label: record.application_no,
      loanAmount: record.loan_amount,
    }));
}

function buildRepeatMix(records: EnrichedLoan[]): PurposeSlice[] {
  const counts = new Map<string, number>();

  for (const record of records) {
    counts.set(record.applicantKey, (counts.get(record.applicantKey) ?? 0) + 1);
  }

  const firstTime = Array.from(counts.values()).filter((value) => value === 1).length;
  const repeat = Array.from(counts.values()).filter((value) => value > 1).length;

  return [
    { color: "#0f766e", label: "First-time applicants", value: firstTime },
    { color: "#f97316", label: "Repeat applicants", value: repeat },
  ];
}

function toQuarterTrend(records: EnrichedLoan[]): TrendPoint[] {
  const quarterMap = new Map<string, number>();

  for (const record of records) {
    if (!record.createdDate) {
      continue;
    }
    const key = quarterKey(record.createdDate);
    quarterMap.set(key, (quarterMap.get(key) ?? 0) + 1);
  }

  return Array.from(quarterMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-4)
    .map(([label, value]) => ({ label, value }));
}

function toOrderedTrendMap<T>(
  records: T[],
  getDate: (record: T) => Date | null,
  collect: (record: T, bucket: number[]) => void,
  finalize: (values: number[]) => number = (values) => values[0] ?? 0,
): TrendPoint[] {
  const map = new Map<string, number[]>();

  for (const record of records) {
    const date = getDate(record);
    if (!date) {
      continue;
    }
    const key = monthKey(date);
    const bucket = map.get(key) ?? [];
    collect(record, bucket);
    map.set(key, bucket);
  }

  return Array.from(map.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([key, values]) => ({
      label: formatMonthKey(key),
      value: finalize(values),
    }));
}

function incrementMapValue<T>(_record: T, bucket: number[]) {
  bucket[0] = (bucket[0] ?? 0) + 1;
}

function getStatusBucket(status: string): StatusBucket {
  const normalized = status.trim().toLowerCase();

  if (normalized.includes("draft")) {
    return "draft";
  }
  if (normalized.includes("reject")) {
    return "rejected";
  }
  if (normalized.includes("default") || normalized.includes("delin")) {
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
  const createdDate = parseDate(record.created_at);
  const updatedDate = parseDate(record.updated_at);

  if (!createdDate || !updatedDate) {
    return null;
  }

  const diff = updatedDate.getTime() - createdDate.getTime();
  return diff >= 0 ? diff / (1000 * 60 * 60 * 24) : null;
}

function getScoreSignal(record: LoanApplicationRecord, maxScorecard: number): number | null {
  const normalizedScorecard = isFiniteNumber(record.scorecard_total)
    ? record.scorecard_total / maxScorecard
    : null;
  const normalizedProbability = isFiniteNumber(record.ai_probability)
    ? record.ai_probability > 1
      ? record.ai_probability / 100
      : record.ai_probability
    : null;

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

function getScoreAccuracy(records: EnrichedLoan[]): number {
  const resolved = records.filter(
    (record) =>
      record.scoreSignal !== null &&
      (record.statusBucket === "approved" ||
        record.statusBucket === "rejected" ||
        record.statusBucket === "defaulted"),
  );

  if (resolved.length === 0) {
    return 0;
  }

  const matches = resolved.filter((record) => {
    const predictedPositive = (record.scoreSignal as number) >= 0.55;
    const actualPositive = record.statusBucket === "approved";
    return predictedPositive === actualPositive;
  }).length;

  return matches / resolved.length;
}

function buildApplicantKey(record: LoanApplicationRecord): string {
  const email = record.email?.trim().toLowerCase();
  if (email) {
    return `email:${email}`;
  }

  const governmentId = record.gov_id?.trim().toLowerCase();
  if (governmentId) {
    return `gov:${governmentId}`;
  }

  return `borrower:${normalizeText(record.borrower_name, record.application_no)}`;
}

function extractAge(record: LoanApplicationRecord): number | null {
  const requirements = toObject(record.requirements);
  const applicantPersonal = toObject(requirements?.applicantPersonal);
  const rawAge = applicantPersonal?.age;

  if (typeof rawAge === "number" && rawAge > 0) {
    return rawAge;
  }

  const dateOfBirth = applicantPersonal?.dateOfBirth;
  if (typeof dateOfBirth !== "string") {
    return null;
  }

  const parsed = parseDate(dateOfBirth);
  if (!parsed) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }

  return age > 0 ? age : null;
}

function extractStateCode(address: string): string | null {
  const match =
    address.match(/,\s([A-Z]{2})\s\d{5}(?:-\d{4})?$/) ??
    address.match(/,\s([A-Z]{2})\s/);
  return match ? match[1] : null;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!fallback) {
    return null;
  }

  const month = Number(fallback[1]) - 1;
  const day = Number(fallback[2]);
  const year = Number(fallback[3]);
  const date = new Date(year, month, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return monthFormatter.format(new Date(year, month - 1, 1));
}

function quarterKey(date: Date): string {
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
}

function average(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function normalizeRiskScore(value: number | null | undefined): number {
  if (!isFiniteNumber(value)) {
    return 0;
  }
  return value > 1 ? value / 100 : value;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeText(value: string | undefined, fallback: string): string {
  const text = value?.trim();
  return text ? text : fallback;
}

function toObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
