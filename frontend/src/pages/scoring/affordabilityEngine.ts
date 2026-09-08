export type AffordabilityInputs = {
  netMonthlyIncome: number
  essentialLivingExpenses: number
  existingDebtPayments: number
  minimumSavingsRequirement: number
  existingGoalContributions: number
  principalAmount: number
  annualInterestRate: number
  termMonths: number
  monthlyAmortization: number
  insurancePerYear: number
  maintenancePerMonth: number
  fuelPerMonth: number
  otherExpensesPerMonth: number
  monthlyBenefit: number
  emergencyFundBalance: number
  financialHealthScore: number
  spendingStabilityScore: number
  goalImpactPercent: number
}

export type AffordabilityRecommendation =
  | 'Excellent affordability'
  | 'Affordable'
  | 'Affordable with caution'
  | 'Financially stretched'
  | 'Not recommended'

export type StressScenario = {
  id: 'base' | 'stress' | 'severe'
  label: string
  capacity: number
  capacityPercent: number
  resilienceMonthsAfterDeficit: number | null
  status: 'No impact on resilience' | 'Resilience under pressure' | 'Severe resilience impact'
}

export type AffordabilityResult = {
  calculatedMonthlyAmortization: number
  monthlyAmortizationUsed: number
  totalMonthlyPayment: number
  netMonthlyPayment: number
  availableFinancialCapacity: number
  postPurchaseCapacity: number
  paymentBurdenPercent: number
  emergencyFundMonths: number
  score: number
  recommendation: AffordabilityRecommendation
  hardRules: Array<{ id: string; triggered: boolean; message: string }>
  components: Array<{ id: string; label: string; weight: number; score: number; contribution: number }>
  stressScenarios: StressScenario[]
  aiRecommendations: string[]
}

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value))
const safeNumber = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0

export function calculateMonthlyAmortization(principal: number, annualRate: number, termMonths: number): number {
  const amount = safeNumber(principal)
  const months = Math.max(0, Math.round(termMonths))
  if (amount === 0 || months === 0) return 0
  const monthlyRate = safeNumber(annualRate) / 100 / 12
  if (monthlyRate === 0) return amount / months
  const factor = Math.pow(1 + monthlyRate, months)
  return amount * ((monthlyRate * factor) / (factor - 1))
}

function recommendationForScore(score: number): AffordabilityRecommendation {
  if (score >= 90) return 'Excellent affordability'
  if (score >= 80) return 'Affordable'
  if (score >= 70) return 'Affordable with caution'
  if (score >= 60) return 'Financially stretched'
  return 'Not recommended'
}

function cashFlowScore(postPurchaseCapacity: number, income: number): number {
  if (income <= 0 || postPurchaseCapacity <= 0) return 0
  return clamp((postPurchaseCapacity / income) * 400)
}

function debtCapacityScore(paymentBurdenPercent: number): number {
  if (paymentBurdenPercent <= 30) return 100
  if (paymentBurdenPercent <= 40) return 85
  if (paymentBurdenPercent <= 50) return 65
  if (paymentBurdenPercent <= 60) return 40
  return 10
}

function resilienceScore(emergencyFundMonths: number): number {
  if (emergencyFundMonths >= 6) return 100
  if (emergencyFundMonths >= 3) return 75
  if (emergencyFundMonths >= 1) return 40
  return 10
}

function goalScore(goalImpactPercent: number): number {
  return clamp(100 - safeNumber(goalImpactPercent) * 2)
}

function buildStressScenario(
  id: StressScenario['id'],
  label: string,
  income: number,
  expenses: number,
  debt: number,
  payment: number,
  emergencyFund: number,
): StressScenario {
  const capacity = income - expenses - debt - payment
  const capacityPercent = income > 0 ? (capacity / income) * 100 : -100
  const monthlyDeficit = Math.max(0, -capacity)
  const resilienceMonthsAfterDeficit = monthlyDeficit > 0 ? emergencyFund / monthlyDeficit : null
  const status = capacity > 0
    ? 'No impact on resilience'
    : capacityPercent >= -5
      ? 'Resilience under pressure'
      : 'Severe resilience impact'
  return { id, label, capacity, capacityPercent, resilienceMonthsAfterDeficit, status }
}

