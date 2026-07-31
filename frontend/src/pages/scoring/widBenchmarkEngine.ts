export type WidThreshold = {
  percentile: number
  amount: number
}

export type WidCountryReference = {
  countryCode: string
  countryName: string
  year: number
  currency: string
  incomeShares: {
    bottom50: number
    top10: number
    top1: number
    dataQuality: number
  }
  wealthVariableCode: string
  populationBasis: string
  wealthShares: {
    bottom50: number | null
    middle40: number | null
    top10: number | null
    top1: number | null
  }
  wealthThresholds: WidThreshold[]
}

export type WidBenchmarkInput = {
  netWorth: number
  annualIncome: number
  countryCode: string
  currency: string
  reference?: WidCountryReference
}

export type WidBenchmarkResult = {
  status: 'ranked' | 'insufficient-data' | 'currency-mismatch' | 'unsupported-country'
  percentile: number | null
  topPercent: number | null
  band: string
  netWorth: number
  annualIncome: number
  countryCode: string
  countryName: string | null
  referenceYear: number | null
  source: string
  explanation: string
  incomeConcentrationRank: number | null
  incomeConcentrationCountryCount: number
  top10IncomeShare: number | null
}

export const WID_2024_COUNTRY_REFERENCES: Record<string, WidCountryReference> = {
  ID: {
    countryCode: 'ID', countryName: 'Indonesia', year: 2024, currency: 'IDR',
    incomeShares: { bottom50: 0.1245, top10: 0.4686, top1: 0.1785, dataQuality: 1 },
    wealthVariableCode: 'shweal992i', populationBasis: 'Adults over age 20, individual basis',
    wealthShares: { bottom50: null, middle40: null, top10: null, top1: null }, wealthThresholds: [],
  },
  MY: {
    countryCode: 'MY', countryName: 'Malaysia', year: 2024, currency: 'MYR',
    incomeShares: { bottom50: 0.1921, top10: 0.3653, top1: 0.13, dataQuality: 1 },
    wealthVariableCode: 'shweal992i', populationBasis: 'Adults over age 20, individual basis',
    wealthShares: { bottom50: null, middle40: null, top10: null, top1: null }, wealthThresholds: [],
  },
  PH: {
    countryCode: 'PH',
    countryName: 'Philippines',
    year: 2024,
    currency: 'PHP',
    incomeShares: { bottom50: 0.1435, top10: 0.454, top1: 0.1662, dataQuality: 1 },
    wealthVariableCode: 'shweal992i',
    populationBasis: 'Adults over age 20, individual basis',
    wealthShares: { bottom50: null, middle40: null, top10: null, top1: null },
    wealthThresholds: [],
  },
  SG: {
    countryCode: 'SG', countryName: 'Singapore', year: 2024, currency: 'SGD',
    incomeShares: { bottom50: 0.1665, top10: 0.4628, top1: 0.1421, dataQuality: 1 },
    wealthVariableCode: 'shweal992i', populationBasis: 'Adults over age 20, individual basis',
    wealthShares: { bottom50: null, middle40: null, top10: null, top1: null }, wealthThresholds: [],
  },
  TH: {
    countryCode: 'TH', countryName: 'Thailand', year: 2024, currency: 'THB',
    incomeShares: { bottom50: 0.1065, top10: 0.5235, top1: 0.1983, dataQuality: 1 },
    wealthVariableCode: 'shweal992i', populationBasis: 'Adults over age 20, individual basis',
    wealthShares: { bottom50: null, middle40: null, top10: null, top1: null }, wealthThresholds: [],
  },
  US: {
    countryCode: 'US', countryName: 'USA', year: 2024, currency: 'USD',
    incomeShares: { bottom50: 0.1344, top10: 0.4676, top1: 0.2073, dataQuality: 5 },
    wealthVariableCode: 'shweal992i', populationBasis: 'Adults over age 20, individual basis',
    wealthShares: { bottom50: null, middle40: null, top10: null, top1: null }, wealthThresholds: [],
  },
  GB: {
    countryCode: 'GB', countryName: 'United Kingdom', year: 2024, currency: 'GBP',
    incomeShares: { bottom50: 0.2043, top10: 0.3622, top1: 0.1308, dataQuality: 1 },
    wealthVariableCode: 'shweal992i', populationBasis: 'Adults over age 20, individual basis',
    wealthShares: { bottom50: null, middle40: null, top10: null, top1: null }, wealthThresholds: [],
  },
}

