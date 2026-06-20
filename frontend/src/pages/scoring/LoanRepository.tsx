import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getErrorMessage } from "../../api";
import {
  exportLoanApplications,
  fetchLoanApplications,
  importLoanApplications,
  updateLoanApplicationStatus,
  type LoanApplicationRecord,
  type WorkflowStatus,
} from "../../api/loan";

const statusOptions: Array<"All" | WorkflowStatus> = [
  "All",
  "Draft",
  "Submitted",
  "Under Review",
  "Credit Review",
  "Approved",
  "Rejected",
  "Released",
];

const workflowStatuses: WorkflowStatus[] = [
  "Draft",
  "Submitted",
  "Under Review",
  "Credit Review",
  "Approved",
  "Rejected",
  "Released",
];

function getStatusColor(status: WorkflowStatus) {
  switch (status) {
    case "Draft":
      return "bg-gray-100 text-gray-700";
    case "Submitted":
      return "bg-blue-100 text-blue-700";
    case "Under Review":
      return "bg-yellow-100 text-yellow-700";
    case "Credit Review":
      return "bg-purple-100 text-purple-700";
    case "Approved":
      return "bg-green-100 text-green-700";
    case "Rejected":
      return "bg-red-100 text-red-700";
    case "Released":
      return "bg-indigo-100 text-indigo-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function formatCurrency(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "N/A";
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" ? `${value}%` : "N/A";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return parsed.toLocaleString();
}

const summaryCardStyles: Record<
  WorkflowStatus | "Total Applications",
  { accent: string; surface: string; ring: string }
> = {
  "Total Applications": {
    accent: "text-slate-900",
    surface: "bg-slate-900",
    ring: "ring-slate-800/10",
  },
  Draft: {
    accent: "text-slate-800",
    surface: "bg-slate-100",
    ring: "ring-slate-300/80",
  },
  Submitted: {
    accent: "text-blue-900",
    surface: "bg-blue-50",
    ring: "ring-blue-200",
  },
  "Under Review": {
    accent: "text-amber-900",
    surface: "bg-amber-50",
    ring: "ring-amber-200",
  },
  "Credit Review": {
    accent: "text-violet-900",
    surface: "bg-violet-50",
    ring: "ring-violet-200",
  },
  Approved: {
    accent: "text-emerald-900",
    surface: "bg-emerald-50",
    ring: "ring-emerald-200",
  },
  Rejected: {
    accent: "text-rose-900",
    surface: "bg-rose-50",
    ring: "ring-rose-200",
  },
  Released: {
    accent: "text-indigo-900",
    surface: "bg-indigo-50",
    ring: "ring-indigo-200",
  },
};

export default function LoanRepository() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const requestedStatus = searchParams.get("status");

  const [applications, setApplications] = useState<LoanApplicationRecord[]>([]);
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | WorkflowStatus>(
    "All",
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState<"csv" | "xlsx" | null>(null);

  const filteredApplications = useMemo(() => {
    return applications.filter((application) => {
      const matchesSearch =
        searchText.length === 0 ||
        application.application_no
          .toLowerCase()
          .includes(searchText.toLowerCase()) ||
        application.borrower_name
          .toLowerCase()
          .includes(searchText.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || application.status === statusFilter;

      const createdAt = application.created_at
        ? new Date(application.created_at)
        : null;
      const matchesDateFrom =
        !dateFrom ||
        (createdAt !== null &&
          !Number.isNaN(createdAt.getTime()) &&
          createdAt >= new Date(`${dateFrom}T00:00:00`));
      const matchesDateTo =
        !dateTo ||
        (createdAt !== null &&
          !Number.isNaN(createdAt.getTime()) &&
          createdAt <= new Date(`${dateTo}T23:59:59.999`));

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [applications, dateFrom, dateTo, searchText, statusFilter]);

  const stats = useMemo(
    () => ({
      total: applications.length,
      byStatus: workflowStatuses.reduce(
        (accumulator, status) => {
          accumulator[status] = applications.filter(
            (item) => item.status === status,
          ).length;
          return accumulator;
        },
        {} as Record<WorkflowStatus, number>,
      ),
    }),
    [applications],
  );

  const summaryCards = useMemo(
    () => [
      { label: "Total Applications", value: stats.total, note: "All active records" },
      { label: "Draft", value: stats.byStatus.Draft, note: "Work in progress" },
      { label: "Submitted", value: stats.byStatus.Submitted, note: "Awaiting next review" },
      { label: "Under Review", value: stats.byStatus["Under Review"], note: "Initial assessment" },
      { label: "Credit Review", value: stats.byStatus["Credit Review"], note: "Credit committee lane" },
      { label: "Approved", value: stats.byStatus.Approved, note: "Cleared for release prep" },
      { label: "Rejected", value: stats.byStatus.Rejected, note: "Closed applications" },
      { label: "Released", value: stats.byStatus.Released, note: "Fully booked accounts" },
    ],
    [stats],
  );

  const messageIsError = message.toLowerCase().includes("failed");

  const loadApplications = async () => {
    setLoading(true);
    setMessage("");

    try {
      const data = await fetchLoanApplications();
      setApplications(data);
    } catch (error) {
      setMessage(getErrorMessage(error, "Failed to load loan applications."));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (
    applicationNo: string,
    status: WorkflowStatus,
  ) => {
    setMessage("");

    try {
      const result = await updateLoanApplicationStatus(applicationNo, status);
      setMessage(result.message);
      await loadApplications();
    } catch (error) {
      setMessage(getErrorMessage(error, "Failed to update loan status."));
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setIsImporting(true);
    setMessage("");

    try {
      const result = await importLoanApplications(selectedFile);
      setMessage(result.message);
      await loadApplications();
    } catch (error) {
      setMessage(getErrorMessage(error, "Failed to import loan applications."));
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  const triggerExport = async (format: "csv" | "xlsx") => {
    setIsExporting(format);
    setMessage("");

    try {
      const blob = await exportLoanApplications({
        dateFrom,
        dateTo,
        format,
        status: statusFilter,
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `loan-repository-${statusFilter.toLowerCase()}-${dateFrom || "start"}-${dateTo || "end"}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setMessage(`Loan repository ${format.toUpperCase()} export generated.`);
    } catch (error) {
      setMessage(getErrorMessage(error, `Failed to export ${format.toUpperCase()}.`));
    } finally {
      setIsExporting(null);
    }
  };

  useEffect(() => {
    void loadApplications();
  }, []);

  useEffect(() => {
    if (requestedStatus && statusOptions.includes(requestedStatus as WorkflowStatus)) {
      setStatusFilter(requestedStatus as WorkflowStatus);
      return;
    }

    setStatusFilter("All");
  }, [requestedStatus]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-700 bg-slate-900 p-6 text-white md:p-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Credit Operations
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-white">
                  Loan Repository
                </h1>
                <p className="max-w-3xl text-sm text-slate-300 md:text-base">
                  Centralized loan origination monitoring, workflow oversight, and
                  records management for credit operations teams.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-1 xl:text-right">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Visible Records
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {filteredApplications.length}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Active Filter
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {statusFilter}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Period
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {dateFrom || dateTo ? `${dateFrom || "Start"} to ${dateTo || "Present"}` : "All Dates"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 bg-slate-50 px-6 py-5 md:px-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">
                  Portfolio Snapshot
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Status volumes arranged for quick executive review.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-4">
                {summaryCards.map((card) => {
                  const styles =
                    summaryCardStyles[card.label as keyof typeof summaryCardStyles];

                  return (
                    <div
                      key={card.label}
                      className={`w-[172px] rounded-2xl ${styles.surface} p-4 shadow-sm ring-1 ${styles.ring}`}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {card.label}
                      </div>
                      <div className={`mt-3 text-3xl font-semibold ${styles.accent}`}>
                        {card.value}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">{card.note}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 bg-white px-6 py-6 md:px-8">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">
                    Filters and Actions
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Search, narrow the reporting window, and manage imports or exports.
                  </p>
                </div>
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                  Repository Control Panel
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_220px_180px_180px]">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Search
                  </span>
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search by application number or borrower"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Workflow Status
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as "All" | WorkflowStatus)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Date From
                  </span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Date To
                  </span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="text-sm text-slate-500">
                  Use import for bulk onboarding and exports for formal reporting packs.
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:justify-end">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                  <button
                    onClick={handleImportClick}
                    disabled={isImporting}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-slate-900 disabled:opacity-50"
                  >
                    {isImporting ? "Importing..." : "Upload CSV / Excel"}
                  </button>
                  <button
                    onClick={() => void triggerExport("csv")}
                    disabled={isExporting !== null}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-blue-700 bg-blue-700 px-5 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-blue-800 disabled:opacity-50"
                  >
                    {isExporting === "csv" ? "Exporting CSV..." : "Download CSV"}
                  </button>
                  <button
                    onClick={() => void triggerExport("xlsx")}
                    disabled={isExporting !== null}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-emerald-700 bg-emerald-700 px-5 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {isExporting === "xlsx" ? "Exporting Excel..." : "Download Excel"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            {message && (
              <div
                className={`mb-5 rounded-xl border p-4 text-sm ${
                  messageIsError
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                {message}
              </div>
            )}

            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Application Register
                </h2>
                <p className="text-sm text-slate-500">
                  Formal record view for credit, operations, and release teams.
                </p>
              </div>

              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
                Showing {filteredApplications.length} of {applications.length} applications
              </div>
            </div>

            {loading && (
              <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                Loading repository records...
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Application No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Created At</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Borrower</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Gov ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Address</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Monthly Income</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Other Income</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Debt Obligations</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Loan Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Term</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Interest Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Purpose</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Collateral</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Committee Remarks</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Executive Approval</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Scorecard</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">AI Prob.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">DTI</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">DSR</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">LTV</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredApplications.map((row) => (
                    <tr key={row.application_no} className="align-top transition hover:bg-slate-50/80">
                      <td className="px-4 py-4">
                        <button
                          onClick={() =>
                            navigate(
                              `/lending-scorecard?applicationNo=${encodeURIComponent(
                                row.application_no,
                              )}`,
                            )
                          }
                          className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
                        >
                          {row.application_no}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{formatDateTime(row.created_at)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{row.product_type}</td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-900">{row.borrower_name}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{row.email}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{row.phone}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{row.gov_id}</td>
                      <td className="max-w-xs whitespace-normal break-words px-4 py-4 text-sm text-slate-700">
                        {row.address}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">PHP {formatCurrency(row.monthly_income)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">PHP {formatCurrency(row.other_income)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">PHP {formatCurrency(row.debt_obligations)}</td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-900">
                        PHP {formatCurrency(row.loan_amount)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{row.term_months} mos</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatPercent(row.interest_rate)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{row.purpose}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{row.vehicle_info}</td>
                      <td className="max-w-sm whitespace-normal break-words px-4 py-4 text-sm text-slate-700">
                        {row.committee_remarks}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{row.executive_approval ? "Yes" : "No"}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{row.scorecard_total ?? 0}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatPercent(row.ai_probability)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatPercent(row.dti)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatPercent(row.dsr)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatPercent(row.ltv)}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusColor(
                            row.status,
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            navigate(`/loan-details/${row.application_no}`)
                          }
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                          View
                        </button>

                        <button
                          onClick={() =>
                            navigate(
                              `/lending-scorecard?applicationNo=${encodeURIComponent(
                                row.application_no,
                              )}`,
                            )
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                        >
                          Update
                        </button>

                        {row.status === "Credit Review" && (
                          <>
                            <button
                              onClick={() =>
                                handleStatusUpdate(row.application_no, "Approved")
                              }
                              className="rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-800"
                            >
                              Approve
                            </button>

                            <button
                              onClick={() =>
                                handleStatusUpdate(row.application_no, "Rejected")
                              }
                              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {row.status === "Approved" && (
                          <button
                            onClick={() =>
                              handleStatusUpdate(row.application_no, "Released")
                            }
                            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                          >
                            Release
                          </button>
                        )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!loading && filteredApplications.length === 0 && (
                    <tr>
                      <td
                        colSpan={25}
                        className="p-10 text-center text-sm text-slate-500"
                      >
                        No loan applications matched the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
