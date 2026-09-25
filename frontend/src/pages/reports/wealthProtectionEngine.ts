import {
  computeNetWorthBuildingScore,
  type NetWorthBuildingDraftInput,
} from '../scoring/netWorthBuildingEngine'

export type WealthProtectionBand =
  | 'Strong protection'
  | 'Generally protected'
  | 'Material gaps'
  | 'High vulnerability'

export type WealthProtectionComponentResult = {
  id: string
  label: string
  weight: number
  score: number | null
  weightedPoints: number
  evidence: string
}

export type WealthProtectionScoreResult = {
  score: number
  band: WealthProtectionBand
  assessedWeight: number
  components: WealthProtectionComponentResult[]
}

const INVESTMENT_IDS = [
  'asset-stocks',
  'asset-mutual-funds',
  'asset-uitf',
  'asset-etfs',
  'asset-bonds',
  'asset-treasury-bills',
  'asset-reits',
  'asset-cryptocurrency',
  'asset-gold-precious-metals',
  'asset-other-investments',
] as const

function toAmount(value: string | number | undefined): number {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : 0
}

function effectiveAmounts(input: NetWorthBuildingDraftInput): Record<string, string | number | undefined> {
  const amounts: Record<string, string | number | undefined> = { ...input.amounts }
  for (const row of input.savedSetup ?? []) amounts[row.id] = row.setupAmount
  for (const [id, value] of Object.entries(input.actualEntries ?? {})) {
    if (String(value ?? '').trim()) amounts[id] = value
  }
  return amounts
}

function average(...scores: number[]): number {
  return scores.reduce((total, score) => total + score, 0) / scores.length
}

function portfolioDiversificationScore(amounts: Record<string, string | number | undefined>): number | null {
  const holdings = INVESTMENT_IDS.map((id) => toAmount(amounts[id])).filter((amount) => amount > 0)
  const total = holdings.reduce((sum, amount) => sum + amount, 0)
  if (total <= 0) return null
  if (holdings.length === 1) return 20

  const concentration = holdings.reduce((sum, amount) => sum + ((amount / total) ** 2), 0)
  return Math.round(Math.max(20, Math.min(100, (1 - concentration) * 125)))
}

function evidenceReadinessScore(
  values: Record<string, string>,
  keyPattern: RegExp,
): number | null {
  const matching = Object.entries(values).filter(([key, value]) => keyPattern.test(key) && value.trim() !== '')
  if (matching.length === 0) return null

  const positive = matching.filter(([, value]) => {
    const normalized = value.trim().toLowerCase()
    return !['false', 'no', 'none', '0', 'not available', 'pending'].includes(normalized)
  }).length
  return Math.round((positive / matching.length) * 100)
}

function taxFraudScore(
  amounts: Record<string, string | number | undefined>,
  values: Record<string, string>,
): number | null {
  const checks: number[] = []
  const taxValue = amounts['liability-taxes-payable']
  if (String(taxValue ?? '').trim()) checks.push(toAmount(taxValue) > 0 ? 40 : 100)

  const riskKeys = [
    'previousFraudRecords',
    'fakeNationalId',
    'forgedPayslip',
    'forgedBankStatement',
    'identityTheftIndicator',
    'sanctionsPepMatch',
  ]
  for (const key of riskKeys) {
    const value = values[key]?.trim().toLowerCase()
    if (!value) continue
    checks.push(['true', 'yes', 'match', 'positive'].includes(value) ? 0 : 100)
  }

  return checks.length > 0 ? Math.round(average(...checks)) : null
}

export function getWealthProtectionBand(score: number): WealthProtectionBand {
  if (score >= 80) return 'Strong protection'
  if (score >= 60) return 'Generally protected'
  if (score >= 40) return 'Material gaps'
  return 'High vulnerability'
}

export function computeWealthProtectionScore(
  input: NetWorthBuildingDraftInput | null,
  profileValues: Record<string, string> = {},
): WealthProtectionScoreResult | null {
  if (!input) return null

  const amounts = effectiveAmounts(input)
  const suppliedAmounts = Object.values(amounts).some((value) => String(value ?? '').trim() !== '')
  if (!suppliedAmounts) return null

  const wealth = computeNetWorthBuildingScore(input)
  const { componentScores, metrics } = wealth
  const portfolioScore = portfolioDiversificationScore(amounts)
  const estateScore = evidenceReadinessScore(
    profileValues,
    /estate|beneficiar|lastWill|livingWill|trust|succession/i,
  )
  const fraudScore = taxFraudScore(amounts, profileValues)

  const definitions = [
    {
      id: 'liquidity',
      label: 'Liquidity & emergency reserves',
      weight: 20,
      score: average(componentScores.liquidityBuffer, componentScores.emergencyReadiness),
      evidence: `${metrics.emergencyFundMonths.toFixed(1)} months of expenses in liquid reserves`,
    },
    {
      id: 'insurance',
      label: 'Insurance coverage adequacy',
      weight: 40,
      score: metrics.protectionCoveragePercent > 0 ? componentScores.protectionCoverage : null,
      evidence: metrics.protectionCoveragePercent > 0
        ? `${metrics.protectionCoveragePercent.toFixed(0)}% of insurance categories populated`
        : 'No insurance coverage data provided',
    },
    {
      id: 'debt',
      label: 'Debt and interest-rate exposure',
      weight: 15,
      score: componentScores.leverageControl,
      evidence: `${metrics.debtToAssetRatioPercent.toFixed(1)}% debt-to-asset ratio`,
    },
    {
      id: 'portfolio',
      label: 'Portfolio diversification and concentration risk',
      weight: 11,
      score: portfolioScore,
      evidence: portfolioScore === null
        ? 'No investment allocation data provided'
        : `${INVESTMENT_IDS.filter((id) => toAmount(amounts[id]) > 0).length} funded investment categories`,
    },
    {
      id: 'continuity',
      label: 'Retirement and income continuity',
      weight: 10,
      score: average(
        componentScores.retirementReadiness,
        componentScores.financialIndependence,
        componentScores.cashFlowStrength,
      ),
      evidence: `${metrics.retirementCoverageYears.toFixed(1)} years retirement coverage; ${metrics.financialIndependencePercent.toFixed(0)}% passive-income coverage`,
    },
    {
      id: 'estate',
      label: 'Estate, beneficiary, and legal readiness',
      weight: 2,
      score: estateScore,
      evidence: estateScore === null ? 'No estate or beneficiary readiness data provided' : 'Profile readiness fields provided',
    },
    {
      id: 'tax-fraud',
      label: 'Tax and fraud/security resilience',
      weight: 2,
      score: fraudScore,
      evidence: fraudScore === null ? 'No tax or fraud/security assessment data provided' : 'Tax and fraud/security fields evaluated',
    },
  ] as const

  const components = definitions.map((component): WealthProtectionComponentResult => {
    const score = component.score === null ? null : Math.round(component.score)
    return {
      ...component,
      score,
      weightedPoints: score === null ? 0 : Math.round(score * component.weight) / 100,
    }
  })
  const score = Math.round(components.reduce((total, component) => total + component.weightedPoints, 0))

  return {
    score,
    band: getWealthProtectionBand(score),
    assessedWeight: components.reduce(
      (total, component) => total + (component.score === null ? 0 : component.weight),
      0,
    ),
    components,
  }
}