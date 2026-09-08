export type RetirementModelInputs = {
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  currentMonthlyExpenses: number
  retirementSpendingPercent: number
  currentRetirementSavings: number
  monthlyContribution: number
  annualPreRetirementReturn: number
  annualPostRetirementReturn: number
  annualReturnVolatility: number
  inflationRate: number
  annualPensionIncome: number
  withdrawalRate: number
  annualContributionIncrease: number
}

export type RetirementScenario = {
  id: 'conservative' | 'base' | 'optimistic'
  label: string
  annualReturn: number
  inflationRate: number
  projectedPortfolio: number
  requiredCorpus: number
  fundingRatioPercent: number
}

export type RetirementModelResult = {
  yearsToRetirement: number
  retirementYears: number
  retirementNeeds: {
    monthlyExpensesAtRetirement: number
    annualExpensesAtRetirement: number
    lifetimeSpending: number
  }
  inflation: {
    cumulativeIncreasePercent: number
    futureCostOfCurrentMonthlyExpenses: number
  }
  retirementIncome: {
    annualPortfolioIncome: number
    annualPensionIncome: number
    totalAnnualIncome: number
    annualIncomeGap: number
  }
  investmentProjection: {
    projectedPortfolioAtRetirement: number
    investmentGrowth: number
    totalContributions: number
  }
  retirementCorpus: {
    requiredCorpus: number
    fundingGap: number
    fundingRatioPercent: number
  }
  financialIndependence: {
    age: number | null
    yearsFromNow: number | null
  }
  contributionOptimizer: {
    requiredMonthlyContribution: number
    monthlyContributionGap: number
  }
  scenarios: RetirementScenario[]
  monteCarlo: {
    trials: number
    successProbabilityPercent: number
    percentile10EndingBalance: number
    medianEndingBalance: number
    percentile90EndingBalance: number
    resilience: 'Strong' | 'Moderate' | 'Vulnerable'
  }
}

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value))
const safeNumber = (value: number): number => Number.isFinite(value) ? Math.max(0, value) : 0
const annualRate = (percent: number): number => safeNumber(percent) / 100

function futureValueLumpSum(presentValue: number, yearlyRate: number, years: number): number {
  return presentValue * Math.pow(1 + yearlyRate, Math.max(0, years))
}

function projectedPortfolio(input: RetirementModelInputs, yearlyReturn: number): number {
  const years = Math.max(0, input.retirementAge - input.currentAge)
  const contributionGrowth = annualRate(input.annualContributionIncrease)
  let balance = safeNumber(input.currentRetirementSavings)
  let annualContribution = safeNumber(input.monthlyContribution) * 12

  for (let year = 0; year < years; year += 1) {
    balance = balance * (1 + yearlyReturn) + annualContribution
    annualContribution *= 1 + contributionGrowth
  }
  return balance
}

function totalContributions(input: RetirementModelInputs): number {
  const years = Math.max(0, input.retirementAge - input.currentAge)
  const contributionGrowth = annualRate(input.annualContributionIncrease)
  let contribution = safeNumber(input.monthlyContribution) * 12
  let total = 0
  for (let year = 0; year < years; year += 1) {
    total += contribution
    contribution *= 1 + contributionGrowth
  }
  return total
}

function retirementExpenseAtAge(input: RetirementModelInputs, age: number): number {
  const years = Math.max(0, age - input.currentAge)
  const spendingRatio = clamp(safeNumber(input.retirementSpendingPercent), 0, 200) / 100
  return safeNumber(input.currentMonthlyExpenses) * spendingRatio * 12 * Math.pow(1 + annualRate(input.inflationRate), years)
}

function requiredCorpusAtAge(input: RetirementModelInputs, age: number, inflationRate = input.inflationRate): number {
  const adjustedInput = { ...input, inflationRate }
  const annualNeed = Math.max(0, retirementExpenseAtAge(adjustedInput, age) - safeNumber(input.annualPensionIncome))
  const withdrawalRate = Math.max(0.001, annualRate(input.withdrawalRate))
  return annualNeed / withdrawalRate
}

