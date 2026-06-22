import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getErrorMessage } from "../../api";
import {
	fetchLoanApplication,
	fetchLoanApplications,
	updateLoanApplicationStatus,
	type LoanApplicationRecord,
} from "../../api/loan";

function valueOrNA(value: number | string | null | undefined) {
	if (value === null || value === undefined || value === "") {
		return "N/A";
	}
	return typeof value === "number" ? value.toFixed(2) : value;
}

export default function CreditReviewWorkbench() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const selectedApplicationNo = searchParams.get("applicationNo") || "";

	const [applications, setApplications] = useState<LoanApplicationRecord[]>([]);
	const [loan, setLoan] = useState<LoanApplicationRecord | null>(null);
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");

	const summary = useMemo(
		() => [
			{ label: "A-Credit", value: loan?.credit_scores?.credit_grade ?? loan?.overall_scores?.final_grade },
			{ label: "Fraud Score", value: loan?.fraud_scores?.overall_fraud_score },
			{ label: "Social Score", value: loan?.social_scores?.overall_social_score },
			{ label: "Bureau Score", value: loan?.credit_bureau_reports?.bureau_score },
			{ label: "Psychometric", value: loan?.psychometric_scores?.overall_psychometric_score },
			{ label: "AI Confidence", value: loan?.ai_recommendations?.confidence_score },
		],
		[loan],
	);

	const loadData = async (applicationNo?: string) => {
		setLoading(true);
		setMessage("");
		try {
			const list = await fetchLoanApplications();
			setApplications(list);

			const targetNo = applicationNo || selectedApplicationNo || list[0]?.application_no;
			if (targetNo) {
				const record = await fetchLoanApplication(targetNo);
				setLoan(record);
			}
		} catch (error) {
			setMessage(getErrorMessage(error, "Failed to load credit review workbench."));
		} finally {
			setLoading(false);
		}
	};

	const updateStatus = async (status: "Approved" | "Rejected") => {
		if (!loan) {
			return;
		}
		try {
			const result = await updateLoanApplicationStatus(loan.application_no, status);
			setMessage(result.message);
			await loadData(loan.application_no);
		} catch (error) {
			setMessage(getErrorMessage(error, `Failed to mark as ${status}.`));
		}
	};

	useEffect(() => {
		void loadData();
	}, [selectedApplicationNo]);

	return (
		<div className="min-h-screen bg-slate-50 p-6">
			<div className="mx-auto max-w-7xl space-y-5">
				<div className="rounded-2xl bg-white p-6 shadow-sm">
					<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
						<div>
							<p className="text-xs uppercase tracking-[0.2em] text-slate-500">QuantScores</p>
							<h1 className="text-2xl font-semibold text-slate-900">Credit Review Workbench</h1>
							<p className="text-sm text-slate-600">
								Central review for Credit, Fraud, Social, Bureau, Psychometric, and AI recommendation.
							</p>
						</div>
						<div className="flex gap-2">
							<button
								onClick={() => navigate("/approval-queue")}
								className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
							>
								Back to Queue
							</button>
							{loan ? (
								<button
									onClick={() => navigate(`/loan-details/${encodeURIComponent(loan.application_no)}`)}
									className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
								>
									Open Full Details
								</button>
							) : null}
						</div>
					</div>

					<div className="mt-4">
						<label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
							Select Application
						</label>
						<select
							value={loan?.application_no || ""}
							onChange={(event) => void loadData(event.target.value)}
							className="mt-1 block w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
						>
							{applications.map((item) => (
								<option key={item.application_no} value={item.application_no}>
									{item.application_no} - {item.borrower_name}
								</option>
							))}
						</select>
					</div>
				</div>

				{message ? <div className="rounded-lg bg-white p-4 text-sm text-slate-700">{message}</div> : null}
				{loading ? <div className="rounded-lg bg-white p-5 text-sm text-slate-600">Loading workbench...</div> : null}

				{loan && !loading ? (
					<>
						<div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
							{summary.map((item) => (
								<div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
									<div className="text-[11px] uppercase tracking-wider text-slate-500">{item.label}</div>
									<div className="mt-1 text-lg font-semibold text-slate-800">{valueOrNA(item.value)}</div>
								</div>
							))}
						</div>

						<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
							<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
								<h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">Risk Components</h2>
								<div className="mt-3 space-y-2 text-sm">
									<div>Credit Total: <strong>{valueOrNA(loan.credit_scores?.total_credit_score)}</strong></div>
									<div>Fraud Risk Level: <strong>{valueOrNA(loan.fraud_scores?.fraud_risk_level)}</strong></div>
									<div>Social Total: <strong>{valueOrNA(loan.social_scores?.overall_social_score)}</strong></div>
									<div>Psychometric Total: <strong>{valueOrNA(loan.psychometric_scores?.overall_psychometric_score)}</strong></div>
									<div>Bureau Source: <strong>{valueOrNA(loan.credit_bureau_reports?.bureau_name)}</strong></div>
								</div>
							</section>

							<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
								<h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">AI Recommendation</h2>
								<div className="mt-3 space-y-2 text-sm">
									<div>Recommendation: <strong>{valueOrNA(loan.ai_recommendations?.recommendation)}</strong></div>
									<div>Confidence: <strong>{valueOrNA(loan.ai_recommendations?.confidence_score)}</strong></div>
									<div>Suggested Amount: <strong>{valueOrNA(loan.ai_recommendations?.suggested_amount)}</strong></div>
									<div className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
										{loan.ai_recommendations?.explanation || "No explanation provided."}
									</div>
								</div>
							</section>
						</div>

						<div className="flex flex-wrap gap-2">
							<button
								onClick={() => void updateStatus("Approved")}
								className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
							>
								Approve
							</button>
							<button
								onClick={() => void updateStatus("Rejected")}
								className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
							>
								Reject
							</button>
						</div>
					</>
				) : null}
			</div>
		</div>
	);
}
