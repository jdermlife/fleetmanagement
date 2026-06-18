import React, { useEffect, useState } from "react";

interface LoanApplication {
  application_no: string;
  borrower_name: string;
  email: string;
  phone: string;
  loan_amount: number;
  status: string;
  purpose: string;
  created_at: string;
}

export default function LoanRepository() {

  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [filtered, setFiltered] = useState<LoanApplication[]>([]);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [loading, setLoading] = useState(false);

  const API =
    "https://fleetmanagement-dq9t.onrender.com/api/loan-applications";

  const loadApplications = async () => {
    try {

      setLoading(true);

      const response = await fetch(API);

      if (!response.ok)
        throw new Error("Failed to load");

      const data = await response.json();

      setApplications(data);
      setFiltered(data);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {

    let result = [...applications];

    if (searchText) {

      result = result.filter(
        x =>
          x.application_no
            .toLowerCase()
            .includes(searchText.toLowerCase()) ||

          x.borrower_name
            .toLowerCase()
            .includes(searchText.toLowerCase())
      );
    }

    if (statusFilter !== "All") {

      result = result.filter(
        x => x.status === statusFilter
      );
    }

    setFiltered(result);

  }, [searchText, statusFilter, applications]);

  const updateStatus = async (
    applicationNo: string,
    status: string
  ) => {

    try {

      const response = await fetch(
        `${API}/${applicationNo}/status?status=${status}`,
        {
          method: "PUT"
        }
      );

      if (!response.ok)
        throw new Error();

      loadApplications();

    } catch (error) {
      console.error(error);
    }
  };

  const getStatusColor = (status: string) => {

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
        return "bg-gray-100";
    }
  };

  const stats = {
    total: applications.length,
    approved: applications.filter(
      x => x.status === "Approved"
    ).length,
    released: applications.filter(
      x => x.status === "Released"
    ).length,
    rejected: applications.filter(
      x => x.status === "Rejected"
    ).length
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      <div className="max-w-7xl mx-auto">

        <div className="bg-white rounded-xl shadow">

          <div className="bg-slate-800 text-white p-6">

            <h1 className="text-2xl font-bold">
              Loan Repository
            </h1>

            <p className="text-slate-300">
              Loan Origination Repository &
              Workflow Management
            </p>

          </div>

          {/* DASHBOARD */}

          <div className="grid grid-cols-4 gap-4 p-6">

            <div className="bg-blue-50 p-4 rounded">

              <div className="text-sm">
                Total Applications
              </div>

              <div className="text-3xl font-bold">
                {stats.total}
              </div>

            </div>

            <div className="bg-green-50 p-4 rounded">

              <div className="text-sm">
                Approved
              </div>

              <div className="text-3xl font-bold">
                {stats.approved}
              </div>

            </div>

            <div className="bg-indigo-50 p-4 rounded">

              <div className="text-sm">
                Released
              </div>

              <div className="text-3xl font-bold">
                {stats.released}
              </div>

            </div>

            <div className="bg-red-50 p-4 rounded">

              <div className="text-sm">
                Rejected
              </div>

              <div className="text-3xl font-bold">
                {stats.rejected}
              </div>

            </div>

          </div>

          {/* SEARCH */}

          <div className="p-6 border-t">

            <div className="flex gap-4">

              <input
                value={searchText}
                onChange={(e) =>
                  setSearchText(e.target.value)
                }
                placeholder="Search Application No or Borrower"
                className="flex-1 border rounded px-4 py-2"
              />

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                className="border rounded px-4 py-2"
              >
                <option>All</option>
                <option>Draft</option>
                <option>Submitted</option>
                <option>Under Review</option>
                <option>Credit Review</option>
                <option>Approved</option>
                <option>Rejected</option>
                <option>Released</option>
              </select>

            </div>

          </div>

          {/* TABLE */}

          <div className="p-6">

            {loading && (
              <div>Loading...</div>
            )}

            <table className="w-full border">

              <thead>

                <tr className="bg-gray-100">

                  <th className="p-3 text-left">
                    Application No
                  </th>

                  <th className="p-3 text-left">
                    Borrower
                  </th>

                  <th className="p-3 text-left">
                    Loan Amount
                  </th>

                  <th className="p-3 text-left">
                    Purpose
                  </th>

                  <th className="p-3 text-left">
                    Status
                  </th>

                  <th className="p-3 text-left">
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody>

                {filtered.map((row) => (

                  <tr
                    key={row.application_no}
                    className="border-t"
                  >

                    <td className="p-3">
                      {row.application_no}
                    </td>

                    <td className="p-3">
                      {row.borrower_name}
                    </td>

                    <td className="p-3">
                      ₱
                      {row.loan_amount?.toLocaleString()}
                    </td>

                    <td className="p-3">
                      {row.purpose}
                    </td>

                    <td className="p-3">

                      <span
                        className={`px-3 py-1 rounded text-xs font-bold ${getStatusColor(
                          row.status
                        )}`}
                      >
                        {row.status}
                      </span>

                    </td>

                    <td className="p-3 flex gap-2 flex-wrap">

                      <button
                        className="bg-blue-600 text-white px-3 py-1 rounded"
                      >
                        View
                      </button>

                      <button
                        className="bg-green-600 text-white px-3 py-1 rounded"
                      >
                        Edit
                      </button>

                      {row.status ===
                        "Credit Review" && (

                        <>
                          <button
                            onClick={() =>
                              updateStatus(
                                row.application_no,
                                "Approved"
                              )
                            }
                            className="bg-green-700 text-white px-3 py-1 rounded"
                          >
                            Approve
                          </button>

                          <button
                            onClick={() =>
                              updateStatus(
                                row.application_no,
                                "Rejected"
                              )
                            }
                            className="bg-red-600 text-white px-3 py-1 rounded"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {row.status ===
                        "Approved" && (

                        <button
                          onClick={() =>
                            updateStatus(
                              row.application_no,
                              "Released"
                            )
                          }
                          className="bg-indigo-600 text-white px-3 py-1 rounded"
                        >
                          Release
                        </button>

                      )}

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </div>

      </div>

    </div>
  );
}