import { describe, expect, it } from 'vitest'

import type { LoanApplicationPayload } from '../src/api/loan'
import { calculateInformationProvidedPercent } from '../src/pages/scoring/applicationCompleteness'

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
      purpose: 'Working capital',
      requirements: {
        applicantPersonal: {
          firstName: 'Alex',
          lastName: 'Borrower',
          dateOfBirth: '1990-01-01',
          citizenship: 'Filipino',
          maritalStatus: 'Single',
        },
        employmentInformation: {
          employmentStatus: 'Employed',
          employerBusinessName: 'Example Company',
          occupation: 'Analyst',
          position: 'Senior Analyst',
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
          auditedFinancialStatements: true,
          proofOfRemittanceIncome: true,
          investmentStatements: true,
          additionalSupportingDocuments: true,
        },
      },
    })

    expect(calculateInformationProvidedPercent(application)).toBe(100)
  })
})
