import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { api, getErrorMessage } from '../../api';
import {
  createLoanApplication,
  fetchLoanApplication,
  updateLoanApplication,
  updateLoanApplicationStatus,
  type LoanApplicationRequirements,
  type LoanApplicationPayload,
  type LoanApplicationRecord,
  type ProductType,
  type WorkflowStatus,
} from '../../api/loan';

// --- TypeScript Interfaces (PostgreSQL Schema Mapping) ---
interface BorrowerInfo { fullName: string; email: string; phone: string; govId: string; address: string; }
interface CoBorrower { id: string; name: string; relationship: string; monthlyIncome: number; debtObligations: number; creditStanding: string; }
interface Employment { history: string; monthlyIncome: number; otherIncome: number; debtObligations: number; }
interface LoanDetails { amount: number; termMonths: number; interestRate: number; purpose: string; productType: ProductType; }
interface Collateral { vehicleInfo: string; appraisedValue: number; insurance: string; registration: string; }
interface ApplicantPersonal { lastName: string; firstName: string; middleName: string; dateOfBirth: string; placeOfBirth: string; age: number; gender: string; citizenship: string; numberOfDependents: number; maritalStatus: string; mothersMaidenName: string; }
interface ContactInformation { mobileNumber: string; homePhoneNumber: string; emailAddress: string; }
interface GovernmentIds { tin: string; sssGsisNumber: string; otherGovernmentId: string; idNumber: string; issueDate: string; expiryDate: string; }
interface AddressInformation { presentAddress: string; permanentAddress: string; mailingAddress: string; lengthOfStay: string; }
interface OtherInformation { homeOwnership: string; educationalAttainment: string; numberOfVehiclesOwned: number; recentPhotoUploaded: boolean; }
interface EmploymentInformation { employmentStatus: string; employerBusinessName: string; officeAddress: string; occupation: string; position: string; natureOfWorkBusiness: string; dateHired: string; officePhoneNumber: string; previousEmployer: string; totalYearsWorking: string; grossMonthlyIncome: number; monthlyLivingExpenses: number; otherSourcesOfIncome: number; investmentIncome: number; businessIncome: number; pensionIncome: number; otherIncome: string; }
interface CollateralInformation { propertyAddress: string; registeredOwner: string; lotNumber: string; blockNumber: string; tctCctNumber: string; }
interface SpouseInformation { fullName: string; dateOfBirth: string; placeOfBirth: string; citizenship: string; mobileNumber: string; presentAddress: string; employerBusinessName: string; officeAddress: string; occupation: string; position: string; natureOfWork: string; yearsWithEmployer: string; previousEmployer: string; totalYearsWorking: string; grossMonthlyIncome: number; monthlyExpenses: number; otherIncomeSources: string; }
interface BankingRelationships { creditCardIssuer: string; creditCardNumber: string; creditLimit: number; outstandingBalance: number; memberSince: string; bankBranch: string; accountType: string; accountNumber: string; currentBalance: number; loanLender: string; loanType: string; loanCurrentBalance: number; loanMonthlyAmortization: number; }
interface Signatures { applicantSignature: string; spouseOrCoBorrowerSignature: string; borrowerSignatureAutoLoanInsurance: string; extensionCardholderSignature: string; }
interface SupportingDocuments { validGovernmentId: boolean; passportIfApplicable: boolean; driversLicense: boolean; philSysId: boolean; certificateOfEmployment: boolean; latestPayslips: boolean; latestItr: boolean; dtiSecRegistration: boolean; businessPermit: boolean; financialStatements: boolean; utilityBill: boolean; waterBill: boolean; internetBill: boolean; titleTctCct: boolean; taxDeclaration: boolean; lotPlan: boolean; propertyPhotos: boolean; vehicleQuotation: boolean; vehicleInvoice: boolean; orCrForRefinancing: boolean; proofOfIncome: boolean; bankStatements: boolean; existingCreditCardStatements: boolean; additionalSupportingDocuments: boolean; auditedFinancialStatements: boolean; proofOfRemittanceIncome: boolean; investmentStatements: boolean; }
interface EnhancedDueDiligence { previousLendersAndExistingLoanAccounts: string; numberOfActiveLoans: number; previousLoanRestructuringDisclosures: string; employmentReferencePerson: string; hrContactInformation: string; supervisorInformation: string; additionalBankAccountsOwned: string; sourceOfIncomeVerificationReferences: string; lengthOfResidenceConfirmation: string; utilityAccountReferences: string; characterReferences: string; professionalOrganizationMemberships: string; professionalLicenses: string; facebookProfile: string; instagramProfile: string; xProfile: string; tikTokProfile: string; linkedInProfile: string; otherSocialMediaLinks: string; businessWebsite: string; guarantorReferences: string; coBorrowerReferences: string; additionalPropertyDeclarations: string; additionalVehicleDeclarations: string; selfDeclaredAssetsAndLiabilities: string; selfDeclaredInvestmentPortfolio: string; existingInsurancePolicies: string; priorBankingRelationships: string; consentOpenBankingDataAccess: boolean; consentEmploymentVerification: boolean; consentIdentityVerification: boolean; psychometricQuestionnaireResponses: string; financialBehaviorQuestionnaireResponses: string; riskAppetiteQuestionnaireResponses: string; businessOutlookQuestionnaireResponses: string; futureFinancialPlansQuestionnaire: string; spendingBehaviorQuestionnaire: string; householdBudgetingQuestionnaire: string; emergencyPreparednessQuestionnaire: string; characterAndIntegrityAssessmentAnswers: string; communityInvolvementInformation: string; referencesFromEmployerOrCommunity: string; }
interface OptionalPsychometricQuestionnaire { question01: string; question02: string; question03: string; question04: string; question05: string; question06: string; question07: string; question08: string; question09: string; question10: string; question11: string; question12: string; question13: string; question14: string; question15: string; question16: string; question17: string; question18: string; question19: string; question20: string; }
interface DocumentItem { id: string; name: string; type: string; parsedData?: string; status: 'Pending' | 'Parsed' | 'Failed'; }
interface Disbursement { bankAccount: string; accountNumber: string; disbursementDate: string; bookingDate: string; startRepaymentDate: string; firstPaymentDate: string; }
interface FinalChecklist { allRequiredDocumentsProvided: boolean; allSignaturesCollected: boolean; creditCommitteeApproved: boolean; executiveApprovalObtained: boolean; collateralDocumentationReady: boolean; }

interface LoanApplication {
  id: string;
  status: WorkflowStatus;
  productType: ProductType;
  borrower: BorrowerInfo;
  coBorrowers: CoBorrower[];
  employment: Employment;
  loan: LoanDetails;
  collateral: Collateral;
  applicantPersonal: ApplicantPersonal;
  contactInformation: ContactInformation;
  governmentIds: GovernmentIds;
  addressInformation: AddressInformation;
  otherInformation: OtherInformation;
  employmentInformation: EmploymentInformation;
  collateralInformation: CollateralInformation;
  spouseInformation: SpouseInformation;
  bankingRelationships: BankingRelationships;
  signatures: Signatures;
  supportingDocuments: SupportingDocuments;
  enhancedDueDiligence: EnhancedDueDiligence;
  optionalPsychometricQuestionnaire: OptionalPsychometricQuestionnaire;
  documents: DocumentItem[];
  committeeRemarks: string;
  routing: { creditOfficer: string; branchManager: string; creditCommittee: string; executiveApproval: boolean; };
  disbursement: Disbursement;
  finalChecklist?: FinalChecklist;
  releaseNotes?: string;
}

type ParsedSectionUpdates = {
  borrower?: Partial<BorrowerInfo>;
  applicantPersonal?: Partial<ApplicantPersonal>;
  contactInformation?: Partial<ContactInformation>;
  governmentIds?: Partial<GovernmentIds>;
  addressInformation?: Partial<AddressInformation>;
  employment?: Partial<Employment>;
  employmentInformation?: Partial<EmploymentInformation>;
  collateralInformation?: Partial<CollateralInformation>;
  otherInformation?: Partial<OtherInformation>;
};

interface DocumentParseReview {
  documentName: string;
  documentType: string;
  confidence: number;
  summary: string;
  notes: string[];
  supportingDocuments: Partial<SupportingDocuments>;
  extractedData: ParsedSectionUpdates;
}

// --- Initial State Factory ---
const createNewApplicationInstance = (): LoanApplication => ({
  id: 'APP-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
  status: 'Draft',
  productType: 'Auto Loan',
  borrower: { fullName: '', email: '', phone: '', govId: '', address: '' },
  coBorrowers: [],
  employment: { history: '', monthlyIncome: 0, otherIncome: 0, debtObligations: 0 },
  loan: { amount: 0, termMonths: 12, interestRate: 5.5, purpose: '', productType: 'Auto Loan' },
  collateral: { vehicleInfo: '', appraisedValue: 0, insurance: '', registration: '' },
  applicantPersonal: { lastName: '', firstName: '', middleName: '', dateOfBirth: '', placeOfBirth: '', age: 0, gender: '', citizenship: '', numberOfDependents: 0, maritalStatus: '', mothersMaidenName: '' },
  contactInformation: { mobileNumber: '', homePhoneNumber: '', emailAddress: '' },
  governmentIds: { tin: '', sssGsisNumber: '', otherGovernmentId: '', idNumber: '', issueDate: '', expiryDate: '' },
  addressInformation: { presentAddress: '', permanentAddress: '', mailingAddress: '', lengthOfStay: '' },
  otherInformation: { homeOwnership: '', educationalAttainment: '', numberOfVehiclesOwned: 0, recentPhotoUploaded: false },
  employmentInformation: { employmentStatus: '', employerBusinessName: '', officeAddress: '', occupation: '', position: '', natureOfWorkBusiness: '', dateHired: '', officePhoneNumber: '', previousEmployer: '', totalYearsWorking: '', grossMonthlyIncome: 0, monthlyLivingExpenses: 0, otherSourcesOfIncome: 0, investmentIncome: 0, businessIncome: 0, pensionIncome: 0, otherIncome: '' },
  collateralInformation: { propertyAddress: '', registeredOwner: '', lotNumber: '', blockNumber: '', tctCctNumber: '' },
  spouseInformation: { fullName: '', dateOfBirth: '', placeOfBirth: '', citizenship: '', mobileNumber: '', presentAddress: '', employerBusinessName: '', officeAddress: '', occupation: '', position: '', natureOfWork: '', yearsWithEmployer: '', previousEmployer: '', totalYearsWorking: '', grossMonthlyIncome: 0, monthlyExpenses: 0, otherIncomeSources: '' },
  bankingRelationships: { creditCardIssuer: '', creditCardNumber: '', creditLimit: 0, outstandingBalance: 0, memberSince: '', bankBranch: '', accountType: '', accountNumber: '', currentBalance: 0, loanLender: '', loanType: '', loanCurrentBalance: 0, loanMonthlyAmortization: 0 },
  signatures: { applicantSignature: '', spouseOrCoBorrowerSignature: '', borrowerSignatureAutoLoanInsurance: '', extensionCardholderSignature: '' },
  supportingDocuments: { validGovernmentId: false, passportIfApplicable: false, driversLicense: false, philSysId: false, certificateOfEmployment: false, latestPayslips: false, latestItr: false, dtiSecRegistration: false, businessPermit: false, financialStatements: false, utilityBill: false, waterBill: false, internetBill: false, titleTctCct: false, taxDeclaration: false, lotPlan: false, propertyPhotos: false, vehicleQuotation: false, vehicleInvoice: false, orCrForRefinancing: false, proofOfIncome: false, bankStatements: false, existingCreditCardStatements: false, additionalSupportingDocuments: false, auditedFinancialStatements: false, proofOfRemittanceIncome: false, investmentStatements: false },
  enhancedDueDiligence: { previousLendersAndExistingLoanAccounts: '', numberOfActiveLoans: 0, previousLoanRestructuringDisclosures: '', employmentReferencePerson: '', hrContactInformation: '', supervisorInformation: '', additionalBankAccountsOwned: '', sourceOfIncomeVerificationReferences: '', lengthOfResidenceConfirmation: '', utilityAccountReferences: '', characterReferences: '', professionalOrganizationMemberships: '', professionalLicenses: '', facebookProfile: '', instagramProfile: '', xProfile: '', tikTokProfile: '', linkedInProfile: '', otherSocialMediaLinks: '', businessWebsite: '', guarantorReferences: '', coBorrowerReferences: '', additionalPropertyDeclarations: '', additionalVehicleDeclarations: '', selfDeclaredAssetsAndLiabilities: '', selfDeclaredInvestmentPortfolio: '', existingInsurancePolicies: '', priorBankingRelationships: '', consentOpenBankingDataAccess: false, consentEmploymentVerification: false, consentIdentityVerification: false, psychometricQuestionnaireResponses: '', financialBehaviorQuestionnaireResponses: '', riskAppetiteQuestionnaireResponses: '', businessOutlookQuestionnaireResponses: '', futureFinancialPlansQuestionnaire: '', spendingBehaviorQuestionnaire: '', householdBudgetingQuestionnaire: '', emergencyPreparednessQuestionnaire: '', characterAndIntegrityAssessmentAnswers: '', communityInvolvementInformation: '', referencesFromEmployerOrCommunity: '' },
  optionalPsychometricQuestionnaire: { question01: '', question02: '', question03: '', question04: '', question05: '', question06: '', question07: '', question08: '', question09: '', question10: '', question11: '', question12: '', question13: '', question14: '', question15: '', question16: '', question17: '', question18: '', question19: '', question20: '' },
  documents: [],
  committeeRemarks: '',
  routing: { creditOfficer: '', branchManager: '', creditCommittee: 'Pending', executiveApproval: false },
  disbursement: { bankAccount: '', accountNumber: '', disbursementDate: '', bookingDate: '', startRepaymentDate: '', firstPaymentDate: '' },
  finalChecklist: { allRequiredDocumentsProvided: false, allSignaturesCollected: false, creditCommitteeApproved: false, executiveApprovalObtained: false, collateralDocumentationReady: false },
  releaseNotes: '',
});