const COUNTRY_CODE_BY_CITIZENSHIP: Record<string, string> = {
  Filipino: 'PH',
  American: 'US',
  British: 'GB',
  Indonesian: 'ID',
  Malaysian: 'MY',
  Singaporean: 'SG',
  Thai: 'TH',
}

export function countryCodeFromCitizenship(citizenship?: string) {
  return COUNTRY_CODE_BY_CITIZENSHIP[citizenship?.trim() ?? ''] ?? 'PH'
}

function interpolatePercentile(netWorth: number, thresholds: WidThreshold[]) {
  const ordered = [...thresholds].sort((left, right) => left.amount - right.amount)
  if (ordered.length < 2) return null
  if (netWorth <= ordered[0].amount) return ordered[0].percentile
  if (netWorth >= ordered[ordered.length - 1].amount) return ordered[ordered.length - 1].percentile

  for (let index = 1; index < ordered.length; index += 1) {
    const lower = ordered[index - 1]
    const upper = ordered[index]
    if (netWorth > upper.amount) continue
    if (upper.amount === lower.amount) return upper.percentile
    const position = (netWorth - lower.amount) / (upper.amount - lower.amount)
    return lower.percentile + position * (upper.percentile - lower.percentile)
  }
  return null
}

function percentileBand(percentile: number) {
  if (percentile >= 99) return 'Top 1%'
  if (percentile >= 90) return 'Top 10%'
  if (percentile >= 50) return 'Middle 40%'
  return 'Bottom 50%'
}

function incomeConcentrationRanking(reference?: WidCountryReference) {
  const rankedCountries = Object.values(WID_2024_COUNTRY_REFERENCES)
    .filter((candidate) => candidate.year === 2024 && Number.isFinite(candidate.incomeShares.top10))
    .sort((left, right) => right.incomeShares.top10 - left.incomeShares.top10)

  return {
    rank: reference ? rankedCountries.findIndex((candidate) => candidate.countryCode === reference.countryCode) + 1 : 0,
    countryCount: rankedCountries.length,
  }
}

export function computeWidBenchmark(input: WidBenchmarkInput): WidBenchmarkResult {
  const reference = input.reference ?? WID_2024_COUNTRY_REFERENCES[input.countryCode]
  const incomeRanking = incomeConcentrationRanking(reference)
  const base = {
    netWorth: Number.isFinite(input.netWorth) ? input.netWorth : 0,
    annualIncome: Number.isFinite(input.annualIncome) ? input.annualIncome : 0,
    countryCode: input.countryCode,
    countryName: reference?.countryName ?? null,
    referenceYear: reference?.year ?? null,
    source: 'World Inequality Database export downloaded 31 July 2026',
    incomeConcentrationRank: incomeRanking.rank || null,
    incomeConcentrationCountryCount: incomeRanking.countryCount,
    top10IncomeShare: reference?.incomeShares.top10 ?? null,
  }

  if (!reference) {
    return { ...base, status: 'unsupported-country', percentile: null, topPercent: null, band: 'Ranking unavailable', explanation: 'The supplied WID export does not contain this country.' }
  }
  if (input.currency !== reference.currency) {
    return { ...base, status: 'currency-mismatch', percentile: null, topPercent: null, band: 'Ranking unavailable', explanation: `Convert the profile from ${input.currency} to ${reference.currency} using a dated exchange rate before comparison.` }
  }

  const percentile = interpolatePercentile(base.netWorth, reference.wealthThresholds)
  if (percentile === null) {
    return {
      ...base,
      status: 'insufficient-data',
      percentile: null,
      topPercent: null,
      band: 'Ranking pending',
      explanation: 'The supplied WID wealth rows contain no values or amount thresholds, so a personal wealth percentile cannot be calculated from this export.',
    }
  }

  const roundedPercentile = Math.round(percentile * 10) / 10
  return {
    ...base,
    status: 'ranked',
    percentile: roundedPercentile,
    topPercent: Math.round((100 - roundedPercentile) * 10) / 10,
    band: percentileBand(roundedPercentile),
    explanation: `Net worth was interpolated between matching ${reference.countryName} WID wealth thresholds for ${reference.year}.`,
  }
}