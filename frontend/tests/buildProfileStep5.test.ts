import { describe, expect, it } from 'vitest'

import {
  HISTORICAL_ASSESSMENT_FIELDS,
  withHistoricalAssessmentDefaults,
} from '../src/pages/scoring/buildProfileStep5'

describe('withHistoricalAssessmentDefaults', () => {
  const selectableFields = HISTORICAL_ASSESSMENT_FIELDS.filter((field) => field.options?.length)

  it('defaults all 11 selectable historical assessment questions to their first option', () => {
    const values = withHistoricalAssessmentDefaults({})

    expect(HISTORICAL_ASSESSMENT_FIELDS).toHaveLength(12)
    expect(selectableFields).toHaveLength(11)
    for (const field of selectableFields) {
      expect(values[field.key]).toBe(field.options?.[0])
    }
    expect(values.creditBureauCreditLimitUtilization).toBeUndefined()
    expect(values.step89DetailedFinancialPosition).toBe('0')
  })

  it('preserves existing selections and defaults blank selections', () => {
    const values = withHistoricalAssessmentDefaults({
      creditBureauLatePaymentFrequency: 'Loan in default',
      creditBureauDelinquencyDefaultHistory: '   ',
      unrelatedField: 'preserved',
    })

    expect(values.creditBureauLatePaymentFrequency).toBe('Loan in default')
    expect(values.creditBureauDelinquencyDefaultHistory).toBe(
      selectableFields.find((field) => field.key === 'creditBureauDelinquencyDefaultHistory')?.options?.[0],
    )
    expect(values.unrelatedField).toBe('preserved')
  })

  it('preserves a saved Step 8 and 9 detailed financial position value', () => {
    const values = withHistoricalAssessmentDefaults({
      step89DetailedFinancialPosition: '125000',
    })

    expect(values.step89DetailedFinancialPosition).toBe('125000')
  })
})
