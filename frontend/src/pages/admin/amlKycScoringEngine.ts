export type AmlRiskBand = {
  minimum: number
  classification: 'Very Low Risk' | 'Low Risk' | 'Medium Risk' | 'Elevated Risk' | 'High Risk'
  dueDiligence: string
}

export type AmlAnswerOption = {
  value: string
  label: string
  score: number
}

export type AmlQuestion = {
  id: string
  section: string
  question: string
  maximumScore: number
  options: readonly AmlAnswerOption[]
}

export type AmlAssessmentResult = {
  score: number
  maximumScore: 100
  answeredCount: number
  totalQuestions: number
  complete: boolean
  classification: AmlRiskBand['classification'] | 'Assessment Incomplete'
  dueDiligence: string
}

const options = (entries: Array<[string, string, number]>): AmlAnswerOption[] =>
  entries.map(([value, label, score]) => ({ value, label, score }))

export const AML_QUESTIONS: readonly AmlQuestion[] = [
  {
    id: 'identityVerification', section: 'Customer Identity Verification', maximumScore: 15,
    question: 'How was the customer identity verified?',
    options: options([
      ['electronic-government-id', 'Government-issued ID verified electronically', 15],
      ['manual-government-id', 'Government-issued ID verified manually', 12],
      ['one-valid-id', 'One valid ID only', 8],
      ['incomplete-verification', 'Temporary ID / Incomplete verification', 3],
      ['identity-unverified', 'Identity cannot be verified', 0],
    ]),
  },
  {
    id: 'sourceOfFunds', section: 'Source of Funds', maximumScore: 15,
    question: 'What is the primary source of the customer funds?',
    options: options([
      ['documented-income', 'Regular salary/business income with supporting documents', 15],
      ['incomplete-income-documents', 'Salary/business income without complete documents', 12],
      ['documented-investments-inheritance', 'Investments or inheritance with supporting documents', 10],
      ['cash-intensive-limited-documents', 'Cash-intensive business with limited documentation', 5],
      ['unknown-funds', 'Unknown / Cannot be explained', 0],
    ]),
  },
  {
    id: 'sourceOfWealth', section: 'Source of Wealth', maximumScore: 10,
    question: 'Can the customer accumulated wealth be reasonably explained?',
    options: options([
      ['fully-documented', 'Fully documented', 10],
      ['mostly-documented', 'Mostly documented', 8],
      ['partially-documented', 'Partially documented', 5],
      ['limited-explanation', 'Limited explanation', 2],
      ['cannot-explain', 'Cannot explain', 0],
    ]),
  },
  {
    id: 'pepScreening', section: 'Politically Exposed Person Screening', maximumScore: 10,
    question: 'Is the customer a PEP or closely related to one?',
    options: options([
      ['not-pep', 'No', 10],
      ['former-pep', 'Former PEP (more than 5 years)', 8],
      ['family-former-pep', 'Immediate family of former PEP', 6],
      ['family-current-pep', 'Immediate family of current PEP', 3],
      ['current-pep', 'Current PEP', 0],
    ]),
  },
  {
    id: 'sanctionsScreening', section: 'Sanctions Screening', maximumScore: 15,
    question: 'Did sanctions screening identify any matches?',
    options: options([
      ['no-match', 'No sanctions match', 15],
      ['false-positive-cleared', 'False positive cleared', 12],
      ['potential-match', 'Potential match under review', 6],
      ['confirmed-match', 'Confirmed sanctions match', 0],
    ]),
  },
  {
    id: 'adverseMedia', section: 'Adverse Media Screening', maximumScore: 10,
    question: 'Has the customer appeared in adverse media related to financial crimes?',
    options: options([
      ['none', 'None', 10],
      ['minor-civil', 'Minor civil issues', 8],
      ['unrelated-negative-media', 'Negative media unrelated to financial crime', 5],
      ['financial-crime-allegations', 'Financial crime allegations', 2],
      ['financial-crime-conviction', 'Confirmed financial crime conviction', 0],
    ]),
  },
  {
    id: 'geographicRisk', section: 'Geographic Risk', maximumScore: 10,
    question: 'Where is the primary country of residence or business?',
    options: options([
      ['low-risk', 'Low-risk jurisdiction', 10],
      ['medium-risk', 'Medium-risk jurisdiction', 8],
      ['high-risk', 'High-risk jurisdiction', 4],
      ['fatf-grey-list', 'FATF Increased Monitoring (Grey List)', 2],
      ['fatf-black-list', 'FATF High-Risk (Black List)', 0],
    ]),
  },
  {
    id: 'natureOfBusiness', section: 'Nature of Business', maximumScore: 5,
    question: 'What best describes the customer occupation or business?',
    options: options([
      ['salaried', 'Salaried employee', 5],
      ['professional', 'Registered professional', 5],
      ['corporation', 'Registered corporation', 4],
      ['cash-intensive', 'Cash-intensive business', 2],
      ['high-risk-business', 'High-risk business', 0],
    ]),
  },
  {
    id: 'transactionProfile', section: 'Transaction Profile', maximumScore: 5,
    question: 'How do expected transactions compare with the customer income profile?',
    options: options([
      ['fully-consistent', 'Fully consistent', 5],
      ['slightly-higher', 'Slightly higher than expected', 4],
      ['moderately-inconsistent', 'Moderately inconsistent', 2],
      ['highly-unusual', 'Highly unusual', 0],
    ]),
  },
  {
    id: 'beneficialOwnership', section: 'Beneficial Ownership', maximumScore: 5,
    question: 'Who is the beneficial owner of the account?',
    options: options([
      ['customer-sole-owner', 'Customer is sole beneficial owner', 5],
      ['fully-disclosed', 'Ownership fully disclosed', 4],
      ['complex-documented', 'Complex ownership but documented', 2],
      ['unknown-owner', 'Beneficial owner unknown', 0],
    ]),
  },
] as const

export const AML_RISK_BANDS: readonly AmlRiskBand[] = [
  { minimum: 90, classification: 'Very Low Risk', dueDiligence: 'Simplified Due Diligence (SDD)' },
  { minimum: 80, classification: 'Low Risk', dueDiligence: 'Standard Customer Due Diligence (CDD)' },
  { minimum: 70, classification: 'Medium Risk', dueDiligence: 'Standard CDD with additional verification' },
  { minimum: 60, classification: 'Elevated Risk', dueDiligence: 'Enhanced Due Diligence (EDD)' },
  { minimum: 0, classification: 'High Risk', dueDiligence: 'Full EDD + Senior Management Approval' },
] as const

export function computeAmlRiskAssessment(answers: Record<string, string>): AmlAssessmentResult {
  const answeredQuestions = AML_QUESTIONS.filter((question) => answers[question.id])
  const score = answeredQuestions.reduce((total, question) => {
    return total + (question.options.find((option) => option.value === answers[question.id])?.score ?? 0)
  }, 0)
  const complete = answeredQuestions.length === AML_QUESTIONS.length
  const band = AML_RISK_BANDS.find((candidate) => score >= candidate.minimum) ?? AML_RISK_BANDS[AML_RISK_BANDS.length - 1]

  return {
    score,
    maximumScore: 100,
    answeredCount: answeredQuestions.length,
    totalQuestions: AML_QUESTIONS.length,
    complete,
    classification: complete ? band.classification : 'Assessment Incomplete',
    dueDiligence: complete ? band.dueDiligence : 'Complete all questions to determine due diligence.',
  }
}