import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getErrorMessage } from "../../api";
import {
  fetchLoanApplications,
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

export default function LoanRepository() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const requestedStatus = searchParams.get("status");

  const [applications, setApplications] = useState<LoanApplicationRecord[]>([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | WorkflowStatus>(
    "All",
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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

      return matchesSearch && matchesStatus;
    });
  }, [applications, searchText, statusFilter]);

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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-xl bg-white shadow">
          <div className="bg-slate-800 p-6 text-white">
            <h1 className="text-2xl font-bold">Loan Repository</h1>
            <p className="text-slate-300">
              Loan origination repository and workflow management
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
            <div className="rounded bg-blue-50 p-4">
              <div className="text-sm">Total Applications</div>
              <div className="text-3xl font-bold">{stats.total}</div>
            </div>
            <div className="rounded bg-gray-50 p-4">
              <div className="text-sm">Draft</div>
              <div className="text-3xl font-bold">{stats.byStatus.Draft}</div>
            </div>
            <div className="rounded bg-blue-50 p-4">
              <div className="text-sm">Submitted</div>
              <div className="text-3xl font-bold">{stats.byStatus.Submitted}</div>
            </div>
            <div className="rounded bg-yellow-50 p-4">
              <div className="text-sm">Under Review</div>
              <div className="text-3xl font-bold">{stats.byStatus["Under Review"]}</div>
            </div>
            <div className="rounded bg-purple-50 p-4">
              <div className="text-sm">Credit Review</div>
              <div className="text-3xl font-bold">{stats.byStatus["Credit Review"]}</div>
            </div>
            <div className="rounded bg-green-50 p-4">
              <div className="text-sm">Approved</div>
              <div className="text-3xl font-bold">{stats.byStatus.Approved}</div>
            </div>
            <div className="rounded bg-red-50 p-4">
              <div className="text-sm">Rejected</div>
              <div className="text-3xl font-bold">{stats.byStatus.Rejected}</div>
            </div>
            <div className="rounded bg-indigo-50 p-4">
              <div className="text-sm">Released</div>
              <div className="text-3xl font-bold">{stats.byStatus.Released}</div>
            </div>
          </div>

          <div className="border-t p-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search application no or borrower"
                className="flex-1 rounded border px-4 py-2"
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "All" | WorkflowStatus)
                }
                className="rounded border px-4 py-2"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-6">
            {message && (
              <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {message}
              </div>
            )}

            {loading && <div className="mb-4 text-sm text-slate-600">Loading...</div>}

            <div className="overflow-x-auto">
              <table className="w-full border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-3 text-left">Application No</th>
                    <th className="p-3 text-left">Product</th>
                    <th className="p-3 text-left">Borrower</th>
                    <th className="p-3 text-left">Email</th>
                    <th className="p-3 text-left">Phone</th>
                    <th className="p-3 text-left">Gov ID</th>
                    <th className="p-3 text-left">Address</th>
                    <th className="p-3 text-left">Monthly Income</th>
                    <th className="p-3 text-left">Other Income</th>
                    <th className="p-3 text-left">Debt Obligations</th>
                    <th className="p-3 text-left">Loan Amount</th>
                    <th className="p-3 text-left">Term</th>
                    <th className="p-3 text-left">Interest Rate</th>
                    <th className="p-3 text-left">Purpose</th>
                    <th className="p-3 text-left">Collateral</th>
                    <th className="p-3 text-left">Committee Remarks</th>
                    <th className="p-3 text-left">Executive Approval</th>
                    <th className="p-3 text-left">Scorecard</th>
                    <th className="p-3 text-left">AI Prob.</th>
                    <th className="p-3 text-left">DTI</th>
                    <th className="p-3 text-left">DSR</th>
                    <th className="p-3 text-left">LTV</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredApplications.map((row) => (
                    <tr key={row.application_no} className="border-t">
                      <td className="p-3">
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
                      <td className="p-3">{row.product_type}</td>
                      <td className="p-3">{row.borrower_name}</td>
                      <td className="p-3">{row.email}</td>
                      <td className="p-3">{row.phone}</td>
                      <td className="p-3">{row.gov_id}</td>
                      <td className="p-3 max-w-xs whitespace-normal break-words">
                        {row.address}
                      </td>
                      <td className="p-3">PHP {formatCurrency(row.monthly_income)}</td>
                      <td className="p-3">PHP {formatCurrency(row.other_income)}</td>
                      <td className="p-3">PHP {formatCurrency(row.debt_obligations)}</td>
                      <td className="p-3">
                        PHP {formatCurrency(row.loan_amount)}
                      </td>
                      <td className="p-3">{row.term_months} mos</td>
                      <td className="p-3">{formatPercent(row.interest_rate)}</td>
                      <td className="p-3">{row.purpose}</td>
                      <td className="p-3">{row.vehicle_info}</td>
                      <td className="p-3 max-w-sm whitespace-normal break-words">
                        {row.committee_remarks}
                      </td>
                      <td className="p-3">{row.executive_approval ? "Yes" : "No"}</td>
                      <td className="p-3">{row.scorecard_total ?? 0}</td>
                      <td className="p-3">{formatPercent(row.ai_probability)}</td>
                      <td className="p-3">{formatPercent(row.dti)}</td>
                      <td className="p-3">{formatPercent(row.dsr)}</td>
                      <td className="p-3">{formatPercent(row.ltv)}</td>
                      <td className="p-3">
                        <span
                          className={`rounded px-3 py-1 text-xs font-bold ${getStatusColor(
                            row.status,
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="flex flex-wrap gap-2 p-3">
                        <button
                          onClick={() =>
                            navigate(`/loan-details/${row.application_no}`)
                          }
                          className="rounded bg-blue-600 px-3 py-1 text-white"
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
                          className="rounded bg-green-600 px-3 py-1 text-white"
                        >
                          Update
                        </button>

                        {row.status === "Credit Review" && (
                          <>
                            <button
                              onClick={() =>
                                handleStatusUpdate(row.application_no, "Approved")
                              }
                              className="rounded bg-green-700 px-3 py-1 text-white"
                            >
                              Approve
                            </button>

                            <button
                              onClick={() =>
                                handleStatusUpdate(row.application_no, "Rejected")
                              }
                              className="rounded bg-red-600 px-3 py-1 text-white"
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
                            className="rounded bg-indigo-600 px-3 py-1 text-white"
                          >
                            Release
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {!loading && filteredApplications.length === 0 && (
                    <tr>
                      <td
                        colSpan={24}
                        className="p-6 text-center text-sm text-slate-500"
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
  );
}
