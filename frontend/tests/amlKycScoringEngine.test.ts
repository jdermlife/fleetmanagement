import { describe, expect, it } from 'vitest'

import {
  AML_QUESTIONS,
  computeAmlRiskAssessment,
} from '../src/pages/admin/amlKycScoringEngine'

const answersForScore = (choices: number[]) => Object.fromEntries(
  AML_QUESTIONS.map((question, index) => [question.id, question.options[choices[index]].value]),
)

describe('AML KYC scoring engine', () => {
  it('totals the ten maximum answers to 100 points', () => {
    expect(computeAmlRiskAssessment(answersForScore(Array(10).fill(0)))).toMatchObject({
      score: 100,
      complete: true,
      classification: 'Very Low Risk',
      dueDiligence: 'Simplified Due Diligence (SDD)',
    })
  })

  it.each([
    [90, 'Very Low Risk'],
    [89, 'Low Risk'],
    [80, 'Low Risk'],
    [79, 'Medium Risk'],
    [70, 'Medium Risk'],
    [69, 'Elevated Risk'],
    [60, 'Elevated Risk'],
    [59, 'High Risk'],
  ])('classifies a complete score of %i as %s', (targetScore, classification) => {
    const answerOptions = AML_QUESTIONS.map((question) => question.options)
    let matchingAnswers: Record<string, string> | null = null

    const search = (index: number, score: number, answers: Record<string, string>) => {
      if (matchingAnswers || score > targetScore) return
      if (index === answerOptions.length) {
        if (score === targetScore) matchingAnswers = answers
        return
      }
      for (const option of answerOptions[index]) {
        search(index + 1, score + option.score, { ...answers, [AML_QUESTIONS[index].id]: option.value })
      }
    }
    search(0, 0, {})

    expect(matchingAnswers).not.toBeNull()
    expect(computeAmlRiskAssessment(matchingAnswers!).classification).toBe(classification)
  })

  it('does not classify an incomplete assessment', () => {
    expect(computeAmlRiskAssessment({ identityVerification: 'electronic-government-id' })).toMatchObject({
      score: 15,
      answeredCount: 1,
      complete: false,
      classification: 'Assessment Incomplete',
    })
  })
})