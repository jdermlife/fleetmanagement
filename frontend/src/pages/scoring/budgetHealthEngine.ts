type NumericInput = string | number | undefined

export type BudgetHealthLineItem = {
  id: string
  setupAmount: number
  type: 'income' | 'expense'
}

export type BudgetCashFlowMonth = {
  income: NumericInput
  expenses: NumericInput
  budgetVariancePercent?: NumericInput
  budgetCompleted?: boolean
}

export type BudgetHealthAdjustments = {
  billsAlwaysPaidOnTime?: boolean
  incomeSteadilyIncreasing?: boolean
  expensesConsistentlyDecreasing?: boolean
  emergencyFundMonths?: NumericInput
  highLifestyleInflation?: boolean
  frequentBudgetOverruns?: boolean
}

export type BudgetHealthDraftInput = {
  periodStart?: string
  periodEnd?: string
  incomeDraft?: Record<string, NumericInput>
  expenseDraft?: Record<string, NumericInput>
  expenseAllocationDraft?: Record<string, NumericInput>
  savedSetup?: BudgetHealthLineItem[]
  actualEntries?: Record<string, NumericInput>
  cashFlowHistory?: BudgetCashFlowMonth[]
  adjustments?: BudgetHealthAdjustments
}

export type BudgetHealthScoreResult = {
  score: number
  planning: number
  adherence: number
  savingsDiscipline: number
  expenseAllocation: number
  cashFlowStability: number
  aiAdjustment: number
  metrics: {
    variancePercent: number | null
    savingsRatePercent: number | null
    stableMonths: number
    allocationTotalPercent: number
  }
}

function toNumber(value: NumericInput) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function hasValue(value: NumericInput) {
  return String(value ?? '').trim().length > 0
}

function round(value: number, precision = 1) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function scoreAdherence(variancePercent: number | null) {
  if (variancePercent === null) return 0
  if (variancePercent <= 5) return 30
  if (variancePercent <= 10) return 25
  if (variancePercent <= 15) return 20
  if (variancePercent <= 20) return 15
  if (variancePercent <= 30) return 8
  return 0
}

function scoreSavingsRate(savingsRatePercent: number | null) {
  if (savingsRatePercent === null || savingsRatePercent < 5) return 0
  if (savingsRatePercent > 30) return 20
  if (savingsRatePercent >= 20) return 18
  if (savingsRatePercent >= 15) return 15
  if (savingsRatePercent >= 10) return 10
  return 5
}

function scoreStableMonths(stableMonths: number) {
  if (stableMonths >= 12) return 15
  if (stableMonths >= 10) return 13
  if (stableMonths >= 8) return 11
  if (stableMonths >= 6) return 8
  return stableMonths > 0 ? 4 : 0
}

function sumAllocation(allocation: Record<string, NumericInput>, ids: string[]) {
  return ids.reduce((total, id) => total + toNumber(allocation[id]), 0)
}

function scoreExpenseAllocation(allocation: Record<string, NumericInput>) {
  if (!Object.values(allocation).some(hasValue)) return 0

  const checks = [
    sumAllocation(allocation, ['housing', 'rent']) <= 35,
    (() => {
      const value = sumAllocation(allocation, ['food-dining', 'groceries'])
      return value >= 10 && value <= 20
    })(),
    (() => {
      const value = sumAllocation(allocation, ['transport', 'fuel'])
      return value >= 10 && value <= 15
    })(),
    (() => {
      const value = sumAllocation(allocation, ['insurance', 'home-insurance', 'car-insurance'])
      return value >= 5 && value <= 10
    })(),
    sumAllocation(allocation, ['savings-core', 'savings-buffer']) >= 20,
    sumAllocation(allocation, ['entertainment', 'streaming']) <= 10,
  ]

  return round(checks.filter(Boolean).length * 2.5)
}

function countStableMonths(history: BudgetCashFlowMonth[]) {
  let stableMonths = 0
  for (const month of [...history].reverse()) {
    const income = toNumber(month.income)
    const expenses = toNumber(month.expenses)
    const variance = toNumber(month.budgetVariancePercent)
    if (income <= 0 || expenses > income || variance > 10 || month.budgetCompleted === false) break
    stableMonths += 1
  }
  return Math.min(12, stableMonths)
}

