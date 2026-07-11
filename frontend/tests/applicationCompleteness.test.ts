import { describe, expect, it } from 'vitest'

import type { LoanApplicationPayload } from '../src/api/loan'
import {
  calculateApplicationInformationCompletion,
  calculateInformationProvidedPercent,
} from '../src/pages/scoring/applicationCompleteness'

const asLoanApplication = (value: unknown) => value as LoanApplicationPayload

describe('calculateInformationProvidedPercent', () => {
  it('returns zero when no tracked information has been provided', () => {
    const application = asLoanApplication({
      requirements: {
        applicantPersonal: {},
        employmentInformation: {},
        enhancedDueDiligence: {},
        supportingDocuments: {},
      },
    })

    expect(calculateInformationProvidedPercent(application)).toBe(0)
  })

  it('returns one hundred when all tracked information has been provided', () => {
    const psychometricAssessment = Object.fromEntries(
      Array.from({ length: 50 }, (_, index) => [`q${index + 1}`, 'Answered']),
    )
    const application = asLoanApplication({
      product_type: 'Personal Loan',
      borrower_name: 'Alex Borrower',
      email: 'alex@example.com',
      phone: '09171234567',
      gov_id: 'ID-123',
      address: 'Makati City',
      monthly_income: 50_000,
      loan_amount: 100_000,
      term_months: 12,
      interest_rate: 8,
      purpose: 'Working capital',
      requirements: {
        applicantPersonal: {
          firstName: 'Alex',
          lastName: 'Borrower',
          dateOfBirth: '1990-01-01',
          placeOfBirth: 'Manila',
          gender: 'Female',
          citizenship: 'Filipino',
          maritalStatus: 'Single',
          mothersMaidenName: 'Sample Name',
        },
        contactInformation: { mobileNumber: '09171234567' },
        governmentIds: { tin: '123-456-789' },
        addressInformation: {
          permanentAddress: 'Makati City',
          mailingAddress: 'Makati City',
          lengthOfStay: 'Five years',
        },
        otherInformation: {
          homeOwnership: 'Own',
          educationalAttainment: 'College Degree',
          hasCoBorrower: false,
        },
        employmentInformation: {
          employmentStatus: 'Employed',
          employerBusinessName: 'Example Company',
          officeAddress: 'Makati City',
          occupation: 'Analyst',
          position: 'Senior Analyst',
          natureOfWorkBusiness: 'Financial services',
          dateHired: '2020-01-01',
          totalYearsWorking: 'Six years',
          grossMonthlyIncome: 50_000,
        },
        enhancedDueDiligence: {
          previousLendersAndExistingLoanAccounts: 'None',
          previousLoanRestructuringDisclosures: 'None',
          employmentReferencePerson: 'Reference Person',
          hrContactInformation: 'hr@example.com',
          supervisorInformation: 'Supervisor',
          additionalBankAccountsOwned: 'None',
          sourceOfIncomeVerificationReferences: 'Payslips',
          lengthOfResidenceConfirmation: 'Five years',
          utilityAccountReferences: 'Utility reference',
          characterReferences: 'Character reference',
          communityReputation: 'Good standing',
          professionalOrganizationMemberships: 'None',
          professionalLicenses: 'None',
          guarantorReferences: 'None',
          additionalPropertyDeclarations: 'None',
          additionalVehicleDeclarations: 'None',
          selfDeclaredAssetsAndLiabilities: 'Declared',
          selfDeclaredInvestmentPortfolio: 'None',
          existingInsurancePolicies: 'None',
          priorBankingRelationships: 'Declared',
          consentOpenBankingDataAccess: true,
          consentEmploymentVerification: true,
          consentIdentityVerification: true,
          communityInvolvementInformation: 'None',
          referencesFromEmployerOrCommunity: 'Reference provided',
        },
        supportingDocuments: {
          validGovernmentId: true,
          proofOfIncome: true,
          bankStatements: true,
          auditedFinancialStatements: true,
          proofOfRemittanceIncome: true,
          investmentStatements: true,
          additionalSupportingDocuments: true,
          certificateOfEmployment: true,
          latestPayslips: true,
          latestItr: true,
        },
        bankingRelationships: {
          creditPaymentHistory: 'No previous borrowing',
          accountHandling: 'Satisfactory handling',
          utilityCreditBureauStatus: 'Very satisfactory',
        },
        psychometricAssessment,
      },
    })

    expect(calculateInformationProvidedPercent(application)).toBe(100)
  })

  it('excludes non-applicable co-borrower and collateral steps from the total', () => {
    const application = asLoanApplication({
      product_type: 'Personal Loan',
      requirements: {
        applicantPersonal: { maritalStatus: 'Single' },
        otherInformation: { hasCoBorrower: false },
        psychometricAssessment: {},
        supportingDocuments: {},
      },
    })

    const completion = calculateApplicationInformationCompletion(application)

    expect(completion.steps[4]).toMatchObject({ applicable: false, percent: 100 })
    expect(completion.steps[6]).toMatchObject({ applicable: false, percent: 100 })
  })
})
