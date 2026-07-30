type NumericInput = string | number | undefined

export type BillPaymentHealthPayment = {
  datePaid?: string
  amountPaid?: NumericInput
}

export type BillPaymentHealthBiller = {
  id: string
  estimatedDueDay?: NumericInput
  dateCovered?: string
  budgetedAmount: NumericInput
  frequency?: string
  emailReminder10DaysBefore?: boolean
  payments?: BillPaymentHealthPayment[]
}

export type BillPaymentHealthInput = {
  billers?: BillPaymentHealthBiller[]
  monthlyIncome?: NumericInput
  referenceDate?: string
}

export type BillPaymentHealthScoreResult = {
  score: number
  grade: string
  interpretation: string
  components: {
    paymentTimeliness: number
    paymentCompletion: number
    budgetAdherence: number
    billAffordability: number
    reminderDiscipline: number
    paymentConsistency: number
    aiFinancialBehavior: number
  }
  metrics: {
    averageCompletionPercent: number | null
    averageVariancePercent: number | null
    monthlyBills: number
    affordabilityRatioPercent: number | null
    reminderEnabledPercent: number | null
    latePaymentCount: number
    scoredPaymentCount: number
  }
  strengths: string[]
  opportunities: string[]
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value))
}

function round(value: number, precision = 1) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function toNumber(value: NumericInput) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function parseDate(value: string | undefined) {
  if (!value) return null
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function resolveDueDate(biller: BillPaymentHealthBiller) {
  const coveredDate = parseDate(biller.dateCovered)
  const dueDay = Math.trunc(toNumber(biller.estimatedDueDay))
  if (!coveredDate || dueDay < 1 || dueDay > 31) return coveredDate

  const lastDay = new Date(coveredDate.getFullYear(), coveredDate.getMonth() + 1, 0).getDate()
  return new Date(coveredDate.getFullYear(), coveredDate.getMonth(), Math.min(dueDay, lastDay))
}

function differenceInDays(date: Date, comparison: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24
  return Math.round((date.getTime() - comparison.getTime()) / millisecondsPerDay)
}

function scorePaymentTiming(daysLate: number) {
  if (daysLate < 0) return 25
  if (daysLate === 0) return 24
  if (daysLate <= 3) return 20
  if (daysLate <= 7) return 15
  if (daysLate <= 15) return 8
  return 0
}

function scoreCompletion(completionPercent: number) {
  if (completionPercent >= 100) return 20
  if (completionPercent >= 90) return 18
  if (completionPercent >= 80) return 15
  if (completionPercent >= 70) return 10
  return 0
}

function scoreBudgetVariance(variancePercent: number) {
  if (variancePercent <= 5) return 15
  if (variancePercent <= 10) return 13
  if (variancePercent <= 15) return 10
  if (variancePercent <= 20) return 7
  return 0
}

function scoreAffordability(ratioPercent: number | null) {
  if (ratioPercent === null) return 0
  if (ratioPercent < 30) return 15
  if (ratioPercent <= 40) return 13
  if (ratioPercent <= 50) return 10
  if (ratioPercent <= 60) return 6
  return 0
}

function scoreConsistency(latePaymentCount: number, scoredPaymentCount: number) {
  if (scoredPaymentCount === 0) return 0
  if (latePaymentCount === 0) return 10
  if (latePaymentCount === 1) return 8
  if (latePaymentCount === 2) return 6
  if (latePaymentCount === 3) return 3
  return 0
}

function monthlyEquivalent(amount: number, frequency: string | undefined) {
  if (frequency === 'Weekly') return amount * 52 / 12
  if (frequency === 'Quarterly') return amount / 3
  if (frequency === 'Semi-Annual') return amount / 6
  if (frequency === 'Annual') return amount / 12
  return amount
}

function gradeFor(score: number) {
  if (score >= 95) return { grade: 'A+', interpretation: 'Outstanding Bill Management' }
  if (score >= 90) return { grade: 'A', interpretation: 'Excellent' }
  if (score >= 85) return { grade: 'B+', interpretation: 'Very Good' }
  if (score >= 80) return { grade: 'B', interpretation: 'Good' }
  if (score >= 75) return { grade: 'C+', interpretation: 'Acceptable' }
  if (score >= 70) return { grade: 'C', interpretation: 'Needs Improvement' }
  if (score >= 60) return { grade: 'D', interpretation: 'High Risk' }
  return { grade: 'E', interpretation: 'Critical' }
}

export function computeBillPaymentHealthScore(input: BillPaymentHealthInput): BillPaymentHealthScoreResult {
  const billers = input.billers ?? []
  const referenceDate = parseDate(input.referenceDate) ?? new Date()
  const twelveMonthsAgo = new Date(referenceDate)
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

  const billResults = billers.map((biller) => {
    const budget = toNumber(biller.budgetedAmount)
    const dueDate = resolveDueDate(biller)
    const payments = (biller.payments ?? [])
      .map((payment) => ({ date: parseDate(payment.datePaid), amount: toNumber(payment.amountPaid) }))
      .filter((payment): payment is { date: Date; amount: number } => payment.date !== null && payment.amount > 0)
      .sort((left, right) => left.date.getTime() - right.date.getTime())
    const actual = payments.reduce((total, payment) => total + payment.amount, 0)
    const completionPercent = budget > 0 ? (actual / budget) * 100 : 0
    const variancePercent = budget > 0 && payments.length > 0
      ? (Math.abs(actual - budget) / budget) * 100
      : null

    let cumulativePaid = 0
    let effectivePaymentDate: Date | null = null
    for (const payment of payments) {
      cumulativePaid += payment.amount
      effectivePaymentDate = payment.date
      if (budget > 0 && cumulativePaid >= budget) break
    }
    const daysLate = dueDate && effectivePaymentDate
      ? differenceInDays(effectivePaymentDate, dueDate)
      : null

    return {
      budget,
      actual,
      completionPercent,
      variancePercent,
      daysLate,
      paymentDate: effectivePaymentDate,
      reminderEnabled: Boolean(biller.emailReminder10DaysBefore),
      monthlyAmount: monthlyEquivalent(budget, biller.frequency),
    }
  })

  const billerCount = billResults.length
  const average = (values: number[]) => values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0
  const paymentTimeliness = round(average(billResults.map((result) => (
    result.daysLate === null ? 0 : scorePaymentTiming(result.daysLate)
  ))))
  const paymentCompletion = round(average(billResults.map((result) => scoreCompletion(result.completionPercent))))
  const budgetAdherence = round(average(billResults.map((result) => (
    result.variancePercent === null ? 0 : scoreBudgetVariance(result.variancePercent)
  ))))

  const monthlyBills = billResults.reduce((total, result) => total + result.monthlyAmount, 0)
  const monthlyIncome = toNumber(input.monthlyIncome)
  const affordabilityRatioPercent = monthlyIncome > 0 ? (monthlyBills / monthlyIncome) * 100 : null
  const billAffordability = scoreAffordability(affordabilityRatioPercent)

  const reminderEnabledCount = billResults.filter((result) => result.reminderEnabled).length
  const reminderEnabledPercent = billerCount > 0 ? (reminderEnabledCount / billerCount) * 100 : null
  const reminderDiscipline = reminderEnabledPercent === 100
    ? 10
    : (reminderEnabledPercent ?? 0) >= 75
      ? 8
      : (reminderEnabledPercent ?? 0) > 0 ? 5 : 0

  const historyResults = billResults.filter((result) => (
    result.paymentDate && result.paymentDate >= twelveMonthsAgo && result.paymentDate <= referenceDate
  ))
  const latePaymentCount = historyResults.filter((result) => (result.daysLate ?? 0) > 0).length
  const paymentConsistency = scoreConsistency(latePaymentCount, historyResults.length)

  const averageCompletionPercent = billerCount > 0
    ? average(billResults.map((result) => Math.min(100, result.completionPercent)))
    : null
  const varianceResults = billResults.filter((result) => result.variancePercent !== null)
  const averageVariancePercent = varianceResults.length > 0
    ? average(varianceResults.map((result) => result.variancePercent ?? 0))
    : null
  const onTimeRate = historyResults.length > 0
    ? (historyResults.filter((result) => (result.daysLate ?? 1) <= 0).length / historyResults.length) * 100
    : 0
  const severelyLateOrUnpaid = billResults.some((result) => (
    (result.daysLate !== null && result.daysLate > 15)
    || (result.daysLate === null && resolveDueDate(billers[billResults.indexOf(result)])?.getTime() < referenceDate.getTime())
  ))
  const aiFinancialBehavior = clamp(
    (onTimeRate >= 90 ? 2 : 0)
      + ((averageCompletionPercent ?? 0) >= 100 ? 1 : 0)
      + (averageVariancePercent !== null && averageVariancePercent <= 5 ? 1 : 0)
      + (reminderEnabledPercent === 100 ? 1 : 0)
      - (severelyLateOrUnpaid ? 2 : 0)
      - (averageCompletionPercent !== null && averageCompletionPercent < 90 ? 1 : 0)
      - (averageVariancePercent !== null && averageVariancePercent > 20 ? 1 : 0)
      - (billerCount > 0 && reminderEnabledCount === 0 ? 1 : 0),
    -5,
    5,
  )

  const baseScore = paymentTimeliness + paymentCompletion + budgetAdherence
    + billAffordability + reminderDiscipline + paymentConsistency
  const score = round(clamp(baseScore + aiFinancialBehavior))
  const grade = gradeFor(score)
  const strengths: string[] = []
  const opportunities: string[] = []

  if (paymentTimeliness >= 20) strengths.push('Bills are generally paid before or close to their due dates.')
  else opportunities.push('Schedule payments earlier to reduce late-payment exposure.')
  if (paymentCompletion >= 18) strengths.push('Payment completion is strong across recorded bills.')
  else opportunities.push('Complete partial or unpaid bills to improve settlement discipline.')
  if (budgetAdherence >= 13) strengths.push('Actual bill payments remain close to the planned budget.')
  else opportunities.push('Review bills with more than 10% variance and update their allocations or usage plans.')
  if (billAffordability >= 13) strengths.push('Recurring bills are affordable relative to recorded monthly income.')
  else if (affordabilityRatioPercent === null) opportunities.push('Add monthly income to measure bill affordability.')
  else opportunities.push('Reduce or renegotiate recurring bills to improve affordability.')
  if (reminderDiscipline >= 8) strengths.push('Reminder coverage supports organized bill management.')
  else opportunities.push('Enable reminders for most or all recurring bills.')
  if (paymentConsistency >= 8) strengths.push('Available payment history shows consistent timing.')
  else opportunities.push('Build a 12-month record with no more than one late payment.')

  return {
    score,
    ...grade,
    components: {
      paymentTimeliness,
      paymentCompletion,
      budgetAdherence,
      billAffordability,
      reminderDiscipline,
      paymentConsistency,
      aiFinancialBehavior,
    },
    metrics: {
      averageCompletionPercent: averageCompletionPercent === null ? null : round(averageCompletionPercent, 2),
      averageVariancePercent: averageVariancePercent === null ? null : round(averageVariancePercent, 2),
      monthlyBills: round(monthlyBills, 2),
      affordabilityRatioPercent: affordabilityRatioPercent === null ? null : round(affordabilityRatioPercent, 2),
      reminderEnabledPercent: reminderEnabledPercent === null ? null : round(reminderEnabledPercent, 2),
      latePaymentCount,
      scoredPaymentCount: historyResults.length,
    },
    strengths,
    opportunities,
  }
}