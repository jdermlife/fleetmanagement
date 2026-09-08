export type SavingsGoalInputs = {
  targetSavingsGoal: number
  actualSavings: number
  currentMonthlySavings: number
  targetMonths: number
  annualReturnRate: number
}

export type SavingsGoalStatus = 'Goal reached' | 'On track' | 'Adjustment needed' | 'No contribution set'

export type SavingsGoalResult = {
  savingsGap: number
  progressPercent: number
  monthlyAmountNeeded: number
  monthsRequired: number | null
  projectedSavingsAtTarget: number
  monthlyAdjustment: number
  status: SavingsGoalStatus
  recommendations: string[]
}

const safeNumber = (value: number): number => Number.isFinite(value) ? Math.max(0, value) : 0

function futureValue(currentSavings: number, monthlySavings: number, monthlyRate: number, months: number): number {
  if (months <= 0) return currentSavings
  if (monthlyRate === 0) return currentSavings + monthlySavings * months

  const growthFactor = Math.pow(1 + monthlyRate, months)
  return currentSavings * growthFactor + monthlySavings * ((growthFactor - 1) / monthlyRate)
}

function requiredMonthlySavings(target: number, currentSavings: number, monthlyRate: number, months: number): number {
  if (target <= currentSavings) return 0
  if (months <= 0) return target - currentSavings
  if (monthlyRate === 0) return (target - currentSavings) / months

  const growthFactor = Math.pow(1 + monthlyRate, months)
  const futureCurrentSavings = currentSavings * growthFactor
  if (futureCurrentSavings >= target) return 0
  return (target - futureCurrentSavings) * monthlyRate / (growthFactor - 1)
}

function monthsToGoal(target: number, currentSavings: number, monthlySavings: number, monthlyRate: number): number | null {
  if (target <= currentSavings) return 0
  if (monthlySavings <= 0 && monthlyRate <= 0) return null
  if (monthlyRate === 0) return Math.ceil((target - currentSavings) / monthlySavings)

  if (monthlySavings === 0) {
    if (currentSavings <= 0) return null
    return Math.ceil(Math.log(target / currentSavings) / Math.log(1 + monthlyRate))
  }

  const contributionValue = monthlySavings / monthlyRate
  const growthFactor = (target + contributionValue) / (currentSavings + contributionValue)
  return growthFactor > 1 ? Math.ceil(Math.log(growthFactor) / Math.log(1 + monthlyRate)) : 0
}

export function computeSavingsGoalOptimization(input: SavingsGoalInputs): SavingsGoalResult {
  const targetSavingsGoal = safeNumber(input.targetSavingsGoal)
  const actualSavings = safeNumber(input.actualSavings)
  const currentMonthlySavings = safeNumber(input.currentMonthlySavings)
  const targetMonths = Math.max(1, Math.round(safeNumber(input.targetMonths)))
  const monthlyRate = safeNumber(input.annualReturnRate) / 100 / 12
  const savingsGap = Math.max(0, targetSavingsGoal - actualSavings)
  const progressPercent = targetSavingsGoal > 0
    ? Math.min(100, (actualSavings / targetSavingsGoal) * 100)
    : 0
  const monthlyAmountNeeded = requiredMonthlySavings(targetSavingsGoal, actualSavings, monthlyRate, targetMonths)
  const monthsRequired = monthsToGoal(targetSavingsGoal, actualSavings, currentMonthlySavings, monthlyRate)
  const projectedSavingsAtTarget = futureValue(actualSavings, currentMonthlySavings, monthlyRate, targetMonths)
  const monthlyAdjustment = Math.max(0, monthlyAmountNeeded - currentMonthlySavings)

  const status: SavingsGoalStatus = savingsGap === 0 && targetSavingsGoal > 0
    ? 'Goal reached'
    : currentMonthlySavings <= 0
      ? 'No contribution set'
      : projectedSavingsAtTarget >= targetSavingsGoal
        ? 'On track'
        : 'Adjustment needed'

  const recommendations: string[] = []
  if (targetSavingsGoal <= 0) {
    recommendations.push('Set a target savings goal to calculate a funding plan.')
  } else if (status === 'Goal reached') {
    recommendations.push('The savings goal is fully funded. Redirect future contributions to the next priority goal.')
  } else if (status === 'On track') {
    recommendations.push(`Maintain the current monthly contribution to reach the goal in approximately ${monthsRequired ?? targetMonths} months.`)
  } else if (status === 'No contribution set') {
    recommendations.push(`Start a monthly contribution of at least ${Math.ceil(monthlyAmountNeeded)} to meet the selected deadline.`)
  } else {
    recommendations.push(`Increase monthly savings by at least ${Math.ceil(monthlyAdjustment)} to meet the selected deadline.`)
  }
  if (input.annualReturnRate > 0) {
    recommendations.push('The projection assumes a steady return; review the plan if actual returns or fees differ.')
  }

  return {
    savingsGap,
    progressPercent,
    monthlyAmountNeeded,
    monthsRequired,
    projectedSavingsAtTarget,
    monthlyAdjustment,
    status,
    recommendations,
  }
}
