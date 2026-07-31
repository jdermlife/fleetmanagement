export type WidThreshold = {
  percentile: number
  amount: number
}

export type WidCountryReference = {
  countryCode: string
  countryName: string
  year: number
  currency: string
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
}

export const WID_2024_COUNTRY_REFERENCES: Record<string, WidCountryReference> = {
  PH: {
    countryCode: 'PH',
    countryName: 'Philippines',
    year: 2024,
    currency: 'PHP',
    wealthVariableCode: 'shweal992i',
    populationBasis: 'Adults over age 20, individual basis',
    wealthShares: { bottom50: null, middle40: null, top10: null, top1: null },
    wealthThresholds: [],
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

export function computeWidBenchmark(input: WidBenchmarkInput): WidBenchmarkResult {
  const reference = input.reference ?? WID_2024_COUNTRY_REFERENCES[input.countryCode]
  const base = {
    netWorth: Number.isFinite(input.netWorth) ? input.netWorth : 0,
    annualIncome: Number.isFinite(input.annualIncome) ? input.annualIncome : 0,
    countryCode: input.countryCode,
    countryName: reference?.countryName ?? null,
    referenceYear: reference?.year ?? null,
    source: 'World Inequality Database export downloaded 31 July 2026',
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