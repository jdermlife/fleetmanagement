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
	netWorth?: NetWorthBuildingDraftInput
	budget?: BudgetHealthDraftInput
	loanMonitoring?: LoanMonitoringScoreInput | LoanMonitoringScoreResult
	billPayment?: BillPaymentHealthInput
	wealthFoundation?: WealthFoundationDraftInput
	wealthComposite: Pick<WealthCompositeInput, 'wealthBehaviourScore' | 'wealthAuthenticityScore'>
	widBenchmark: WidBenchmarkInput
	availability?: Partial<Record<
		'financialHealth' | 'creditHealth' | 'netWorth' | 'budget' | 'loanMonitoring' | 'billPayment',
		boolean
	>>
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
	financial_health_summary: JsonObject | null
	credit_health_summary: JsonObject | null
	net_worth_summary: JsonObject | null
	budget_tracking_summary: JsonObject | null
	loan_monitoring_summary: JsonObject | null
	bill_reminder_summary: JsonObject | null
	profile_data: JsonObject
	source_profile_id: string | null
	source_loan_application_id: number | null
	created_at: string
	updated_at: string
}

type MonthlyProfileSnapshotListResponse = {
	items: MonthlyProfileSnapshotRecord[]
	total: number
}

export async function fetchMonthlyProfileSnapshots(limit = 120): Promise<MonthlyProfileSnapshotRecord[]> {
	const response = await api.get<MonthlyProfileSnapshotListResponse>(
		'/api/profile-monthly-snapshots',
		{ params: { limit } },
	)
	return response.data.items
}

export async function fetchLatestMonthlyProfileSnapshot(): Promise<MonthlyProfileSnapshotRecord | null> {
	const response = await api.get<MonthlyProfileSnapshotListResponse>(
		'/api/profile-monthly-snapshots',
		{ params: { limit: 1 } },
	)
	return response.data.items[0] ?? null
}

function normalizeSnapshotMonth(value: string): string {
	const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value)
	if (!match) throw new Error('Snapshot month must use YYYY-MM or YYYY-MM-DD format')
	const month = Number(match[2])
	if (month < 1 || month > 12) throw new Error('Snapshot month is invalid')
	return `${match[1]}-${match[2]}-01`
}

export function calculateMonthlyProfile(input: MonthlyProfileCalculatorInput): MonthlyProfileCalculation {
	const netWorthInput = input.netWorth ?? {}
	const budget = computeBudgetHealthScore(input.budget ?? {})
	const netWorthAvailable = input.availability?.netWorth ?? input.netWorth !== undefined
	const loanMonitoringInput = input.loanMonitoring ?? {
		daysPastDue: null,
		beginningBalance: 0,
		currentBalance: 0,
		dsrPercent: null,
		utilizationPercent: null,
		ltvPercent: null,
		activeLoanCount: 0,
		highInterestLoanCount: 0,
		distinctLoanTypeCount: 0,
		distinctLenderCount: 0,
		refinancingImprovesCashFlow: false,
		consolidationOpportunity: false,
	}
	const computedNetWorth = computeNetWorthBuildingScore(netWorthInput)
	const netWorth = netWorthAvailable ? computedNetWorth : {
		...computedNetWorth,
		score: 0,
		normalizedScore: 0,
		componentScores: {
			netWorthStrength: 0,
			liquidityBuffer: 0,
			cashFlowStrength: 0,
			leverageControl: 0,
			emergencyReadiness: 0,
			investmentReadiness: 0,
			retirementReadiness: 0,
			financialIndependence: 0,
			goalMomentum: 0,
			protectionCoverage: 0,
		},
	}
	const loanMonitoring = 'components' in loanMonitoringInput
		? loanMonitoringInput
		: computeLoanMonitoringScore(loanMonitoringInput)
	const wealthFoundation = computeWealthFoundationScore(input.wealthFoundation ?? netWorthInput)
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
		credit: input.financialHealth.credit ?? 0,
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
		billPayment: computeBillPaymentHealthScore(input.billPayment ?? {}),
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
	const availability = {
		financialHealth: input.availability?.financialHealth ?? true,
		creditHealth: input.availability?.creditHealth ?? input.creditHealth !== undefined,
		netWorth: input.availability?.netWorth ?? input.netWorth !== undefined,
		budget: input.availability?.budget ?? input.budget !== undefined,
		loanMonitoring: input.availability?.loanMonitoring ?? input.loanMonitoring !== undefined,
		billPayment: input.availability?.billPayment ?? input.billPayment !== undefined,
	}
	const payload = {
		profile_data: input.profileData,
		source_profile_id: input.sourceProfileId,
		source_application_no: input.sourceApplicationNo,
		financial_health_score: availability.financialHealth ? calculations.financialHealth.score : null,
		credit_health_score: availability.creditHealth ? input.creditHealth?.score ?? null : null,
		net_worth_positioning_score: availability.netWorth ? calculations.wealthComposite.normalizedScore : null,
		budget_tracking_score: availability.budget ? calculations.budget.score : null,
		loan_monitoring_score: availability.loanMonitoring ? calculations.loanMonitoring.score : null,
		bill_reminder_score: availability.billPayment ? calculations.billPayment.score : null,
		financial_health_summary: availability.financialHealth ? calculations.financialHealth : null,
		credit_health_summary: availability.creditHealth ? input.creditHealth?.summary ?? null : null,
		net_worth_summary: availability.netWorth ? {
			netWorthBuilding: calculations.netWorth,
			wealthFoundation: calculations.wealthFoundation,
			wealthComposite: calculations.wealthComposite,
			widBenchmark: calculations.widBenchmark,
		} : null,
		budget_tracking_summary: availability.budget ? calculations.budget : null,
		loan_monitoring_summary: availability.loanMonitoring ? calculations.loanMonitoring : null,
		bill_reminder_summary: availability.billPayment ? calculations.billPayment : null,
	}
	const response = await api.put<MonthlyProfileSnapshotRecord>(
		`/api/profile-monthly-snapshots/${normalizeSnapshotMonth(input.snapshotMonth)}`,
		payload,
	)
	return { snapshot: response.data, calculations }
}

