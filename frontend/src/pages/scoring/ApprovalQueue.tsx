import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getErrorMessage } from "../../api";
import {
	fetchLoanApplications,
	updateLoanApplicationStatus,
	type LoanApplicationRecord,
	type WorkflowStatus,
} from "../../api/loan";

const reviewStatuses: WorkflowStatus[] = ["Submitted", "Under Review", "Credit Review"];

const nextStatusMap: Partial<Record<WorkflowStatus, WorkflowStatus>> = {
	Submitted: "Under Review",
	"Under Review": "Credit Review",
	"Credit Review": "Approved",
};

export default function ApprovalQueue() {
	const navigate = useNavigate();
	const [queue, setQueue] = useState<LoanApplicationRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");

	const grouped = useMemo(
		() =>
			reviewStatuses.map((status) => ({
				status,
				items: queue.filter((item) => item.status === status),
			})),
		[queue],
	);

	const loadQueue = async () => {
		setLoading(true);
		setMessage("");
		try {
			const applications = await fetchLoanApplications();
			setQueue(applications.filter((item) => reviewStatuses.includes(item.status)));
		} catch (error) {
			setMessage(getErrorMessage(error, "Failed to load approval queue."));
		} finally {
			setLoading(false);
		}
	};

	const advanceStatus = async (applicationNo: string, currentStatus: WorkflowStatus) => {
		const nextStatus = nextStatusMap[currentStatus];
		if (!nextStatus) {
			return;
		}

		try {
			const result = await updateLoanApplicationStatus(applicationNo, nextStatus);
			setMessage(result.message);
			await loadQueue();
		} catch (error) {
			setMessage(getErrorMessage(error, "Failed to update application status."));
		}
	};

	useEffect(() => {
		void loadQueue();
	}, []);

	return (
		<div className="min-h-screen bg-slate-50 p-6">
			<div className="mx-auto max-w-7xl space-y-6">
				<div className="rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div>
							<p className="text-xs uppercase tracking-[0.2em] text-slate-300">Workflow Engine</p>
							<h1 className="text-3xl font-semibold">Approval Queue</h1>
							<p className="mt-1 text-sm text-slate-300">
								Manage applications moving from Submitted to Credit Review and final approval.
							</p>
						</div>
						<button
							onClick={() => navigate("/loan-repository")}
							className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
						>
							Back to Repository
						</button>
					</div>
				</div>

				{message ? (
					<div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
						{message}
					</div>
				) : null}

				{loading ? (
					<div className="rounded-lg bg-white p-6 text-slate-600 shadow">Loading approval queue...</div>
				) : (
					<div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
						{grouped.map((column) => (
							<section key={column.status} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
								<div className="mb-3 flex items-center justify-between">
									<h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">{column.status}</h2>
									<span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
										{column.items.length}
									</span>
								</div>

								<div className="space-y-3">
									{column.items.length === 0 ? (
										<div className="rounded-md bg-slate-50 p-3 text-xs text-slate-500">No applications in this lane.</div>
									) : (
										column.items.map((item) => {
											const nextStatus = nextStatusMap[item.status];
											return (
												<article key={item.application_no} className="rounded-lg border border-slate-200 p-3">
													<div className="text-xs text-slate-500">{item.application_no}</div>
													<div className="text-sm font-semibold text-slate-800">{item.borrower_name}</div>
													<div className="mt-1 text-xs text-slate-600">
														Loan: PHP {typeof item.loan_amount === "number" ? item.loan_amount.toLocaleString() : "N/A"}
													</div>
													<div className="mt-3 flex flex-wrap gap-2">
														<button
															onClick={() =>
																navigate(`/credit-review-workbench?applicationNo=${encodeURIComponent(item.application_no)}`)
															}
															className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
														>
															Open Workbench
														</button>
														{nextStatus ? (
															<button
																onClick={() => void advanceStatus(item.application_no, item.status)}
																className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
															>
																Move to {nextStatus}
															</button>
														) : null}
													</div>
												</article>
											);
										})
									)}
								</div>
							</section>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
