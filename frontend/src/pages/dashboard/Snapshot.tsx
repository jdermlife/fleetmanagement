import { useEffect, useMemo, useRef, useState } from "react";

import { getErrorMessage } from "../../api";
import {
  fetchAllLoanApplications,
  fetchDashboardStatistics,
  type LoanApplicationRecord,
} from "../../api/loan";

type MetricCardData = {
  accent: string;
  detail: string;
  label: string;
  value: string;
};

type ChartSlice = {
  color: string;
  label: string;
  value: number;
};

type TrendPoint = {
  label: string;
  value: number;
};

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

const asOfFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const COVERAGE_MIN_RECORDS = 100;

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
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const initialRangeRef = useRef({ startDate, endDate });

  const loadSummary = async (startDateValue: string, endDateValue: string) => {
    const summary = await fetchDashboardStatistics();
    setDashboardSummary(summary);

    const dateRange = getDateRange(startDateValue, endDateValue);
    const rangeRecords = await fetchAllLoanApplications({
      ...dateRange,
    });

    if (rangeRecords.length >= COVERAGE_MIN_RECORDS) {
      setApplications(rangeRecords);
      return;
    }

    const minimumRecords = await fetchAllLoanApplications({
      maxRecords: COVERAGE_MIN_RECORDS,
    });
    setApplications(minimumRecords);
  };

  useEffect(() => {
    const loadInitialSummary = async () => {
      setLoading(true);
      setMessage("");

      try {
        await loadSummary(initialRangeRef.current.startDate, initialRangeRef.current.endDate);
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

    void loadInitialSummary();
  }, []);

  const handleGenerateReport = async () => {
    setProcessing(true);
    setMessage("");

    try {
      await loadSummary(startDate, endDate);
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Failed to process dashboard coverage. Please try again.",
        ),
      );
    } finally {
      setProcessing(false);
    }
  };

  const asOfDateLabel = useMemo(() => {
    const parsed = new Date(`${endDate}T00:00:00`);
    const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return asOfFormatter.format(safeDate);
  }, [endDate]);
  const summaryCards = useMemo(() => {
    const overallPortfolioTotal = dashboardSummary?.totalApplications ?? 0;
    const totalApplications = applications.length;
    const approved = applications.filter((record) => getStatusBucket(record.status) === "approved").length;
    const pending = applications.filter((record) => getStatusBucket(record.status) === "pending").length;
    const rejected = applications.filter((record) => getStatusBucket(record.status) === "rejected").length;

    const highCreditRiskCount = applications.filter((record) => {
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

    const behavioralRiskCount = applications.filter((record) => {
      const behaviorScore = normalizeRiskScore(
        record.psychometric_scores?.overall_psychometric_score,
      );
      const behaviorRiskLevel =
        record.psychometric_scores?.psychometric_risk_level?.toLowerCase() ?? "";
      return (
        behaviorScore >= 0.75 ||
        behaviorRiskLevel.includes("high") ||
        behaviorRiskLevel.includes("critical")
      );
    }).length;

    const socialRiskCount = applications.filter(
      (record) => normalizeRiskScore(record.social_scores?.overall_social_score) >= 0.75,
    ).length;

    return [
      {
        label: "Overall Portfolio Total",
        value: overallPortfolioTotal,
        note: "Global total across all available records",
      },
      {
        label: "Total Applications",
        value: totalApplications,
        note: "Based on selected coverage (max 100 records)",
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
        label: "High Credit Risk Count",
        value: highCreditRiskCount,
        note: "Defaulted or high AI risk",
      },
      {
        label: "Fraud Accounts High Score",
        value: fraudHighScoreCount,
        note: "High/critical fraud risk",
      },
      {
        label: "% Approval",
        value: formatPercent(safeDivide(approved, totalApplications)),
        note: "Approved divided by total applications",
      },
      {
        label: "High Behavioral Risk Counts",
        value: behavioralRiskCount,
        note: "High psychometric risk or score",
      },
      {
        label: "Social Risk Counts",
        value: socialRiskCount,
        note: "High social risk score",
      },
      {
        label: "Recommended with Enhancement",
        value: pending,
        note: "Pending profiles suggested for enhancement",
      },
    ];
  }, [applications, dashboardSummary]);

  const statusSlices = useMemo<ChartSlice[]>(() => {
    const counts: Record<string, number> = {
      Approved: 0,
      Pending: 0,
      Rejected: 0,
      Defaulted: 0,
      Draft: 0,
    };

    applications.forEach((record) => {
      const bucket = getStatusBucket(record.status);
      if (bucket === "approved") counts.Approved += 1;
      if (bucket === "pending") counts.Pending += 1;
      if (bucket === "rejected") counts.Rejected += 1;
      if (bucket === "defaulted") counts.Defaulted += 1;
      if (bucket === "draft") counts.Draft += 1;
    });

    return [
      { color: "#16a34a", label: "Approved", value: counts.Approved },
      { color: "#eab308", label: "Pending", value: counts.Pending },
      { color: "#dc2626", label: "Rejected", value: counts.Rejected },
      { color: "#ea580c", label: "Defaulted", value: counts.Defaulted },
      { color: "#64748b", label: "Draft", value: counts.Draft },
    ];
  }, [applications]);

  const aiRiskSlices = useMemo<ChartSlice[]>(() => {
    let high = 0;
    let medium = 0;
    let low = 0;

    applications.forEach((record) => {
      const score = normalizeRiskScore(record.ai_probability);
      if (score >= 0.75) {
        high += 1;
      } else if (score >= 0.4) {
        medium += 1;
      } else {
        low += 1;
      }
    });

    return [
      { color: "#dc2626", label: "High AI Risk", value: high },
      { color: "#f59e0b", label: "Medium AI Risk", value: medium },
      { color: "#16a34a", label: "Low AI Risk", value: low },
    ];
  }, [applications]);

  const dailyTrend = useMemo<TrendPoint[]>(() => {
    const days: TrendPoint[] = [];
    const end = new Date(`${endDate}T00:00:00`);
    const safeEnd = Number.isNaN(end.getTime()) ? new Date() : end;

    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(safeEnd);
      day.setDate(safeEnd.getDate() - i);
      const key = formatDateInput(day);
      days.push({ label: key.slice(5), value: 0 });
    }

    applications.forEach((record) => {
      const createdAt = record.created_at;
      if (!createdAt) {
        return;
      }
      const key = createdAt.slice(5, 10);
      const target = days.find((point) => point.label === key);
      if (target) {
        target.value += 1;
      }
    });

    return days;
  }, [applications, endDate]);

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
              Snapshot view with summary metrics only. 
            </p>
            <p style={{ ...subtleTextStyle, marginTop: "8px", maxWidth: "760px", fontSize: "0.82rem" }}>
              Welcome back. Here is your quick portfolio overview for today.
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
            Portfolio Summary
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

        {loading ? (
          <div style={{ ...panelStyle, marginBottom: "20px" }}>
            <h2 style={sectionTitleStyle}>Loading dashboard summary...</h2>
            <p style={{ ...subtleTextStyle, marginTop: "10px" }}>
              The dashboard is fetching a lightweight statistics snapshot.
            </p>
          </div>
        ) : (
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
                    <label htmlFor="snapshot-start-date" style={{ color: "#334155", fontSize: "0.78rem", fontWeight: 700 }}>
                      Start Date:
                    </label>
                    <input
                      id="snapshot-start-date"
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
                    <label htmlFor="snapshot-start-time" style={{ color: "#334155", fontSize: "0.78rem", fontWeight: 700 }}>
                      Start Time:
                    </label>
                    <input
                      id="snapshot-start-time"
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
                    <label htmlFor="snapshot-end-date" style={{ color: "#334155", fontSize: "0.78rem", fontWeight: 700 }}>
                      End Date:
                    </label>
                    <input
                      id="snapshot-end-date"
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
                    <label htmlFor="snapshot-end-time" style={{ color: "#334155", fontSize: "0.78rem", fontWeight: 700 }}>
                      End Time:
                    </label>
                    <input
                      id="snapshot-end-time"
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
                    disabled={processing || loading}
                    style={{
                      background: "#2ecc71",
                      border: "none",
                      borderRadius: "10px",
                      color: "#fff",
                      cursor: processing || loading ? "not-allowed" : "pointer",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      opacity: processing || loading ? 0.7 : 1,
                      padding: "12px 16px",
                    }}
                  >
                    {processing ? "Generating..." : "Generate Report"}
                  </button>
                </div>
              </div>

              <p style={{ ...subtleTextStyle, fontSize: "0.83rem", margin: "10px 0 0" }}>
                Default Coverage: Last 7 days or 100 records, whichever is higher.
              </p>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid rgba(148,163,184,0.25)",
                  borderRadius: "999px",
                  color: "#334155",
                  display: "inline-flex",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  padding: "10px 16px",
                }}
              >
                As of date: {asOfDateLabel}
              </div>
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

            <ResponsiveGrid minWidth={320} style={{ marginTop: "20px" }}>
              <div style={panelStyle}>
                <h2 style={{ ...sectionTitleStyle, fontSize: "1.05rem" }}>Status Distribution</h2>
                <p style={{ ...subtleTextStyle, marginTop: "8px", marginBottom: "12px" }}>
                  Breakdown of captured records by workflow status.
                </p>
                <HorizontalBarChart slices={statusSlices} />
              </div>

              <div style={panelStyle}>
                <h2 style={{ ...sectionTitleStyle, fontSize: "1.05rem" }}>AI Risk Mix</h2>
                <p style={{ ...subtleTextStyle, marginTop: "8px", marginBottom: "12px" }}>
                  High, medium, and low risk grouping from AI probability.
                </p>
                <HorizontalBarChart slices={aiRiskSlices} />
              </div>

              <div style={{ ...panelStyle, gridColumn: "1 / -1" }}>
                <h2 style={{ ...sectionTitleStyle, fontSize: "1.05rem" }}>7-Day Application Trend</h2>
                <p style={{ ...subtleTextStyle, marginTop: "8px", marginBottom: "12px" }}>
                  Daily application activity within the selected reporting period.
                </p>
                <TrendBars points={dailyTrend} />
              </div>
            </ResponsiveGrid>
          </>
        )}
      </div>
    </div>
  );
}

