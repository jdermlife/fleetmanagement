import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getErrorMessage } from "../../api";
import {
  fetchLoanApplication,
  type LoanApplicationRecord,
} from "../../api/loan";

export default function LoanDetails() {
  const navigate = useNavigate();
  const { applicationNo } = useParams();

  const [loan, setLoan] = useState<LoanApplicationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadLoan = async () => {
      if (!applicationNo) {
        setMessage("Loan record not found.");
        setLoading(false);
        return;
      }

      try {
        const data = await fetchLoanApplication(applicationNo);
        setLoan(data);
      } catch (error) {
        setMessage(getErrorMessage(error, "Loan record not found."));
      } finally {
        setLoading(false);
      }
    };

    void loadLoan();
  }, [applicationNo]);

  const formatCurrency = (value: number | null | undefined) =>
    typeof value === "number" ? value.toLocaleString() : "N/A";

  const formatPercent = (value: number | null | undefined) =>
    typeof value === "number" ? `${value.toFixed(2)}%` : "N/A";

  if (loading) {
    return <div className="p-10">Loading loan details...</div>;
  }

  if (!loan) {
    return <div className="p-10">{message || "Loan record not found."}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-t-xl bg-slate-800 p-6 text-white">
          <div className="flex flex-col justify-between gap-4 md:flex-row">
            <div>
              <h1 className="text-2xl font-bold">Loan Details</h1>
              <p>Application No: {loan.application_no}</p>
            </div>

            <button
              onClick={() => navigate("/loan-repository")}
              className="rounded bg-white px-4 py-2 text-slate-800"
            >
              Back
            </button>
          </div>
        </div>

        <div className="bg-white p-6 shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded bg-blue-50 p-4">
              <div className="text-sm">Loan Amount</div>
              <div className="text-2xl font-bold">
                PHP {formatCurrency(loan.loan_amount)}
              </div>
            </div>

            <div className="rounded bg-slate-50 p-4">
              <div className="text-sm">Product Type</div>
              <div className="text-2xl font-bold">{loan.product_type}</div>
            </div>

            <div className="rounded bg-green-50 p-4">
              <div className="text-sm">AI Probability</div>
              <div className="text-2xl font-bold">{formatPercent(loan.ai_probability)}</div>
            </div>

            <div className="rounded bg-yellow-50 p-4">
              <div className="text-sm">Scorecard</div>
              <div className="text-2xl font-bold">{loan.scorecard_total ?? "N/A"}/50</div>
            </div>

            <div className="rounded bg-purple-50 p-4">
              <div className="text-sm">Status</div>
              <div className="text-2xl font-bold">{loan.status}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Borrower Information</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              Full Name
              <div className="font-semibold">{loan.borrower_name}</div>
            </div>
            <div>
              Email
              <div className="font-semibold">{loan.email}</div>
            </div>
            <div>
              Phone
              <div className="font-semibold">{loan.phone}</div>
            </div>
            <div>
              Government ID
              <div className="font-semibold">{loan.gov_id}</div>
            </div>
            <div className="md:col-span-2">
              Address
              <div className="font-semibold">{loan.address}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Employment and Income</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              Monthly Income
              <div className="font-bold">
                PHP {formatCurrency(loan.monthly_income)}
              </div>
            </div>
            <div>
              Other Income
              <div className="font-bold">
                PHP {formatCurrency(loan.other_income)}
              </div>
            </div>
            <div>
              Existing Debt
              <div className="font-bold">
                PHP {formatCurrency(loan.debt_obligations)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Loan Information</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              Loan Amount
              <div className="font-bold">
                PHP {formatCurrency(loan.loan_amount)}
              </div>
            </div>
            <div>
              Purpose
              <div className="font-bold">{loan.purpose}</div>
            </div>
            <div>
              Term
              <div className="font-bold">{loan.term_months} Months</div>
            </div>
            <div>
              Interest Rate
              <div className="font-bold">{loan.interest_rate}%</div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Collateral Information</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              Vehicle
              <div className="font-bold">{loan.vehicle_info}</div>
            </div>
            <div>
              Appraised Value
              <div className="font-bold">
                PHP {formatCurrency(loan.appraised_value)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Credit Metrics</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded bg-red-50 p-4">
              DTI
              <div className="text-2xl font-bold">{formatPercent(loan.dti)}</div>
            </div>
            <div className="rounded bg-orange-50 p-4">
              DSR
              <div className="text-2xl font-bold">{formatPercent(loan.dsr)}</div>
            </div>
            <div className="rounded bg-blue-50 p-4">
              LTV
              <div className="text-2xl font-bold">{formatPercent(loan.ltv)}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Committee Remarks</h2>
          <div className="rounded border bg-gray-50 p-4">
            {loan.committee_remarks || "No remarks available"}
          </div>
        </div>
      </div>
    </div>
  );
}
