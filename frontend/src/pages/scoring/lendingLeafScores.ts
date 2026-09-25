export type LendingLeafScores = {
  creditScore: number | null
  psychometricScore: number | null
  socialScore: number | null
  nonStarterScore: number | null
  monthlyIncome: number
  monthlyDebtCommitments: number
  parsedDocumentCount: number
  totalDocumentCount: number
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function averageScore(values: Array<number | null | undefined>): number {
  const validValues = values.filter((value): value is number => typeof value === 'number')
  if (validValues.length === 0) return 0
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length
}

function mapEducationScore(education: string): number {
  switch (education.trim().toLowerCase()) {
    case 'post graduate':
    case 'postgraduate':
      return 95
    case 'college':
    case 'college graduate':
      return 85
    case 'vocational':
      return 72
    case 'high school':
      return 65
    case 'elementary':
      return 50
    default:
      return 40
  }
}

function psychometricResponseToPoints(response: string): number {
  switch (response) {
    case 'Strongly Agree':
      return 5
    case 'Agree':
      return 4
    case 'Neutral':
      return 3
    case 'Disagree':
      return 2
    case 'Strongly Disagree':
      return 1
    default:
      return 0
  }
}

function derivePsychometricScore(application: Record<string, unknown>): number | null {
  const assessment = application.psychometricAssessment
  if (assessment && typeof assessment === 'object') {
    const values = Object.values(assessment).map((response) => psychometricResponseToPoints(textValue(response)))
    const answeredValues = values.filter((value) => value > 0)
    if (answeredValues.length > 0) return Math.round((averageScore(answeredValues) / 5) * 100)
  }

  const legacyQuestionnaire = application.optionalPsychometricQuestionnaire
  if (legacyQuestionnaire && typeof legacyQuestionnaire === 'object') {
    const values = Object.values(legacyQuestionnaire).map((response) => psychometricResponseToPoints(textValue(response)))
    const answeredValues = values.filter((value) => value > 0)
    if (answeredValues.length > 0) return Math.round((averageScore(answeredValues) / 5) * 100)
  }

  return null
}

export function deriveLendingLeafScores(payload: unknown): LendingLeafScores | null {
  const applicationContainer = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null
  const application = applicationContainer?.formData
  if (!application || typeof application !== 'object') return null

  const loanApplication = application as Record<string, unknown>
  const borrower = (loanApplication.borrower as Record<string, unknown> | undefined) ?? {}
  const contactInformation = (loanApplication.contactInformation as Record<string, unknown> | undefined) ?? {}
  const addressInformation = (loanApplication.addressInformation as Record<string, unknown> | undefined) ?? {}
  const employment = (loanApplication.employment as Record<string, unknown> | undefined) ?? {}
  const otherInformation = (loanApplication.otherInformation as Record<string, unknown> | undefined) ?? {}
  const employmentInformation = (loanApplication.employmentInformation as Record<string, unknown> | undefined) ?? {}
  const applicantPersonal = (loanApplication.applicantPersonal as Record<string, unknown> | undefined) ?? {}
  const enhancedDueDiligence = (loanApplication.enhancedDueDiligence as Record<string, unknown> | undefined) ?? {}
  const bankingRelationships = (loanApplication.bankingRelationships as Record<string, unknown> | undefined) ?? {}
  const collateral = (loanApplication.collateral as Record<string, unknown> | undefined) ?? {}
  const collateralInformation = (loanApplication.collateralInformation as Record<string, unknown> | undefined) ?? {}
  const loan = (loanApplication.loan as Record<string, unknown> | undefined) ?? {}
  const coBorrowers = Array.isArray(loanApplication.coBorrowers) ? loanApplication.coBorrowers as Array<Record<string, unknown>> : []
  const additionalCollaterals = Array.isArray(loanApplication.additionalCollaterals) ? loanApplication.additionalCollaterals as Array<Record<string, unknown>> : []
  const documents = Array.isArray(loanApplication.documents) ? loanApplication.documents as Array<Record<string, unknown>> : []

  const totalCollateralValue =
    numberValue(collateral.appraisedValue) +
    numberValue(collateralInformation.propertyAppraisedValue) +
    additionalCollaterals.reduce((sum, item) => sum + numberValue(item.appraisedValue), 0)
  const totalIncome =
    numberValue(employment.monthlyIncome) +
    numberValue(employment.otherIncome) +
    coBorrowers.reduce((sum, item) => sum + numberValue(item.monthlyIncome), 0)
  const totalExistingDebt =
    numberValue(employment.debtObligations) +
    coBorrowers.reduce((sum, item) => sum + numberValue(item.debtObligations), 0)
  const monthlyRate = numberValue(loan.interestRate) / 100 / 12
  const months = numberValue(loan.termMonths)
  const principal = numberValue(loan.amount)
  const monthlyPayment = months === 0
    ? 0
    : monthlyRate === 0
      ? principal / months
      : principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
  const dsr = totalIncome > 0 ? ((totalExistingDebt + monthlyPayment) / totalIncome) * 100 : 0
  const ltv = totalCollateralValue > 0 ? (principal / totalCollateralValue) * 100 : 0

  const character = textValue(borrower.govId) ? 8 : 5
  const capacity = dsr < 30 ? 10 : dsr < 40 ? 7 : 4
  const capital = numberValue(employment.otherIncome) > 0 ? 8 : 5
  const collateralScore = ltv < 80 ? 10 : ltv < 90 ? 7 : 4
  const conditions = textValue(loan.purpose) ? 8 : 5
  const creditScore = clampScore((character + capacity + capital + collateralScore + conditions) * 2)

  const canonicalEmail = textValue(borrower.email) || textValue(contactInformation.emailAddress)
  const canonicalPhone = textValue(contactInformation.mobileNumber) || textValue(borrower.phone)
  const canonicalAddress = textValue(addressInformation.presentAddress) || textValue(borrower.address)
  const parsedDocsCount = documents.filter((document) => textValue(document.status) === 'Parsed').length
  const docsCoverage = documents.length > 0 ? parsedDocsCount / documents.length : 0
  const nonStarterScore = clampScore(
    (textValue(borrower.govId) ? 30 : 0) +
      (canonicalEmail ? 10 : 0) +
      (canonicalPhone ? 10 : 0) +
      (canonicalAddress ? 10 : 0) +
      Math.round(docsCoverage * 35) +
      (textValue(applicantPersonal.dateOfBirth) ? 5 : 0),
  )

  const residenceStabilityScore = clampScore(
    (textValue(addressInformation.lengthOfStay) ? 60 : 35) +
      (textValue(otherInformation.homeOwnership) ? 20 : 0) +
      (canonicalAddress ? 20 : 0),
  )
  const employmentStabilityScore = clampScore(
    (textValue(employmentInformation.totalYearsWorking) ? 65 : 40) +
      (textValue(employmentInformation.employmentStatus) ? 20 : 0) +
      (textValue(employmentInformation.employerBusinessName) ? 15 : 0),
  )
  const familyStabilityScore = clampScore(
    (textValue(applicantPersonal.maritalStatus) ? 45 : 25) +
      (textValue((loanApplication.spouseInformation as Record<string, unknown> | undefined)?.fullName) ? 20 : 0) +
      (typeof applicantPersonal.numberOfDependents === 'number' ? 15 : 0) +
      (textValue(enhancedDueDiligence.referencesFromEmployerOrCommunity) ? 20 : 0),
  )
  const bankingRelationshipScore = clampScore(
    (textValue(bankingRelationships.accountNumber) ? 35 : 0) +
      (numberValue(bankingRelationships.currentBalance) > 0 ? 35 : 0) +
      (textValue(bankingRelationships.creditCardNumber) ? 15 : 0) +
      (textValue(bankingRelationships.memberSince) ? 15 : 0),
  )
  const socialScore = Math.round(averageScore([
    residenceStabilityScore,
    employmentStabilityScore,
    familyStabilityScore,
    mapEducationScore(textValue(otherInformation.educationalAttainment)),
    bankingRelationshipScore,
  ]))
  const psychometricScore = derivePsychometricScore(loanApplication)

  return {
    creditScore,
    psychometricScore,
    socialScore,
    nonStarterScore,
    monthlyIncome: totalIncome,
    monthlyDebtCommitments: totalExistingDebt + monthlyPayment,
    parsedDocumentCount: parsedDocsCount,
    totalDocumentCount: documents.length,
  }
}
