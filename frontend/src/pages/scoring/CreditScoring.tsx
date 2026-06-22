import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getErrorMessage } from "../../api";
import { fetchLoanApplications, type LoanApplicationRecord } from "../../api/loan";

function CreditScoring() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<LoanApplicationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const summary = useMemo(() => {
    const total = applications.length;
    const creditReview = applications.filter((item) => item.status === "Credit Review").length;
    const approved = applications.filter((item) => item.status === "Approved").length;
    const avgAiProbability =
      total === 0
        ? null
        : applications.reduce((acc, item) => acc + (item.ai_probability || 0), 0) / total;

    return {
      total,
      creditReview,
      approved,
      avgAiProbability,
    };
  }, [applications]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage("");
      try {
        const data = await fetchLoanApplications();
        setApplications(data);
      } catch (error) {
        setMessage(getErrorMessage(error, "Failed to load credit operations metrics."));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Credit Operations Overview</h2>
          <p className="mt-1 text-sm text-slate-600">
            This page now uses the active loan origination API flow under /api/loan-applications.
          </p>
        </div>

        {message ? <div className="rounded-lg bg-white p-4 text-sm text-slate-700">{message}</div> : null}

        {loading ? (
          <div className="rounded-lg bg-white p-4 text-sm text-slate-600">Loading metrics...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wider text-slate-500">Applications</div>
              <div className="text-3xl font-bold text-slate-800">{summary.total}</div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wider text-slate-500">Credit Review</div>
              <div className="text-3xl font-bold text-violet-700">{summary.creditReview}</div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wider text-slate-500">Approved</div>
              <div className="text-3xl font-bold text-emerald-700">{summary.approved}</div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wider text-slate-500">Avg AI Probability</div>
              <div className="text-3xl font-bold text-cyan-700">
                {typeof summary.avgAiProbability === "number"
                  ? `${summary.avgAiProbability.toFixed(2)}%`
                  : "N/A"}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 rounded-lg bg-white p-4 shadow-sm">
          <button
            onClick={() => navigate("/lending-scorecard")}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            New Scored Application
          </button>
          <button
            onClick={() => navigate("/approval-queue")}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
          >
            Open Approval Queue
          </button>
          <button
            onClick={() => navigate("/credit-review-workbench")}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Open Credit Review Workbench
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreditScoring;