function getStatusBucket(status: string): "approved" | "defaulted" | "draft" | "pending" | "rejected" {
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

function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function normalizeRiskScore(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value > 1 ? value / 100 : value;
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

function HorizontalBarChart({ slices }: { slices: ChartSlice[] }) {
  const max = Math.max(1, ...slices.map((slice) => slice.value));

  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {slices.map((slice) => (
        <div key={slice.label}>
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ color: "#334155", fontSize: "0.8rem", fontWeight: 600 }}>{slice.label}</span>
            <span style={{ color: "#0f172a", fontSize: "0.82rem", fontWeight: 700 }}>{slice.value.toLocaleString()}</span>
          </div>
          <div style={{ background: "#e2e8f0", borderRadius: "999px", height: "10px", overflow: "hidden" }}>
            <div
              style={{
                background: slice.color,
                borderRadius: "999px",
                height: "100%",
                width: `${(slice.value / max) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendBars({ points }: { points: TrendPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.value));

  return (
    <div style={{ alignItems: "end", display: "grid", gap: "10px", gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
      {points.map((point) => (
        <div key={point.label} style={{ textAlign: "center" }}>
          <div
            style={{
              background: "linear-gradient(180deg, #38bdf8, #0ea5e9)",
              borderRadius: "8px 8px 4px 4px",
              height: `${Math.max(14, (point.value / max) * 120)}px`,
              marginBottom: "6px",
            }}
            title={`${point.label}: ${point.value}`}
          />
          <div style={{ color: "#334155", fontSize: "0.72rem", fontWeight: 700 }}>{point.value}</div>
          <div style={{ color: "#64748b", fontSize: "0.68rem" }}>{point.label}</div>
        </div>
      ))}
    </div>
  );
}