function requiredMonthlyContribution(input: RetirementModelInputs, target: number): number {
  const years = Math.max(0, input.retirementAge - input.currentAge)
  if (years <= 0) return 0
  const yearlyRate = annualRate(input.annualPreRetirementReturn)
  const futureCurrentSavings = futureValueLumpSum(safeNumber(input.currentRetirementSavings), yearlyRate, years)
  const gap = Math.max(0, target - futureCurrentSavings)
  if (gap === 0) return 0
  const futureValuePerMonthlyUnit = projectedPortfolio({
    ...input,
    currentRetirementSavings: 0,
    monthlyContribution: 1,
  }, yearlyRate)
  return futureValuePerMonthlyUnit > 0 ? gap / futureValuePerMonthlyUnit : 0
}

function financialIndependenceDate(input: RetirementModelInputs): { age: number | null; yearsFromNow: number | null } {
  const monthlyRate = annualRate(input.annualPreRetirementReturn) / 12
  const monthlyContributionGrowth = Math.pow(1 + annualRate(input.annualContributionIncrease), 1 / 12) - 1
  let balance = safeNumber(input.currentRetirementSavings)
  let contribution = safeNumber(input.monthlyContribution)

  for (let month = 0; month <= 100 * 12; month += 1) {
    const age = input.currentAge + month / 12
    if (balance >= requiredCorpusAtAge(input, age)) {
      return { age, yearsFromNow: month / 12 }
    }
    balance = balance * (1 + monthlyRate) + contribution
    contribution *= 1 + monthlyContributionGrowth
  }
  return { age: null, yearsFromNow: null }
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = seed + 0x6D2B79F5 | 0
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed)
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

function normalRandom(random: () => number): number {
  const first = Math.max(random(), Number.EPSILON)
  const second = random()
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second)
}

function runMonteCarlo(input: RetirementModelInputs, trials = 500): RetirementModelResult['monteCarlo'] {
  const random = mulberry32(20260908)
  const yearsToRetirement = Math.max(0, input.retirementAge - input.currentAge)
  const retirementYears = Math.max(0, input.lifeExpectancy - input.retirementAge)
  const meanPreReturn = annualRate(input.annualPreRetirementReturn)
  const meanPostReturn = annualRate(input.annualPostRetirementReturn)
  const volatility = annualRate(input.annualReturnVolatility)
  const inflation = annualRate(input.inflationRate)
  const contributionGrowth = annualRate(input.annualContributionIncrease)
  const endings: number[] = []
  let successes = 0

  for (let trial = 0; trial < trials; trial += 1) {
    let balance = safeNumber(input.currentRetirementSavings)
    let annualContribution = safeNumber(input.monthlyContribution) * 12
    for (let year = 0; year < yearsToRetirement; year += 1) {
      const returnRate = clamp(meanPreReturn + normalRandom(random) * volatility, -0.95, 1)
      balance = Math.max(0, balance * (1 + returnRate) + annualContribution)
      annualContribution *= 1 + contributionGrowth
    }

    let annualWithdrawal = Math.max(0, retirementExpenseAtAge(input, input.retirementAge) - safeNumber(input.annualPensionIncome))
    let survived = balance > 0
    for (let year = 0; year < retirementYears; year += 1) {
      const returnRate = clamp(meanPostReturn + normalRandom(random) * volatility, -0.95, 1)
      balance = Math.max(0, balance * (1 + returnRate) - annualWithdrawal)
      annualWithdrawal *= 1 + inflation
      if (balance <= 0) survived = false
    }
    if (survived) successes += 1
    endings.push(balance)
  }

  endings.sort((left, right) => left - right)
  const percentile = (ratio: number) => endings[Math.min(endings.length - 1, Math.floor((endings.length - 1) * ratio))] ?? 0
  const successProbabilityPercent = successes / trials * 100
  return {
    trials,
    successProbabilityPercent,
    percentile10EndingBalance: percentile(0.1),
    medianEndingBalance: percentile(0.5),
    percentile90EndingBalance: percentile(0.9),
    resilience: successProbabilityPercent >= 80 ? 'Strong' : successProbabilityPercent >= 60 ? 'Moderate' : 'Vulnerable',
  }
}