export function computeAffordability(input: AffordabilityInputs): AffordabilityResult {
  const values = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, safeNumber(value)])) as AffordabilityInputs
  const calculatedMonthlyAmortization = calculateMonthlyAmortization(values.principalAmount, values.annualInterestRate, values.termMonths)
  const monthlyAmortizationUsed = values.monthlyAmortization > 0 ? values.monthlyAmortization : calculatedMonthlyAmortization
  const totalMonthlyPayment = monthlyAmortizationUsed
    + values.insurancePerYear / 12
    + values.maintenancePerMonth
    + values.fuelPerMonth
    + values.otherExpensesPerMonth
  const netMonthlyPayment = Math.max(0, totalMonthlyPayment - values.monthlyBenefit)
  const availableFinancialCapacity = values.netMonthlyIncome
    - values.essentialLivingExpenses
    - values.existingDebtPayments
    - values.minimumSavingsRequirement
    - values.existingGoalContributions
  const postPurchaseCapacity = availableFinancialCapacity - netMonthlyPayment
  const paymentBurdenPercent = values.netMonthlyIncome > 0
    ? ((netMonthlyPayment + values.existingDebtPayments) / values.netMonthlyIncome) * 100
    : 100
  const emergencyFundMonths = values.essentialLivingExpenses + values.existingDebtPayments > 0
    ? values.emergencyFundBalance / (values.essentialLivingExpenses + values.existingDebtPayments)
    : 0

  const componentDefinitions = [
    { id: 'cashFlow', label: 'Cash-Flow Capacity', weight: 30, score: cashFlowScore(postPurchaseCapacity, values.netMonthlyIncome) },
    { id: 'debt', label: 'Debt Capacity', weight: 20, score: debtCapacityScore(paymentBurdenPercent) },
    { id: 'resilience', label: 'Financial Resilience', weight: 20, score: resilienceScore(emergencyFundMonths) },
    { id: 'goal', label: 'Goal Impact', weight: 15, score: goalScore(values.goalImpactPercent) },
    { id: 'health', label: 'Financial Health', weight: 10, score: clamp(values.financialHealthScore) },
    { id: 'stability', label: 'Spending Stability', weight: 5, score: clamp(values.spendingStabilityScore) },
  ]
  const components = componentDefinitions.map((component) => ({
    ...component,
    contribution: component.score * component.weight / 100,
  }))
  const weightedScore = Math.round(components.reduce((sum, component) => sum + component.contribution, 0))

  const persistentNegativeCashFlow = availableFinancialCapacity < 0
  const emergencyFundCriticallyInadequate = emergencyFundMonths < 1
  const excessiveDebtBurden = paymentBurdenPercent > 50
  const majorGoalFailure = values.goalImpactPercent >= 40
  const hardRules = [
    { id: 'negativeCashFlow', triggered: persistentNegativeCashFlow, message: 'Persistent negative cash flow makes the purchase not recommended.' },
    { id: 'emergencyFund', triggered: emergencyFundCriticallyInadequate, message: 'Emergency reserves cover less than one month of essential obligations.' },
    { id: 'debtBurden', triggered: excessiveDebtBurden, message: 'Total debt and purchase payments exceed 50% of net monthly income.' },
    { id: 'goalFailure', triggered: majorGoalFailure, message: 'The purchase would delay or materially reduce a major financial goal.' },
  ]

  let score = weightedScore
  if (persistentNegativeCashFlow) score = Math.min(score, 59)
  else if (emergencyFundCriticallyInadequate || excessiveDebtBurden) score = Math.min(score, 69)
  else if (majorGoalFailure) score = Math.min(score, 79)

  const stressRatePayment = calculateMonthlyAmortization(values.principalAmount, values.annualInterestRate + 2, values.termMonths)
  const severeRatePayment = calculateMonthlyAmortization(values.principalAmount, values.annualInterestRate + 4, values.termMonths)
  const nonLoanCosts = totalMonthlyPayment - monthlyAmortizationUsed
  const stressScenarios = [
    buildStressScenario('base', 'Base capacity', values.netMonthlyIncome, values.essentialLivingExpenses, values.existingDebtPayments, netMonthlyPayment, values.emergencyFundBalance),
    buildStressScenario('stress', 'Stress: income -10%, expenses +10%, rate +2%', values.netMonthlyIncome * 0.9, values.essentialLivingExpenses * 1.1, values.existingDebtPayments, Math.max(0, stressRatePayment + nonLoanCosts - values.monthlyBenefit), values.emergencyFundBalance),
    buildStressScenario('severe', 'Severe: income -20%, expenses +15%, rate +4%', values.netMonthlyIncome * 0.8, values.essentialLivingExpenses * 1.15, values.existingDebtPayments, Math.max(0, severeRatePayment + nonLoanCosts - values.monthlyBenefit), values.emergencyFundBalance),
  ]

  const aiRecommendations: string[] = []
  if (persistentNegativeCashFlow) aiRecommendations.push('Do not add this commitment until monthly cash flow is consistently positive.')
  if (emergencyFundCriticallyInadequate) aiRecommendations.push('Build at least three months of essential expenses and debt payments before proceeding.')
  if (excessiveDebtBurden) aiRecommendations.push('Reduce the principal, extend the term cautiously, or pay down existing debt to bring payment burden below 40%.')
  if (majorGoalFailure) aiRecommendations.push('Lower the purchase cost or monthly payment so existing goals remain funded.')
  if (netMonthlyPayment > availableFinancialCapacity && !persistentNegativeCashFlow) aiRecommendations.push('The new payment exceeds currently available capacity; increase the down payment or defer the purchase.')
  if (aiRecommendations.length === 0) aiRecommendations.push('The purchase fits current capacity. Preserve the emergency fund and review affordability again if income, rates, or expenses change.')

  return {
    calculatedMonthlyAmortization,
    monthlyAmortizationUsed,
    totalMonthlyPayment,
    netMonthlyPayment,
    availableFinancialCapacity,
    postPurchaseCapacity,
    paymentBurdenPercent,
    emergencyFundMonths,
    score,
    recommendation: recommendationForScore(score),
    hardRules,
    components,
    stressScenarios,
    aiRecommendations,
  }
}
