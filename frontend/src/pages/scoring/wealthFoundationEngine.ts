type NumericInput = string | number | undefined

type ScoreBand = {
  minimum: number
  score: number
}

export type WealthFoundationDraftInput = {
  amounts?: Record<string, NumericInput>
}

export type WealthFoundationBand = {
  minimum: number
  maximum: number
  rangeScore: string
  rating: string
  positioningBand: string
}

export type WealthFoundationScoreResult = {
  rawScore: number
  score: number
  rating: string
  positioningBand: string
  rangeScore: string
  band: WealthFoundationBand
  metrics: {
    emergencyFundMonths: number
    positiveCashflowScore: number
    budgetManagementScore: number
    debtUnderControlScore: number
    insuranceCoverageScore: number
    bankRelationshipScore: number
    financialGoalsScore: number
  }
  componentScores: {
    emergencyFund: number
    positiveCashflow: number
    budgetManagement: number
    debtUnderControl: number
    basicInsurance: number
    bankAccountRelationship: number
    financialGoals: number
  }
}

export type WealthFoundationInsight = {
  reason: string
  recommendations: string[]
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

const FINANCIAL_GOAL_IDS = new Set([
  'goal-emergency-fund',
  'goal-home-purchase',
  'goal-vehicle-purchase',
  'goal-education-fund',
  'goal-business-expansion',
  'goal-debt-reduction',
  'goal-retirement-fund',
  'goal-investment-growth',
  'goal-travel-fund',
  'goal-wealth-accumulation',
  'goal-financial-independence',
])

export const WEALTH_FOUNDATION_BANDS: readonly WealthFoundationBand[] = [
  { minimum: 31, maximum: 35, rangeScore: '31-35', rating: 'Excellent Wealth Foundation', positioningBand: 'Strong Wealth Foundation' },
  { minimum: 26, maximum: 30, rangeScore: '26-30', rating: 'Strong Wealth Foundation', positioningBand: 'Strong Wealth Foundation' },
  { minimum: 21, maximum: 25, rangeScore: '21-25', rating: 'Good Wealth Foundation', positioningBand: 'Moderate Wealth Foundation' },
  { minimum: 16, maximum: 20, rangeScore: '16-20', rating: 'Developing Wealth Foundation', positioningBand: 'Developing Wealth Foundation' },
  { minimum: 0, maximum: 15, rangeScore: 'Below 16', rating: 'Weak Wealth Foundation', positioningBand: 'Weak Wealth Foundation' },
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

function sumByPredicate(amounts: Record<string, number>, predicate: (id: string) => boolean) {
  return Object.entries(amounts).reduce((total, [id, amount]) => {
    return predicate(id) ? total + amount : total
  }, 0)
}

function getBand(rawScore: number) {
  const boundedScore = Math.round(clamp(rawScore, 0, 35))

  for (const band of WEALTH_FOUNDATION_BANDS) {
    if (boundedScore >= band.minimum) {
      return band
    }
  }

  return WEALTH_FOUNDATION_BANDS[WEALTH_FOUNDATION_BANDS.length - 1]
}

function buildRecommendationPool(result: WealthFoundationScoreResult) {
  return [
    {
      score: result.componentScores.emergencyFund,
      recommendation: 'Build liquid reserves so you can hold at least 3 to 6 months of expenses in an emergency fund.',
    },
    {
      score: result.componentScores.positiveCashflow,
      recommendation: 'Increase monthly surplus by trimming expenses or raising recurring income.',
    },
    {
      score: result.componentScores.budgetManagement,
      recommendation: 'Use a written budget and review spending monthly to keep cash flow visible.',
    },
    {
      score: result.componentScores.debtUnderControl,
      recommendation: 'Lower liabilities and keep debt pressure under control relative to assets.',
    },
    {
      score: result.componentScores.basicInsurance,
      recommendation: 'Add life, health, HMO, and related protection so the family base is better covered.',
    },
    {
      score: result.componentScores.bankAccountRelationship,
      recommendation: 'Keep 2 to 3 active banking relationships to strengthen formal financial access.',
    },
    {
      score: result.componentScores.financialGoals,
      recommendation: 'Document SMART wealth goals and review them regularly so the plan stays measurable.',
    },
  ]
}

export function explainWealthFoundationResult(result: WealthFoundationScoreResult): WealthFoundationInsight {
  const weakestComponent = Object.entries(result.componentScores).reduce<{
    key: keyof WealthFoundationScoreResult['componentScores']
    score: number
  } | null>((weakest, [key, score]) => {
    const typedKey = key as keyof WealthFoundationScoreResult['componentScores']
    if (!weakest || score < weakest.score) {
      return { key: typedKey, score }
    }
    return weakest
  }, null)

  const reasonByComponent: Record<keyof WealthFoundationScoreResult['componentScores'], string> = {
    emergencyFund: 'The rating is driven by emergency reserve coverage, which reflects how long the household can absorb shocks.',
    positiveCashflow: 'The rating is driven by monthly cash flow, because recurring surplus is the engine of wealth creation.',
    budgetManagement: 'The rating is driven by budget discipline, because predictable spending supports sustained accumulation.',
    debtUnderControl: 'The rating is driven by debt pressure, because a thinner liability load supports stronger wealth growth.',
    basicInsurance: 'The rating is driven by insurance protection, because the foundation is stronger when major risks are covered.',
    bankAccountRelationship: 'The rating is driven by banking relationships, because active formal accounts improve access and tracking.',
    financialGoals: 'The rating is driven by goal clarity, because documented goals keep wealth-building measurable and consistent.',
  }

  const focusedReason = weakestComponent ? reasonByComponent[weakestComponent.key] : 'The rating reflects a balanced mix of emergency reserves, cash flow, debt control, insurance, banking, and goals.'
  const summaryReason = result.rawScore >= 31
    ? 'The rating is strong because the household already shows solid financial building blocks across the core indicators.'
    : `The rating is ${result.rating.toLowerCase()} because ${focusedReason.toLowerCase()}`

  const recommendations = buildRecommendationPool(result)
    .filter((item) => item.score < 4)
    .sort((left, right) => left.score - right.score)
    .map((item) => item.recommendation)
    .slice(0, 4)

  return {
    reason: summaryReason,
    recommendations: recommendations.length > 0
      ? recommendations
      : ['Maintain the current savings, protection, and goal-setting discipline to keep the foundation strong.'],
  }
}

export function computeWealthFoundationScore(
  input: WealthFoundationDraftInput,
): WealthFoundationScoreResult {
  const amounts = Object.entries(input.amounts ?? {}).reduce<Record<string, number>>((accumulator, [id, value]) => {
    accumulator[id] = toNumber(value)
    return accumulator
  }, {})

  const liquidAssets = sumByPredicate(amounts, (id) => LIQUID_ASSET_IDS.has(id))
  const totalAssets = sumByPredicate(amounts, (id) => id.startsWith('asset-'))
  const totalLiabilities = sumByPredicate(amounts, (id) => id.startsWith('liability-'))
  const monthlyIncome = sumByPredicate(amounts, (id) => id.startsWith('income-'))
  const monthlyExpenses = sumByPredicate(amounts, (id) => id.startsWith('expense-'))
  const insuranceCoverageCount = INSURANCE_IDS.filter((id) => toNumber(amounts[id]) > 0).length
  const bankRelationshipCount = [
    'banking-account-1',
    'banking-account-2',
    'banking-account-3',
  ].filter((id) => toNumber(amounts[id]) > 0).length
  const financialGoalsCount = FINANCIAL_GOAL_IDS.size > 0
    ? Array.from(FINANCIAL_GOAL_IDS).filter((id) => toNumber(amounts[id]) > 0).length
    : 0

  const emergencyFundMonths = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0
  const positiveCashflow = monthlyIncome - monthlyExpenses
  const budgetManagementRatio = monthlyIncome > 0 ? positiveCashflow / monthlyIncome : 0
  const debtUnderControlRatio = totalAssets > 0 ? Math.max(totalAssets - totalLiabilities, 0) / totalAssets : 0
  const insuranceCoverageRatio = insuranceCoverageCount / INSURANCE_IDS.length
  const bankRelationshipRatio = clamp(bankRelationshipCount / 3, 0, 1)
  const financialGoalsRatio = clamp(financialGoalsCount / 5, 0, 1)

  const componentScores = {
    emergencyFund: scoreFromFloors(emergencyFundMonths, [
      { minimum: 12, score: 5 },
      { minimum: 6, score: 4 },
      { minimum: 3, score: 3 },
      { minimum: 1, score: 2 },
      { minimum: 0.1, score: 1 },
    ], 0),
    positiveCashflow: scoreFromFloors(positiveCashflow, [
      { minimum: monthlyIncome * 0.3, score: 5 },
      { minimum: monthlyIncome * 0.2, score: 4 },
      { minimum: monthlyIncome * 0.1, score: 3 },
      { minimum: 0, score: 2 },
      { minimum: -1, score: 1 },
    ], 0),
    budgetManagement: scoreFromFloors(budgetManagementRatio, [
      { minimum: 0.5, score: 5 },
      { minimum: 0.35, score: 4 },
      { minimum: 0.2, score: 3 },
      { minimum: 0.05, score: 2 },
      { minimum: 0, score: 1 },
    ], 0),
    debtUnderControl: scoreFromFloors(debtUnderControlRatio, [
      { minimum: 0.85, score: 5 },
      { minimum: 0.7, score: 4 },
      { minimum: 0.55, score: 3 },
      { minimum: 0.4, score: 2 },
      { minimum: 0.25, score: 1 },
    ], 0),
    basicInsurance: scoreFromFloors(insuranceCoverageRatio, [
      { minimum: 0.85, score: 5 },
      { minimum: 0.65, score: 4 },
      { minimum: 0.45, score: 3 },
      { minimum: 0.2, score: 2 },
      { minimum: 0.05, score: 1 },
    ], 0),
    bankAccountRelationship: scoreFromFloors(bankRelationshipRatio, [
      { minimum: 1, score: 5 },
      { minimum: 0.66, score: 4 },
      { minimum: 0.33, score: 3 },
      { minimum: 0.1, score: 2 },
      { minimum: 0.01, score: 1 },
    ], 0),
    financialGoals: scoreFromFloors(financialGoalsRatio, [
      { minimum: 0.8, score: 5 },
      { minimum: 0.6, score: 4 },
      { minimum: 0.4, score: 3 },
      { minimum: 0.2, score: 2 },
      { minimum: 0.01, score: 1 },
    ], 0),
  }

  const rawScore = roundMetric(
    componentScores.emergencyFund
      + componentScores.positiveCashflow
      + componentScores.budgetManagement
      + componentScores.debtUnderControl
      + componentScores.basicInsurance
      + componentScores.bankAccountRelationship
      + componentScores.financialGoals,
    2,
  )

  const band = getBand(rawScore)
  const score = Math.round((rawScore / 35) * 1000)

  return {
    rawScore,
    score,
    rating: band.rating,
    positioningBand: band.positioningBand,
    rangeScore: band.rangeScore,
    band,
    metrics: {
      emergencyFundMonths: roundMetric(emergencyFundMonths),
      positiveCashflowScore: roundMetric(positiveCashflow),
      budgetManagementScore: roundMetric(budgetManagementRatio * 100),
      debtUnderControlScore: roundMetric(debtUnderControlRatio * 100),
      insuranceCoverageScore: roundMetric(insuranceCoverageRatio * 100),
      bankRelationshipScore: roundMetric(bankRelationshipRatio * 100),
      financialGoalsScore: roundMetric(financialGoalsRatio * 100),
    },
    componentScores,
  }
}