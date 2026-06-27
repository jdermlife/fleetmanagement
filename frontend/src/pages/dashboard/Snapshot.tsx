import { useEffect, useMemo, useState } from "react";

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

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getLast7DaysRange(coveringDateInput: string): { dateFrom: string; dateTo: string } {
  const parsed = new Date(`${coveringDateInput}T00:00:00`);
  const coveringDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const sevenDaysAgo = new Date(coveringDate);
  sevenDaysAgo.setDate(coveringDate.getDate() - 7);

  return {
    dateFrom: formatDateInput(sevenDaysAgo),
    dateTo: formatDateInput(coveringDate),
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
  const [coveringDate, setCoveringDate] = useState(() => formatDateInput(new Date()));
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const loadSummary = async (dateValue: string) => {
    const summary = await fetchDashboardStatistics();
    setDashboardSummary(summary);

    const dateRange = getLast7DaysRange(dateValue);
    const records = await fetchAllLoanApplications({
      ...dateRange,
      maxRecords: 200,
    });
    setApplications(records);
  };

  useEffect(() => {
    const loadInitialSummary = async () => {
      setLoading(true);
      setMessage("");

      try {
        await loadSummary(coveringDate);
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

  const handleProcess = async () => {
    setProcessing(true);
    setMessage("");

    try {
      await loadSummary(coveringDate);
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
    const parsed = new Date(`${coveringDate}T00:00:00`);
    const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return asOfFormatter.format(safeDate);
  }, [coveringDate]);
  const summaryCards = useMemo(() => {
    const totalApplications = dashboardSummary?.totalApplications ?? 0;
    const approved = dashboardSummary?.approved ?? 0;
    const pending = dashboardSummary?.pending ?? 0;
    const rejected = dashboardSummary?.rejected ?? 0;

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
              Snapshot view with summary metrics only. Graphs have been removed.
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
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  justifyContent: "space-between",
                }}
              >
                <p style={{ ...subtleTextStyle, fontSize: "0.85rem", margin: 0 }}>
                  Coverage notice: last 7 days or 200 records, whichever is lower.
                </p>
                <div style={{ alignItems: "center", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <label htmlFor="snapshot-covering-date" style={{ color: "#334155", fontSize: "0.82rem", fontWeight: 700 }}>
                    Covering Date
                  </label>
                  <input
                    id="snapshot-covering-date"
                    type="date"
                    value={coveringDate}
                    onChange={(event) => setCoveringDate(event.target.value)}
                    style={{
                      border: "1px solid rgba(148,163,184,0.45)",
                      borderRadius: "10px",
                      color: "#0f172a",
                      fontSize: "0.82rem",
                      padding: "8px 10px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleProcess()}
                    disabled={processing || loading}
                    style={{
                      background: "linear-gradient(135deg, #f59e0b, #d97706)",
                      border: "none",
                      borderRadius: "10px",
                      color: "#fff",
                      cursor: processing || loading ? "not-allowed" : "pointer",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      opacity: processing || loading ? 0.7 : 1,
                      padding: "8px 12px",
                    }}
                  >
                    {processing ? "Processing..." : "Processed"}
                  </button>
                </div>
              </div>
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

            <div style={{ ...panelStyle, marginTop: "20px" }}>
              <h2 style={{ ...sectionTitleStyle, fontSize: "1.1rem" }}>Charts Removed</h2>
              <p style={{ ...subtleTextStyle, marginTop: "10px" }}>
                Detailed graphical insights in Snapshot have been removed as requested.
              </p>
            </div>
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