const buildLoanRequirements = (
  application: LoanApplication,
): LoanApplicationRequirements => ({
  productInformation: {
    productType: application.loan.productType,
    homePurposeOfLoan: application.loan.purpose,
    homeDesiredLoanAmount: application.loan.amount,
    homeLoanTerm: application.loan.termMonths,
    homeCollateralType: application.collateral.vehicleInfo,
    autoPurpose: application.loan.purpose,
    autoVehicleClassification: application.loan.productType,
    autoUnitModel: application.collateral.vehicleInfo,
    autoYearModel: application.loan.termMonths.toString(),
    autoSellingPrice: application.collateral.appraisedValue,
    autoDesiredLoanAmount: application.loan.amount,
    autoDownPayment: 0,
    autoYearsToPay: Math.max(1, Math.round(application.loan.termMonths / 12)),
    creditCardType: application.loan.purpose,
    creditCardExtensionRequested:
      application.signatures.extensionCardholderSignature.length > 0,
  },
  applicantPersonal: application.applicantPersonal,
  contactInformation: application.contactInformation,
  governmentIds: application.governmentIds,
  addressInformation: application.addressInformation,
  otherInformation: application.otherInformation,
  employmentInformation: application.employmentInformation,
  collateralInformation: application.collateralInformation,
  spouseInformation: application.spouseInformation,
  bankingRelationships: application.bankingRelationships,
  signatures: application.signatures,
  supportingDocuments: application.supportingDocuments,
  enhancedDueDiligence: application.enhancedDueDiligence,
  optionalPsychometricQuestionnaire: application.optionalPsychometricQuestionnaire,
});

const calculateLoanMetrics = (application: LoanApplication) => {
  const totalIncome =
    application.employment.monthlyIncome +
    application.employment.otherIncome +
    application.coBorrowers.reduce((sum, cb) => sum + cb.monthlyIncome, 0);

  const totalExistingDebt =
    application.employment.debtObligations +
    application.coBorrowers.reduce((sum, cb) => sum + cb.debtObligations, 0);

  const r = application.loan.interestRate / 100 / 12;
  const n = application.loan.termMonths;
  const p = application.loan.amount;
  const monthlyPayment =
    n === 0
      ? 0
      : r === 0
        ? p / n
        : p * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  const dti = totalIncome > 0 ? (totalExistingDebt / totalIncome) * 100 : 0;
  const dsr =
    totalIncome > 0
      ? ((totalExistingDebt + monthlyPayment) / totalIncome) * 100
      : 0;
  const ltv =
    application.collateral.appraisedValue > 0
      ? (application.loan.amount / application.collateral.appraisedValue) * 100
      : 0;

  return { totalIncome, totalExistingDebt, monthlyPayment, dti, dsr, ltv };
};

const calculateAutomatedScorecard = (
  application: LoanApplication,
  calculations: ReturnType<typeof calculateLoanMetrics>,
) => {
  const character = application.borrower.govId ? 8 : 5;
  const capacity = calculations.dsr < 30 ? 10 : calculations.dsr < 40 ? 7 : 4;
  const capital = application.employment.otherIncome > 0 ? 8 : 5;
  const collateral = calculations.ltv < 80 ? 10 : calculations.ltv < 90 ? 7 : 4;
  const conditions = application.loan.purpose ? 8 : 5;
  const total = character + capacity + capital + collateral + conditions;

  return { character, capacity, capital, collateral, conditions, total };
};

const calculateCreditRiskInsights = (
  application: LoanApplication,
  calculations: ReturnType<typeof calculateLoanMetrics>,
  automatedTotal: number,
) => {
  const parsedDocsCount = application.documents.filter(
    (doc) => doc.status === 'Parsed',
  ).length;
  const docsCoverage =
    application.documents.length > 0
      ? parsedDocsCount / application.documents.length
      : 0;

  const fraudScore = Math.max(
    0,
    Math.min(
      100,
      (application.borrower.govId ? 30 : 0) +
        (application.borrower.email ? 10 : 0) +
        (application.borrower.phone ? 10 : 0) +
        (application.borrower.address ? 10 : 0) +
        Math.round(docsCoverage * 35) +
        (application.applicantPersonal.dateOfBirth ? 5 : 0),
    ),
  );

  const nonStarterScore = Math.max(
    0,
    Math.min(
      100,
      (application.loan.amount > 0 ? 20 : 0) +
        (application.collateral.appraisedValue > 0 ? 20 : 0) +
        (application.loan.productType ? 10 : 0) +
        (calculations.totalIncome > 0 ? 20 : 0) +
        (calculations.dsr < 60 ? 15 : 0) +
        (parsedDocsCount >= 2 ? 15 : 0),
    ),
  );

  const riskScore = Math.max(
    0,
    Math.min(
      100,
      calculations.dsr * 0.4 +
        calculations.ltv * 0.3 +
        (50 - automatedTotal) * 2 +
        (parsedDocsCount === 0 ? 10 : 0),
    ),
  );

  const grossRevenue =
    application.loan.amount *
    (application.loan.interestRate / 100) *
    Math.max(1, application.loan.termMonths / 12);
  const expectedLoss = application.loan.amount * (riskScore / 100) * 0.08;
  const processingCost = Math.max(150, application.loan.amount * 0.005);
  const originationProfitability = grossRevenue - expectedLoss - processingCost;
  const originationMargin =
    grossRevenue > 0 ? (originationProfitability / grossRevenue) * 100 : 0;

  return {
    fraudScore,
    nonStarterScore,
    riskScore,
    originationProfitability,
    originationMargin,
    grossRevenue,
    expectedLoss,
    processingCost,
  };
};

const calculateAiRecommendation = (
  application: LoanApplication,
  calculations: ReturnType<typeof calculateLoanMetrics>,
  automatedTotal: number,
) => {
  let baseProb = 70;
  const computationLog = ['Base Probability: 70%'];

  if (calculations.dsr < 35) {
    baseProb += 15;
    computationLog.push('+15% (Strong Debt Service Ratio (DSR) < 35%)');
  } else if (calculations.dsr > 50) {
    baseProb -= 20;
    computationLog.push('-20% (High Debt Service Ratio (DSR) > 50%)');
  }

  if (calculations.ltv < 80) {
    baseProb += 10;
    computationLog.push('+10% (Safe Loan-to-Value Ratio (LTV) < 80%)');
  } else if (calculations.ltv > 95) {
    baseProb -= 15;
    computationLog.push('-15% (Risky Loan-to-Value Ratio (LTV) > 95%)');
  }

  if (automatedTotal >= 40) {
    baseProb += 5;
    computationLog.push('+5% (High Automated Scorecard)');
  }

  const finalProb = Math.min(Math.max(baseProb, 0), 100);

  return {
    probability: finalProb,
    riskLevel: finalProb > 80 ? 'Low' : finalProb > 50 ? 'Medium' : 'High',
    suggestedAmount:
      finalProb > 80 ? application.loan.amount : application.loan.amount * 0.8,
    computationLog,
  };
};

const hasRequiredEnhancedDueDiligence = (
  dueDiligence: EnhancedDueDiligence,
) =>
  dueDiligence.previousLendersAndExistingLoanAccounts.trim().length > 0 &&
  dueDiligence.numberOfActiveLoans >= 0 &&
  dueDiligence.previousLoanRestructuringDisclosures.trim().length > 0 &&
  dueDiligence.employmentReferencePerson.trim().length > 0 &&
  dueDiligence.hrContactInformation.trim().length > 0 &&
  dueDiligence.supervisorInformation.trim().length > 0 &&
  dueDiligence.additionalBankAccountsOwned.trim().length > 0 &&
  dueDiligence.sourceOfIncomeVerificationReferences.trim().length > 0 &&
  dueDiligence.lengthOfResidenceConfirmation.trim().length > 0 &&
  dueDiligence.utilityAccountReferences.trim().length > 0 &&
  dueDiligence.characterReferences.trim().length > 0 &&
  dueDiligence.professionalOrganizationMemberships.trim().length > 0 &&
  dueDiligence.professionalLicenses.trim().length > 0 &&
  dueDiligence.guarantorReferences.trim().length > 0 &&
  dueDiligence.coBorrowerReferences.trim().length > 0 &&
  dueDiligence.additionalPropertyDeclarations.trim().length > 0 &&
  dueDiligence.additionalVehicleDeclarations.trim().length > 0 &&
  dueDiligence.selfDeclaredAssetsAndLiabilities.trim().length > 0 &&
  dueDiligence.selfDeclaredInvestmentPortfolio.trim().length > 0 &&
  dueDiligence.existingInsurancePolicies.trim().length > 0 &&
  dueDiligence.priorBankingRelationships.trim().length > 0 &&
  dueDiligence.consentOpenBankingDataAccess &&
  dueDiligence.consentEmploymentVerification &&
  dueDiligence.consentIdentityVerification &&
  dueDiligence.financialBehaviorQuestionnaireResponses.trim().length > 0 &&
  dueDiligence.riskAppetiteQuestionnaireResponses.trim().length > 0 &&
  dueDiligence.businessOutlookQuestionnaireResponses.trim().length > 0 &&
  dueDiligence.futureFinancialPlansQuestionnaire.trim().length > 0 &&
  dueDiligence.spendingBehaviorQuestionnaire.trim().length > 0 &&
  dueDiligence.householdBudgetingQuestionnaire.trim().length > 0 &&
  dueDiligence.emergencyPreparednessQuestionnaire.trim().length > 0 &&
  dueDiligence.characterAndIntegrityAssessmentAnswers.trim().length > 0 &&
  dueDiligence.communityInvolvementInformation.trim().length > 0 &&
  dueDiligence.referencesFromEmployerOrCommunity.trim().length > 0;

const hasRequiredAdditionalSupportingDocuments = (
  supportingDocuments: SupportingDocuments,
) =>
  supportingDocuments.auditedFinancialStatements &&
  supportingDocuments.proofOfRemittanceIncome &&
  supportingDocuments.investmentStatements &&
  supportingDocuments.additionalSupportingDocuments;

const psychometricQuestionnaireItems: Array<{
  field: keyof OptionalPsychometricQuestionnaire;
  question: string;
}> = [
  { field: 'question01', question: 'I create a plan before making a major financial decision.' },
  { field: 'question02', question: 'I consistently pay obligations on or before their due dates.' },
  { field: 'question03', question: 'I compare several options before borrowing money.' },
  { field: 'question04', question: 'I set aside part of my income for savings or emergencies.' },
  { field: 'question05', question: 'I avoid buying non-essential items when money is tight.' },
  { field: 'question06', question: 'I stay calm and organized when facing financial pressure.' },
  { field: 'question07', question: 'I prefer long-term financial stability over short-term spending.' },
  { field: 'question08', question: 'I keep personal records such as bills, receipts, or payment schedules organized.' },
  { field: 'question09', question: 'I ask questions and clarify terms before signing contracts.' },
  { field: 'question10', question: 'I feel personally responsible for meeting every debt obligation I take on.' },
  { field: 'question11', question: 'I usually follow through on commitments even when circumstances become difficult.' },
  { field: 'question12', question: 'I review my income and expenses regularly.' },
  { field: 'question13', question: 'I think ahead about how unexpected events could affect my finances.' },
  { field: 'question14', question: 'I would rather delay a purchase than borrow beyond what I can comfortably repay.' },
  { field: 'question15', question: 'People who know me would describe me as financially disciplined.' },
  { field: 'question16', question: 'I am careful about sharing accurate information in financial applications.' },
  { field: 'question17', question: 'I am comfortable seeking advice when I do not understand financial matters.' },
  { field: 'question18', question: 'I prioritize household essentials before discretionary spending.' },
  { field: 'question19', question: 'I can adjust my lifestyle if income temporarily declines.' },
  { field: 'question20', question: 'I make financial decisions with my long-term goals in mind.' },
];