export function computeRetirementModel(input: RetirementModelInputs): RetirementModelResult {
  const values: RetirementModelInputs = {
    ...input,
    currentAge: clamp(Math.round(safeNumber(input.currentAge)), 18, 100),
    retirementAge: clamp(Math.round(safeNumber(input.retirementAge)), 18, 100),
    lifeExpectancy: clamp(Math.round(safeNumber(input.lifeExpectancy)), 18, 120),
  }
  values.retirementAge = Math.max(values.currentAge, values.retirementAge)
  values.lifeExpectancy = Math.max(values.retirementAge, values.lifeExpectancy)

  const yearsToRetirement = values.retirementAge - values.currentAge
  const retirementYears = values.lifeExpectancy - values.retirementAge
  const annualExpensesAtRetirement = retirementExpenseAtAge(values, values.retirementAge)
  const projectedPortfolioAtRetirement = projectedPortfolio(values, annualRate(values.annualPreRetirementReturn))
  const requiredCorpus = requiredCorpusAtAge(values, values.retirementAge)
  const withdrawalRate = annualRate(values.withdrawalRate)
  const annualPortfolioIncome = projectedPortfolioAtRetirement * withdrawalRate
  const totalAnnualIncome = annualPortfolioIncome + values.annualPensionIncome
  const requiredMonthly = requiredMonthlyContribution(values, requiredCorpus)
  const contributions = totalContributions(values)
  const fiDate = financialIndependenceDate(values)
  const cumulativeInflation = Math.pow(1 + annualRate(values.inflationRate), yearsToRetirement)
  const lifetimeSpending = Array.from({ length: retirementYears }, (_, year) => annualExpensesAtRetirement * Math.pow(1 + annualRate(values.inflationRate), year))
    .reduce((total, expense) => total + expense, 0)

  const scenarioAssumptions: Array<Pick<RetirementScenario, 'id' | 'label' | 'annualReturn' | 'inflationRate'>> = [
    { id: 'conservative', label: 'Conservative', annualReturn: Math.max(0, values.annualPreRetirementReturn - 2), inflationRate: values.inflationRate + 1 },
    { id: 'base', label: 'Base plan', annualReturn: values.annualPreRetirementReturn, inflationRate: values.inflationRate },
    { id: 'optimistic', label: 'Optimistic', annualReturn: values.annualPreRetirementReturn + 2, inflationRate: Math.max(0, values.inflationRate - 1) },
  ]
  const scenarios: RetirementScenario[] = scenarioAssumptions.map((scenario) => {
    const portfolio = projectedPortfolio(values, annualRate(scenario.annualReturn))
    const corpus = requiredCorpusAtAge(values, values.retirementAge, scenario.inflationRate)
    return {
      ...scenario,
      projectedPortfolio: portfolio,
      requiredCorpus: corpus,
      fundingRatioPercent: corpus > 0 ? portfolio / corpus * 100 : 100,
    }
  })

  return {
    yearsToRetirement,
    retirementYears,
    retirementNeeds: {
      monthlyExpensesAtRetirement: annualExpensesAtRetirement / 12,
      annualExpensesAtRetirement,
      lifetimeSpending,
    },
    inflation: {
      cumulativeIncreasePercent: (cumulativeInflation - 1) * 100,
      futureCostOfCurrentMonthlyExpenses: values.currentMonthlyExpenses * cumulativeInflation,
    },
    retirementIncome: {
      annualPortfolioIncome,
      annualPensionIncome: values.annualPensionIncome,
      totalAnnualIncome,
      annualIncomeGap: Math.max(0, annualExpensesAtRetirement - totalAnnualIncome),
    },
    investmentProjection: {
      projectedPortfolioAtRetirement,
      investmentGrowth: Math.max(0, projectedPortfolioAtRetirement - values.currentRetirementSavings - contributions),
      totalContributions: contributions,
    },
    retirementCorpus: {
      requiredCorpus,
      fundingGap: Math.max(0, requiredCorpus - projectedPortfolioAtRetirement),
      fundingRatioPercent: requiredCorpus > 0 ? projectedPortfolioAtRetirement / requiredCorpus * 100 : 100,
    },
    financialIndependence: fiDate,
    contributionOptimizer: {
      requiredMonthlyContribution: requiredMonthly,
      monthlyContributionGap: Math.max(0, requiredMonthly - values.monthlyContribution),
    },
    scenarios,
    monteCarlo: runMonteCarlo(values),
  }
}
