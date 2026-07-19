import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

import { api, getErrorMessage } from "../../api";
import {
  exportLoanApplications,
  importLoanApplications,
  updateLoanApplicationStatus,
  type LoanApplicationRecord,
  type WorkflowStatus,
} from "../../api/loan";
import Authorize from "../../components/auth/Authorize";
import { useAuthorization } from "../../hooks/useAuthorization";

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
      return "loan-repository-status-draft";
    case "Submitted":
      return "loan-repository-status-submitted";
    case "Under Review":
      return "loan-repository-status-review";
    case "Credit Review":
      return "loan-repository-status-credit-review";
    case "Approved":
      return "loan-repository-status-approved";
    case "Rejected":
      return "loan-repository-status-rejected";
    case "Released":
      return "loan-repository-status-released";
    default:
      return "loan-repository-status-draft";
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

function getStatusTransitionErrorMessage(error: unknown, status: WorkflowStatus): string {
  if (!axios.isAxiosError(error)) {
    return `Failed to update loan status to ${status}.`;
  }

  const detail = error.response?.data && typeof error.response.data === "object" && "detail" in error.response.data
    ? (error.response.data as { detail?: unknown }).detail
    : undefined;
  const detailText = typeof detail === "string" ? detail : "";

  if (error.response?.status === 403) {
    if (detailText.toLowerCase().includes("approve loan applications")) {
      return "Approval failed: your account is missing approve:loans permission.";
    }

    if (detailText.toLowerCase().includes("not allowed to access this loan application")) {
      return "Approval failed: you can only approve records you created, unless you are an admin.";
    }

    if (status === "Approved") {
      return "Approval failed: permission denied. You need approve:loans access for this record.";
    }

    if (status === "Released") {
      return "Release failed: permission denied. You need final_approve:loans access for this record.";
    }

    return "Status update failed: permission denied for this record.";
  }

  if (detailText) {
    return detailText;
  }

  return `Failed to update loan status to ${status}.`;
}

const DEFAULT_STATUS_FILTER: "All" | WorkflowStatus = "Draft";
const PAGE_SIZE = 10;

