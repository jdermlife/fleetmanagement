type NumericInput = string | number | undefined

type ScoreBand = {
  minimum: number
  score: number
}

type CeilingScoreBand = {
  maximum: number
  score: number
}

export type NetWorthBuildingDraftInput = {
  amounts?: Record<string, NumericInput>
  savedSetup?: Array<{
    id: string
    setupAmount: number
  }>
  actualEntries?: Record<string, NumericInput>
  selectedFinancialGoal?: string
  targetAmount?: NumericInput
  targetMonths?: NumericInput
}

export type NetWorthBuildingGradeBand = {
  minimum: number
  maximum: number
  rangeScore: string
  grade: string
  rating: string
}

export type NetWorthBuildingScoreResult = {
  score: number
  normalizedScore: number
  grade: string
  rating: string
  rangeScore: string
  band: NetWorthBuildingGradeBand
  metrics: {
    totalAssets: number
    totalLiabilities: number
    netWorth: number
    liquidAssets: number
    monthlyIncome: number
    monthlyExpenses: number
    monthlyCashFlow: number
    savingsRatePercent: number
    debtToIncomeRatioPercent: number
    debtToAssetRatioPercent: number
    emergencyFundMonths: number
    investmentReadinessPercent: number
    retirementCoverageYears: number
    financialIndependencePercent: number
    protectionCoveragePercent: number
    goalProgressPercent: number
    projectedNetWorthAtGoalDate: number
  }
  componentScores: {
    netWorthStrength: number
    liquidityBuffer: number
    cashFlowStrength: number
    leverageControl: number
    emergencyReadiness: number
    investmentReadiness: number
    retirementReadiness: number
    financialIndependence: number
    goalMomentum: number
    protectionCoverage: number
  }
}

const LIQUID_ASSET_IDS = new Set([
  'asset-cash-on-hand',
  'asset-savings-account',
  'asset-checking-account',
  'asset-payroll-account',
  'asset-time-deposit',
  'asset-foreign-currency-account',
  'asset-digital-wallet',
  'asset-emergency-fund',
])

const INVESTMENT_ASSET_IDS = new Set([
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
])

const RETIREMENT_ASSET_IDS = new Set([
  'asset-retirement-fund',
  'asset-pension-benefits',
  'asset-provident-fund',
  'asset-employer-retirement-plan',
])

const PASSIVE_INCOME_IDS = new Set([
  'income-passive',
  'income-dividend',
  'income-interest',
  'income-rental',
  'income-pension',
])

const INSURANCE_IDS = [
  'insurance-life',
  'insurance-health',
  'insurance-hmo',
  'insurance-critical-illness',
  'insurance-accident',
  'insurance-disability',
  'insurance-property',
  'insurance-vehicle',
  'insurance-business',
] as const

export const NET_WORTH_BUILDING_GRADE_BANDS: readonly NetWorthBuildingGradeBand[] = [
  { minimum: 830, maximum: 900, rangeScore: '830-900', grade: 'A+', rating: 'Exceptional Wealth Builder' },
  { minimum: 760, maximum: 829, rangeScore: '760-829', grade: 'A', rating: 'Elite Momentum' },
  { minimum: 690, maximum: 759, rangeScore: '690-759', grade: 'B+', rating: 'Very Strong Builder' },
  { minimum: 620, maximum: 689, rangeScore: '620-689', grade: 'B', rating: 'Strong Progress' },
  { minimum: 550, maximum: 619, rangeScore: '550-619', grade: 'C+', rating: 'Stable Foundation' },
  { minimum: 480, maximum: 549, rangeScore: '480-549', grade: 'C', rating: 'Developing Position' },
  { minimum: 410, maximum: 479, rangeScore: '410-479', grade: 'D+', rating: 'Vulnerable Build' },
  { minimum: 340, maximum: 409, rangeScore: '340-409', grade: 'D', rating: 'Fragile Position' },
  { minimum: 270, maximum: 339, rangeScore: '270-339', grade: 'E', rating: 'High Stress' },
  { minimum: 200, maximum: 269, rangeScore: '200-269', grade: 'F', rating: 'Critical Reset' },
] as const

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function toNumber(value: NumericInput) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}

