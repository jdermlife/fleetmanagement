import { describe, expect, it } from 'vitest'

import { calculateApplicationInformationCompletion } from './applicationCompleteness'

type Application = Parameters<typeof calculateApplicationInformationCompletion>[0]

const createApplication = (includeOptionalInputs: boolean): Application => ({
  product_type: 'Auto Loan',
  purpose: '',
  loan_amount: 0,
  term_months: 0,
  interest_rate: 0,
  borrower_name: '',
  email: '',
  phone: '',
  gov_id: '',
  address: '',
  monthly_income: 0,
  appraised_value: 0,
  requirements: {
    applicantPersonal: {
      firstName: includeOptionalInputs ? 'Juan' : '',
      lastName: includeOptionalInputs ? 'Dela Cruz' : '',
      mothersMaidenName: includeOptionalInputs ? 'Maria Santos' : '',
    },
    collateralAssetDetails: {
      vehicleMarketabilityCategory: includeOptionalInputs ? 'High-demand' : '',
    },
    supportingDocuments: includeOptionalInputs
      ? { validGovernmentId: true, bankStatements: true }
      : {},
  },
} as unknown as Application)

describe('calculateApplicationInformationCompletion', () => {
  it('does not require identity name parts, vehicle marketability, or document classifications', () => {
    const withoutOptionalInputs = calculateApplicationInformationCompletion(
      createApplication(false),
    )
    const withOptionalInputs = calculateApplicationInformationCompletion(
      createApplication(true),
    )

    expect(withOptionalInputs).toEqual(withoutOptionalInputs)
    expect(withoutOptionalInputs.steps[7]).toMatchObject({
      applicable: false,
      provided: 0,
      total: 0,
    })
  })
})