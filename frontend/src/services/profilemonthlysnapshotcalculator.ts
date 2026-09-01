import { api } from '../api'
import {
	computeBillPaymentHealthScore,
	type BillPaymentHealthInput,
} from '../pages/scoring/billPaymentHealthEngine'
import {
	computeBudgetHealthScore,
	type BudgetHealthDraftInput,
} from '../pages/scoring/budgetHealthEngine'
import {
	computeFinancialHealthSummary,
	type FinancialHealthSummaryInputs,
} from '../pages/scoring/financialHealthSummaryEngine'
import {
	computeLoanMonitoringScore,
	type LoanMonitoringScoreInput,
	type LoanMonitoringScoreResult,
} from '../pages/scoring/loanMonitoringScoreEngine'
import {
	computeNetWorthBuildingScore,
	type NetWorthBuildingDraftInput,
} from '../pages/scoring/netWorthBuildingEngine'
import {
	computeWealthCompositeScore,
	type WealthCompositeInput,
} from '../pages/scoring/wealthCompositeEngine'
import {
	computeWealthFoundationScore,
	type WealthFoundationDraftInput,
} from '../pages/scoring/wealthFoundationEngine'
import {
	computeWidBenchmark,
	type WidBenchmarkInput,
} from '../pages/scoring/widBenchmarkEngine'

type JsonObject = Record<string, unknown>

export type MonthlyProfileCalculatorInput = {
	snapshotMonth: string
	profileData: JsonObject
	sourceProfileId?: string
	sourceApplicationNo?: string
	financialHealth: FinancialHealthSummaryInputs
	creditHealth?: { score: number; summary?: JsonObject }
	netWorth: NetWorthBuildingDraftInput
	budget: BudgetHealthDraftInput
	loanMonitoring: LoanMonitoringScoreInput | LoanMonitoringScoreResult
	billPayment: BillPaymentHealthInput
	wealthFoundation?: WealthFoundationDraftInput
	wealthComposite: Pick<WealthCompositeInput, 'wealthBehaviourScore' | 'wealthAuthenticityScore'>
	widBenchmark: WidBenchmarkInput
}

export type MonthlyProfileCalculation = {
	financialHealth: ReturnType<typeof computeFinancialHealthSummary>
	billPayment: ReturnType<typeof computeBillPaymentHealthScore>
	loanMonitoring: ReturnType<typeof computeLoanMonitoringScore>
	netWorth: ReturnType<typeof computeNetWorthBuildingScore>
	wealthFoundation: ReturnType<typeof computeWealthFoundationScore>
	wealthComposite: ReturnType<typeof computeWealthCompositeScore>
	widBenchmark: ReturnType<typeof computeWidBenchmark>
	budget: ReturnType<typeof computeBudgetHealthScore>
}

export type MonthlyProfileSnapshotRecord = {
	id: number
	user_id: number
	snapshot_month: string
	financial_health_score: number | null
	credit_health_score: number | null
	net_worth_positioning_score: number | null
	budget_tracking_score: number | null
	loan_monitoring_score: number | null
	bill_reminder_score: number | null
	created_at: string
	updated_at: string
}

function normalizeSnapshotMonth(value: string): string {
	const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value)
	if (!match) throw new Error('Snapshot month must use YYYY-MM or YYYY-MM-DD format')
	const month = Number(match[2])
	if (month < 1 || month > 12) throw new Error('Snapshot month is invalid')
	return `${match[1]}-${match[2]}-01`
}

export function calculateMonthlyProfile(input: MonthlyProfileCalculatorInput): MonthlyProfileCalculation {
	const netWorth = computeNetWorthBuildingScore(input.netWorth)
	const budget = computeBudgetHealthScore(input.budget)
	const loanMonitoring = 'components' in input.loanMonitoring
		? input.loanMonitoring
		: computeLoanMonitoringScore(input.loanMonitoring)
	const wealthFoundation = computeWealthFoundationScore(input.wealthFoundation ?? input.netWorth)
	const wealthComposite = computeWealthCompositeScore({
		netWorthPositioningScore: netWorth.score,
		wealthFoundationScore: wealthFoundation.score,
		...input.wealthComposite,
	})
	const investmentScore = (
		netWorth.componentScores.investmentReadiness
		+ netWorth.componentScores.retirementReadiness
		+ netWorth.componentScores.financialIndependence
	) / 3
	const financialHealth = computeFinancialHealthSummary({
		...input.financialHealth,
		'cash-flow': netWorth.componentScores.cashFlowStrength,
		wealth: netWorth.normalizedScore,
		budget: budget.score,
		payment: netWorth.componentScores.leverageControl,
		protection: netWorth.componentScores.protectionCoverage,
		investment: investmentScore,
		goal: netWorth.componentScores.goalMomentum,
	})

	return {
		financialHealth,
		billPayment: computeBillPaymentHealthScore(input.billPayment),
		loanMonitoring,
		netWorth,
		wealthFoundation,
		wealthComposite,
		widBenchmark: computeWidBenchmark(input.widBenchmark),
		budget,
	}
}

export async function calculateAndSaveMonthlyProfile(
	input: MonthlyProfileCalculatorInput,
): Promise<{ snapshot: MonthlyProfileSnapshotRecord; calculations: MonthlyProfileCalculation }> {
	const calculations = calculateMonthlyProfile(input)
	const payload = {
		profile_data: input.profileData,
		source_profile_id: input.sourceProfileId,
		source_application_no: input.sourceApplicationNo,
		financial_health_score: calculations.financialHealth.score,
		credit_health_score: input.creditHealth?.score,
		net_worth_positioning_score: calculations.wealthComposite.normalizedScore,
		budget_tracking_score: calculations.budget.score,
		loan_monitoring_score: calculations.loanMonitoring.score,
		bill_reminder_score: calculations.billPayment.score,
		financial_health_summary: calculations.financialHealth,
		credit_health_summary: input.creditHealth?.summary,
		net_worth_summary: {
			netWorthBuilding: calculations.netWorth,
			wealthFoundation: calculations.wealthFoundation,
			wealthComposite: calculations.wealthComposite,
			widBenchmark: calculations.widBenchmark,
		},
		budget_tracking_summary: calculations.budget,
		loan_monitoring_summary: calculations.loanMonitoring,
		bill_reminder_summary: calculations.billPayment,
	}
	const response = await api.put<MonthlyProfileSnapshotRecord>(
		`/api/profile-monthly-snapshots/${normalizeSnapshotMonth(input.snapshotMonth)}`,
		payload,
	)
	return { snapshot: response.data, calculations }
}

