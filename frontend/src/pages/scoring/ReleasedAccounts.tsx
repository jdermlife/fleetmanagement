import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getErrorMessage } from "../../api";
import { fetchLoanApplications, type LoanApplicationRecord } from "../../api/loan";

export default function ReleasedAccounts() {
	const navigate = useNavigate();
	const [accounts, setAccounts] = useState<LoanApplicationRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			setMessage("");
			try {
				const data = await fetchLoanApplications();
				setAccounts(data.filter((item) => item.status === "Released"));
			} catch (error) {
				setMessage(getErrorMessage(error, "Failed to load released accounts."));
			} finally {
				setLoading(false);
			}
		};

		void load();
	}, []);

	return (
		<div className="min-h-screen bg-slate-50 p-6">
			<div className="mx-auto max-w-6xl space-y-4">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-semibold text-slate-800">Released Accounts</h1>
					<button
						onClick={() => navigate("/loan-repository?status=Released")}
						className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
					>
						Open in Repository
					</button>
				</div>

				{message ? <div className="rounded-lg bg-white p-4 text-sm text-slate-700">{message}</div> : null}
				{loading ? <div className="rounded-lg bg-white p-4 text-sm text-slate-600">Loading released accounts...</div> : null}

				{!loading ? (
					<div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-100 text-slate-700">
								<tr>
									<th className="px-4 py-3 text-left">Application</th>
									<th className="px-4 py-3 text-left">Applicant / Borrower</th>
									<th className="px-4 py-3 text-left">Loan Amount</th>
									<th className="px-4 py-3 text-left">Created</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{accounts.length === 0 ? (
									<tr>
										<td colSpan={4} className="px-4 py-6 text-center text-slate-500">
											No released accounts found.
										</td>
									</tr>
								) : (
									accounts.map((account) => (
										<tr
											key={account.application_no}
											className="cursor-pointer hover:bg-slate-50"
											onClick={() => navigate(`/loan-details/${encodeURIComponent(account.application_no)}`)}
										>
											<td className="px-4 py-3 font-mono text-xs text-slate-700">{account.application_no}</td>
											<td className="px-4 py-3 text-slate-800">{account.borrower_name}</td>
											<td className="px-4 py-3 text-slate-700">
												PHP {typeof account.loan_amount === "number" ? account.loan_amount.toLocaleString() : "N/A"}
											</td>
											<td className="px-4 py-3 text-slate-600">
												{account.created_at ? new Date(account.created_at).toLocaleString() : "N/A"}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				) : null}
			</div>
		</div>
	);
}
