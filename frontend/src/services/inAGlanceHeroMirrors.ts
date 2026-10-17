import { useEffect } from 'react'

import {
  fetchAutosaveDraft,
  isAutosaveConflictError,
  saveAutosaveDraftRemote,
} from '../autosave/draftApi'
import type { CreditHealthGraphScores } from '../pages/scoring/CreditHealthScoreGraph'

const CREDIT_HEALTH_SCOPE = 'credit-health-hero-mirror'
const WEALTH_BUILDING_SCOPE = 'wealth-building-hero-mirror'
const BUDGET_UTILIZATION_SCOPE = 'budget-utilization-hero-mirror'

export type WealthBuildingHeroMirror = {
  netWorthPositioning: number
  wealthBehaviour: number
  wealthFoundation: number
  wealthAuthenticity: number
}

export type BudgetUtilizationHeroMirror = {
  budgetAmount: number
  utilizedAmount: number
  utilizationPercent: number
  progressPercent: number
  overflowPercent: number
  remainingAmount: number
  overBudgetAmount: number
  sourceLabel: string
}

export type InAGlanceHeroMirrors = {
  creditHealth: CreditHealthGraphScores | null
  wealthBuilding: WealthBuildingHeroMirror | null
  budgetUtilization: BudgetUtilizationHeroMirror | null
}

type HeroMirrorScope =
  | typeof CREDIT_HEALTH_SCOPE
  | typeof WEALTH_BUILDING_SCOPE
  | typeof BUDGET_UTILIZATION_SCOPE

type PublishedHeroMirror<T> = {
  value: T
  computedAt: string
}

async function publishHeroMirror<T>(scope: HeroMirrorScope, entityKey: string, value: T): Promise<void> {
  const payload: PublishedHeroMirror<T> = {
    value,
    computedAt: new Date().toISOString(),
  }
  const currentDraft = await fetchAutosaveDraft<PublishedHeroMirror<T>>(scope, entityKey)

  try {
    await saveAutosaveDraftRemote(scope, entityKey, {
      payload,
      expectedRevision: currentDraft?.revision ?? null,
    })
  } catch (error) {
    if (!isAutosaveConflictError(error)) throw error

    await saveAutosaveDraftRemote(scope, entityKey, {
      payload,
      expectedRevision: error.currentDraft?.revision ?? null,
    })
  }
}

async function loadHeroMirror<T>(scope: HeroMirrorScope, entityKey: string): Promise<T | null> {
  const draft = await fetchAutosaveDraft<PublishedHeroMirror<T>>(scope, entityKey)
  return draft?.payload.value ?? null
}

export function usePublishCreditHealthHero(
  entityKey: string,
  value: CreditHealthGraphScores,
  enabled: boolean,
): void {
  usePublishHeroMirror(CREDIT_HEALTH_SCOPE, entityKey, value, enabled)
}

export function usePublishWealthBuildingHero(
  entityKey: string,
  value: WealthBuildingHeroMirror,
  enabled: boolean,
): void {
  usePublishHeroMirror(WEALTH_BUILDING_SCOPE, entityKey, value, enabled)
}

export function usePublishBudgetUtilizationHero(
  entityKey: string,
  value: BudgetUtilizationHeroMirror,
  enabled: boolean,
): void {
  usePublishHeroMirror(BUDGET_UTILIZATION_SCOPE, entityKey, value, enabled)
}

function usePublishHeroMirror<T>(
  scope: HeroMirrorScope,
  entityKey: string,
  value: T,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return

    const timeoutId = window.setTimeout(() => {
      void publishHeroMirror(scope, entityKey, value).catch(() => undefined)
    }, 700)

    return () => window.clearTimeout(timeoutId)
  }, [enabled, entityKey, scope, value])
}

export async function loadInAGlanceHeroMirrors(entityKey: string): Promise<InAGlanceHeroMirrors> {
  const [creditHealth, wealthBuilding, budgetUtilization] = await Promise.all([
    loadHeroMirror<CreditHealthGraphScores>(CREDIT_HEALTH_SCOPE, entityKey),
    loadHeroMirror<WealthBuildingHeroMirror>(WEALTH_BUILDING_SCOPE, entityKey),
    loadHeroMirror<BudgetUtilizationHeroMirror>(BUDGET_UTILIZATION_SCOPE, entityKey),
  ])

  return { creditHealth, wealthBuilding, budgetUtilization }
}
