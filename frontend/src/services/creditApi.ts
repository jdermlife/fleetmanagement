import { api } from '../api'

type BorrowerLike = {
  dsr_percent?: number | string | null
  address_stay_years?: number | string | null
  net_disposable_income?: number | string | null
}

type PropertyLike = {
  appraised_value?: number | string | null
}

type CreditScoreInput = {
  borrowers?: BorrowerLike[] | null
  properties?: PropertyLike[] | null
}

type DriverPayload = Record<string, unknown>

export interface CreditScoreResult {
  capacity_score: number
  character_score: number
  collateral_score: number
  condition_score: number
  total_score: number
  risk_classification: 'A' | 'B' | 'C' | 'D'
}

function toNumericValue(value: number | string | null | undefined): number {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

export const CreditApi = {
  async computeScore(data: CreditScoreInput): Promise<CreditScoreResult> {
    const borrowers = Array.isArray(data?.borrowers) ? data.borrowers : []
    const properties = Array.isArray(data?.properties) ? data.properties : []

    const borrowerCount = Math.max(borrowers.length, 1)
    const avgDsr =
      borrowers.reduce((accumulator, item) => accumulator + toNumericValue(item?.dsr_percent), 0) / borrowerCount
    const avgAddressYears =
      borrowers.reduce((accumulator, item) => accumulator + toNumericValue(item?.address_stay_years), 0) / borrowerCount
    const avgNetIncome =
      borrowers.reduce((accumulator, item) => accumulator + toNumericValue(item?.net_disposable_income), 0) / borrowerCount
    const totalCollateral = properties.reduce(
      (accumulator, item) => accumulator + toNumericValue(item?.appraised_value),
      0,
    )

    const capacityScore = Math.max(5, Math.min(25, 25 - avgDsr / 4))
    const characterScore = Math.max(5, Math.min(25, 8 + avgAddressYears * 2))
    const collateralScore = Math.max(5, Math.min(25, totalCollateral > 0 ? 20 : 10))
    const conditionScore = Math.max(5, Math.min(25, avgNetIncome > 50000 ? 22 : avgNetIncome > 20000 ? 16 : 10))

    const totalScore = Math.round(capacityScore + characterScore + collateralScore + conditionScore)
    const riskClassification: CreditScoreResult['risk_classification'] =
      totalScore >= 85 ? 'A' : totalScore >= 70 ? 'B' : totalScore >= 55 ? 'C' : 'D'

    return {
      capacity_score: Number(capacityScore.toFixed(2)),
      character_score: Number(characterScore.toFixed(2)),
      collateral_score: Number(collateralScore.toFixed(2)),
      condition_score: Number(conditionScore.toFixed(2)),
      total_score: totalScore,
      risk_classification: riskClassification,
    }
  },

  async calculateCreditScore(data: CreditScoreInput): Promise<CreditScoreResult> {
    return this.computeScore(data)
  },

  async getDrivers() {
    const response = await api.get('/drivers')
    return response.data
  },

  async createDriver(data: DriverPayload) {
    const response = await api.post('/drivers', data)
    return response.data
  },
}
