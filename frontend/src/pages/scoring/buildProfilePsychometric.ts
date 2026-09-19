import { CREDIT_VALUES_QUESTIONS } from './buildProfileStep3'

export function buildPsychometricAssessment(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(CREDIT_VALUES_QUESTIONS.map((question) => {
    const selected = values[`creditValues.${question.field}`] || ''
    const optionIndex = question.options.indexOf(selected)
    return [question.field, optionIndex >= 0 ? String(Math.max(0, 4 - optionIndex)) : '']
  }))
}