function hasValue(value: NumericInput) {
  return String(value ?? '').trim().length > 0
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0
  }
  return numerator / denominator
}

function roundMetric(value: number, precision = 2) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function scoreFromFloors(value: number, bands: readonly ScoreBand[], fallback = 0) {
  for (const band of bands) {
    if (value >= band.minimum) {
      return band.score
    }
  }
  return fallback
}

function scoreFromCeilings(value: number, bands: readonly CeilingScoreBand[], fallback = 0) {
  for (const band of bands) {
    if (value <= band.maximum) {
      return band.score
    }
  }
  return fallback
}

function buildBaseAmounts(input: NetWorthBuildingDraftInput) {
  const amounts = Object.entries(input.amounts ?? {}).reduce<Record<string, number>>((accumulator, [id, value]) => {
    accumulator[id] = toNumber(value)
    return accumulator
  }, {})

  for (const row of input.savedSetup ?? []) {
    amounts[row.id] = toNumber(row.setupAmount)
  }

  return amounts
}

function resolveEffectiveAmounts(input: NetWorthBuildingDraftInput) {
  const baseAmounts = buildBaseAmounts(input)
  const effectiveAmounts = { ...baseAmounts }

  for (const [id, value] of Object.entries(input.actualEntries ?? {})) {
    if (!hasValue(value)) {
      continue
    }
    effectiveAmounts[id] = toNumber(value)
  }

  return effectiveAmounts
}

function sumByPredicate(amounts: Record<string, number>, predicate: (id: string) => boolean) {
  return Object.entries(amounts).reduce((total, [id, amount]) => {
    return predicate(id) ? total + amount : total
  }, 0)
}

export function getNetWorthBuildingGradeBand(score: number) {
  const boundedScore = Math.round(clamp(score, 200, 900))

  for (const band of NET_WORTH_BUILDING_GRADE_BANDS) {
    if (boundedScore >= band.minimum) {
      return band
    }
  }

  return NET_WORTH_BUILDING_GRADE_BANDS[NET_WORTH_BUILDING_GRADE_BANDS.length - 1]
}

