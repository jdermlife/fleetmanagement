import { describe, expect, it } from 'vitest'

import {
  CREDIT_VALUES_QUESTIONS,
  STEP_3_DEFAULT_VALUES,
  isStep3DefaultValue,
  withCreditValuesDefaults,
} from '../src/pages/scoring/buildProfileStep3'

describe('withCreditValuesDefaults', () => {
  it('defaults every unanswered credit value question to its last option', () => {
    const values = withCreditValuesDefaults({})

    expect(CREDIT_VALUES_QUESTIONS).toHaveLength(50)
    for (const question of CREDIT_VALUES_QUESTIONS) {
      expect(values[`creditValues.${question.field}`]).toBe(
        question.options[question.options.length - 1],
      )
    }
  })

  it('preserves existing answers and defaults blank answers', () => {
    const values = withCreditValuesDefaults({
      'creditValues.q01': CREDIT_VALUES_QUESTIONS[0].options[0],
      'creditValues.q02': '   ',
      unrelatedField: 'preserved',
    })

    expect(values['creditValues.q01']).toBe(CREDIT_VALUES_QUESTIONS[0].options[0])
    expect(values['creditValues.q02']).toBe(
      CREDIT_VALUES_QUESTIONS[1].options[CREDIT_VALUES_QUESTIONS[1].options.length - 1],
    )
    expect(values.unrelatedField).toBe('preserved')
  })

  it('adds the requested Step 3 defaults without replacing saved values', () => {
    const values = withCreditValuesDefaults({
      communityReputation: 'Excellent references',
      facebookProfile: 'saved.example/profile',
      fakeNationalId: '',
      forgedPayslip: '   ',
      forgedBankStatement: '',
      identityTheftIndicator: '   ',
      sanctionsPepMatch: '',
    })

    expect(values).toMatchObject({
      lifestyleIndicator: 'Respectable lifestyle (no gambling, drinking, etc.)',
      secondaryIncomeProfile: 'No secondary income',
      communityReputation: 'Excellent references',
      professionalOrganizationMemberships: 'NA',
      professionalLicenses: '00001',
      facebookProfile: 'saved.example/profile',
      instagramProfile: 'NA',
      consentOpenBankingDataAccess: 'true',
      consentEmploymentVerification: 'true',
      consentIdentityVerification: 'true',
      faceMatchScore: '100',
      livenessDetection: 'Passed',
      bankStatementVerificationStatus: 'Matches application',
      deviceReputation: 'Trusted',
      fakeNationalId: 'false',
      forgedPayslip: 'false',
      forgedBankStatement: 'false',
      identityTheftIndicator: 'false',
      sanctionsPepMatch: 'false',
      fraudAndDocumentAuthenticityAttestation: 'true',
    })
    expect(Object.keys(STEP_3_DEFAULT_VALUES)).toHaveLength(35)
    expect(isStep3DefaultValue('professionalLicenses', '00001')).toBe(true)
    expect(isStep3DefaultValue('professionalLicenses', 'PRC-123')).toBe(false)
  })
})
