export type LoanMonitoringScoreInput = {
  daysPastDue: number | null
  beginningBalance: number
  currentBalance: number
  dsrPercent: number | null
  utilizationPercent: number | null
  ltvPercent: number | null
  activeLoanCount: number
  highInterestLoanCount: number
  distinctLoanTypeCount: number
  distinctLenderCount: number
  refinancingImprovesCashFlow: boolean
  consolidationOpportunity: boolean
  regularExtraPayments?: boolean
  principalPrepayment?: boolean
  decliningPaymentBehavior?: boolean
  increasingPastDues?: boolean
  savingsBehaviorScore?: number | null
  budgetAdherenceScore?: number | null
}

export type LoanMonitoringScoreResult = {
  score: number
  grade: string
  interpretation: string
  components: {
    paymentPerformance: number
    balanceManagement: number
    debtServiceCapacity: number
    loanUtilization: number
    collateralQuality: number
    portfolioHealth: number
    aiAdjustment: number
  }
  metrics: {
    balanceReductionPercent: number | null
    utilizationPercent: number | null
    dsrPercent: number | null
    ltvPercent: number | null
  }
  behavioralHealth: Array<{
    id: string
    label: string
    score: number | null
    basis: string
  }>
  predictions: {
    probabilityOfDefault: number
    probabilityOfRestructuring: number
    probabilityOfEarlyPayoff: number
    wealthBuildingImpact: number
    financialResilienceUnderStress: number
    expectedLoanTrajectory: string
  }
  strengths: string[]
  improvements: string[]
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value))
}

function round(value: number, precision = 1) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function normalize(component: number, maximum: number) {
  return maximum > 0 ? clamp((component / maximum) * 100) : 0
}

function paymentPerformanceScore(daysPastDue: number | null) {
  if (daysPastDue === null || daysPastDue < 0) return 0
  if (daysPastDue === 0) return 30
  if (daysPastDue <= 15) return 24
  if (daysPastDue <= 30) return 18
  if (daysPastDue <= 60) return 10
  return 0
}

function balanceManagementScore(reductionPercent: number | null) {
  if (reductionPercent === null) return 0
  if (reductionPercent > 25) return 15
  if (reductionPercent >= 20) return 13
  if (reductionPercent >= 15) return 11
  if (reductionPercent >= 10) return 8
  if (reductionPercent >= 5) return 5
  return 2
}

function debtServiceCapacityScore(dsrPercent: number | null) {
  if (dsrPercent === null || dsrPercent < 0) return 0
  if (dsrPercent <= 30) return 20
  if (dsrPercent <= 35) return 18
  if (dsrPercent <= 40) return 16
  if (dsrPercent <= 45) return 12
  if (dsrPercent <= 50) return 8
  return 0
}

function utilizationScore(utilizationPercent: number | null) {
  if (utilizationPercent === null || utilizationPercent < 0) return 0
  if (utilizationPercent < 40) return 10
  if (utilizationPercent <= 60) return 8
  if (utilizationPercent <= 75) return 6
  if (utilizationPercent <= 90) return 3
  return 0
}

function collateralScore(ltvPercent: number | null) {
  if (ltvPercent === null || ltvPercent < 0) return 0
  if (ltvPercent < 60) return 10
  if (ltvPercent <= 70) return 8
  if (ltvPercent <= 80) return 6
  if (ltvPercent <= 90) return 3
  return 0
}

function portfolioScore(input: LoanMonitoringScoreInput) {
  if (input.activeLoanCount <= 0) return 0

  const manageableCount = input.activeLoanCount <= 3 ? 2 : input.activeLoanCount <= 5 ? 1 : 0
  const interestControl = input.highInterestLoanCount === 0
    ? 2
    : input.highInterestLoanCount / input.activeLoanCount <= 0.25 ? 1 : 0
  const refinancingDiscipline = input.refinancingImprovesCashFlow ? 2 : input.highInterestLoanCount === 0 ? 2 : 0
  const consolidationDiscipline = input.activeLoanCount === 1 || input.consolidationOpportunity ? 2 : 1
  const diversification = input.activeLoanCount === 1
    ? 2
    : Math.min(input.distinctLoanTypeCount, input.distinctLenderCount) >= 2 ? 2 : 1

  return manageableCount + interestControl + refinancingDiscipline + consolidationDiscipline + diversification
}