export default function LoanRepository() {
  const navigate = useNavigate();
  const { hasRole, hasPermission } = useAuthorization();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canCreateLoans = hasRole("admin") || hasPermission("create:loans");
  const canEditLoans = hasRole("admin") || hasPermission("edit:loans");
  const canApproveLoans = hasRole("admin") || hasPermission("approve:loans");
  const canFinalApproveLoans =
    hasRole("admin") || hasPermission("final_approve:loans");
  const canExportLoans = hasRole("admin") || hasPermission("export:loans");

  const requestedStatus = searchParams.get("status");

  const [applications, setApplications] = useState<LoanApplicationRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalApplications, setTotalApplications] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | WorkflowStatus>(
    DEFAULT_STATUS_FILTER,
  );
  const [appliedSearchText, setAppliedSearchText] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [appliedStatusFilter, setAppliedStatusFilter] = useState<"All" | WorkflowStatus>(
    DEFAULT_STATUS_FILTER,
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState<"csv" | "xlsx" | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalApplications / PAGE_SIZE));

  const filteredApplications = useMemo(() => {
    return applications.filter((application) => {
      const matchesSearch =
        appliedSearchText.length === 0 ||
        application.application_no
          .toLowerCase()
          .includes(appliedSearchText.toLowerCase()) ||
        application.borrower_name
          .toLowerCase()
          .includes(appliedSearchText.toLowerCase());

      const matchesStatus =
        appliedStatusFilter === "All" || application.status === appliedStatusFilter;

      const createdAt = application.created_at
        ? new Date(application.created_at)
        : null;
      const matchesDateFrom =
        !appliedDateFrom ||
        (createdAt !== null &&
          !Number.isNaN(createdAt.getTime()) &&
          createdAt >= new Date(`${appliedDateFrom}T00:00:00`));
      const matchesDateTo =
        !appliedDateTo ||
        (createdAt !== null &&
          !Number.isNaN(createdAt.getTime()) &&
          createdAt <= new Date(`${appliedDateTo}T23:59:59.999`));

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [applications, appliedDateFrom, appliedDateTo, appliedSearchText, appliedStatusFilter]);

  const stats = useMemo(
    () => ({
      total: totalApplications,
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
    [applications, totalApplications],
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
  const recordsCountItems = useMemo(
    () => [
      {
        label: "Visible Records" as const,
        value: filteredApplications.length,
        note: "Records shown after search, date, and status filters",
      },
      {
        label: "Total Applications" as const,
        value: stats.total,
        note: "All records currently loaded in the repository",
      },
    ],
    [filteredApplications.length, stats.total],
  );

  const messageIsError = message.toLowerCase().includes("failed");

  const loadApplications = useCallback(async (
    filters: {
      dateFrom?: string;
      dateTo?: string;
      statusFilter?: "All" | WorkflowStatus;
    } = {},
    nextPage = page,
  ) => {
    setLoading(true);
    setMessage("");

    try {
      const effectiveStatusFilter = filters.statusFilter ?? appliedStatusFilter;
      const effectiveDateFrom = filters.dateFrom ?? appliedDateFrom;
      const effectiveDateTo = filters.dateTo ?? appliedDateTo;
      const offset = (nextPage - 1) * PAGE_SIZE;
      const searchParams = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        summary: "true",
      });

      if (effectiveStatusFilter !== "All") {
        searchParams.set("status", effectiveStatusFilter);
      }

      if (effectiveDateFrom) {
        searchParams.set("date_from", effectiveDateFrom);
      }

      if (effectiveDateTo) {
        searchParams.set("date_to", effectiveDateTo);
      }

      const response = await api.get<{
        total: number;
        limit: number;
        offset: number;
        records: LoanApplicationRecord[];
      }>(`/api/loan-applications?${searchParams.toString()}`);

      setApplications(response.data.records);
      setTotalApplications(response.data.total);
    } catch (error) {
      setMessage(getErrorMessage(error, "Failed to load loan applications."));
    } finally {
      setLoading(false);
    }
  }, [appliedDateFrom, appliedDateTo, appliedStatusFilter, page]);

  const applyFilters = async () => {
    setAppliedSearchText(searchText);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setAppliedStatusFilter(statusFilter);
    setPage(1);
    await loadApplications(
      {
        dateFrom,
        dateTo,
        statusFilter,
      },
      1,
    );
  };

  const resetFilters = async () => {
    setSearchText("");
    setDateFrom("");
    setDateTo("");
    setStatusFilter(DEFAULT_STATUS_FILTER);
    setAppliedSearchText("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setAppliedStatusFilter(DEFAULT_STATUS_FILTER);
    setPage(1);
    await loadApplications(
      {
        dateFrom: "",
        dateTo: "",
        statusFilter: DEFAULT_STATUS_FILTER,
      },
      1,
    );
  };

  const handleStatusUpdate = async (
    applicationNo: string,
    status: WorkflowStatus,
  ) => {
    setMessage("");

    const allowed =
      (status === "Approved" || status === "Rejected")
        ? canApproveLoans
        : status === "Released"
          ? canFinalApproveLoans
          : canEditLoans;

    if (!allowed) {
      setMessage("You do not have permission to perform this status transition.");
      return;
    }

    try {
      const result = await updateLoanApplicationStatus(applicationNo, status);
      setMessage(result.message);
      await loadApplications();
    } catch (error) {
      setMessage(getStatusTransitionErrorMessage(error, status));
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
    setActionNotice("");

    try {
      const result = await importLoanApplications(selectedFile);
      setMessage(result.message);
      setActionNotice("👍 Upload completed.");
      await loadApplications();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Failed to import loan applications. Large files may take longer to process.",
        ),
      );
      setActionNotice("");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  const triggerExport = async (format: "csv" | "xlsx") => {
    setIsExporting(format);
    setMessage("");
    setActionNotice("");

    try {
      const blob = await exportLoanApplications({
        dateFrom: appliedDateFrom,
        dateTo: appliedDateTo,
        format,
        status: appliedStatusFilter,
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `loan-repository-${appliedStatusFilter.toLowerCase()}-${appliedDateFrom || "start"}-${appliedDateTo || "end"}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setMessage(`Loan repository ${format.toUpperCase()} export generated.`);
      setActionNotice(`👍 ${format.toUpperCase()} download completed.`);
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          `Failed to export ${format.toUpperCase()}. Large exports may take longer to generate.`,
        ),
      );
      setActionNotice("");
    } finally {
      setIsExporting(null);
    }
  };

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    if (requestedStatus && statusOptions.includes(requestedStatus as WorkflowStatus)) {
      setStatusFilter(requestedStatus as WorkflowStatus);
      setAppliedStatusFilter(requestedStatus as WorkflowStatus);
      setPage(1);
      return;
    }

    setStatusFilter(DEFAULT_STATUS_FILTER);
    setAppliedStatusFilter(DEFAULT_STATUS_FILTER);
    setPage(1);
  }, [requestedStatus]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-700 bg-slate-900 p-6 text-white md:p-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                Record Review
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Record Repository
              </h1>
              <p className="max-w-3xl text-sm text-slate-300 md:text-base">
                
              </p>
            </div>
          </div>


              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Portfolio Snapshot
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {summaryCards.map((card) => (
                    <article key={card.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-2xl font-bold text-slate-900">{card.value.toLocaleString()}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-700">{card.label}</div>
                      <p className="mt-1 text-xs text-slate-500">{card.note}</p>
                    </article>
                  ))}
                </div>
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
                    placeholder="Search by application number or applicant / borrower"
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
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                    }}
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
                    onChange={(event) => {
                      setDateTo(event.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="text-sm text-slate-500">
                  Default view loads the first 10 draft records. Use the filter button to retrieve a different result set.
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:justify-end">
                  <button
                    onClick={() => void applyFilters()}
                    disabled={loading}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-amber-600 bg-amber-500 px-5 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-amber-600 disabled:opacity-50"
                  >
                    {loading ? "Processing..." : "Process Filters"}
                  </button>
                  <button
                    onClick={() => void resetFilters()}
                    disabled={loading}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold tracking-wide text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    Reset
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                  <Authorize
                    permissions={["create:loans"]}
                    roles={["admin"]}
                    fallback={
                      <button
                        disabled
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-400 bg-slate-300 px-5 py-3 text-sm font-semibold tracking-wide text-slate-700"
                      >
                        Upload CSV / Excel (Admin only)
                      </button>
                    }
                  >
                    <button
                      onClick={handleImportClick}
                      disabled={isImporting}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-slate-900 disabled:opacity-50"
                    >
                      {isImporting ? "Importing..." : "Upload CSV / Excel"}
                    </button>
                  </Authorize>
                  <button
                    onClick={() => void triggerExport("csv")}
                    disabled={isExporting !== null || !canExportLoans}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-blue-700 bg-blue-700 px-5 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-blue-800 disabled:opacity-50"
                  >
                    {isExporting === "csv" ? "Exporting CSV..." : "Download CSV"}
                  </button>
                  <button
                    onClick={() => void triggerExport("xlsx")}
                    disabled={isExporting !== null || !canExportLoans}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-emerald-700 bg-emerald-700 px-5 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {isExporting === "xlsx" ? "Exporting Excel..." : "Download Excel"}
                  </button>
                </div>
              </div>
              {!canCreateLoans && (
                <p className="mt-2 text-xs text-slate-500 xl:text-right">
                  Bulk import requires create loan permission.
                </p>
              )}
              {!canExportLoans && (
                <p className="mt-2 text-xs text-slate-500 xl:text-right">
                  Export requires export loan permission.
                </p>
              )}
              {actionNotice && (
                <p className="mt-3 text-xs text-emerald-700 xl:text-right">
                  {actionNotice}
                </p>
              )}
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
                Showing {filteredApplications.length} of {totalApplications} applications
              </div>
            </div>

            {loading && (
              <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                Loading repository records...
              </div>
            )}

            <div className="loan-repository-mobile-records">
              {filteredApplications.map((row) => (
                <article
                  key={`mobile-${row.application_no}`}
                  className="loan-repository-record-card"
                >
                  <div className="loan-repository-record-summary">
                    <div className="loan-repository-record-identity">
                      <button
                        onClick={() =>
                          navigate(
                            `/lending-scorecard?applicationNo=${encodeURIComponent(
                              row.application_no,
                            )}`,
                          )
                        }
                        className="loan-repository-record-link"
                      >
                        {row.application_no}
                      </button>
                      <div className="text-xs text-slate-500">{formatDateTime(row.created_at)}</div>
                      <div className="text-sm font-medium text-slate-900">{row.borrower_name}</div>
                      <div className="text-xs text-slate-500">{row.product_type}</div>
                    </div>

                    <span
                      className={`loan-repository-status ${getStatusColor(
                        row.status,
                      )}`}
                    >
                      {row.status}
                    </span>
                  </div>

                  <div className="loan-repository-record-metrics">
                    <div className="loan-repository-metric-grid">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Loan Amount</div>
                        <div className="font-semibold text-slate-900">PHP {formatCurrency(row.loan_amount)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Monthly Income</div>
                        <div className="text-slate-700">PHP {formatCurrency(row.monthly_income)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">DTI</div>
                        <div className="text-slate-700">{formatPercent(row.dti)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">DSR</div>
                        <div className="text-slate-700">{formatPercent(row.dsr)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">LTV</div>
                        <div className="text-slate-700">{formatPercent(row.ltv)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Term</div>
                        <div className="text-slate-700">{row.term_months} mos</div>
                      </div>
                    </div>

                    <div className="loan-repository-record-contact">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</div>
                        <div className="text-slate-700 break-words">{row.email}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Phone</div>
                        <div className="text-slate-700">{row.phone}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Address</div>
                        <div className="text-slate-700 break-words">{row.address}</div>
                      </div>
                    </div>
                  </div>

                  <div className="loan-repository-record-actions">
                    <button
                      onClick={() => navigate(`/loan-details/${row.application_no}`)}
                      className="loan-repository-action loan-repository-action-view"
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
                      disabled={!canEditLoans}
                      className="loan-repository-action loan-repository-action-update"
                    >
                      Update
                    </button>

                    {row.status === "Credit Review" && canApproveLoans ? (
                      <button
                        onClick={() => handleStatusUpdate(row.application_no, "Approved")}
                        className="loan-repository-action loan-repository-action-approve"
                      >
                        Approve
                      </button>
                    ) : null}

                    {row.status === "Credit Review" && canApproveLoans ? (
                      <button
                        onClick={() => handleStatusUpdate(row.application_no, "Rejected")}
                        className="loan-repository-action loan-repository-action-reject"
                      >
                        Reject
                      </button>
                    ) : null}

                    {row.status === "Credit Review" && !canApproveLoans ? (
                      <p className="text-xs text-amber-700">
                        Approval actions require approve:loans permission.
                      </p>
                    ) : null}

                    {row.status === "Approved" && canFinalApproveLoans ? (
                      <button
                        onClick={() => handleStatusUpdate(row.application_no, "Released")}
                        className="loan-repository-action loan-repository-action-release"
                      >
                        Release
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}

              {!loading && filteredApplications.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  No loan applications matched the current filters.
                </div>
              ) : null}
            </div>

            <div className="loan-repository-desktop-register">
              <div className="loan-repository-table-scroll">
                <table className="loan-repository-table">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Application No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Created At</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Applicant / Borrower</th>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Debt-to-Income Ratio (DTI)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Debt Service Ratio (DSR)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Loan-to-Value Ratio (LTV)</th>
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
                          disabled={!canEditLoans}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                        >
                          Update
                        </button>

                        {row.status === "Credit Review" && canApproveLoans && (
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

                        {row.status === "Credit Review" && !canApproveLoans && (
                          <p className="text-xs font-medium text-amber-700">
                            Approval actions require approve:loans permission.
                          </p>
                        )}

                        {row.status === "Approved" && canFinalApproveLoans && (
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

            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