export function computeBudgetHealthScore(input: BudgetHealthDraftInput): BudgetHealthScoreResult {
  const incomeDraft = input.incomeDraft ?? {}
  const expenseDraft = input.expenseDraft ?? {}
  const allocation = input.expenseAllocationDraft ?? {}
  const savedSetup = input.savedSetup ?? []
  const actualEntries = input.actualEntries ?? {}

  const plannedIncome = Object.values(incomeDraft).reduce<number>((total, value) => total + toNumber(value), 0)
  const plannedExpenses = Object.values(expenseDraft).reduce<number>((total, value) => total + toNumber(value), 0)
  const allocationTotalPercent = Object.values(allocation).reduce<number>((total, value) => total + toNumber(value), 0)
  const planning = (input.periodStart && input.periodEnd ? 2 : 0)
    + (savedSetup.length > 0 ? 4 : 0)
    + (plannedIncome > 0 ? 4 : 0)
    + (plannedExpenses > 0 ? 4 : 0)
    + (Math.abs(allocationTotalPercent - 100) < 0.01 ? 6 : 0)

  const expenseActualRows = savedSetup.filter((item) => item.type === 'expense' && hasValue(actualEntries[item.id]))
  const comparablePlannedExpenses = expenseActualRows.reduce((total, item) => total + toNumber(item.setupAmount), 0)
  const comparableActualExpenses = expenseActualRows.reduce((total, item) => total + toNumber(actualEntries[item.id]), 0)
  const variancePercent = comparablePlannedExpenses > 0
    ? round((Math.abs(comparableActualExpenses - comparablePlannedExpenses) / comparablePlannedExpenses) * 100, 2)
    : null
  const adherence = scoreAdherence(variancePercent)

  const incomeActualRows = savedSetup.filter((item) => item.type === 'income' && hasValue(actualEntries[item.id]))
  const actualIncome = incomeActualRows.reduce((total, item) => total + toNumber(actualEntries[item.id]), 0)
  const actualExpenses = expenseActualRows.reduce((total, item) => total + toNumber(actualEntries[item.id]), 0)
  const useActualCashFlow = incomeActualRows.length > 0 && expenseActualRows.length > 0
  const effectiveIncome = useActualCashFlow ? actualIncome : plannedIncome
  const effectiveExpenses = useActualCashFlow ? actualExpenses : plannedExpenses
  const savingsRatePercent = effectiveIncome > 0
    ? round(((effectiveIncome - effectiveExpenses) / effectiveIncome) * 100, 2)
    : null
  const savingsDiscipline = scoreSavingsRate(savingsRatePercent)
  const expenseAllocation = scoreExpenseAllocation(allocation)

  const stableMonths = input.cashFlowHistory?.length
    ? countStableMonths(input.cashFlowHistory)
    : useActualCashFlow && effectiveIncome >= effectiveExpenses && (variancePercent ?? Number.POSITIVE_INFINITY) <= 10
      ? 1
      : 0
  const cashFlowStability = scoreStableMonths(stableMonths)

  const adjustments = input.adjustments ?? {}
  const negativeCashFlow = effectiveIncome > 0 && effectiveExpenses > effectiveIncome
  const aiAdjustment = (adjustments.billsAlwaysPaidOnTime ? 2 : 0)
    + (adjustments.incomeSteadilyIncreasing ? 2 : 0)
    + (adjustments.expensesConsistentlyDecreasing ? 2 : 0)
    + (toNumber(adjustments.emergencyFundMonths) >= 6 ? 2 : 0)
    - (adjustments.highLifestyleInflation ? 3 : 0)
    - (adjustments.frequentBudgetOverruns ? 5 : 0)
    - (negativeCashFlow ? 8 : 0)
  const baseScore = planning + adherence + savingsDiscipline + expenseAllocation + cashFlowStability

  return {
    score: round(Math.max(0, Math.min(100, baseScore + aiAdjustment))),
    planning,
    adherence,
    savingsDiscipline,
    expenseAllocation,
    cashFlowStability,
    aiAdjustment,
    metrics: {
      variancePercent,
      savingsRatePercent,
      stableMonths,
      allocationTotalPercent: round(allocationTotalPercent, 2),
    },
  }
}