export function computeNetWorthBuildingScore(
  input: NetWorthBuildingDraftInput,
): NetWorthBuildingScoreResult {
  const effectiveAmounts = resolveEffectiveAmounts(input)
  const totalAssets = sumByPredicate(effectiveAmounts, (id) => id.startsWith('asset-'))
  const totalLiabilities = sumByPredicate(effectiveAmounts, (id) => id.startsWith('liability-'))
  const monthlyIncome = sumByPredicate(effectiveAmounts, (id) => id.startsWith('income-'))
  const monthlyExpenses = sumByPredicate(effectiveAmounts, (id) => id.startsWith('expense-'))
  const liquidAssets = sumByPredicate(effectiveAmounts, (id) => LIQUID_ASSET_IDS.has(id))
  const investmentAssets = sumByPredicate(effectiveAmounts, (id) => INVESTMENT_ASSET_IDS.has(id))
  const retirementAssets = sumByPredicate(effectiveAmounts, (id) => RETIREMENT_ASSET_IDS.has(id))
  const passiveIncome = sumByPredicate(effectiveAmounts, (id) => PASSIVE_INCOME_IDS.has(id))
  const insuranceCoverageCount = INSURANCE_IDS.filter((id) => toNumber(effectiveAmounts[id]) > 0).length

  const netWorth = totalAssets - totalLiabilities
  const monthlyCashFlow = monthlyIncome - monthlyExpenses
  const savingsRate = ratio(Math.max(monthlyCashFlow, 0), monthlyIncome)
  const debtToIncomeRatio = ratio(totalLiabilities, monthlyIncome * 12)
  const debtToAssetRatio = ratio(totalLiabilities, totalAssets)
  const emergencyFundMonths = ratio(liquidAssets, Math.max(monthlyExpenses, 1))
  const investmentReadinessRatio = ratio(investmentAssets + retirementAssets, totalAssets)
  const retirementCoverageYears = ratio(retirementAssets, Math.max(monthlyExpenses * 12, 1))
  const financialIndependenceRatio = ratio(passiveIncome, Math.max(monthlyExpenses, 1))
  const protectionCoverageRatio = ratio(insuranceCoverageCount, INSURANCE_IDS.length)

  const targetAmount = toNumber(input.targetAmount)
  const targetMonths = Math.max(0, Math.floor(toNumber(input.targetMonths)))
  const projectedNetWorthAtGoalDate = netWorth + (Math.max(monthlyCashFlow, 0) * targetMonths)
  const goalProgressRatio = targetAmount > 0
    ? ratio(Math.max(projectedNetWorthAtGoalDate, 0), targetAmount)
    : 0

  const componentScores = {
    netWorthStrength: scoreFromFloors(ratio(netWorth, Math.max(totalAssets, 1)), [
      { minimum: 0.85, score: 100 },
      { minimum: 0.7, score: 92 },
      { minimum: 0.55, score: 84 },
      { minimum: 0.4, score: 76 },
      { minimum: 0.25, score: 68 },
      { minimum: 0.1, score: 58 },
      { minimum: 0, score: 46 },
    ], 20),
    liquidityBuffer: scoreFromFloors(ratio(liquidAssets, Math.max(totalAssets, 1)), [
      { minimum: 0.45, score: 100 },
      { minimum: 0.3, score: 90 },
      { minimum: 0.2, score: 82 },
      { minimum: 0.12, score: 72 },
      { minimum: 0.06, score: 62 },
      { minimum: 0.02, score: 50 },
    ], 25),
    cashFlowStrength: scoreFromFloors(savingsRate, [
      { minimum: 0.35, score: 100 },
      { minimum: 0.25, score: 92 },
      { minimum: 0.18, score: 84 },
      { minimum: 0.1, score: 74 },
      { minimum: 0.05, score: 64 },
      { minimum: 0, score: 52 },
    ], 18),
    leverageControl: scoreFromCeilings(debtToAssetRatio, [
      { maximum: 0.1, score: 100 },
      { maximum: 0.2, score: 92 },
      { maximum: 0.35, score: 84 },
      { maximum: 0.5, score: 74 },
      { maximum: 0.65, score: 64 },
      { maximum: 0.8, score: 52 },
      { maximum: 1, score: 40 },
    ], 20),
    emergencyReadiness: scoreFromFloors(emergencyFundMonths, [
      { minimum: 12, score: 100 },
      { minimum: 9, score: 92 },
      { minimum: 6, score: 84 },
      { minimum: 3, score: 72 },
      { minimum: 1, score: 58 },
      { minimum: 0.5, score: 42 },
    ], 20),
    investmentReadiness: scoreFromFloors(investmentReadinessRatio, [
      { minimum: 0.35, score: 100 },
      { minimum: 0.25, score: 90 },
      { minimum: 0.15, score: 80 },
      { minimum: 0.08, score: 70 },
      { minimum: 0.03, score: 58 },
      { minimum: 0.01, score: 46 },
    ], 20),
    retirementReadiness: scoreFromFloors(retirementCoverageYears, [
      { minimum: 15, score: 100 },
      { minimum: 10, score: 90 },
      { minimum: 6, score: 80 },
      { minimum: 3, score: 70 },
      { minimum: 1, score: 58 },
      { minimum: 0.25, score: 44 },
    ], 20),
    financialIndependence: scoreFromFloors(financialIndependenceRatio, [
      { minimum: 1, score: 100 },
      { minimum: 0.75, score: 90 },
      { minimum: 0.5, score: 78 },
      { minimum: 0.25, score: 64 },
      { minimum: 0.1, score: 50 },
      { minimum: 0.01, score: 36 },
    ], 20),
    goalMomentum: targetAmount > 0 && targetMonths > 0
      ? scoreFromFloors(goalProgressRatio, [
        { minimum: 1.1, score: 100 },
        { minimum: 1, score: 92 },
        { minimum: 0.8, score: 78 },
        { minimum: 0.6, score: 66 },
        { minimum: 0.4, score: 52 },
        { minimum: 0.2, score: 38 },
      ], 20)
      : input.selectedFinancialGoal?.trim()
        ? 55
        : 45,
    protectionCoverage: scoreFromFloors(protectionCoverageRatio, [
      { minimum: 0.9, score: 100 },
      { minimum: 0.7, score: 88 },
      { minimum: 0.5, score: 76 },
      { minimum: 0.3, score: 62 },
      { minimum: 0.1, score: 48 },
    ], 30),
  }

  const weightedIndex = roundMetric(
    (componentScores.netWorthStrength * 0.22)
      + (componentScores.liquidityBuffer * 0.14)
      + (componentScores.cashFlowStrength * 0.14)
      + (componentScores.leverageControl * 0.12)
      + (componentScores.emergencyReadiness * 0.1)
      + (componentScores.investmentReadiness * 0.08)
      + (componentScores.retirementReadiness * 0.07)
      + (componentScores.financialIndependence * 0.05)
      + (componentScores.goalMomentum * 0.05)
      + (componentScores.protectionCoverage * 0.03),
    1,
  )

  const score = Math.round(clamp(200 + (weightedIndex * 7), 200, 900))
  const band = getNetWorthBuildingGradeBand(score)

  return {
    score,
    normalizedScore: weightedIndex,
    grade: band.grade,
    rating: band.rating,
    rangeScore: band.rangeScore,
    band,
    metrics: {
      totalAssets: roundMetric(totalAssets),
      totalLiabilities: roundMetric(totalLiabilities),
      netWorth: roundMetric(netWorth),
      liquidAssets: roundMetric(liquidAssets),
      monthlyIncome: roundMetric(monthlyIncome),
      monthlyExpenses: roundMetric(monthlyExpenses),
      monthlyCashFlow: roundMetric(monthlyCashFlow),
      savingsRatePercent: roundMetric(savingsRate * 100),
      debtToIncomeRatioPercent: roundMetric(debtToIncomeRatio * 100),
      debtToAssetRatioPercent: roundMetric(debtToAssetRatio * 100),
      emergencyFundMonths: roundMetric(emergencyFundMonths),
      investmentReadinessPercent: roundMetric(investmentReadinessRatio * 100),
      retirementCoverageYears: roundMetric(retirementCoverageYears),
      financialIndependencePercent: roundMetric(financialIndependenceRatio * 100),
      protectionCoveragePercent: roundMetric(protectionCoverageRatio * 100),
      goalProgressPercent: roundMetric(goalProgressRatio * 100),
      projectedNetWorthAtGoalDate: roundMetric(projectedNetWorthAtGoalDate),
    },
    componentScores: {
      netWorthStrength: roundMetric(componentScores.netWorthStrength),
      liquidityBuffer: roundMetric(componentScores.liquidityBuffer),
      cashFlowStrength: roundMetric(componentScores.cashFlowStrength),
      leverageControl: roundMetric(componentScores.leverageControl),
      emergencyReadiness: roundMetric(componentScores.emergencyReadiness),
      investmentReadiness: roundMetric(componentScores.investmentReadiness),
      retirementReadiness: roundMetric(componentScores.retirementReadiness),
      financialIndependence: roundMetric(componentScores.financialIndependence),
      goalMomentum: roundMetric(componentScores.goalMomentum),
      protectionCoverage: roundMetric(componentScores.protectionCoverage),
    },
  }
}