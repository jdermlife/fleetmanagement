export type AffordableLoanInputs = {
  totalMonthlyIncome: number
  existingMonthlyDebt: number
  requestedMonthlyPayment: number
  annualInterestRate: number
  termMonths: number
  collateralValue: number
  dsrLimitPercent: number
  ltvLimitPercent: number
}

export type LendingScoreTimelineInput = {
  label: string
  score: number | null
}

export const calculateAffordableLoan = ({
  totalMonthlyIncome,
  existingMonthlyDebt,
  requestedMonthlyPayment,
  annualInterestRate,
  termMonths,
  collateralValue,
  dsrLimitPercent,
  ltvLimitPercent,
}: AffordableLoanInputs) => {
  const monthlyPaymentCapacity = Math.max(
    0,
    totalMonthlyIncome * (dsrLimitPercent / 100) - existingMonthlyDebt,
  )
  const months = Math.max(0, Math.round(termMonths))
  const monthlyRate = Math.max(0, annualInterestRate) / 100 / 12
  const maximumByIncome = months === 0
    ? 0
    : monthlyRate === 0
      ? monthlyPaymentCapacity * months
      : monthlyPaymentCapacity * (1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate
  const maximumByCollateral = collateralValue > 0
    ? collateralValue * (ltvLimitPercent / 100)
    : Number.POSITIVE_INFINITY
  const maximumAffordableLoan = Math.max(0, Math.min(maximumByIncome, maximumByCollateral))

  return {
    maximumAffordableLoan,
    monthlyPaymentCapacity,
    recommendedMonthlyPayment: Math.min(Math.max(0, requestedMonthlyPayment), monthlyPaymentCapacity),
    limitingFactor: maximumByCollateral < maximumByIncome ? 'collateral value' : 'income and existing debt',
  }
}

export const buildLendingScoreTimeline = (
  scores: readonly LendingScoreTimelineInput[],
  months = 6,
  targetScore = 800,
) => Array.from({ length: months + 1 }, (_, month) => ({
  month,
  scores: scores.map(({ label, score }) => ({
    label,
    score: score === null
      ? null
      : Math.round(score + (Math.max(score, targetScore) - score) * (month / Math.max(1, months))),
  })),
}))