function gradeFor(score: number) {
  if (score >= 95) return { grade: 'A+', interpretation: 'Exceptional Loan Management' }
  if (score >= 90) return { grade: 'A', interpretation: 'Excellent' }
  if (score >= 85) return { grade: 'B+', interpretation: 'Very Good' }
  if (score >= 80) return { grade: 'B', interpretation: 'Good' }
  if (score >= 75) return { grade: 'C+', interpretation: 'Acceptable' }
  if (score >= 70) return { grade: 'C', interpretation: 'Watch' }
  if (score >= 60) return { grade: 'D', interpretation: 'High Risk' }
  return { grade: 'E', interpretation: 'Critical' }
}

export function computeLoanMonitoringScore(input: LoanMonitoringScoreInput): LoanMonitoringScoreResult {
  const balanceReductionPercent = input.beginningBalance > 0
    ? round(((input.beginningBalance - input.currentBalance) / input.beginningBalance) * 100, 2)
    : null
  const paymentPerformance = paymentPerformanceScore(input.daysPastDue)
  const balanceManagement = balanceManagementScore(balanceReductionPercent)
  const debtServiceCapacity = debtServiceCapacityScore(input.dsrPercent)
  const loanUtilization = utilizationScore(input.utilizationPercent)
  const collateralQuality = collateralScore(input.ltvPercent)
  const portfolioHealth = portfolioScore(input)
  const aiAdjustment = clamp(
    (input.regularExtraPayments ? 2 : 0)
      + (input.principalPrepayment ? 1 : 0)
      + (input.refinancingImprovesCashFlow ? 1 : 0)
      - (input.decliningPaymentBehavior ? 2 : 0)
      - (input.increasingPastDues ? 3 : 0),
    -5,
    5,
  )
  const baseScore = paymentPerformance + balanceManagement + debtServiceCapacity
    + loanUtilization + collateralQuality + portfolioHealth
  const score = round(clamp(baseScore + aiAdjustment))
  const grade = gradeFor(score)

  const normalized = {
    payment: normalize(paymentPerformance, 30),
    balance: normalize(balanceManagement, 15),
    dsr: normalize(debtServiceCapacity, 20),
    utilization: normalize(loanUtilization, 10),
    collateral: normalize(collateralQuality, 10),
    portfolio: normalize(portfolioHealth, 10),
  }
  const savingsBehavior = input.savingsBehaviorScore === null || input.savingsBehaviorScore === undefined
    ? null
    : clamp(input.savingsBehaviorScore)
  const budgetAdherence = input.budgetAdherenceScore === null || input.budgetAdherenceScore === undefined
    ? null
    : clamp(input.budgetAdherenceScore)
  const newDebtAcquisition = input.activeLoanCount <= 1 ? 100 : input.activeLoanCount === 2 ? 75 : input.activeLoanCount === 3 ? 50 : 25
  const refinancingDiscipline = input.activeLoanCount <= 1 || input.highInterestLoanCount === 0
    ? 100
    : input.refinancingImprovesCashFlow ? 80 : 40
  const paymentConsistency = input.daysPastDue === null ? null : input.daysPastDue === 0 ? 100 : clamp(100 - input.daysPastDue * 1.5)

  const defaultRisk = round(clamp(
    (100 - normalized.payment) * 0.35
      + (100 - normalized.dsr) * 0.25
      + (100 - normalized.utilization) * 0.15
      + (100 - normalized.collateral) * 0.1
      + (100 - normalized.portfolio) * 0.1
      + (aiAdjustment < 0 ? Math.abs(aiAdjustment) * 5 : 0),
  ))
  const restructuringRisk = round(clamp(
    (100 - normalized.dsr) * 0.4
      + (100 - normalized.payment) * 0.3
      + (100 - normalized.balance) * 0.15
      + (100 - normalized.portfolio) * 0.15,
  ))
  const earlyPayoff = round(clamp(
    normalized.balance * 0.35
      + normalized.payment * 0.25
      + normalized.dsr * 0.2
      + (input.principalPrepayment ? 15 : 0)
      + (input.regularExtraPayments ? 5 : 0),
  ))
  const wealthImpact = round(clamp(
    normalized.dsr * 0.3
      + normalized.balance * 0.25
      + (savingsBehavior ?? 50) * 0.25
      + (budgetAdherence ?? 50) * 0.2,
  ))
  const resilience = round(clamp(
    normalized.payment * 0.25
      + normalized.dsr * 0.25
      + normalized.collateral * 0.2
      + normalized.portfolio * 0.15
      + (budgetAdherence ?? 50) * 0.15,
  ))
  const expectedLoanTrajectory = defaultRisk <= 20 && earlyPayoff >= 65
    ? 'Accelerated payoff likely'
    : defaultRisk <= 35 && restructuringRisk <= 35
      ? 'Stable reduction trajectory'
      : restructuringRisk >= 60
        ? 'Restructuring pressure increasing'
        : defaultRisk >= 60
          ? 'Elevated default-risk trajectory'
          : 'Managed with close monitoring'

  const componentNarratives = [
    { score: normalized.payment, strength: 'payments are current', improvement: 'restore on-time payment performance' },
    { score: normalized.balance, strength: 'principal is reducing at a healthy pace', improvement: 'increase principal reduction' },
    { score: normalized.dsr, strength: 'debt-service capacity is healthy', improvement: 'reduce debt-service pressure' },
    { score: normalized.utilization, strength: 'loan utilization is controlled', improvement: 'lower loan utilization' },
    { score: normalized.collateral, strength: 'collateral coverage is strong', improvement: 'improve collateral coverage or reduce LTV' },
    { score: normalized.portfolio, strength: 'the loan portfolio is well managed', improvement: 'review high-rate or concentrated loan exposures' },
  ]
  const strengths = componentNarratives.filter((item) => item.score >= 75).map((item) => item.strength)
  const improvements = componentNarratives.filter((item) => item.score < 60).map((item) => item.improvement)

  return {
    score,
    ...grade,
    components: {
      paymentPerformance,
      balanceManagement,
      debtServiceCapacity,
      loanUtilization,
      collateralQuality,
      portfolioHealth,
      aiAdjustment,
    },
    metrics: {
      balanceReductionPercent,
      utilizationPercent: input.utilizationPercent,
      dsrPercent: input.dsrPercent,
      ltvPercent: input.ltvPercent,
    },
    behavioralHealth: [
      { id: 'on-time-payment', label: 'On-time payment rate', score: normalized.payment, basis: 'Payment-performance proxy from days past due' },
      { id: 'principal-reduction', label: 'Principal reduction trend', score: normalized.balance, basis: 'Beginning balance versus current balance' },
      { id: 'savings-behavior', label: 'Savings behavior', score: savingsBehavior, basis: 'Saved Budget and Expense Tracker savings discipline' },
      { id: 'payment-consistency', label: 'Payment consistency', score: paymentConsistency, basis: 'Current delinquency proxy; payment history improves precision' },
      { id: 'new-debt', label: 'New debt acquisition', score: newDebtAcquisition, basis: 'Current active-loan count' },
      { id: 'utilization-trend', label: 'Loan utilization trend', score: normalized.utilization, basis: 'Current outstanding balance versus credit capacity' },
      { id: 'budget-adherence', label: 'Budget adherence', score: budgetAdherence, basis: 'Saved planned-versus-actual expense variance' },
      { id: 'refinancing-discipline', label: 'Refinancing discipline', score: refinancingDiscipline, basis: 'High-rate exposure and projected cash-flow improvement' },
    ],
    predictions: {
      probabilityOfDefault: defaultRisk,
      probabilityOfRestructuring: restructuringRisk,
      probabilityOfEarlyPayoff: earlyPayoff,
      wealthBuildingImpact: wealthImpact,
      financialResilienceUnderStress: resilience,
      expectedLoanTrajectory,
    },
    strengths: strengths.length ? strengths : ['No strong component is confirmed yet; complete the monitoring inputs.'],
    improvements: improvements.length ? improvements : ['Maintain current repayment and principal-reduction discipline.'],
  }
}