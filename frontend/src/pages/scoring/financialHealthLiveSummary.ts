import { fetchAutosaveDraft } from '../../autosave/draftApi'
import {
  computeBudgetHealthScore,
  type BudgetHealthDraftInput,
  type BudgetHealthScoreResult,
} from './budgetHealthEngine'
import {
  computeFinancialHealthSummary,
  type FinancialHealthSummaryInputs,
  type FinancialHealthSummaryResult,
} from './financialHealthSummaryEngine'
import { deriveLendingLeafScores, type LendingLeafScores } from './lendingLeafScores'
import {
  computeNetWorthBuildingScore,
  type NetWorthBuildingDraftInput,
  type NetWorthBuildingScoreResult,
} from './netWorthBuildingEngine'

type FinancialHealthLiveScores = {
  netWorthBuildingScore: NetWorthBuildingScoreResult | null
  budgetHealthScore: BudgetHealthScoreResult | null
  lendingLeafScores: LendingLeafScores | null
}

function averageScore(values: Array<number | null | undefined>): number | null {
  const availableValues = values.filter((value): value is number => typeof value === 'number')
  if (availableValues.length === 0) return null
  return availableValues.reduce((total, value) => total + value, 0) / availableValues.length
}

export function buildLiveFinancialHealthInputs({
  netWorthBuildingScore,
  budgetHealthScore,
  lendingLeafScores,
}: FinancialHealthLiveScores): FinancialHealthSummaryInputs {
  const netWorthComponents = netWorthBuildingScore?.componentScores
  const investmentScore = netWorthComponents
    ? averageScore([
        netWorthComponents.investmentReadiness,
        netWorthComponents.retirementReadiness,
        netWorthComponents.financialIndependence,
      ])
    : null

  return {
    credit: lendingLeafScores?.creditScore ?? null,
    'cash-flow': netWorthComponents?.cashFlowStrength ?? null,
    wealth: netWorthBuildingScore?.normalizedScore ?? null,
    budget: budgetHealthScore?.score ?? null,
    payment: netWorthComponents?.leverageControl ?? null,
    protection: netWorthComponents?.protectionCoverage ?? null,
    investment: investmentScore,
    goal: netWorthComponents?.goalMomentum ?? null,
  }
}

export async function loadLiveFinancialHealthSummary(
  analysisEntityKey: string,
  lendingEntityKey: string,
): Promise<FinancialHealthSummaryResult> {
  const [netWorthDraft, budgetDraft, lendingDraft] = await Promise.all([
    fetchAutosaveDraft<NetWorthBuildingDraftInput>('net-worth-positioning', analysisEntityKey),
    fetchAutosaveDraft<BudgetHealthDraftInput>('budget-expense-tracker', analysisEntityKey),
    fetchAutosaveDraft<unknown>('loan-application', lendingEntityKey),
  ])

  const inputs = buildLiveFinancialHealthInputs({
    netWorthBuildingScore: netWorthDraft?.payload
      ? computeNetWorthBuildingScore(netWorthDraft.payload)
      : null,
    budgetHealthScore: budgetDraft?.payload
      ? computeBudgetHealthScore(budgetDraft.payload)
      : null,
    lendingLeafScores: lendingDraft?.payload
      ? deriveLendingLeafScores(lendingDraft.payload)
      : null,
  })

  return computeFinancialHealthSummary(inputs)
}