const psychometricResponseOptions = [
  'Strongly Disagree',
  'Disagree',
  'Neutral',
  'Agree',
  'Strongly Agree',
];

const mergeDefinedFields = <T extends object>(
  current: T,
  updates?: Partial<T>,
): T => {
  if (!updates) {
    return current;
  }

  const next = { ...(current as Record<string, unknown>) };

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === 'string' && value.trim().length === 0) {
      continue;
    }

    next[key] = value as unknown;
  }

  return next as T;
};

const reviewSectionConfigs: Array<{
  key: keyof ParsedSectionUpdates;
  title: string;
  fields: Array<{
    key: string;
    label: string;
    type?: 'text' | 'number' | 'date' | 'email' | 'tel';
  }>;
}> = [
  {
    key: 'borrower',
    title: 'Borrower Information',
    fields: [
      { key: 'fullName', label: 'Full Legal Name' },
      { key: 'email', label: 'Email Address', type: 'email' },
      { key: 'phone', label: 'Contact Number', type: 'tel' },
      { key: 'govId', label: 'Government ID Number' },
      { key: 'address', label: 'Complete Residential Address' },
    ],
  },
  {
    key: 'applicantPersonal',
    title: 'Personal Details',
    fields: [
      { key: 'lastName', label: 'Last Name' },
      { key: 'firstName', label: 'First Name' },
      { key: 'middleName', label: 'Middle Name' },
      { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
      { key: 'placeOfBirth', label: 'Place of Birth' },
    ],
  },
  {
    key: 'contactInformation',
    title: 'Contact Information',
    fields: [
      { key: 'mobileNumber', label: 'Mobile Number', type: 'tel' },
      { key: 'homePhoneNumber', label: 'Home Phone Number', type: 'tel' },
      { key: 'emailAddress', label: 'Email Address', type: 'email' },
    ],
  },
  {
    key: 'governmentIds',
    title: 'Government IDs',
    fields: [
      { key: 'tin', label: 'TIN' },
      { key: 'sssGsisNumber', label: 'SSS / GSIS Number' },
      { key: 'idNumber', label: 'ID Number' },
      { key: 'issueDate', label: 'Issue Date', type: 'date' },
      { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
    ],
  },
  {
    key: 'addressInformation',
    title: 'Address Information',
    fields: [
      { key: 'presentAddress', label: 'Present Address' },
      { key: 'permanentAddress', label: 'Permanent Address' },
      { key: 'mailingAddress', label: 'Mailing Address' },
    ],
  },
  {
    key: 'employment',
    title: 'Employment Summary',
    fields: [
      { key: 'history', label: 'Employment History' },
      { key: 'monthlyIncome', label: 'Primary Monthly Income', type: 'number' },
      { key: 'otherIncome', label: 'Other Sources of Income', type: 'number' },
      { key: 'debtObligations', label: 'Existing Monthly Debt Obligations', type: 'number' },
    ],
  },
  {
    key: 'employmentInformation',
    title: 'Detailed Employment Information',
    fields: [
      { key: 'employmentStatus', label: 'Employment Status' },
      { key: 'employerBusinessName', label: 'Employer / Business Name' },
      { key: 'occupation', label: 'Occupation' },
      { key: 'grossMonthlyIncome', label: 'Gross Monthly Income', type: 'number' },
      { key: 'otherSourcesOfIncome', label: 'Other Sources of Income', type: 'number' },
      { key: 'investmentIncome', label: 'Investment Income', type: 'number' },
      { key: 'businessIncome', label: 'Business Income', type: 'number' },
    ],
  },
  {
    key: 'collateralInformation',
    title: 'Collateral Information',
    fields: [
      { key: 'propertyAddress', label: 'Property Address' },
      { key: 'registeredOwner', label: 'Registered Owner' },
      { key: 'tctCctNumber', label: 'TCT/CCT Number' },
    ],
  },
];

// --- Main Component ---
export default function LendingScorecard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedApplicationNo = searchParams.get('applicationNo');
  const [formattedNumberDrafts, setFormattedNumberDrafts] = useState<Record<string, string>>({});
  const [documentReview, setDocumentReview] = useState<DocumentParseReview | null>(null);
  const [reviewDocumentId, setReviewDocumentId] = useState<string | null>(null);
  const [selectedWorkflowAction, setSelectedWorkflowAction] = useState<WorkflowStatus>('Credit Review');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<LoanApplication>(createNewApplicationInstance());
  const [isParsing, setIsParsing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hasPersistedRecord, setHasPersistedRecord] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingApplication, setIsLoadingApplication] = useState(false);

  // --- Auto-Calculations (Memoized for Performance) ---
  const calculations = useMemo(() => calculateLoanMetrics(formData), [formData]);

  // --- Automated Lending Scorecard (5 Cs) ---
  const automatedScorecard = useMemo(
    () => calculateAutomatedScorecard(formData, calculations),
    [calculations, formData],
  );

  const creditRiskInsights = useMemo(
    () =>
      calculateCreditRiskInsights(
        formData,
        calculations,
        automatedScorecard.total,
      ),
    [automatedScorecard.total, calculations, formData],
  );

  // --- AI Recommendation with Computations ---
  const aiRecommendation = useMemo(
    () => calculateAiRecommendation(formData, calculations, automatedScorecard.total),
    [calculations, automatedScorecard.total, formData],
  );

  // --- Handlers ---
  type EditableSection =
    | 'borrower'
    | 'employment'
    | 'loan'
    | 'collateral'
    | 'routing'
    | 'applicantPersonal'
    | 'contactInformation'
    | 'governmentIds'
    | 'addressInformation'
    | 'otherInformation'
    | 'employmentInformation'
    | 'collateralInformation'
    | 'spouseInformation'
    | 'bankingRelationships'
    | 'signatures'
    | 'supportingDocuments'
    | 'enhancedDueDiligence'
    | 'optionalPsychometricQuestionnaire'
    | 'disbursement'
    | 'finalChecklist';
  type FieldValue = string | number | boolean;
  type FormSectionValue =
    | BorrowerInfo
    | Employment
    | LoanDetails
    | Collateral
    | LoanApplication['routing']
    | ApplicantPersonal
    | ContactInformation
    | GovernmentIds
    | AddressInformation
    | OtherInformation
    | EmploymentInformation
    | CollateralInformation
    | SpouseInformation
    | BankingRelationships
    | Signatures
    | SupportingDocuments
    | EnhancedDueDiligence
    | OptionalPsychometricQuestionnaire
    | Disbursement
    | FinalChecklist;

  const setTransientMessage = useCallback((message: string) => {
    setSaveMessage(message);
    window.setTimeout(() => setSaveMessage(''), 3000);
  }, []);

  const parseFormattedNumber = useCallback((value: string) => {
    const normalizedValue = value.replace(/,/g, '').replace(/[^\d.-]/g, '');
    const parsedValue = Number.parseFloat(normalizedValue);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }, []);

  const formatFormattedNumber = useCallback((value: unknown) => {
    if (value === '' || value === null || value === undefined) {
      return '';
    }

    const numericValue =
      typeof value === 'number' ? value : parseFormattedNumber(String(value));

    if (numericValue === 0) {
      return '';
    }

    return numericValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [parseFormattedNumber]);

  const buildFormattedNumberKey = useCallback(
    (section: EditableSection, field: string) => `${section}.${field}`,
    [],
  );

  const updateDocumentItem = useCallback(
    (
      documentId: string,
      status: DocumentItem['status'],
      parsedData?: string,
    ) => {
      setFormData((prev) => ({
        ...prev,
        documents: prev.documents.map((document) =>
          document.id === documentId
            ? { ...document, status, parsedData }
            : document,
        ),
      }));
    },
    [],
  );

  const mergeReviewIntoApplication = useCallback(
    (
      baseApplication: LoanApplication,
      review: DocumentParseReview,
    ): LoanApplication => ({
      ...baseApplication,
      borrower: mergeDefinedFields(
        baseApplication.borrower,
        review.extractedData.borrower,
      ),
      applicantPersonal: mergeDefinedFields(
        baseApplication.applicantPersonal,
        review.extractedData.applicantPersonal,
      ),
      contactInformation: mergeDefinedFields(
        baseApplication.contactInformation,
        review.extractedData.contactInformation,
      ),
      governmentIds: mergeDefinedFields(
        baseApplication.governmentIds,
        review.extractedData.governmentIds,
      ),
      addressInformation: mergeDefinedFields(
        baseApplication.addressInformation,
        review.extractedData.addressInformation,
      ),
      employment: mergeDefinedFields(
        baseApplication.employment,
        review.extractedData.employment,
      ),
      employmentInformation: mergeDefinedFields(
        baseApplication.employmentInformation,
        review.extractedData.employmentInformation,
      ),
      collateralInformation: mergeDefinedFields(
        baseApplication.collateralInformation,
        review.extractedData.collateralInformation,
      ),
      otherInformation: mergeDefinedFields(
        baseApplication.otherInformation,
        review.extractedData.otherInformation,
      ),
      supportingDocuments: {
        ...baseApplication.supportingDocuments,
        ...review.supportingDocuments,
      },
    }),
    [],
  );

  const parseLoanDocument = useCallback(
    async (documentId: string, file: File) => {
      setIsParsing(true);
      setSaveMessage('');

      try {
        const payload = new FormData();
        payload.append('file', file);

        const response = await api.post<DocumentParseReview>(
          '/ai/loan-documents/parse',
          payload,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          },
        );

        const normalizedReview: DocumentParseReview = {
          documentName: response.data.documentName || file.name,
          documentType: response.data.documentType || 'Unclassified Document',
          confidence: response.data.confidence || 0,
          summary: response.data.summary || 'AI review completed.',
          notes: response.data.notes || [],
          supportingDocuments: response.data.supportingDocuments || {},
          extractedData: response.data.extractedData || {},
        };

        setDocumentReview(normalizedReview);
        setReviewDocumentId(documentId);
        updateDocumentItem(
          documentId,
          'Parsed',
          normalizedReview.summary || `Detected ${normalizedReview.documentType}`,
        );
        setStep(1);
      } catch (error) {
        const message = getErrorMessage(
          error,
          'Failed to analyze the uploaded document.',
        );
        updateDocumentItem(documentId, 'Failed', message);
        setSaveMessage(message);
      } finally {
        setIsParsing(false);
      }
    },
    [updateDocumentItem],
  );

  const updateDocumentReviewField = useCallback(
    (
      section: keyof ParsedSectionUpdates,
      field: string,
      value: string | number,
    ) => {
      setDocumentReview((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          extractedData: {
            ...prev.extractedData,
            [section]: {
              ...(prev.extractedData[section] ?? {}),
              [field]: value,
            },
          },
        };
      });
    },
    [],
  );

  const updateDocumentReviewRequirement = useCallback(
    (field: keyof SupportingDocuments, value: boolean) => {
      setDocumentReview((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          supportingDocuments: {
            ...prev.supportingDocuments,
            [field]: value,
          },
        };
      });
    },
    [],
  );

  const hydrateApplication = useCallback((record: LoanApplicationRecord): LoanApplication => {
    const blankApplication = createNewApplicationInstance();
    const savedRequirements:  Partial<LoanApplicationRequirements> = record.requirements ?? {};
    const savedDueDiligence = (savedRequirements.enhancedDueDiligence ?? {}) as Record<string, unknown>;

    return {
      ...blankApplication,
      id: record.application_no,
      status: record.status,
      productType: record.product_type ?? blankApplication.productType,
      borrower: {
        ...blankApplication.borrower,
        fullName: record.borrower_name,
        email: record.email,
        phone: record.phone,
        govId: record.gov_id,
        address: record.address,
      },
      employment: {
        ...blankApplication.employment,
        monthlyIncome: record.monthly_income,
        otherIncome: record.other_income,
        debtObligations: record.debt_obligations,
      },
      loan: {
        ...blankApplication.loan,
        amount: record.loan_amount,
        termMonths: record.term_months,
        interestRate: record.interest_rate,
        purpose: record.purpose,
        productType:
          savedRequirements.productInformation?.productType ??
          record.product_type ??
          blankApplication.loan.productType,
      },
      collateral: {
        ...blankApplication.collateral,
        vehicleInfo: record.vehicle_info,
        appraisedValue: record.appraised_value,
      },
      applicantPersonal: {
        ...blankApplication.applicantPersonal,
        ...savedRequirements.applicantPersonal,
      },
      contactInformation: {
        ...blankApplication.contactInformation,
        ...savedRequirements.contactInformation,
      },
      governmentIds: {
        ...blankApplication.governmentIds,
        ...savedRequirements.governmentIds,
      },
      addressInformation: {
        ...blankApplication.addressInformation,
        ...savedRequirements.addressInformation,
      },
      otherInformation: {
        ...blankApplication.otherInformation,
        ...savedRequirements.otherInformation,
      },
      employmentInformation: {
        ...blankApplication.employmentInformation,
        ...savedRequirements.employmentInformation,
        grossMonthlyIncome: parseFormattedNumber(
          String(
            savedRequirements.employmentInformation?.grossMonthlyIncome ??
              blankApplication.employmentInformation.grossMonthlyIncome,
          ),
        ),
        otherSourcesOfIncome: parseFormattedNumber(
          String(
            savedRequirements.employmentInformation?.otherSourcesOfIncome ??
              blankApplication.employmentInformation.otherSourcesOfIncome,
          ),
        ),
        investmentIncome: parseFormattedNumber(
          String(
            savedRequirements.employmentInformation?.investmentIncome ??
              blankApplication.employmentInformation.investmentIncome,
          ),
        ),
        businessIncome: parseFormattedNumber(
          String(
            savedRequirements.employmentInformation?.businessIncome ??
              blankApplication.employmentInformation.businessIncome,
          ),
        ),
      },
      collateralInformation: {
        ...blankApplication.collateralInformation,
        ...savedRequirements.collateralInformation,
      },
      spouseInformation: {
        ...blankApplication.spouseInformation,
        ...savedRequirements.spouseInformation,
        grossMonthlyIncome: parseFormattedNumber(
          String(
            savedRequirements.spouseInformation?.grossMonthlyIncome ??
              blankApplication.spouseInformation.grossMonthlyIncome,
          ),
        ),
      },
      bankingRelationships: {
        ...blankApplication.bankingRelationships,
        ...savedRequirements.bankingRelationships,
        loanCurrentBalance: parseFormattedNumber(
          String(
            savedRequirements.bankingRelationships?.loanCurrentBalance ??
              blankApplication.bankingRelationships.loanCurrentBalance,
          ),
        ),
      },
      signatures: {
        ...blankApplication.signatures,
        ...savedRequirements.signatures,
      },
      supportingDocuments: {
        ...blankApplication.supportingDocuments,
        ...savedRequirements.supportingDocuments,
      },
      enhancedDueDiligence: {
        ...blankApplication.enhancedDueDiligence,
        ...savedRequirements.enhancedDueDiligence,
        otherSocialMediaLinks:
          typeof savedDueDiligence.otherSocialMediaLinks === 'string'
            ? savedDueDiligence.otherSocialMediaLinks
            : typeof savedDueDiligence.socialMediaProfileLinks === 'string'
              ? savedDueDiligence.socialMediaProfileLinks
              : blankApplication.enhancedDueDiligence.otherSocialMediaLinks,
      },
      optionalPsychometricQuestionnaire: {
        ...blankApplication.optionalPsychometricQuestionnaire,
        ...savedRequirements.optionalPsychometricQuestionnaire,
      },
      committeeRemarks: record.committee_remarks,
      routing: {
        ...blankApplication.routing,
        executiveApproval: record.executive_approval,
      },
    };
  }, [parseFormattedNumber]);

  const buildLoanPayload = (
    newStatus: WorkflowStatus,
    application: LoanApplication = formData,
  ): LoanApplicationPayload => {
    const payloadCalculations = calculateLoanMetrics(application);
    const payloadScorecard = calculateAutomatedScorecard(
      application,
      payloadCalculations,
    );
    const payloadAiRecommendation = calculateAiRecommendation(
      application,
      payloadCalculations,
      payloadScorecard.total,
    );

    return {
    application_no: application.id,
    status: newStatus,
    product_type: application.loan.productType,
    borrower_name: application.borrower.fullName,
    email: application.borrower.email,
    phone: application.borrower.phone,
    gov_id: application.borrower.govId,
    address: application.borrower.address,
    monthly_income: application.employment.monthlyIncome,
    other_income: application.employment.otherIncome,
    debt_obligations: application.employment.debtObligations,
    loan_amount: application.loan.amount,
    term_months: application.loan.termMonths,
    interest_rate: application.loan.interestRate,
    purpose: application.loan.purpose,
    vehicle_info: application.collateral.vehicleInfo,
    appraised_value: application.collateral.appraisedValue,
    committee_remarks: application.committeeRemarks,
    executive_approval: application.routing.executiveApproval,
    dti: payloadCalculations.dti,
    dsr: payloadCalculations.dsr,
    ltv: payloadCalculations.ltv,
    scorecard_total: payloadScorecard.total,
    ai_probability: payloadAiRecommendation.probability,
    requirements: buildLoanRequirements(application),
  };
  };

  const updateField = (section: EditableSection, field: string, value: FieldValue) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as FormSectionValue),
        [field]: value,
      },
    }));
  };

  const addCoBorrower = () => {
    const newCb: CoBorrower = { id: Date.now().toString(), name: '', relationship: '', monthlyIncome: 0, debtObligations: 0, creditStanding: 'Good' };
    setFormData(prev => ({ ...prev, coBorrowers: [...prev.coBorrowers, newCb] }));
  };

  const updateCoBorrower = (id: string, field: keyof CoBorrower, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      coBorrowers: prev.coBorrowers.map(cb => cb.id === id ? { ...cb, [field]: value } : cb)
    }));
  };

  const removeCoBorrower = (id: string) => {
    setFormData(prev => ({ ...prev, coBorrowers: prev.coBorrowers.filter(cb => cb.id !== id) }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isSupportedImageFile =
        file.type.startsWith('image/') ||
        /\.(heic|heif|png|jpe?g|webp|bmp)$/i.test(file.name);

      if (!isSupportedImageFile) {
        setSaveMessage(
          'Failed to upload document. Only image files are supported for AI parsing.',
        );
        e.target.value = '';
        return;
      }

      const newDoc: DocumentItem = { id: Date.now().toString(), name: file.name, type: file.type, status: 'Pending' };
      setFormData(prev => ({ ...prev, documents: [...prev.documents, newDoc] }));
      await parseLoanDocument(newDoc.id, file);

      e.target.value = '';
    }
  };

  const persistLoanApplication = async (
    newStatus: WorkflowStatus,
    applicationOverride?: LoanApplication,
  ) => {
    setIsSaving(true);

    try {
      const applicationToSave = applicationOverride ?? formData;
      const payload = buildLoanPayload(newStatus, applicationToSave);
      const result = hasPersistedRecord
        ? await updateLoanApplication(applicationToSave.id, payload)
        : await createLoanApplication(payload);

      setHasPersistedRecord(true);
      setFormData({ ...applicationToSave, status: newStatus });
      setTransientMessage(result.message || `Application saved as ${newStatus}`);
    } catch (error) {
      setSaveMessage(
        getErrorMessage(error, 'Failed to save loan application.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const changeWorkflowStatus = async (
    newStatus: WorkflowStatus,
    applicationOverride?: LoanApplication,
  ) => {
    if (
      newStatus !== 'Draft' &&
      (!enhancedDueDiligenceComplete || !enhancedSupportingDocumentsComplete)
    ) {
      setSaveMessage(
        'Complete all required enhanced due diligence fields and supporting document declarations before moving beyond Draft.',
      );
      return;
    }

    if (applicationOverride) {
      await persistLoanApplication(newStatus, applicationOverride);
      return;
    }

    if (!hasPersistedRecord || formData.status === 'Draft') {
      await persistLoanApplication(newStatus);
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateLoanApplicationStatus(formData.id, newStatus);
      setFormData(prev => ({ ...prev, status: newStatus }));
      setTransientMessage(result.message || `Status updated to ${newStatus}`);
    } catch (error) {
      setSaveMessage(getErrorMessage(error, 'Failed to update status.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    await persistLoanApplication('Draft');
  };

  const handleSelectedWorkflowAction = async () => {
    await changeWorkflowStatus(selectedWorkflowAction);
  };

  const handleFinalizeDocumentReview = async (newStatus: WorkflowStatus) => {
    if (!documentReview) {
      return;
    }

    const mergedApplication = mergeReviewIntoApplication(formData, documentReview);
    await changeWorkflowStatus(newStatus, mergedApplication);
    setDocumentReview(null);
    setReviewDocumentId(null);
  };

  const loadApplication = useCallback(async (applicationNo: string) => {
    setIsLoadingApplication(true);

    try {
      const data = await fetchLoanApplication(applicationNo);

      setFormData(hydrateApplication(data));
      setHasPersistedRecord(true);
      setDocumentReview(null);
      setReviewDocumentId(null);
      setStep(1);
      setTransientMessage('Application loaded');
    } catch (error) {
      setSaveMessage(getErrorMessage(error, 'Failed to load application.'));
    } finally {
      setIsLoadingApplication(false);
    }
  }, [hydrateApplication, setTransientMessage]);

  useEffect(() => {
    if (!requestedApplicationNo) {
      return;
    }

    void loadApplication(requestedApplicationNo);
  }, [loadApplication, requestedApplicationNo]);

  // --- Global Nav Actions ---
  const handleCreateNew = () => {
    setFormData(createNewApplicationInstance());
    setFormattedNumberDrafts({});
    setDocumentReview(null);
    setReviewDocumentId(null);
    setHasPersistedRecord(false);
    setStep(1);
    navigate('/lending-scorecard', { replace: true });
    setTransientMessage('New application draft generated.');
  };

  const enhancedDueDiligenceComplete = useMemo(
    () => hasRequiredEnhancedDueDiligence(formData.enhancedDueDiligence),
    [formData.enhancedDueDiligence],
  );
  const enhancedSupportingDocumentsComplete = useMemo(
    () => hasRequiredAdditionalSupportingDocuments(formData.supportingDocuments),
    [formData.supportingDocuments],
  );
  // --- Validation for Step 10 ---
  const validationChecks = useMemo(() => [
    { label: 'Borrower Identity Verified', passed: !!formData.borrower.fullName && !!formData.borrower.govId },
    { label: 'Loan Amount & Collateral Valid', passed: formData.loan.amount > 0 && formData.collateral.appraisedValue > 0 },
    { label: 'Debt Service Ratio (DSR) is within acceptable limits (< 50%)', passed: calculations.dsr < 50 },
    { label: 'Required Documents Uploaded & Parsed', passed: formData.documents.length >= 2 && formData.documents.every(d => d.status === 'Parsed') },
    { label: 'Product selected', passed: !!formData.loan.productType },
    { label: 'Enhanced due diligence fields completed', passed: enhancedDueDiligenceComplete },
    { label: 'Enhanced supporting document declarations completed', passed: enhancedSupportingDocumentsComplete },
  ], [calculations, enhancedDueDiligenceComplete, enhancedSupportingDocumentsComplete, formData]);
  const allValidationChecksPassed = validationChecks.every((check) => check.passed);
  const finalChecklistComplete = Boolean(
    formData.finalChecklist?.allRequiredDocumentsProvided &&
      formData.finalChecklist?.allSignaturesCollected &&
      formData.finalChecklist?.creditCommitteeApproved &&
      formData.finalChecklist?.executiveApprovalObtained &&
      formData.finalChecklist?.collateralDocumentationReady,
  );
  const suggestedWorkflowAction = useMemo<WorkflowStatus>(() => {
    if (formData.status === 'Released') {
      return 'Released';
    }

    if (formData.status === 'Rejected') {
      return 'Rejected';
    }

    if (formData.status === 'Approved') {
      return finalChecklistComplete ? 'Released' : 'Approved';
    }

    if (formData.status === 'Credit Review') {
      if (aiRecommendation.probability < 50 || creditRiskInsights.riskScore > 60) {
        return 'Rejected';
      }

      if (allValidationChecksPassed && aiRecommendation.probability >= 70) {
        return 'Approved';
      }

      return 'Credit Review';
    }

    if (formData.status === 'Submitted' || formData.status === 'Under Review') {
      return allValidationChecksPassed ? 'Credit Review' : 'Draft';
    }

    return allValidationChecksPassed ? 'Credit Review' : 'Draft';
  }, [
    aiRecommendation.probability,
    allValidationChecksPassed,
    creditRiskInsights.riskScore,
    finalChecklistComplete,
    formData.status,
  ]);
  useEffect(() => {
    setSelectedWorkflowAction(suggestedWorkflowAction);
  }, [suggestedWorkflowAction]);
  const saveMessageIsError = saveMessage.toLowerCase().includes('failed');
  const getInputValue = (
    section: EditableSection,
    field: string,
    type = 'text',
  ): string | number => {
    const rawValue = (formData[section] as Record<string, FieldValue | undefined>)[field];

    if (typeof rawValue === 'boolean') {
      return rawValue ? 'true' : 'false';
    }

    if (type === 'number' && rawValue === 0) {
      return '';
    }

    return rawValue ?? '';
  };

  const getReviewFieldValue = (
    section: keyof ParsedSectionUpdates,
    field: string,
  ) => {
    if (!documentReview) {
      return '';
    }

    const sectionValues = documentReview.extractedData[section];

    if (!sectionValues) {
      return '';
    }

    return (sectionValues as Record<string, string | number | undefined>)[field] ?? '';
  };

  const hasReviewSectionValues = (section: keyof ParsedSectionUpdates) => {
    if (!documentReview) {
      return false;
    }

    const sectionValues = documentReview.extractedData[section];

    if (!sectionValues) {
      return false;
    }

    return Object.values(sectionValues).some(
      (value) =>
        value !== undefined &&
        value !== null &&
        !(typeof value === 'string' && value.trim().length === 0),
    );
  };

  const renderInput = (section: EditableSection, field: string, label: string, type = 'text', disabled = false) => (
    <div className="mb-3">
      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">{label}</label>
      <input
        type={type}
        disabled={disabled}
        value={getInputValue(section, field, type)}
        onChange={(e) => updateField(section, field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className={`loan-form-input w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-gray-100 text-gray-500' : 'border-gray-300'}`}
      />
    </div>
  );

  const renderTextarea = (
    section: EditableSection,
    field: string,
    label: string,
    rows = 3,
    required = false,
  ) => (
    <div className="mb-3">
      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">
        {label}{required ? ' (Required)' : ''}
      </label>
      <textarea
        rows={rows}
        value={String(getInputValue(section, field))}
        onChange={(event) => updateField(section, field, event.target.value)}
        className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  const renderFormattedNumberInput = (
    section: EditableSection,
    field: string,
    label: string,
    disabled = false,
  ) => {
    const fieldKey = buildFormattedNumberKey(section, field);
    const rawValue = (formData[section] as Record<string, FieldValue | undefined>)[field];
    const displayValue =
      formattedNumberDrafts[fieldKey] ??
      formatFormattedNumber(rawValue);

    return (
      <div className="mb-3">
        <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">{label}</label>
        <input
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={displayValue}
          onFocus={() =>
            setFormattedNumberDrafts((prev) => ({
              ...prev,
              [fieldKey]:
                rawValue === 0 || rawValue === '' || rawValue === undefined
                  ? ''
                  : String(rawValue),
            }))
          }
          onChange={(event) => {
            const nextDraft = event.target.value
              .replace(/,/g, '')
              .replace(/[^\d.-]/g, '');

            setFormattedNumberDrafts((prev) => ({
              ...prev,
              [fieldKey]: nextDraft,
            }));
            updateField(section, field, parseFormattedNumber(nextDraft));
          }}
          onBlur={() =>
            setFormattedNumberDrafts((prev) => {
              const nextDrafts = { ...prev };
              delete nextDrafts[fieldKey];
              return nextDrafts;
            })
          }
          className={`loan-form-input w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-gray-100 text-gray-500' : 'border-gray-300'}`}
        />
      </div>
    );
  };

  const renderCheckbox = (section: EditableSection, field: string, label: string) => (
    <label className="loan-checkbox-row flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={Boolean((formData[section] as Record<string, FieldValue | undefined>)[field])}
        onChange={(event) => updateField(section, field, event.target.checked)}
        className="h-4 w-4"
      />
      <span>{label}</span>
    </label>
  );

  const renderSelect = (
    section: EditableSection,
    field: string,
    label: string,
    options: string[],
  ) => (
    <div className="mb-3">
      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">{label}</label>
      <select
        value={String(getInputValue(section, field))}
        onChange={(event) => updateField(section, field, event.target.value)}
        className="loan-form-select w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );

  const getStatusColor = (status: WorkflowStatus) => {
    const colors: Record<WorkflowStatus, string> = {
      'Draft': 'bg-gray-100 text-gray-800', 'Submitted': 'bg-blue-100 text-blue-800',
      'Under Review': 'bg-yellow-100 text-yellow-800', 'Credit Review': 'bg-purple-100 text-purple-800',
      'Approved': 'bg-green-100 text-green-800', 'Rejected': 'bg-red-100 text-red-800', 'Released': 'bg-indigo-100 text-indigo-800'
    };
    return colors[status];
  };

  const getDocumentStatusColor = (
    status: 'Pending' | 'Parsed' | 'Failed'
  ) => {
    switch (status) {
      case 'Parsed':
        return 'bg-green-100 text-green-700';

      case 'Failed':
        return 'bg-red-100 text-red-700';

      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  const topNavButtonClass = 'loan-toolbar-button';
  const stepperButtonClass = 'loan-stepper-button';
  const footerButtonClass = 'loan-footer-button';
  const workflowActionOptions: Array<{ label: string; value: WorkflowStatus }> = [
    { label: 'Draft', value: 'Draft' },
    { label: 'Review', value: 'Credit Review' },
    { label: 'Reject', value: 'Rejected' },
    { label: 'Approve', value: 'Approved' },
    { label: 'Release', value: 'Released' },
  ];
  const suggestedWorkflowLabel =
    workflowActionOptions.find((option) => option.value === suggestedWorkflowAction)?.label ??
    suggestedWorkflowAction;
  const automatedScoreBand =
    automatedScorecard.total >= 40
      ? 'Prime Quality'
      : automatedScorecard.total >= 30
        ? 'Standard Quality'
        : 'Elevated Review';
  const automatedScoreItems = [
    { label: 'Character', score: automatedScorecard.character, desc: 'Identity depth and borrower profile strength' },
    { label: 'Capacity', score: automatedScorecard.capacity, desc: 'Repayment ability based on Debt Service Ratio (DSR) performance' },
    { label: 'Capital', score: automatedScorecard.capital, desc: 'Supplemental liquidity and outside income support' },
    { label: 'Collateral', score: automatedScorecard.collateral, desc: 'Asset coverage and loan-to-value resilience' },
    { label: 'Conditions', score: automatedScorecard.conditions, desc: 'Purpose quality and overall loan context' },
  ];
  const advancedSignalItems = [
    {
      label: 'Fraud Score',
      value: creditRiskInsights.fraudScore.toFixed(0),
      tone:
        creditRiskInsights.fraudScore >= 70
          ? 'text-emerald-700'
          : creditRiskInsights.fraudScore >= 50
            ? 'text-amber-600'
            : 'text-rose-600',
      note: 'Higher is better',
    },
    {
      label: 'Non-starter Score',
      value: creditRiskInsights.nonStarterScore.toFixed(0),
      tone:
        creditRiskInsights.nonStarterScore >= 70
          ? 'text-emerald-700'
          : creditRiskInsights.nonStarterScore >= 50
            ? 'text-amber-600'
            : 'text-rose-600',
      note: 'Higher is better',
    },
    {
      label: 'Risk Score',
      value: creditRiskInsights.riskScore.toFixed(1),
      tone:
        creditRiskInsights.riskScore <= 35
          ? 'text-emerald-700'
          : creditRiskInsights.riskScore <= 60
            ? 'text-amber-600'
            : 'text-rose-600',
      note: 'Lower is better',
    },
    {
      label: 'Origination Profitability',
      value: `$${creditRiskInsights.originationProfitability.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })}`,
      tone:
        creditRiskInsights.originationProfitability >= 0
          ? 'text-emerald-700'
          : 'text-rose-600',
      note: `Margin ${creditRiskInsights.originationMargin.toFixed(1)}%`,
    },
  ];
  const profitabilityBreakdown = [
    {
      label: 'Gross Interest Revenue',
      value: `$${creditRiskInsights.grossRevenue.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })}`,
    },
    {
      label: 'Expected Loss Reserve',
      value: `$${creditRiskInsights.expectedLoss.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })}`,
    },
    {
      label: 'Processing Cost',
      value: `$${creditRiskInsights.processingCost.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })}`,
    },
  ];
  const aiRiskTone =
    aiRecommendation.riskLevel === 'Low'
      ? 'bg-emerald-100 text-emerald-800'
      : aiRecommendation.riskLevel === 'Medium'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-rose-100 text-rose-800';

  return (
    <div className="lending-scorecard-page min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800">
      <div className="lending-scorecard-card max-w-5xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        
        {/* Header & Workflow Status */}
        <div className="loan-page-header bg-slate-800 text-white p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="loan-page-header-copy">
            <h1 className="loan-page-title text-2xl font-semibold tracking-tight">Advanced Loan Origination System</h1>
            <p className="loan-page-id mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Application ID: {formData.id}</p>
          </div>
          <div className="loan-page-status flex items-center gap-3">
            <span className="loan-page-status-label text-xs font-medium uppercase tracking-[0.12em] text-slate-300">Current Status</span>
            <span className={`loan-page-status-chip rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${getStatusColor(formData.status)}`}>
              {formData.status}
            </span>
          </div>
        </div>

        {/* Global Pipeline Dashboard Navigation Bar */}
        <div className="loan-toolbar bg-slate-100 border-b border-gray-200 px-6 py-3 flex flex-wrap gap-3 items-center justify-start">
          <button 
            onClick={handleCreateNew}
            className={`${topNavButtonClass} loan-toolbar-button-primary border-emerald-900 bg-emerald-800 text-white hover:bg-emerald-900 focus:ring-emerald-700`}
          >
            Create New Application
          </button>
          <button 
            onClick={() => navigate('/loan-repository')}
            className={`${topNavButtonClass} loan-toolbar-button-secondary border-slate-800 bg-slate-700 text-white hover:bg-slate-800 focus:ring-slate-700`}
          >
            Review Applications
          </button>
          <button 
            onClick={() => navigate('/loan-repository?status=Credit%20Review')}
            className={`${topNavButtonClass} loan-toolbar-button-secondary border-slate-800 bg-slate-700 text-white hover:bg-slate-800 focus:ring-slate-700`}
          >
            Approval Queue
          </button>
          <button 
            onClick={() => navigate('/loan-repository?status=Released')}
            className={`${topNavButtonClass} loan-toolbar-button-secondary border-slate-800 bg-slate-700 text-white hover:bg-slate-800 focus:ring-slate-700`}
          >
            Released Accounts
          </button>
        </div>

        {/* Progress Stepper */}
        <div className="loan-stepper-shell bg-slate-50 border-b border-gray-200 p-4 pt-6 overflow-x-auto">
          <div className="loan-stepper-grid grid min-w-[1200px] grid-cols-10 gap-2 text-[11px] font-semibold tracking-[0.04em] text-slate-500">
            {['Product Selection', 'Applicant Info', 'Employment & Income', 'Co-Borrower', 'Banking', 'Collateral', 'Documents', 'Credit Scoring', 'Approval', 'Release & Booking'].map((label, i) => (
              <button
                key={i}
                onClick={() => setStep(i + 1)}
                className={`${stepperButtonClass} ${step === i + 1 ? 'loan-stepper-button-active border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'loan-stepper-button-idle border-gray-200 bg-white hover:border-blue-400 hover:text-blue-600'}`}
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${step >= i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                  {i + 1}
                </div>
                <span className="leading-snug">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <div className="loan-page-body p-6 md:p-8 min-h-[400px]">
          {saveMessage && (
            <div
              className={`mb-4 rounded-md p-3 text-sm font-medium ${
                saveMessageIsError
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {saveMessage}
            </div>
          )}

          {isLoadingApplication && (
            <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
              Loading application record...
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="col-span-full text-lg font-bold text-slate-800 border-b pb-2">Step 1: Product Selection</h3>
              {renderSelect('loan', 'productType', 'Product Being Applied For', ['Home Loan', 'Auto Loan', 'Credit Card', 'Personal Loan'])}
              {renderInput('loan', 'purpose', 'Purpose of Loan')}
              {renderInput('loan', 'amount', 'Requested Loan Amount', 'number')}
              {renderInput('loan', 'termMonths', 'Loan Term (Months)', 'number')}
              {renderInput('loan', 'interestRate', 'Annual Interest Rate (%)', 'number')}
              <div className="md:col-span-2 bg-purple-50 p-4 rounded-md border border-purple-200 mt-2">
                <h4 className="font-bold text-purple-800 text-sm mb-2">Auto-Calculated Metrics</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Est. Monthly Amortization: <span className="font-bold">${calculations.monthlyPayment.toFixed(2)}</span></div>
                  <div>Loan-to-Value Ratio (LTV): <span className={`font-bold ${calculations.ltv > 90 ? 'text-red-600' : 'text-green-600'}`}>{calculations.ltv.toFixed(1)}%</span></div>
                </div>
              </div>

              <div className="md:col-span-2 mt-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1">Step 1 Review Capture</h4>
                    <p className="text-sm text-slate-600">
                      Take a picture or upload an image document. AI will suggest requirement checks and field values for review before saving.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <input
                      type="file"
                      id="step1DocumentUpload"
                      className="hidden"
                      onChange={(event) => void handleFileUpload(event)}
                      accept="image/*"
                      capture="environment"
                    />
                    <label
                      htmlFor="step1DocumentUpload"
                      className="loan-inline-button loan-inline-button-primary inline-flex cursor-pointer items-center justify-center px-4 py-2 text-sm font-semibold"
                    >
                      {isParsing ? 'Analyzing Image...' : 'Take Picture / Upload Image'}
                    </label>
                  </div>
                </div>

                {formData.documents.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {formData.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{doc.name}</p>
                          <p className="text-xs text-slate-500">
                            {doc.parsedData || 'Waiting for AI analysis...'}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${getDocumentStatusColor(doc.status)}`}>
                          {doc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {documentReview && (
                  <div className="mt-5 rounded-lg border border-blue-200 bg-white p-5">
                    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-1">Verification Confirmation</h4>
                        <p className="text-sm text-slate-600">
                          Review and edit AI-suggested details before finalizing this application as draft or for review.
                        </p>
                        {reviewDocumentId && (
                          <p className="mt-1 text-xs text-slate-500">
                            Linked upload reference: {reviewDocumentId}
                          </p>
                        )}
                      </div>
                      <div className="rounded-md bg-blue-50 px-3 py-2 text-right">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Detected Document</p>
                        <p className="text-sm font-bold text-blue-900">{documentReview.documentType}</p>
                        <p className="text-xs text-blue-700">
                          Confidence: {(documentReview.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI Summary</p>
                      <p className="mt-1 text-sm text-slate-700">{documentReview.summary}</p>
                      {documentReview.notes.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
                          {documentReview.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="mt-5">
                      <h5 className="text-sm font-bold text-slate-800 mb-3">Suggested Requirements</h5>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {Object.entries(documentReview.supportingDocuments).map(([field, value]) => (
                          <label
                            key={field}
                            className="loan-checkbox-row flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(event) =>
                                updateDocumentReviewRequirement(
                                  field as keyof SupportingDocuments,
                                  event.target.checked,
                                )
                              }
                              className="h-4 w-4"
                            />
                            <span>{field}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 space-y-5">
                      {reviewSectionConfigs.map((sectionConfig) =>
                        hasReviewSectionValues(sectionConfig.key) ? (
                          <div key={sectionConfig.key} className="rounded-md border border-slate-200 p-4">
                            <h5 className="text-sm font-bold text-slate-800 mb-3">{sectionConfig.title}</h5>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              {sectionConfig.fields.map((fieldConfig) => {
                                const fieldValue = getReviewFieldValue(
                                  sectionConfig.key,
                                  fieldConfig.key,
                                );

                                if (fieldValue === '') {
                                  return null;
                                }

                                return (
                                  <div key={`${sectionConfig.key}.${fieldConfig.key}`} className="mb-1">
                                    <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">
                                      {fieldConfig.label}
                                    </label>
                                    <input
                                      type={fieldConfig.type ?? 'text'}
                                      value={fieldValue}
                                      onChange={(event) =>
                                        updateDocumentReviewField(
                                          sectionConfig.key,
                                          fieldConfig.key,
                                          fieldConfig.type === 'number'
                                            ? parseFormattedNumber(event.target.value)
                                            : event.target.value,
                                        )
                                      }
                                      className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null,
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => void handleFinalizeDocumentReview('Draft')}
                        disabled={isSaving}
                        className="loan-inline-button loan-inline-button-secondary px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm font-medium transition disabled:opacity-50"
                      >
                        Apply, Save as Draft
                      </button>
                      <button
                        onClick={() => void handleFinalizeDocumentReview('Credit Review')}
                        disabled={isSaving}
                        className="loan-inline-button loan-inline-button-accent px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-semibold transition disabled:opacity-50"
                      >
                        Apply, Save for Review
                      </button>
                      <button
                        onClick={() => {
                          setDocumentReview(null);
                          setReviewDocumentId(null);
                        }}
                        type="button"
                        className="loan-footer-link inline-flex min-h-[42px] items-center justify-center px-4 py-2 text-sm font-semibold tracking-wide text-gray-600 transition hover:text-gray-800"
                      >
                        Dismiss Review
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="col-span-full text-lg font-bold text-slate-800 border-b pb-2">Step 2: Applicant Information</h3>
              {renderInput('borrower', 'fullName', 'Full Legal Name')}
              {renderInput('borrower', 'email', 'Email Address', 'email')}
              {renderInput('borrower', 'phone', 'Contact Number', 'tel')}
              {renderInput('borrower', 'govId', 'Government ID Number')}
              {renderInput('borrower', 'address', 'Complete Residential Address')}
              <div className="md:col-span-2 border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Additional Personal Information</h4>
              </div>
              {renderInput('applicantPersonal', 'lastName', 'Last Name')}
              {renderInput('applicantPersonal', 'firstName', 'First Name')}
              {renderInput('applicantPersonal', 'middleName', 'Middle Name')}
              {renderInput('applicantPersonal', 'dateOfBirth', 'Date of Birth', 'date')}
              {renderInput('applicantPersonal', 'placeOfBirth', 'Place of Birth')}
              {renderInput('applicantPersonal', 'age', 'Age', 'number')}
              {renderInput('applicantPersonal', 'gender', 'Gender')}
              {renderInput('applicantPersonal', 'citizenship', 'Citizenship')}
              {renderInput('applicantPersonal', 'numberOfDependents', 'Number of Dependents', 'number')}
              {renderInput('applicantPersonal', 'maritalStatus', 'Marital Status')}
              {renderInput('applicantPersonal', 'mothersMaidenName', "Mother's Maiden Name")}
              {renderInput('contactInformation', 'mobileNumber', 'Mobile Number')}
              {renderInput('contactInformation', 'homePhoneNumber', 'Home Phone Number')}
              {renderInput('governmentIds', 'tin', 'TIN')}
              {renderInput('governmentIds', 'sssGsisNumber', 'SSS / GSIS Number')}
              {renderInput('governmentIds', 'idNumber', 'ID Number')}
              {renderInput('governmentIds', 'issueDate', 'Issue Date', 'date')}
              {renderInput('governmentIds', 'expiryDate', 'Expiry Date', 'date')}
              {renderInput('addressInformation', 'presentAddress', 'Present Address')}
              {renderInput('addressInformation', 'permanentAddress', 'Permanent Address')}
              {renderInput('addressInformation', 'mailingAddress', 'Mailing Address')}
              {renderInput('addressInformation', 'lengthOfStay', 'Length of Stay')}
              {renderInput('otherInformation', 'homeOwnership', 'Home Ownership')}
              {renderInput('otherInformation', 'educationalAttainment', 'Educational Attainment')}
              {renderInput('otherInformation', 'numberOfVehiclesOwned', 'Number of Vehicles Owned', 'number')}
             </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="col-span-full text-lg font-bold text-slate-800 border-b pb-2">Step 3: Employment & Income</h3>
              {renderInput('employment', 'history', 'Employment History (Current Employer & Tenure)')}
              {renderFormattedNumberInput('employment', 'monthlyIncome', 'Primary Monthly Income')}
              {renderFormattedNumberInput('employment', 'otherIncome', 'Other Sources of Income')}
              {renderFormattedNumberInput('employment', 'debtObligations', 'Existing Monthly Debt Obligations')}
              <div className="md:col-span-2 bg-blue-50 p-4 rounded-md border border-blue-200 mt-2">
                <h4 className="font-bold text-blue-800 text-sm mb-2">Auto-Calculated Totals</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Total Household Income: <span className="font-bold">${calculations.totalIncome.toLocaleString()}</span></div>
                  <div>Total Existing Debt: <span className="font-bold">${calculations.totalExistingDebt.toLocaleString()}</span></div>
                </div>
              </div>
              <div className="md:col-span-2 border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Detailed Employment Information</h4>
              </div>
              {renderInput('employmentInformation', 'employmentStatus', 'Employment Status')}
              {renderInput('employmentInformation', 'employerBusinessName', 'Employer / Business Name')}
              {renderInput('employmentInformation', 'officeAddress', 'Office Address')}
              {renderInput('employmentInformation', 'occupation', 'Occupation')}
              {renderInput('employmentInformation', 'position', 'Position')}
              {renderInput('employmentInformation', 'natureOfWorkBusiness', 'Nature of Work / Business')}
              {renderInput('employmentInformation', 'dateHired', 'Date Hired', 'date')}
              {renderInput('employmentInformation', 'officePhoneNumber', 'Office Phone Number')}
              {renderInput('employmentInformation', 'previousEmployer', 'Previous Employer')}
              {renderInput('employmentInformation', 'totalYearsWorking', 'Total Years Working')}
              {renderFormattedNumberInput('employmentInformation', 'grossMonthlyIncome', 'Gross Monthly Income')}
              {renderInput('employmentInformation', 'monthlyLivingExpenses', 'Monthly Living Expenses', 'number')}
              {renderFormattedNumberInput('employmentInformation', 'otherSourcesOfIncome', 'Other Sources of Income')}
              {renderFormattedNumberInput('employmentInformation', 'investmentIncome', 'Investment Income')}
              {renderFormattedNumberInput('employmentInformation', 'businessIncome', 'Business Income')}
              {renderInput('employmentInformation', 'pensionIncome', 'Pension Income', 'number')}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold text-slate-800">Step 4: Co-Borrower Information</h3>
                <button onClick={addCoBorrower} className="loan-inline-button loan-inline-button-primary text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Add Co-Borrower</button>
              </div>
              {formData.coBorrowers.length === 0 && <p className="text-gray-500 italic text-sm">No co-borrowers added. Click above to add.</p>}
              {formData.coBorrowers.map((cb, idx) => (
                <div key={cb.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
                  <button onClick={() => removeCoBorrower(cb.id)} className="loan-icon-button absolute top-2 right-2 text-red-500 hover:text-red-700 text-sm font-bold">Remove</button>
                  <h4 className="font-semibold text-sm text-gray-700 mb-3">Co-Borrower #{idx + 1}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Full Name</label>
                      <input value={cb.name} onChange={(e) => updateCoBorrower(cb.id, 'name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Relationship</label>
                      <input value={cb.relationship} onChange={(e) => updateCoBorrower(cb.id, 'relationship', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Monthly Income</label>
                      <input type="number" value={cb.monthlyIncome === 0 ? '' : cb.monthlyIncome} onChange={(e) => updateCoBorrower(cb.id, 'monthlyIncome', parseFloat(e.target.value)||0)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Debt Obligations</label>
                      <input type="number" value={cb.debtObligations === 0 ? '' : cb.debtObligations} onChange={(e) => updateCoBorrower(cb.id, 'debtObligations', parseFloat(e.target.value)||0)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Credit Standing</label>
                      <select value={cb.creditStanding} onChange={(e) => updateCoBorrower(cb.id, 'creditStanding', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                        <option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Spouse / Co-Borrower Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    ['spouseInformation', 'fullName', 'Full Name'],
                    ['spouseInformation', 'dateOfBirth', 'Date of Birth'],
                    ['spouseInformation', 'placeOfBirth', 'Place of Birth'],
                    ['spouseInformation', 'citizenship', 'Citizenship'],
                    ['spouseInformation', 'mobileNumber', 'Mobile Number'],
                    ['spouseInformation', 'presentAddress', 'Present Address'],
                    ['spouseInformation', 'employerBusinessName', 'Employer / Business Name'],
                    ['spouseInformation', 'officeAddress', 'Office Address'],
                    ['spouseInformation', 'occupation', 'Occupation'],
                    ['spouseInformation', 'position', 'Position'],
                    ['spouseInformation', 'natureOfWork', 'Nature of Work'],
                    ['spouseInformation', 'yearsWithEmployer', 'Years with Employer'],
                    ['spouseInformation', 'previousEmployer', 'Previous Employer'],
                    ['spouseInformation', 'totalYearsWorking', 'Total Years Working'],
                    ['spouseInformation', 'grossMonthlyIncome', 'Gross Monthly Income'],
                    ['spouseInformation', 'monthlyExpenses', 'Monthly Expenses'],
                    ['spouseInformation', 'otherIncomeSources', 'Other Income Sources'],
                  ].map(([section, field, label]) => (
                    field === 'grossMonthlyIncome'
                      ? renderFormattedNumberInput(
                          section as EditableSection,
                          field,
                          label,
                        )
                      : renderInput(
                      section as EditableSection,
                      field,
                      label,
                      field === 'dateOfBirth' ? 'date' : field === 'grossMonthlyIncome' || field === 'monthlyExpenses' ? 'number' : 'text',
                    )
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="col-span-full text-lg font-bold text-slate-800 border-b pb-2">Step 5: Banking Relationships</h3>
              <div className="md:col-span-2 border-b pb-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Existing Credit Card Information</h4>
              </div>
              {renderInput('bankingRelationships', 'creditCardIssuer', 'Card Issuer')}
              {renderInput('bankingRelationships', 'creditCardNumber', 'Card Number')}
              {renderInput('bankingRelationships', 'creditLimit', 'Credit Limit', 'number')}
              {renderInput('bankingRelationships', 'outstandingBalance', 'Outstanding Balance', 'number')}
              {renderInput('bankingRelationships', 'memberSince', 'Member Since', 'date')}
              <div className="md:col-span-2 border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Existing Bank Account Information</h4>
              </div>
              {renderInput('bankingRelationships', 'bankBranch', 'Bank / Branch')}
              {renderInput('bankingRelationships', 'accountType', 'Account Type')}
              {renderInput('bankingRelationships', 'accountNumber', 'Account Number')}
              {renderInput('bankingRelationships', 'currentBalance', 'Current Balance', 'number')}
              <div className="md:col-span-2 border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Existing Loan Information</h4>
              </div>
              {renderInput('bankingRelationships', 'loanLender', 'Lender / Bank')}
              {renderInput('bankingRelationships', 'loanType', 'Loan Type')}
              {renderFormattedNumberInput('bankingRelationships', 'loanCurrentBalance', 'Current Loan Balance')}
              {renderInput('bankingRelationships', 'loanMonthlyAmortization', 'Monthly Amortization', 'number')}
            </div>
          )}

          {step === 6 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="col-span-full text-lg font-bold text-slate-800 border-b pb-2">Step 6: Collateral Details</h3>
              <div className="md:col-span-2">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Asset / Vehicle Information</h4>
              </div>
              {renderInput('collateral', 'vehicleInfo', 'Asset/Vehicle Information')}
              {renderInput('collateral', 'appraisedValue', 'Appraised Value', 'number')}
              {renderInput('collateral', 'insurance', 'Insurance Provider & Policy #')}
              {renderInput('collateral', 'registration', 'Registration / OR/CR Number')}
              <div className="md:col-span-2 border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Home Loan / Property Information (if applicable)</h4>
              </div>
              {renderInput('collateralInformation', 'propertyAddress', 'Property Address')}
              {renderInput('collateralInformation', 'registeredOwner', 'Registered Owner')}
              {renderInput('collateralInformation', 'lotNumber', 'Lot Number')}
              {renderInput('collateralInformation', 'blockNumber', 'Block Number')}
              {renderInput('collateralInformation', 'tctCctNumber', 'TCT/CCT Number')}
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Step 7: Document Upload Center</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition">
                <input type="file" id="fileUpload" className="hidden" onChange={(event) => void handleFileUpload(event)} accept="image/*" capture="environment" />
                <label htmlFor="fileUpload" className="cursor-pointer flex flex-col items-center">
                  <svg
                    className="mb-2 text-gray-400"
                    style={{ width: 40, height: 40, maxWidth: 40, maxHeight: 40 }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                  <span className="text-sm font-medium text-blue-600">Click to upload documents</span>
                  <span className="text-xs text-gray-500 mt-1">Payslips, bank statements, and IDs as image files only</span>
                </label>
              </div>
              
              <div className="space-y-2 mt-4">
                {formData.documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-md shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-100 p-2 rounded">📄</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{doc.name}</p>
                        <p className="text-xs text-gray-500">{doc.parsedData || 'Awaiting parsing...'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${getDocumentStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                      {doc.status === 'Pending' && (
                        <span className="text-xs text-slate-500">Awaiting image analysis</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Required Supporting Documents</h4>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ['supportingDocuments', 'validGovernmentId', 'Valid Government ID'],
                    ['supportingDocuments', 'passportIfApplicable', 'Passport (if applicable)'],
                    ['supportingDocuments', 'driversLicense', 'Driver License'],
                    ['supportingDocuments', 'philSysId', 'PhilSys ID'],
                    ['supportingDocuments', 'certificateOfEmployment', 'Certificate of Employment'],
                    ['supportingDocuments', 'latestPayslips', 'Latest 3 Months Payslips'],
                    ['supportingDocuments', 'latestItr', 'Latest ITR'],
                    ['supportingDocuments', 'dtiSecRegistration', 'DTI/SEC Registration'],
                    ['supportingDocuments', 'businessPermit', 'Business Permit'],
                    ['supportingDocuments', 'financialStatements', 'Financial Statements'],
                    ['supportingDocuments', 'utilityBill', 'Utility Bill'],
                    ['supportingDocuments', 'waterBill', 'Water Bill'],
                    ['supportingDocuments', 'internetBill', 'Internet Bill'],
                    ['supportingDocuments', 'titleTctCct', 'Title (TCT/CCT)'],
                    ['supportingDocuments', 'taxDeclaration', 'Tax Declaration'],
                    ['supportingDocuments', 'lotPlan', 'Lot Plan'],
                    ['supportingDocuments', 'propertyPhotos', 'Property Photos'],
                    ['supportingDocuments', 'vehicleQuotation', 'Vehicle Quotation'],
                    ['supportingDocuments', 'vehicleInvoice', 'Vehicle Invoice'],
                    ['supportingDocuments', 'orCrForRefinancing', 'OR/CR (for refinancing)'],
                    ['supportingDocuments', 'proofOfIncome', 'Proof of Income'],
                    ['supportingDocuments', 'bankStatements', 'Bank Statements (last 6 months)'],
                    ['supportingDocuments', 'existingCreditCardStatements', 'Existing Credit Card Statements'],
                    ['supportingDocuments', 'additionalSupportingDocuments', 'Additional Supporting Documents'],
                    ['supportingDocuments', 'auditedFinancialStatements', 'Audited Financial Statements'],
                    ['supportingDocuments', 'proofOfRemittanceIncome', 'Proof of Remittance Income'],
                    ['supportingDocuments', 'investmentStatements', 'Investment Statements'],
                  ].map(([section, field, label]) => renderCheckbox(section as EditableSection, field, label))}
                </div>
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_58%,#334155_100%)] p-6 text-white shadow-[0_22px_48px_rgba(15,23,42,0.18)] md:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-300">Step 8: Credit Scoring</p>
                    <h3 className="m-0 text-3xl font-semibold tracking-tight text-white">Executive Credit Assessment</h3>
                    <p className="text-sm leading-6 text-slate-300 md:text-base">
                      Consolidated underwriting view for debt capacity, collateral quality,
                      profitability, and AI-assisted approval guidance.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[340px]">
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Total Automated Score</p>
                      <p className="mt-2 text-4xl font-semibold text-white">
                        {automatedScorecard.total}
                        <span className="ml-1 text-base font-medium text-slate-300">/50</span>
                      </p>
                      <p className="mt-2 text-xs text-slate-300">{automatedScoreBand}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">AI Approval Outlook</p>
                      <p className="mt-2 text-4xl font-semibold text-cyan-300">{aiRecommendation.probability}%</p>
                      <p className="mt-2 text-xs text-slate-300">
                        Suggested amount ${aiRecommendation.suggestedAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.95fr]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                    <div className="mb-5">
                      <h4 className="m-0 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Capacity Metrics</h4>
                      <p className="mt-2 text-sm text-slate-600">
                        Primary affordability ratios used to assess repayment pressure.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-rose-200 bg-[linear-gradient(180deg,#fff1f2_0%,#ffffff_100%)] p-5">
                  <h4 className="font-bold text-rose-800 text-[11px] uppercase tracking-[0.22em] mb-2">Debt-to-Income Ratio (DTI)</h4>
                  <p className="text-4xl font-semibold text-rose-700">{calculations.dti.toFixed(1)}%</p>
                  <p className="text-xs text-rose-700/80 mt-4 leading-5">Formula: (Total Existing Debt / Total Income) x 100</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-[linear-gradient(180deg,#fffbeb_0%,#ffffff_100%)] p-5">
                  <h4 className="font-bold text-amber-800 text-[11px] uppercase tracking-[0.22em] mb-2">Debt Service Ratio (DSR)</h4>
                  <p className="text-4xl font-semibold text-amber-700">{calculations.dsr.toFixed(1)}%</p>
                  <p className="text-xs text-amber-700/80 mt-4 leading-5">Formula: ((Existing Debt + Proposed Payment) / Total Income) x 100</p>
                </div>
              </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                    <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                      <div>
                        <h4 className="m-0 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Automated Lending Scorecard</h4>
                        <p className="mt-2 text-sm text-slate-600">Weighted 5C indicators automatically derived from the application record.</p>
                      </div>
                      <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                        Corporate Underwriting Index
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {automatedScoreItems.map((c, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.18em]">{c.label}</p>
                      <p className={`mt-4 text-4xl font-semibold ${c.score >= 8 ? 'text-emerald-600' : c.score >= 6 ? 'text-amber-600' : 'text-rose-600'}`}>{c.score}<span className="ml-1 text-base font-medium text-slate-400">/10</span></p>
                      <p className="mt-3 text-xs leading-5 text-slate-500">{c.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                    <div className="mb-5">
                      <h4 className="m-0 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Advanced Scoring Signals</h4>
                      <p className="mt-2 text-sm text-slate-600">Secondary screening signals for fraud resistance, profitability, and downstream risk.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                  {advancedSignalItems.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.18em]">{item.label}</p>
                      <p className={`mt-3 text-3xl font-semibold ${item.tone}`}>{item.value}</p>
                      <p className="mt-2 text-xs text-slate-500">{item.note}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {profitabilityBreakdown.map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                      <p className="mt-2 text-lg font-semibold text-slate-800">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
                </div>

                <div className="space-y-6">
              <div className="rounded-[24px] border border-indigo-200 bg-[linear-gradient(180deg,#eef2ff_0%,#f8fbff_100%)] p-6 shadow-sm">
                <div className="flex flex-col gap-5 border-b border-indigo-100 pb-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="m-0 text-sm font-semibold text-indigo-700 uppercase tracking-[0.22em]">AI Approval Probability</h4>
                    <p className="mt-3 text-5xl font-semibold tracking-tight text-indigo-700">{aiRecommendation.probability}%</p>
                    <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${aiRiskTone}`}>
                      Risk Level: {aiRecommendation.riskLevel}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-right shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Suggested Loan Amount</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">${aiRecommendation.suggestedAmount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/70 bg-white/70 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Monthly Amortization</p>
                    <p className="mt-2 text-xl font-semibold text-slate-800">${calculations.monthlyPayment.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white/70 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Loan-to-Value Ratio (LTV)</p>
                    <p className="mt-2 text-xl font-semibold text-slate-800">{calculations.ltv.toFixed(1)}%</p>
                  </div>
                </div>
                </div>
                <div className="mt-5">
                  <h5 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-900">Computation Log</h5>
                  <div className="mt-4 rounded-2xl border border-indigo-100 bg-white/80 p-4">
                  <ul className="space-y-3">
                    {aiRecommendation.computationLog.map((log, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                        <span className="mt-1 h-2 w-2 flex-none rounded-full bg-indigo-500" />
                        <span className="leading-6">{log}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <h4 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Underwriting Note</h4>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      This panel combines repayment capacity, collateral adequacy, and AI-assisted
                      decision support into a single review surface designed for credit officers and
                      approval committee presentation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 9 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Step 9: Approval Workflow</h3>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Credit Committee Remarks</label>
                <textarea 
                  value={formData.committeeRemarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, committeeRemarks: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter conditions, stipulations, or approval notes here..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderInput('routing', 'creditOfficer', 'Assigned Credit Officer')}
                {renderInput('routing', 'branchManager', 'Branch Manager')}
                {renderInput('routing', 'creditCommittee', 'Committee Status')}
                <div className="mb-3 flex items-center mt-6">
                  <input type="checkbox" checked={formData.routing.executiveApproval} onChange={(e) => updateField('routing', 'executiveApproval', e.target.checked)} className="mr-2 h-4 w-4" />
                  <label className="text-sm font-medium text-gray-700">Requires Executive Approval</label>
                </div>
              </div>
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Signatures & Authorization</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    ['signatures', 'applicantSignature', 'Applicant Signature'],
                    ['signatures', 'spouseOrCoBorrowerSignature', 'Spouse / Co-Borrower Signature'],
                    ['signatures', 'borrowerSignatureAutoLoanInsurance', 'Borrower Signature (Auto Loan Insurance)'],
                    ['signatures', 'extensionCardholderSignature', 'Extension Cardholder Signature'],
                  ].map(([section, field, label]) => renderInput(section as EditableSection, field, label))}
                </div>
              </div>

              <div className="border-t pt-4 mt-4 space-y-6">
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">Enhanced Due Diligence & Declarations</h4>
                  <p className="text-sm text-slate-500">
                    These required fields capture the previously missing or only partially captured underwriting details.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h5 className="font-semibold text-sm text-slate-700 mb-3">Credit Exposure & Banking Background</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderTextarea('enhancedDueDiligence', 'previousLendersAndExistingLoanAccounts', 'Previous Lenders and Existing Loan Accounts', 3, true)}
                    {renderInput('enhancedDueDiligence', 'numberOfActiveLoans', 'Number of Active Loans', 'number')}
                    {renderTextarea('enhancedDueDiligence', 'previousLoanRestructuringDisclosures', 'Previous Loan Restructuring Disclosures', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'additionalBankAccountsOwned', 'Additional Bank Accounts Owned', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'priorBankingRelationships', 'Prior Banking Relationships', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'existingInsurancePolicies', 'Existing Insurance Policies', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'selfDeclaredAssetsAndLiabilities', 'Self-Declared Assets and Liabilities', 4, true)}
                    {renderTextarea('enhancedDueDiligence', 'selfDeclaredInvestmentPortfolio', 'Self-Declared Investment Portfolio', 4, true)}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h5 className="font-semibold text-sm text-slate-700 mb-3">Employment, Income, and Residence Verification</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderTextarea('enhancedDueDiligence', 'employmentReferencePerson', 'Employment Reference Person', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'hrContactInformation', 'HR Contact Information', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'supervisorInformation', 'Supervisor Information', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'sourceOfIncomeVerificationReferences', 'Source of Income Verification References', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'lengthOfResidenceConfirmation', 'Length of Residence Confirmation', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'utilityAccountReferences', 'Utility Account References', 3, true)}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h5 className="font-semibold text-sm text-slate-700 mb-3">References, Declarations, and Professional Profile</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderTextarea('enhancedDueDiligence', 'characterReferences', 'Character References', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'guarantorReferences', 'Guarantor References', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'coBorrowerReferences', 'Co-Borrower References', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'referencesFromEmployerOrCommunity', 'References from Employer or Community', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'professionalOrganizationMemberships', 'Professional Organization Memberships', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'professionalLicenses', 'Professional Licenses', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'additionalPropertyDeclarations', 'Additional Property Declarations', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'additionalVehicleDeclarations', 'Additional Vehicle Declarations', 3, true)}
                    {renderTextarea('enhancedDueDiligence', 'communityInvolvementInformation', 'Community Involvement Information', 3, true)}
                    {renderInput('enhancedDueDiligence', 'facebookProfile', 'Facebook Profile (Optional)')}
                    {renderInput('enhancedDueDiligence', 'instagramProfile', 'Instagram Profile (Optional)')}
                    {renderInput('enhancedDueDiligence', 'xProfile', 'X / Twitter Profile (Optional)')}
                    {renderInput('enhancedDueDiligence', 'tikTokProfile', 'TikTok Profile (Optional)')}
                    {renderInput('enhancedDueDiligence', 'linkedInProfile', 'LinkedIn Profile (Optional)')}
                    {renderTextarea('enhancedDueDiligence', 'otherSocialMediaLinks', 'Other Social Media Links (Optional)', 2)}
                    {renderInput('enhancedDueDiligence', 'businessWebsite', 'Business Website (If Self-Employed / Optional)')}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h5 className="font-semibold text-sm text-slate-700 mb-3">Questionnaires and Behavioral Assessment</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderTextarea('enhancedDueDiligence', 'financialBehaviorQuestionnaireResponses', 'Financial Behavior Questionnaire Responses', 4, true)}
                    {renderTextarea('enhancedDueDiligence', 'riskAppetiteQuestionnaireResponses', 'Risk Appetite Questionnaire Responses', 4, true)}
                    {renderTextarea('enhancedDueDiligence', 'businessOutlookQuestionnaireResponses', 'Business Outlook Questionnaire Responses', 4, true)}
                    {renderTextarea('enhancedDueDiligence', 'futureFinancialPlansQuestionnaire', 'Future Financial Plans Questionnaire', 4, true)}
                    {renderTextarea('enhancedDueDiligence', 'spendingBehaviorQuestionnaire', 'Spending Behavior Questionnaire', 4, true)}
                    {renderTextarea('enhancedDueDiligence', 'householdBudgetingQuestionnaire', 'Household Budgeting Questionnaire', 4, true)}
                    {renderTextarea('enhancedDueDiligence', 'emergencyPreparednessQuestionnaire', 'Emergency Preparedness Questionnaire', 4, true)}
                    {renderTextarea('enhancedDueDiligence', 'characterAndIntegrityAssessmentAnswers', 'Character and Integrity Assessment Answers', 4, true)}
                  </div>
                </div>

                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                  <div className="mb-3">
                    <h5 className="font-semibold text-sm text-indigo-800 mb-1">Optional to Answer: 20-Question Psychometric Scoring Questionnaire</h5>
                    <p className="text-sm text-indigo-700/80">
                      This optional section helps profile planning, financial discipline, consistency, and repayment behavior.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {psychometricQuestionnaireItems.map((item, index) => (
                      <div key={item.field} className="rounded-lg border border-indigo-100 bg-white p-3">
                        <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">
                          {index + 1}. {item.question}
                        </label>
                        <select
                          value={String(getInputValue('optionalPsychometricQuestionnaire', item.field))}
                          onChange={(event) =>
                            updateField('optionalPsychometricQuestionnaire', item.field, event.target.value)
                          }
                          className="loan-form-select w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select...</option>
                          {psychometricResponseOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h5 className="font-semibold text-sm text-slate-700 mb-3">Verification Consents</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {renderCheckbox('enhancedDueDiligence', 'consentOpenBankingDataAccess', 'Consent for Open Banking Data Access')}
                    {renderCheckbox('enhancedDueDiligence', 'consentEmploymentVerification', 'Consent for Employment Verification')}
                    {renderCheckbox('enhancedDueDiligence', 'consentIdentityVerification', 'Consent for Identity Verification')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 10 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Step 10: Loan Release & Booking</h3>
              <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">
                <h4 className="font-bold text-blue-800 mb-2 text-sm uppercase">✅ System Validation Check</h4>
                <ul className="space-y-1">
                  {validationChecks.map((check, idx) => (
                    <li key={idx} className={`text-sm flex items-center gap-2 ${check.passed ? 'text-green-700' : 'text-red-600'}`}>
                      {check.passed ? '✓' : '✗'} {check.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200 mb-4">
                <h4 className="font-bold text-green-800 text-sm mb-3">Approval Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-white/50 p-3 rounded">
                    <span className="text-gray-600">Requested Loan Amount:</span>
                    <p className="text-xl font-bold text-green-700">${formData.loan.amount.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/50 p-3 rounded">
                    <span className="text-gray-600">Approved Loan Amount:</span>
                    <p className="text-xl font-bold text-blue-700">${aiRecommendation.suggestedAmount.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/50 p-3 rounded">
                    <span className="text-gray-600">Monthly Amortization:</span>
                    <p className="text-xl font-bold text-orange-700">${calculations.monthlyPayment.toFixed(2)}</p>
                  </div>
                  <div className="bg-white/50 p-3 rounded">
                    <span className="text-gray-600">AI Approval Probability:</span>
                    <p className="text-xl font-bold text-indigo-700">{aiRecommendation.probability}%</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderInput('disbursement', 'bankAccount', 'Disbursement Bank Account')}
                {renderInput('disbursement', 'accountNumber', 'Account Number')}
                {renderInput('disbursement', 'disbursementDate', 'Scheduled Disbursement Date', 'date')}
                {renderInput('disbursement', 'bookingDate', 'Loan Booking Date', 'date')}
                {renderInput('disbursement', 'startRepaymentDate', 'Start of Repayment', 'date')}
                {renderInput('disbursement', 'firstPaymentDate', 'First Payment Due Date', 'date')}
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Final Checklist</h4>
                <div className="space-y-2">
                  <label className="flex items-center text-sm cursor-pointer">
                    <input type="checkbox" checked={formData.finalChecklist?.allRequiredDocumentsProvided || false} onChange={(e) => updateField('finalChecklist', 'allRequiredDocumentsProvided', e.target.checked)} className="mr-3 h-4 w-4" />
                    <span className="text-gray-700">All required documents provided</span>
                  </label>
                  <label className="flex items-center text-sm cursor-pointer">
                    <input type="checkbox" checked={formData.finalChecklist?.allSignaturesCollected || false} onChange={(e) => updateField('finalChecklist', 'allSignaturesCollected', e.target.checked)} className="mr-3 h-4 w-4" />
                    <span className="text-gray-700">All signatures collected</span>
                  </label>
                  <label className="flex items-center text-sm cursor-pointer">
                    <input type="checkbox" checked={formData.finalChecklist?.creditCommitteeApproved || false} onChange={(e) => updateField('finalChecklist', 'creditCommitteeApproved', e.target.checked)} className="mr-3 h-4 w-4" />
                    <span className="text-gray-700">Credit committee approved</span>
                  </label>
                  <label className="flex items-center text-sm cursor-pointer">
                    <input type="checkbox" checked={formData.finalChecklist?.executiveApprovalObtained || false} onChange={(e) => updateField('finalChecklist', 'executiveApprovalObtained', e.target.checked)} className="mr-3 h-4 w-4" />
                    <span className="text-gray-700">Executive approval obtained</span>
                  </label>
                  <label className="flex items-center text-sm cursor-pointer">
                    <input type="checkbox" checked={formData.finalChecklist?.collateralDocumentationReady || false} onChange={(e) => updateField('finalChecklist', 'collateralDocumentationReady', e.target.checked)} className="mr-3 h-4 w-4" />
                    <span className="text-gray-700">Collateral documentation ready</span>
                  </label>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Release Authorization Notes</label>
                <textarea 
                  value={formData.releaseNotes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, releaseNotes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Any final notes or special conditions for loan release..."
                />
              </div>

              <div className="bg-slate-800 text-white p-6 rounded-lg mt-6">
                <h4 className="font-bold text-lg mb-4">Final Workflow Actions</h4>
                <div className="flex flex-wrap gap-3 items-end">
                  <button onClick={handleSaveDraft} disabled={isSaving} className="loan-inline-button loan-inline-button-secondary px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm font-medium transition disabled:opacity-50">Save Draft</button>

                  <div className="min-w-[220px]">
                    <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-300">
                      Workflow Action
                    </label>
                    <p className="mb-2 text-xs text-slate-400">
                      Suggested next: <span className="font-semibold text-slate-100">{suggestedWorkflowLabel}</span>
                    </p>
                    <select
                      value={selectedWorkflowAction}
                      onChange={(event) =>
                        setSelectedWorkflowAction(event.target.value as WorkflowStatus)
                      }
                      className="loan-form-select w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {workflowActionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleSelectedWorkflowAction}
                    disabled={isSaving}
                    className="loan-inline-button loan-inline-button-accent inline-flex min-h-[42px] items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold tracking-wide text-white transition hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {workflowActionOptions.find((option) => option.value === selectedWorkflowAction)?.label ?? 'Save Workflow Action'}
                  </button>

                  {formData.status === 'Released' && (
                    <span className="px-4 py-2 bg-green-800 text-green-100 rounded text-sm font-bold border border-green-600">Application Successfully Released</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {step < 10 && (
          <div className="bg-gray-50 p-6 border-t flex justify-between">
            <button onClick={() => setStep(prev => Math.max(prev - 1, 1))} disabled={step === 1} className={`${footerButtonClass} loan-footer-button-secondary border border-gray-300 text-gray-700 hover:bg-gray-100`}>
              ← Back
            </button>
            <div className="flex gap-3">
              <button onClick={handleSaveDraft} disabled={isSaving} className="loan-footer-link inline-flex min-h-[42px] items-center justify-center px-4 py-2 text-sm font-semibold tracking-wide text-gray-600 transition hover:text-gray-800 disabled:opacity-50">Save Draft</button>
              <button onClick={() => setStep(prev => Math.min(prev + 1, 10))} className={`${footerButtonClass} loan-footer-button-primary bg-blue-600 text-white shadow-sm hover:bg-blue-700`}>
                Next Step →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
