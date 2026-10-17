import {
  fetchAutosaveDraft,
  isAutosaveConflictError,
  saveAutosaveDraftRemote,
} from '../../autosave/draftApi'
import {
  type BudgetHealthScoreResult,
} from './budgetHealthEngine'
import {
  type FinancialHealthSummaryInputs,
  type FinancialHealthSummaryResult,
} from './financialHealthSummaryEngine'
import type { LendingLeafScores } from './lendingLeafScores'
import {
  type NetWorthBuildingScoreResult,
} from './netWorthBuildingEngine'

const PUBLISHED_SUMMARY_SCOPE = 'financial-health-live-summary'

export type PublishedFinancialHealthSummary = {
  summary: FinancialHealthSummaryResult
  computedAt: string
}

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

export async function publishFinancialHealthSummary(
  entityKey: string,
  summary: FinancialHealthSummaryResult,
  computedAt: string,
): Promise<void> {
  const payload: PublishedFinancialHealthSummary = { summary, computedAt }
  const currentDraft = await fetchAutosaveDraft<PublishedFinancialHealthSummary>(
    PUBLISHED_SUMMARY_SCOPE,
    entityKey,
  )
  if (currentDraft && currentDraft.payload.computedAt >= computedAt) return

  try {
    await saveAutosaveDraftRemote(PUBLISHED_SUMMARY_SCOPE, entityKey, {
      payload,
      expectedRevision: currentDraft?.revision ?? null,
    })
  } catch (error) {
    if (!isAutosaveConflictError(error)) throw error
    const conflictingPayload = error.currentDraft?.payload as PublishedFinancialHealthSummary | undefined
    if (conflictingPayload?.computedAt && conflictingPayload.computedAt >= computedAt) return

    await saveAutosaveDraftRemote(PUBLISHED_SUMMARY_SCOPE, entityKey, {
      payload,
      expectedRevision: error.currentDraft?.revision ?? null,
    })
  }
}

export async function loadPublishedFinancialHealthSummary(
  entityKey: string,
): Promise<PublishedFinancialHealthSummary | null> {
  const draft = await fetchAutosaveDraft<PublishedFinancialHealthSummary>(
    PUBLISHED_SUMMARY_SCOPE,
    entityKey,
  )
  return draft?.payload ?? null
}