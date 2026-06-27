import { useEffect, useMemo, useState } from "react";

import { getErrorMessage } from "../../api";
import { fetchDashboardStatistics } from "../../api/loan";

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

export default function DashboardSnapshot() {
  const [dashboardSummary, setDashboardSummary] = useState<{
    totalApplications: number;
    approved: number;
    pending: number;
    rejected: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Applications",
        value: dashboardSummary?.totalApplications ?? 0,
        note: "Loaded from the lightweight summary endpoint",
      },
      {
        label: "Approved",
        value: dashboardSummary?.approved ?? 0,
        note: "Approved records",
      },
      {
        label: "Pending",
        value: dashboardSummary?.pending ?? 0,
        note: "Active pipeline records",
      },
      {
        label: "Rejected",
        value: dashboardSummary?.rejected ?? 0,
        note: "Closed-out decisions",
      },
    ],
    [dashboardSummary],
  );

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
