import type { LoanApplicationPayload } from '../../api/loan'

export const CREDIT_RATING_MINIMUM_INFORMATION_PERCENT = 70

export type InformationStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type StepInformationCompletion = {
  applicable: boolean
  percent: number
  provided: number
  step: InformationStepNumber
  total: number
}

export type ApplicationInformationCompletion = {
  overallPercent: number
  provided: number
  steps: Record<InformationStepNumber, StepInformationCompletion>
  total: number
}

const hasText = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0

const hasPositiveNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const calculateStep = (
  step: InformationStepNumber,
  checks: boolean[],
  applicable = true,
): StepInformationCompletion => {
  if (!applicable) {
    return { applicable: false, percent: 100, provided: 0, step, total: 0 }
  }

  const provided = checks.filter(Boolean).length
  const total = checks.length
  return {
    applicable: true,
    percent: total > 0 ? Math.round((provided / total) * 100) : 0,
    provided,
    step,
    total,
  }
}

export const calculateApplicationInformationCompletion = (
  application: LoanApplicationPayload,
) : ApplicationInformationCompletion => {
  const requirements = application.requirements
  const applicant = requirements?.applicantPersonal
  const contact = requirements?.contactInformation
  const governmentIds = requirements?.governmentIds
  const addresses = requirements?.addressInformation
  const otherInformation = requirements?.otherInformation
  const employment = requirements?.employmentInformation
  const dueDiligence = requirements?.enhancedDueDiligence
  const documents = requirements?.supportingDocuments
  const spouse = requirements?.spouseInformation
  const coBorrowers = requirements?.coBorrowers ?? []
  const banking = requirements?.bankingRelationships
  const collateral = requirements?.collateralAssetDetails
  const property = requirements?.collateralInformation
  const productType = application.product_type

  const step1Checks = [
    hasText(productType),
    hasText(application.purpose),
    hasPositiveNumber(application.loan_amount),
    hasPositiveNumber(application.term_months),
    hasPositiveNumber(application.interest_rate),
  ]

  const step2Checks = [
    hasText(application.borrower_name),
    hasText(application.email),
    hasText(application.phone),
    hasText(application.gov_id),
    hasText(application.address),
    hasText(applicant?.firstName),
    hasText(applicant?.lastName),
    hasText(applicant?.dateOfBirth),
    hasText(applicant?.placeOfBirth),
    hasText(applicant?.gender),
    hasText(applicant?.citizenship),
    hasText(applicant?.maritalStatus),
    hasText(applicant?.mothersMaidenName),
    hasText(contact?.mobileNumber),
    hasText(addresses?.permanentAddress),
    hasText(addresses?.mailingAddress),
    hasText(addresses?.lengthOfStay),
    hasText(otherInformation?.homeOwnership),
    hasText(otherInformation?.educationalAttainment),
    hasText(governmentIds?.tin) ||
      hasText(governmentIds?.sssGsisNumber) ||
      hasText(governmentIds?.idNumber),
  ]

  const psychometricChecks = Object.values(requirements?.psychometricAssessment ?? {})
  const normalizedPsychometricChecks = psychometricChecks.length > 0
    ? psychometricChecks.map(hasText)
    : Array.from({ length: 50 }, () => false)

  const step3Checks = [
    hasPositiveNumber(application.monthly_income),
    hasText(employment?.employmentStatus),
    hasText(employment?.employerBusinessName),
    hasText(employment?.officeAddress),
    hasText(employment?.occupation),
    hasText(employment?.position),
    hasText(employment?.natureOfWorkBusiness),
    hasText(employment?.dateHired),
    hasText(employment?.totalYearsWorking),
    hasPositiveNumber(employment?.grossMonthlyIncome),
    hasText(dueDiligence?.employmentReferencePerson),
    hasText(dueDiligence?.hrContactInformation),
    hasText(dueDiligence?.supervisorInformation),
    hasText(dueDiligence?.sourceOfIncomeVerificationReferences),
    hasText(dueDiligence?.lengthOfResidenceConfirmation),
    hasText(dueDiligence?.utilityAccountReferences),
    hasText(dueDiligence?.characterReferences),
    hasText(dueDiligence?.guarantorReferences),
    hasText(dueDiligence?.referencesFromEmployerOrCommunity),
    hasText(dueDiligence?.communityReputation),
    hasText(dueDiligence?.professionalOrganizationMemberships),
    hasText(dueDiligence?.professionalLicenses),
    hasText(dueDiligence?.additionalPropertyDeclarations),
    hasText(dueDiligence?.additionalVehicleDeclarations),
    hasText(dueDiligence?.communityInvolvementInformation),
    dueDiligence?.consentOpenBankingDataAccess === true,
    dueDiligence?.consentEmploymentVerification === true,
    dueDiligence?.consentIdentityVerification === true,
    ...normalizedPsychometricChecks,
  ]

  const married = applicant?.maritalStatus?.trim().toLowerCase() === 'married'
  const hasCoBorrower = otherInformation?.hasCoBorrower === true
  const spouseChecks = married
    ? [
        hasText(spouse?.fullName),
        hasText(spouse?.dateOfBirth),
        hasText(spouse?.citizenship),
        hasText(spouse?.mobileNumber),
        hasText(spouse?.presentAddress),
        hasText(spouse?.employerBusinessName),
        hasText(spouse?.occupation),
        hasText(spouse?.position),
        hasText(spouse?.natureOfWork),
        hasText(spouse?.yearsWithEmployer),
        hasPositiveNumber(spouse?.grossMonthlyIncome),
      ]
    : []
  const coBorrowerChecks = hasCoBorrower
    ? coBorrowers.length > 0
      ? coBorrowers.flatMap((coBorrower) => [
          hasText(coBorrower.name),
          hasText(coBorrower.relationship),
          hasPositiveNumber(coBorrower.monthlyIncome),
          hasText(coBorrower.creditStanding),
        ])
      : [false, false, false, false]
    : []
  const step4Applicable = married || hasCoBorrower
  const step4Checks = [...spouseChecks, ...coBorrowerChecks]

  const step5Checks = [
    hasText(dueDiligence?.previousLendersAndExistingLoanAccounts),
    hasText(dueDiligence?.previousLoanRestructuringDisclosures),
    hasText(dueDiligence?.additionalBankAccountsOwned),
    hasText(dueDiligence?.priorBankingRelationships),
    hasText(dueDiligence?.existingInsurancePolicies),
    hasText(dueDiligence?.selfDeclaredAssetsAndLiabilities),
    hasText(dueDiligence?.selfDeclaredInvestmentPortfolio),
    hasText(banking?.creditPaymentHistory),
    hasText(banking?.accountHandling),
    hasText(banking?.utilityCreditBureauStatus),
  ]

  const unsecuredProduct = productType === 'Personal Loan' || productType === 'Credit Card'
  const homeCollateralChecks = productType === 'Home Loan'
    ? [
        hasText(property?.propertyAddress),
        hasText(property?.registeredOwner),
        hasText(property?.lotNumber),
        hasText(property?.tctCctNumber),
        hasText(property?.propertyMarketabilityCategory),
        hasText(property?.houseUnitModelCategory),
        hasText(property?.collateralOccupancyType),
        hasPositiveNumber(property?.propertyAppraisedValue),
      ]
    : []
  const vehicleCollateralChecks = productType === 'Auto Loan' || productType === 'Motorcycle Loan'
    ? [
        hasText(collateral?.assetType),
        hasText(collateral?.maker),
        hasText(collateral?.brand),
        hasText(collateral?.model),
        hasText(collateral?.year),
        hasPositiveNumber(application.appraised_value),
        ...(productType === 'Auto Loan'
          ? [
              hasText(collateral?.vehicleMarketabilityCategory),
              hasText(collateral?.vehicleConditionCategory),
              hasText(collateral?.vehicleTypeCategory),
              hasText(collateral?.insuranceProviderCompany),
              hasText(collateral?.policyNumber),
            ]
          : [hasText(collateral?.motorcycleIntendedUse)]),
      ]
    : []
  const additionalCollateralChecks = (collateral?.additionalCollaterals ?? []).flatMap(
    (additionalCollateral) => [
      hasText(additionalCollateral.collateralType),
      hasText(additionalCollateral.maker),
      hasText(additionalCollateral.brand),
      hasText(additionalCollateral.model),
      hasText(additionalCollateral.year),
      hasPositiveNumber(additionalCollateral.appraisedValue),
    ],
  )
  const step6Checks = [
    ...homeCollateralChecks,
    ...vehicleCollateralChecks,
    ...additionalCollateralChecks,
  ]

  const step7Checks = [
    documents?.validGovernmentId === true,
    documents?.proofOfIncome === true,
    documents?.bankStatements === true,
    documents?.additionalSupportingDocuments === true,
    documents?.auditedFinancialStatements === true,
    documents?.proofOfRemittanceIncome === true,
    documents?.investmentStatements === true,
    ...(productType === 'Home Loan'
      ? [
          documents?.titleTctCct === true,
          documents?.taxDeclaration === true,
          documents?.lotPlan === true,
          documents?.propertyPhotos === true,
        ]
      : []),
    ...(productType === 'Auto Loan' || productType === 'Motorcycle Loan'
      ? [documents?.vehicleQuotation === true, documents?.vehicleInvoice === true]
      : []),
    ...(productType === 'Personal Loan'
      ? [
          documents?.certificateOfEmployment === true,
          documents?.latestPayslips === true,
          documents?.latestItr === true,
        ]
      : []),
  ]

  const steps = {
    1: calculateStep(1, step1Checks),
    2: calculateStep(2, step2Checks),
    3: calculateStep(3, step3Checks),
    4: calculateStep(4, step4Checks, step4Applicable),
    5: calculateStep(5, step5Checks),
    6: calculateStep(6, step6Checks, !unsecuredProduct),
    7: calculateStep(7, step7Checks),
  } satisfies Record<InformationStepNumber, StepInformationCompletion>

  const applicableSteps = Object.values(steps).filter((step) => step.applicable)
  const provided = applicableSteps.reduce((total, step) => total + step.provided, 0)
  const total = applicableSteps.reduce((sum, step) => sum + step.total, 0)

  return {
    overallPercent: total > 0 ? Math.round((provided / total) * 100) : 0,
    provided,
    steps,
    total,
  }
}

export const calculateInformationProvidedPercent = (application: LoanApplicationPayload) =>
  calculateApplicationInformationCompletion(application).overallPercent
