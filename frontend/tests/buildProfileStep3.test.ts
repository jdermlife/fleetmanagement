import { describe, expect, it } from 'vitest'

import {
  CREDIT_VALUES_QUESTIONS,
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
})
