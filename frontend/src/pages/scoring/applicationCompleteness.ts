import type { LoanApplicationPayload } from '../../api/loan'

const hasText = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0

const hasPositiveNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

export const calculateInformationProvidedPercent = (
  application: LoanApplicationPayload,
) => {
  const requirements = application.requirements
  const applicant = requirements?.applicantPersonal
  const employment = requirements?.employmentInformation
  const dueDiligence = requirements?.enhancedDueDiligence
  const documents = requirements?.supportingDocuments

  const informationChecks = [
    hasText(application.product_type),
    hasText(application.borrower_name),
    hasText(application.email),
    hasText(application.phone),
    hasText(application.gov_id),
    hasText(application.address),
    hasPositiveNumber(application.monthly_income),
    hasPositiveNumber(application.loan_amount),
    hasPositiveNumber(application.term_months),
    hasText(application.purpose),
    hasText(applicant?.firstName),
    hasText(applicant?.lastName),
    hasText(applicant?.dateOfBirth),
    hasText(applicant?.citizenship),
    hasText(applicant?.maritalStatus),
    hasText(employment?.employmentStatus),
    hasText(employment?.employerBusinessName),
    hasText(employment?.occupation),
    hasText(employment?.position),
    hasPositiveNumber(employment?.grossMonthlyIncome),
    hasText(dueDiligence?.previousLendersAndExistingLoanAccounts),
    hasText(dueDiligence?.previousLoanRestructuringDisclosures),
    hasText(dueDiligence?.employmentReferencePerson),
    hasText(dueDiligence?.hrContactInformation),
    hasText(dueDiligence?.supervisorInformation),
    hasText(dueDiligence?.additionalBankAccountsOwned),
    hasText(dueDiligence?.sourceOfIncomeVerificationReferences),
    hasText(dueDiligence?.lengthOfResidenceConfirmation),
    hasText(dueDiligence?.utilityAccountReferences),
    hasText(dueDiligence?.characterReferences),
    hasText(dueDiligence?.communityReputation),
    hasText(dueDiligence?.professionalOrganizationMemberships),
    hasText(dueDiligence?.professionalLicenses),
    hasText(dueDiligence?.guarantorReferences),
    hasText(dueDiligence?.additionalPropertyDeclarations),
    hasText(dueDiligence?.additionalVehicleDeclarations),
    hasText(dueDiligence?.selfDeclaredAssetsAndLiabilities),
    hasText(dueDiligence?.selfDeclaredInvestmentPortfolio),
    hasText(dueDiligence?.existingInsurancePolicies),
    hasText(dueDiligence?.priorBankingRelationships),
    dueDiligence?.consentOpenBankingDataAccess === true,
    dueDiligence?.consentEmploymentVerification === true,
    dueDiligence?.consentIdentityVerification === true,
    hasText(dueDiligence?.communityInvolvementInformation),
    hasText(dueDiligence?.referencesFromEmployerOrCommunity),
    documents?.auditedFinancialStatements === true,
    documents?.proofOfRemittanceIncome === true,
    documents?.investmentStatements === true,
    documents?.additionalSupportingDocuments === true,
  ]

  const providedCount = informationChecks.filter(Boolean).length
  return Math.round((providedCount / informationChecks.length) * 100)
}
