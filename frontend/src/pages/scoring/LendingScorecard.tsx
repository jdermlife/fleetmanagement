import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

import {
  api,
  checkCreditCardRiskWithAi,
  generateCreditAdvisorPlan,
  getErrorMessage,
  type CreditCardRiskCheckResult,
  type CreditAdvisorResult,
} from '../../api';
import {
  computeQuantScores,
  createLoanApplication,
  fetchLoanCreationEntitlement,
  fetchLoanApplication,
  type LoanCreationEntitlementResponse,
  type QuantScoresSummary,
  updateLoanApplication,
  updateLoanApplicationStatus,
  type LoanApplicationRequirements,
  type LoanApplicationPayload,
  type LoanApplicationRecord,
  type ProductType,
  type WorkflowStatus,
} from '../../api/loan';
import {
  CREDIT_POLICY_THRESHOLDS,
  isAcceptableDsr,
  isApproveBand,
  isLowRiskProbability,
  isMediumRiskProbability,
  isReviewRecommendationProbability,
  isSafeLtv,
  isStrongDsr,
  isWorkflowAutoApproveProbability,
  isWorkflowAutoRejectProbability,
} from '../../config/creditPolicy';
import { useAuthorization } from '../../hooks/useAuthorization';
import { useAutosaveDraft } from '../../autosave/useAutosaveDraft';
import { isBorrowerSubscriberRole } from '../../authRoles';
import {
  calculateApplicationInformationCompletion,
  CREDIT_RATING_MINIMUM_INFORMATION_PERCENT,
  type InformationStepNumber,
} from './applicationCompleteness';
import { calculateCompositeInternalScore, toFilscore } from './filscoreScale';

// --- TypeScript Interfaces (PostgreSQL Schema Mapping) ---
interface BorrowerInfo { fullName: string; email: string; phone: string; govId: string; address: string; }
interface CoBorrower { id: string; name: string; relationship: string; monthlyIncome: number; debtObligations: number; creditStanding: string; }
interface Employment { history: string; monthlyIncome: number; otherIncome: number; debtObligations: number; }
interface LoanDetails { amount: number; termMonths: number; interestRate: number; purpose: string; productType: ProductType; }
interface Collateral { securityClassification: string; assetType: string; maker: string; brand: string; model: string; year: string; vehicleMarketabilityCategory: string; vehicleConditionCategory: string; vehicleTypeCategory: string; motorcycleIntendedUse: string; useAsCollateral: boolean; appraisedValue: number; insuranceProviderCompany: string; policyNumber: string; orNumber: string; crNumber: string; vehicleInfo: string; insurance: string; registration: string; }
interface AdditionalCollateral { id: string; collateralType: string; propertyType: string; maker: string; brand: string; model: string; year: string; appraisedValue: number; insuranceProviderCompany: string; policyNumber: string; orNumber: string; crNumber: string; tctCctNumber: string; notes: string; }
interface ApplicantPersonal { lastName: string; firstName: string; middleName: string; dateOfBirth: string; placeOfBirth: string; age: number; gender: string; citizenship: string; numberOfDependents: number; maritalStatus: string; mothersMaidenName: string; }
interface ContactInformation { mobileNumber: string; mobileYearsUsed: string; homePhoneNumber: string; emailAddress: string; emailYearsUsed: string; }
interface GovernmentIds { tin: string; sssGsisNumber: string; otherGovernmentId: string; idNumber: string; issueDate: string; expiryDate: string; }
interface AddressInformation { presentAddress: string; permanentAddress: string; mailingAddress: string; lengthOfStay: string; }
interface OtherInformation { homeOwnership: string; educationalAttainment: string; numberOfVehiclesOwned: number; recentPhotoUploaded: boolean; deviceVerified: boolean; hasCoBorrower: boolean; }
interface EmploymentInformation { employmentStatus: string; employmentLocation: string; employerBusinessName: string; employerBusinessYears: number; officeAddress: string; occupation: string; position: string; natureOfWorkBusiness: string; dateHired: string; officePhoneNumber: string; previousEmployer: string; totalYearsWorking: string; grossMonthlyIncome: number; monthlyLivingExpenses: number; otherSourcesOfIncome: number; investmentIncome: number; businessIncome: number; pensionIncome: number; otherIncome: string; }
interface CollateralInformation { propertyAddress: string; registeredOwner: string; lotNumber: string; blockNumber: string; tctCctNumber: string; propertyMarketabilityCategory: string; houseUnitModelCategory: string; collateralOccupancyType: string; propertyAppraisedValue: number; }
interface SpouseInformation { fullName: string; dateOfBirth: string; placeOfBirth: string; citizenship: string; mobileNumber: string; presentAddress: string; employerBusinessName: string; officeAddress: string; occupation: string; position: string; natureOfWork: string; yearsWithEmployer: string; previousEmployer: string; totalYearsWorking: string; grossMonthlyIncome: number; monthlyExpenses: number; otherIncomeSources: string; }
interface BankingRelationships { creditCardIssuer: string; creditCardNumber: string; creditPaymentHistory: string; creditCardRelationshipStatus: string; creditLimit: number; outstandingBalance: number; memberSince: string; bankBranch: string; accountType: string; accountNumber: string; currentBalance: number; averageSavingsBalance: number; averageDailyBalance: number; depositRegularity: string; bankingRelationshipTier: string; accountHandling: string; utilityCreditBureauStatus: string; loanLender: string; loanType: string; loanCurrentBalance: number; loanMonthlyAmortization: number; }
interface Signatures { applicantSignature: string; spouseOrCoBorrowerSignature: string; borrowerSignatureAutoLoanInsurance: string; extensionCardholderSignature: string; }
interface SupportingDocuments { validGovernmentId: boolean; selfiePhotoOptional?: boolean; passportIfApplicable: boolean; driversLicense: boolean; philSysId: boolean; certificateOfEmployment: boolean; latestPayslips: boolean; latestItr: boolean; dtiSecRegistration: boolean; businessPermit: boolean; financialStatements: boolean; utilityBill: boolean; waterBill: boolean; internetBill: boolean; titleTctCct: boolean; taxDeclaration: boolean; lotPlan: boolean; propertyPhotos: boolean; vehicleQuotation: boolean; vehicleInvoice: boolean; orCrForRefinancing: boolean; proofOfIncome: boolean; bankStatements: boolean; existingCreditCardStatements: boolean; additionalSupportingDocuments: boolean; auditedFinancialStatements: boolean; proofOfRemittanceIncome: boolean; investmentStatements: boolean; }
interface EnhancedDueDiligence { previousLendersAndExistingLoanAccounts: string; numberOfActiveLoans: number; previousLoanRestructuringDisclosures: string; lifestyleIndicator: string; secondaryIncomeProfile: string; employmentReferencePerson: string; hrContactInformation: string; supervisorInformation: string; additionalBankAccountsOwned: string; sourceOfIncomeVerificationReferences: string; lengthOfResidenceConfirmation: string; utilityAccountReferences: string; digitalBankingUsage: string; characterReferences: string; communityReputation: string; professionalOrganizationMemberships: string; professionalLicenses: string; facebookProfile: string; facebookProfileDateOpened: string; instagramProfile: string; instagramProfileDateOpened: string; xProfile: string; xProfileDateOpened: string; tikTokProfile: string; tikTokProfileDateOpened: string; linkedInProfile: string; linkedInProfileDateOpened: string; otherSocialMediaLinks: string; businessWebsite: string; guarantorReferences: string; coBorrowerReferences: string; additionalPropertyDeclarations: string; additionalVehicleDeclarations: string; selfDeclaredAssetsAndLiabilities: string; selfDeclaredInvestmentPortfolio: string; existingInsurancePolicies: string; priorBankingRelationships: string; consentOpenBankingDataAccess: boolean; consentEmploymentVerification: boolean; consentIdentityVerification: boolean; psychometricQuestionnaireResponses: string; financialBehaviorQuestionnaireResponses: string; riskAppetiteQuestionnaireResponses: string; businessOutlookQuestionnaireResponses: string; futureFinancialPlansQuestionnaire: string; spendingBehaviorQuestionnaire: string; householdBudgetingQuestionnaire: string; emergencyPreparednessQuestionnaire: string; characterAndIntegrityAssessmentAnswers: string; communityInvolvementInformation: string; referencesFromEmployerOrCommunity: string; }
interface FraudVerification { faceMatchScore: number; livenessDetection: string; incomeDocumentsStatus: string; employmentVerificationStatus: string; bankStatementVerificationStatus: string; payrollVerificationStatus: string; bankAccountOwnershipStatus: string; }
interface DocumentAnalysis { ocrAnalysisStatus: string; }
interface DeviceRisk { deviceReputation: string; ipAddressRisk: string; deviceConsistency: string; }
interface FraudIntelligence { watchlistStatus: string; previousFraudRecords: string; applicationVelocity: string; fakeNationalId: boolean; forgedPayslip: boolean; forgedBankStatement: boolean; identityTheftIndicator: boolean; sanctionsPepMatch: boolean; }
interface OptionalPsychometricQuestionnaire { question01: string; question02: string; question03: string; question04: string; question05: string; question06: string; question07: string; question08: string; question09: string; question10: string; question11: string; question12: string; question13: string; question14: string; question15: string; question16: string; question17: string; question18: string; question19: string; question20: string; }
type PsychometricAssessment = Record<string, string>;
interface DocumentItem { id: string; name: string; type: string; parsedData?: string; status: 'Pending' | 'Parsed' | 'Failed'; }
interface Disbursement { bankAccount: string; accountNumber: string; disbursementDate: string; bookingDate: string; startRepaymentDate: string; firstPaymentDate: string; }
interface FinalChecklist { allRequiredDocumentsProvided: boolean; allSignaturesCollected: boolean; creditCommitteeApproved: boolean; executiveApprovalObtained: boolean; collateralDocumentationReady: boolean; creditImprovementActionsTracked: boolean; }
interface AdvisorChecklistItem { id: string; text: string; done: boolean; }

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
  additionalCollaterals: AdditionalCollateral[];
  spouseInformation: SpouseInformation;
  bankingRelationships: BankingRelationships;
  signatures: Signatures;
  supportingDocuments: SupportingDocuments;
  enhancedDueDiligence: EnhancedDueDiligence;
  fraudVerification: FraudVerification;
  documentAnalysis: DocumentAnalysis;
  deviceRisk: DeviceRisk;
  fraudIntelligence: FraudIntelligence;
  optionalPsychometricQuestionnaire: OptionalPsychometricQuestionnaire;
  psychometricAssessment: PsychometricAssessment;
  documents: DocumentItem[];
  committeeRemarks: string;
  routing: { creditOfficer: string; branchManager: string; creditCommittee: string; executiveApproval: boolean; };
  disbursement: Disbursement;
  finalChecklist?: FinalChecklist;
  releaseNotes?: string;
  advisorChecklist: AdvisorChecklistItem[];
}

interface LendingAutosaveDraft {
  formData: LoanApplication;
  step: number;
  formattedNumberDrafts: Record<string, string>;
  documentReview: DocumentParseReview | null;
  reviewDocumentId: string | null;
  selectedWorkflowAction: WorkflowStatus;
}

const createBlankSpouseInformation = (): SpouseInformation => ({
  fullName: '',
  dateOfBirth: '',
  placeOfBirth: '',
  citizenship: '',
  mobileNumber: '',
  presentAddress: '',
  employerBusinessName: '',
  officeAddress: '',
  occupation: '',
  position: '',
  natureOfWork: '',
  yearsWithEmployer: '',
  previousEmployer: '',
  totalYearsWorking: '',
  grossMonthlyIncome: 0,
  monthlyExpenses: 0,
  otherIncomeSources: '',
});

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

const mapBackendQuantSummary = (
  summary:
    | {
        creditScore?: number;
        fraudScore?: number;
        socialScore?: number;
        psychometricScore?: number;
        relationshipScore?: number;
        profitabilityScore?: number;
        overallScore?: number;
        finalGrade?: string;
        decision?: string;
      }
    | null
    | undefined,
): QuantScoresSummary | null => {
  if (!summary) {
    return null;
  }

  return {
    credit_score: Math.round(summary.creditScore ?? 0),
    fraud_score: Math.round(summary.fraudScore ?? 0),
    social_score: Math.round(summary.socialScore ?? 0),
    psychometric_score: Math.round(summary.psychometricScore ?? 0),
    relationship_score: Math.round(summary.relationshipScore ?? 0),
    profitability_score: Math.round(summary.profitabilityScore ?? 0),
    overall_score: Math.round(summary.overallScore ?? 0),
    final_grade: summary.finalGrade ?? 'N/A',
    decision: (summary.decision ?? 'PENDING').toUpperCase(),
  };
};

const mapRecordQuantSummary = (
  record: LoanApplicationRecord,
): QuantScoresSummary | null => {
  if (!record.overall_scores) {
    return null;
  }

  return {
    credit_score: Math.round(record.overall_scores.credit_score ?? 0),
    fraud_score: Math.round(record.overall_scores.fraud_score ?? 0),
    social_score: Math.round(record.overall_scores.social_score ?? 0),
    psychometric_score: Math.round(record.overall_scores.psychometric_score ?? 0),
    relationship_score: Math.round(record.overall_scores.relationship_score ?? 0),
    profitability_score: Math.round(record.overall_scores.profitability_score ?? 0),
    overall_score: Math.round(record.overall_scores.final_score ?? 0),
    final_grade: record.overall_scores.final_grade ?? 'N/A',
    decision: (record.overall_scores.final_decision ?? 'PENDING').toUpperCase(),
  };
};

// --- Initial State Factory ---
const createNewApplicationInstance = (): LoanApplication => ({
  id: 'APP-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
  status: 'Draft',
  productType: 'Auto Loan',
  borrower: { fullName: '', email: '', phone: '', govId: '', address: '' },
  coBorrowers: [],
  employment: { history: '', monthlyIncome: 0, otherIncome: 0, debtObligations: 0 },
  loan: { amount: 0, termMonths: 12, interestRate: 5.5, purpose: '', productType: 'Auto Loan' },
  collateral: { securityClassification: '', assetType: '', maker: '', brand: '', model: '', year: '', vehicleMarketabilityCategory: '', vehicleConditionCategory: '', vehicleTypeCategory: '', motorcycleIntendedUse: '', useAsCollateral: true, appraisedValue: 0, insuranceProviderCompany: '', policyNumber: '', orNumber: '', crNumber: '', vehicleInfo: '', insurance: '', registration: '' },
  applicantPersonal: { lastName: '', firstName: '', middleName: '', dateOfBirth: '', placeOfBirth: '', age: 0, gender: '', citizenship: 'Filipino', numberOfDependents: 0, maritalStatus: '', mothersMaidenName: '' },
  contactInformation: { mobileNumber: '', mobileYearsUsed: '', homePhoneNumber: '', emailAddress: '', emailYearsUsed: '' },
  governmentIds: { tin: '', sssGsisNumber: '', otherGovernmentId: '', idNumber: '', issueDate: '', expiryDate: '' },
  addressInformation: { presentAddress: '', permanentAddress: '', mailingAddress: '', lengthOfStay: '' },
  otherInformation: { homeOwnership: '', educationalAttainment: '', numberOfVehiclesOwned: 0, recentPhotoUploaded: false, deviceVerified: false, hasCoBorrower: false },
  employmentInformation: { employmentStatus: '', employmentLocation: '', employerBusinessName: '', employerBusinessYears: 0, officeAddress: '', occupation: '', position: '', natureOfWorkBusiness: '', dateHired: '', officePhoneNumber: '', previousEmployer: '', totalYearsWorking: '', grossMonthlyIncome: 0, monthlyLivingExpenses: 0, otherSourcesOfIncome: 0, investmentIncome: 0, businessIncome: 0, pensionIncome: 0, otherIncome: '' },
  collateralInformation: { propertyAddress: '', registeredOwner: '', lotNumber: '', blockNumber: '', tctCctNumber: '', propertyMarketabilityCategory: '', houseUnitModelCategory: '', collateralOccupancyType: '', propertyAppraisedValue: 0 },
  additionalCollaterals: [],
  spouseInformation: createBlankSpouseInformation(),
  bankingRelationships: { creditCardIssuer: '', creditCardNumber: '', creditPaymentHistory: '', creditCardRelationshipStatus: '', creditLimit: 0, outstandingBalance: 0, memberSince: '', bankBranch: '', accountType: '', accountNumber: '', currentBalance: 0, averageSavingsBalance: 0, averageDailyBalance: 0, depositRegularity: '', bankingRelationshipTier: '', accountHandling: '', utilityCreditBureauStatus: '', loanLender: '', loanType: '', loanCurrentBalance: 0, loanMonthlyAmortization: 0 },
  signatures: { applicantSignature: '', spouseOrCoBorrowerSignature: '', borrowerSignatureAutoLoanInsurance: '', extensionCardholderSignature: '' },
  supportingDocuments: { validGovernmentId: false, selfiePhotoOptional: false, passportIfApplicable: false, driversLicense: false, philSysId: false, certificateOfEmployment: false, latestPayslips: false, latestItr: false, dtiSecRegistration: false, businessPermit: false, financialStatements: false, utilityBill: false, waterBill: false, internetBill: false, titleTctCct: false, taxDeclaration: false, lotPlan: false, propertyPhotos: false, vehicleQuotation: false, vehicleInvoice: false, orCrForRefinancing: false, proofOfIncome: false, bankStatements: false, existingCreditCardStatements: false, additionalSupportingDocuments: false, auditedFinancialStatements: false, proofOfRemittanceIncome: false, investmentStatements: false },
  enhancedDueDiligence: { previousLendersAndExistingLoanAccounts: '', numberOfActiveLoans: 0, previousLoanRestructuringDisclosures: '', lifestyleIndicator: '', secondaryIncomeProfile: '', employmentReferencePerson: '', hrContactInformation: '', supervisorInformation: '', additionalBankAccountsOwned: '', sourceOfIncomeVerificationReferences: '', lengthOfResidenceConfirmation: '', utilityAccountReferences: '', digitalBankingUsage: '', characterReferences: '', communityReputation: '', professionalOrganizationMemberships: '', professionalLicenses: '', facebookProfile: '', facebookProfileDateOpened: '', instagramProfile: '', instagramProfileDateOpened: '', xProfile: '', xProfileDateOpened: '', tikTokProfile: '', tikTokProfileDateOpened: '', linkedInProfile: '', linkedInProfileDateOpened: '', otherSocialMediaLinks: '', businessWebsite: '', guarantorReferences: '', coBorrowerReferences: '', additionalPropertyDeclarations: '', additionalVehicleDeclarations: '', selfDeclaredAssetsAndLiabilities: '', selfDeclaredInvestmentPortfolio: '', existingInsurancePolicies: '', priorBankingRelationships: '', consentOpenBankingDataAccess: false, consentEmploymentVerification: false, consentIdentityVerification: false, psychometricQuestionnaireResponses: '', financialBehaviorQuestionnaireResponses: '', riskAppetiteQuestionnaireResponses: '', businessOutlookQuestionnaireResponses: '', futureFinancialPlansQuestionnaire: '', spendingBehaviorQuestionnaire: '', householdBudgetingQuestionnaire: '', emergencyPreparednessQuestionnaire: '', characterAndIntegrityAssessmentAnswers: '', communityInvolvementInformation: '', referencesFromEmployerOrCommunity: '' },
  fraudVerification: { faceMatchScore: 0, livenessDetection: '', incomeDocumentsStatus: '', employmentVerificationStatus: '', bankStatementVerificationStatus: '', payrollVerificationStatus: '', bankAccountOwnershipStatus: '' },
  documentAnalysis: { ocrAnalysisStatus: '' },
  deviceRisk: { deviceReputation: '', ipAddressRisk: '', deviceConsistency: '' },
  fraudIntelligence: { watchlistStatus: '', previousFraudRecords: '', applicationVelocity: '', fakeNationalId: false, forgedPayslip: false, forgedBankStatement: false, identityTheftIndicator: false, sanctionsPepMatch: false },
  optionalPsychometricQuestionnaire: { question01: '', question02: '', question03: '', question04: '', question05: '', question06: '', question07: '', question08: '', question09: '', question10: '', question11: '', question12: '', question13: '', question14: '', question15: '', question16: '', question17: '', question18: '', question19: '', question20: '' },
  psychometricAssessment: createBlankPsychometricAssessment(),
  documents: [],
  committeeRemarks: '',
  routing: { creditOfficer: '', branchManager: '', creditCommittee: 'Pending', executiveApproval: false },
  disbursement: { bankAccount: '', accountNumber: '', disbursementDate: '', bookingDate: '', startRepaymentDate: '', firstPaymentDate: '' },
  finalChecklist: { allRequiredDocumentsProvided: false, allSignaturesCollected: false, creditCommitteeApproved: false, executiveApprovalObtained: false, collateralDocumentationReady: false, creditImprovementActionsTracked: false },
  releaseNotes: '',
  advisorChecklist: [],
});

const buildLoanRequirements = (
  application: LoanApplication,
  advisorChecklist: AdvisorChecklistItem[] = application.advisorChecklist,
): LoanApplicationRequirements => {
  const derivedVehicleInfo = buildCollateralVehicleInfo(application.collateral);
  const derivedInsuranceSummary = buildCollateralInsuranceSummary(application.collateral);

  return {
    productInformation: {
      productType: application.loan.productType,
      homePurposeOfLoan: application.loan.purpose,
      homeDesiredLoanAmount: application.loan.amount,
      homeLoanTerm: application.loan.termMonths,
      homeCollateralType:
        application.collateralInformation.houseUnitModelCategory ||
        application.collateralInformation.propertyAddress ||
        derivedVehicleInfo,
      autoPurpose: application.loan.purpose,
      autoVehicleClassification: application.collateral.assetType,
      autoUnitModel: application.collateral.model,
      autoYearModel: application.collateral.year,
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
    collateralAssetDetails: {
      securityClassification: application.collateral.securityClassification,
      assetType: application.collateral.assetType,
      maker: application.collateral.maker,
      brand: application.collateral.brand,
      model: application.collateral.model,
      year: application.collateral.year,
      vehicleMarketabilityCategory: application.collateral.vehicleMarketabilityCategory,
      vehicleConditionCategory: application.collateral.vehicleConditionCategory,
      vehicleTypeCategory: application.collateral.vehicleTypeCategory,
      motorcycleIntendedUse: application.collateral.motorcycleIntendedUse,
      useAsCollateral: application.collateral.useAsCollateral,
      insuranceProviderCompany:
        application.collateral.insuranceProviderCompany || derivedInsuranceSummary,
      policyNumber: application.collateral.policyNumber,
      orNumber: application.collateral.orNumber,
      crNumber: application.collateral.crNumber,
      additionalCollaterals: application.additionalCollaterals.map((collateral) => ({
        collateralType: collateral.collateralType,
        propertyType: collateral.propertyType,
        maker: collateral.maker,
        brand: collateral.brand,
        model: collateral.model,
        year: collateral.year,
        appraisedValue: collateral.appraisedValue,
        insuranceProviderCompany: collateral.insuranceProviderCompany,
        policyNumber: collateral.policyNumber,
        orNumber: collateral.orNumber,
        crNumber: collateral.crNumber,
        tctCctNumber: collateral.tctCctNumber,
        notes: collateral.notes,
      })),
    },
    spouseInformation: application.spouseInformation,
    coBorrowers: application.coBorrowers.map((coBorrower) => ({
      name: coBorrower.name,
      relationship: coBorrower.relationship,
      monthlyIncome: coBorrower.monthlyIncome,
      debtObligations: coBorrower.debtObligations,
      creditStanding: coBorrower.creditStanding,
    })),
    bankingRelationships: application.bankingRelationships,
    signatures: application.signatures,
    supportingDocuments: application.supportingDocuments,
    enhancedDueDiligence: application.enhancedDueDiligence,
    fraudVerification: application.fraudVerification,
    documentAnalysis: application.documentAnalysis,
    deviceRisk: application.deviceRisk,
    fraudIntelligence: application.fraudIntelligence,
    optionalPsychometricQuestionnaire: application.optionalPsychometricQuestionnaire,
    psychometricAssessment: application.psychometricAssessment,
    editorState: {
      documents: application.documents,
      routing: {
        creditOfficer: application.routing.creditOfficer,
        branchManager: application.routing.branchManager,
        creditCommittee: application.routing.creditCommittee,
      },
      disbursement: application.disbursement,
    },
    releaseReadiness: {
      finalChecklist: application.finalChecklist,
      releaseNotes: application.releaseNotes || '',
      advisorChecklist,
    },
  };
};

const calculateLoanMetrics = (application: LoanApplication) => {
  const totalCollateralValue = calculateTotalCollateralValue(application);
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
    totalCollateralValue > 0
      ? (application.loan.amount / totalCollateralValue) * 100
      : 0;

  return { totalIncome, totalExistingDebt, monthlyPayment, dti, dsr, ltv, totalCollateralValue };
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
  const canonicalEmail = getCanonicalBorrowerEmail(application);
  const canonicalPhone = getCanonicalBorrowerPhone(application);
  const canonicalAddress = getCanonicalBorrowerAddress(application);
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
        (canonicalEmail ? 10 : 0) +
        (canonicalPhone ? 10 : 0) +
        (canonicalAddress ? 10 : 0) +
        Math.round(docsCoverage * 35) +
        (application.applicantPersonal.dateOfBirth ? 5 : 0),
    ),
  );

  const nonStarterScore = Math.max(
    0,
    Math.min(
      100,
      (application.loan.amount > 0 ? 20 : 0) +
        (calculations.totalCollateralValue > 0 ? 20 : 0) +
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
    parsedDocsCount,
    docsCoverage,
  };
};

const calculateAiRecommendation = (
  application: LoanApplication,
  calculations: ReturnType<typeof calculateLoanMetrics>,
  automatedTotal: number,
) => {
  let baseProb = 70;
  const computationLog = ['Base Probability: 70%'];

  if (isStrongDsr(calculations.dsr)) {
    baseProb += 15;
    computationLog.push(
      `+15% (Strong Debt Service Ratio (DSR) < ${CREDIT_POLICY_THRESHOLDS.dsr.strongMax}%)`,
    );
  } else if (calculations.dsr > CREDIT_POLICY_THRESHOLDS.dsr.acceptableMax) {
    baseProb -= 20;
    computationLog.push(
      `-20% (High Debt Service Ratio (DSR) > ${CREDIT_POLICY_THRESHOLDS.dsr.acceptableMax}%)`,
    );
  }

  if (isSafeLtv(calculations.ltv)) {
    baseProb += 10;
    computationLog.push(
      `+10% (Safe Loan-to-Value Ratio (LTV) < ${CREDIT_POLICY_THRESHOLDS.ltv.safeMax}%)`,
    );
  } else if (calculations.ltv > CREDIT_POLICY_THRESHOLDS.ltv.riskyMin) {
    baseProb -= 15;
    computationLog.push(
      `-15% (Risky Loan-to-Value Ratio (LTV) > ${CREDIT_POLICY_THRESHOLDS.ltv.riskyMin}%)`,
    );
  }

  if (automatedTotal >= 40) {
    baseProb += 5;
    computationLog.push('+5% (High Automated Scorecard)');
  }

  const finalProb = Math.min(Math.max(baseProb, 0), 100);

  return {
    probability: finalProb,
    riskLevel: isLowRiskProbability(finalProb)
      ? 'Low'
      : isMediumRiskProbability(finalProb)
        ? 'Medium'
        : 'High',
    suggestedAmount:
      isApproveBand(finalProb) ? application.loan.amount : application.loan.amount * 0.8,
    computationLog,
  };
};

const psychometricResponseToPoints = (response: string) => {
  switch (response) {
    case 'Strongly Agree':
      return 5;
    case 'Agree':
      return 4;
    case 'Neutral':
      return 3;
    case 'Disagree':
      return 2;
    case 'Strongly Disagree':
      return 1;
    default:
      return 0;
  }
};

const psychometricAssessmentResponseToPoints = (
  response: string,
  options: string[],
) => {
  const optionIndex = options.findIndex((option) => option === response);

  if (optionIndex < 0) {
    return 0;
  }

  return 5 - optionIndex;
};

const buildPsychometricAssessmentScores = (
  assessment: PsychometricAssessment,
  legacyQuestionnaire?: OptionalPsychometricQuestionnaire,
) => {
  const assessmentValues = psychometricAssessmentSections.flatMap((section) =>
    section.questions.map((question) =>
      psychometricAssessmentResponseToPoints(
        assessment[question.field] ?? '',
        question.options,
      ),
    ),
  );
  const answeredAssessmentCount = assessmentValues.filter((value) => value > 0).length;

  if (answeredAssessmentCount > 0) {
    const sectionScores = psychometricAssessmentSections.map((section) => {
      const rawScore = section.questions.reduce(
        (sum, question) =>
          sum +
          psychometricAssessmentResponseToPoints(
            assessment[question.field] ?? '',
            question.options,
          ),
        0,
      );

      return Math.round((rawScore / 25) * 100);
    });

    const groupedTraitScores = {
      discipline: Math.round(averageScore([sectionScores[0], sectionScores[1], sectionScores[4]])),
      planning: Math.round(averageScore([sectionScores[3], sectionScores[5]])),
      responsibility: Math.round(averageScore([sectionScores[2], sectionScores[9]])),
      honesty: Math.round(averageScore([sectionScores[6]])),
      resilience: Math.round(averageScore([sectionScores[7], sectionScores[8]])),
    };

    return {
      overallScore: Math.round(averageScore(sectionScores)),
      traitScores: groupedTraitScores,
      answers: { ...assessment },
    };
  }

  const legacyAnswers = legacyQuestionnaire ?? {
    question01: '', question02: '', question03: '', question04: '', question05: '',
    question06: '', question07: '', question08: '', question09: '', question10: '',
    question11: '', question12: '', question13: '', question14: '', question15: '',
    question16: '', question17: '', question18: '', question19: '', question20: '',
  };
  const legacyValues = Object.values(legacyAnswers).map((response) => psychometricResponseToPoints(response));
  const answeredLegacyCount = legacyValues.filter((value) => value > 0).length;

  if (answeredLegacyCount === 0) {
    return {
      overallScore: null,
      traitScores: {
        discipline: null,
        planning: null,
        responsibility: null,
        honesty: null,
        resilience: null,
      },
      answers: { ...assessment },
    };
  }

  const legacyTraitSlices = [
    legacyValues.slice(0, 4),
    legacyValues.slice(4, 8),
    legacyValues.slice(8, 12),
    legacyValues.slice(12, 16),
    legacyValues.slice(16, 20),
  ];
  const legacyTraitScores = legacyTraitSlices.map((slice) => {
    const valid = slice.filter((value) => value > 0);
    if (valid.length === 0) {
      return null;
    }

    return Math.round((averageScore(valid) / 5) * 100);
  });

  return {
    overallScore: Math.round(
      (legacyValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0) /
        (answeredLegacyCount * 5)) *
        100,
    ),
    traitScores: {
      discipline: legacyTraitScores[0],
      planning: legacyTraitScores[1],
      responsibility: legacyTraitScores[2],
      honesty: legacyTraitScores[3],
      resilience: legacyTraitScores[4],
    },
    answers: { ...assessment, ...legacyAnswers },
  };
};

const clampScore = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const averageScore = (values: Array<number | null | undefined>) => {
  const validValues = values.filter((value): value is number => typeof value === 'number');
  if (validValues.length === 0) {
    return 0;
  }

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
};

const mapEducationScore = (education: string) => {
  switch (education.trim().toLowerCase()) {
    case 'post graduate':
    case 'postgraduate':
      return 95;
    case 'college':
    case 'college graduate':
      return 85;
    case 'vocational':
      return 72;
    case 'high school':
      return 65;
    case 'elementary':
      return 50;
    default:
      return 40;
  }
};

const normalizeCustomerSince = (value: string) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10);
};

const getCanonicalCardIssuer = (issuer: string): string | null => {
  const normalizedIssuer = issuer.trim().toLowerCase();

  if (!normalizedIssuer) {
    return null;
  }

  if (normalizedIssuer.includes('visa')) {
    return 'VISA';
  }

  if (normalizedIssuer.includes('master')) {
    return 'MASTERCARD';
  }

  if (normalizedIssuer.includes('american express') || normalizedIssuer.includes('amex')) {
    return 'AMEX';
  }

  if (normalizedIssuer.includes('discover')) {
    return 'DISCOVER';
  }

  if (normalizedIssuer.includes('jcb')) {
    return 'JCB';
  }

  if (normalizedIssuer.includes('diners')) {
    return 'DINERS';
  }

  if (normalizedIssuer.includes('unionpay') || normalizedIssuer.includes('union pay')) {
    return 'UNIONPAY';
  }

  return null;
};

const detectCardIssuerFromNumber = (digits: string): string | null => {
  if (/^4\d{12}(\d{3}){0,2}$/.test(digits)) {
    return 'VISA';
  }

  if (/^(5[1-5]\d{14}|2(2[2-9]\d{12}|[3-6]\d{13}|7[01]\d{12}|720\d{12}))$/.test(digits)) {
    return 'MASTERCARD';
  }

  if (/^3[47]\d{13}$/.test(digits)) {
    return 'AMEX';
  }

  if (/^(6011\d{12}|65\d{14}|64[4-9]\d{13})$/.test(digits)) {
    return 'DISCOVER';
  }

  if (/^35(2[89]|[3-8][0-9])\d{12}$/.test(digits)) {
    return 'JCB';
  }

  if (/^(30[0-5]\d{11}|36\d{12}|3[89]\d{12})$/.test(digits)) {
    return 'DINERS';
  }

  if (/^62\d{14,17}$/.test(digits)) {
    return 'UNIONPAY';
  }

  return null;
};

const isValidLuhnNumber = (digits: string): boolean => {
  let checksum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let current = Number.parseInt(digits.charAt(i), 10);

    if (shouldDouble) {
      current *= 2;
      if (current > 9) {
        current -= 9;
      }
    }

    checksum += current;
    shouldDouble = !shouldDouble;
  }

  return checksum % 10 === 0;
};

const validateCreditCardInformation = (
  cardIssuer: string,
  cardNumber: string,
): string | null => {
  const normalizedIssuer = cardIssuer.trim();
  const digits = cardNumber.replace(/\D/g, '');

  if (!normalizedIssuer && !digits) {
    return null;
  }

  if (normalizedIssuer && !digits) {
    return 'Card number is required when card issuer is provided.';
  }

  if (!normalizedIssuer && digits) {
    return 'Card issuer is required when card number is provided.';
  }

  if (digits.length < 13 || digits.length > 19) {
    return 'Card number must be between 13 and 19 digits.';
  }

  if (!isValidLuhnNumber(digits)) {
    return 'Card number failed internal checksum validation.';
  }

  const issuerFromNumber = detectCardIssuerFromNumber(digits);
  const issuerFromInput = getCanonicalCardIssuer(normalizedIssuer);

  if (issuerFromInput && issuerFromNumber && issuerFromInput !== issuerFromNumber) {
    return 'Card issuer does not match the card number prefix.';
  }

  return null;
};

const validateBankAccountInformation = (
  bankBranch: string,
  accountNumber: string,
): string | null => {
  const normalizedBankBranch = bankBranch.trim();
  const normalizedAccountNumber = accountNumber.replace(/[\s-]/g, '');

  if (!normalizedBankBranch && !normalizedAccountNumber) {
    return null;
  }

  if (normalizedBankBranch && !normalizedAccountNumber) {
    return 'Account number is required when bank/branch is provided.';
  }

  if (!normalizedBankBranch && normalizedAccountNumber) {
    return 'Bank/branch is required when account number is provided.';
  }

  if (!/^\d{8,20}$/.test(normalizedAccountNumber)) {
    return 'Account number must contain 8 to 20 digits.';
  }

  if (/^(\d)\1+$/.test(normalizedAccountNumber)) {
    return 'Account number format appears invalid. Please verify and try again.';
  }

  return null;
};

const calculateQuantScoresSummary = (
  application: LoanApplication,
  calculations: ReturnType<typeof calculateLoanMetrics>,
  automatedTotal: number,
  aiRecommendation: ReturnType<typeof calculateAiRecommendation>,
  creditRiskInsights: ReturnType<typeof calculateCreditRiskInsights>,
) => {
  const canonicalAddress = getCanonicalBorrowerAddress(application);
  const socialSignals = [
    application.enhancedDueDiligence.facebookProfile,
    application.enhancedDueDiligence.instagramProfile,
    application.enhancedDueDiligence.xProfile,
    application.enhancedDueDiligence.tikTokProfile,
    application.enhancedDueDiligence.linkedInProfile,
    application.enhancedDueDiligence.otherSocialMediaLinks,
    application.enhancedDueDiligence.communityInvolvementInformation,
    application.enhancedDueDiligence.referencesFromEmployerOrCommunity,
    application.enhancedDueDiligence.professionalOrganizationMemberships,
    application.contactInformation.mobileYearsUsed,
    application.contactInformation.emailYearsUsed,
    application.enhancedDueDiligence.digitalBankingUsage,
    application.enhancedDueDiligence.communityReputation,
  ].filter((value) => value.trim().length > 0).length;

  const socialScoreValue = Math.min(
    100,
    socialSignals * 8 +
      (canonicalAddress ? 10 : 0) +
      (application.otherInformation.deviceVerified ? 10 : 0) +
      (application.otherInformation.homeOwnership ? 8 : 0),
  );
  const bureauBase =
    520 +
    automatedTotal * 5 +
    (calculations.dsr < 40 ? 70 : calculations.dsr < 55 ? 30 : -30) +
    (calculations.ltv < 85 ? 40 : calculations.ltv < 95 ? 10 : -25);
  const creditBureauScoreValue = Math.max(
    300,
    Math.min(850, Math.round(bureauBase)),
  );

  const psychometricAssessmentScores = buildPsychometricAssessmentScores(
    application.psychometricAssessment,
    application.optionalPsychometricQuestionnaire,
  );
  const psychometricScoreValue = psychometricAssessmentScores.overallScore;

  const aCreditScore =
    aiRecommendation.probability >= 85 && creditRiskInsights.riskScore < 35
      ? 'A'
      : aiRecommendation.probability >= 70 && creditRiskInsights.riskScore < 50
        ? 'B'
        : aiRecommendation.probability >= 55
          ? 'C'
          : 'D';

  return {
    aCreditScore,
    fraudScoreValue: Math.round(creditRiskInsights.fraudScore),
    fraudScore: creditRiskInsights.fraudScore.toFixed(0),
    socialScoreValue,
    socialScore: socialScoreValue.toFixed(0),
    creditBureauScoreValue,
    creditBureauScore: creditBureauScoreValue.toString(),
    psychometricScoreValue,
    psychometricScore:
      psychometricScoreValue !== null ? psychometricScoreValue.toString() : 'N/A',
    originationProfitabilityValue: creditRiskInsights.originationProfitability,
    originationProfitability: `PHP ${creditRiskInsights.originationProfitability.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })}`,
  };
};

const buildScorePayloadSections = (
  application: LoanApplication,
  calculations: ReturnType<typeof calculateLoanMetrics>,
  automatedScorecard: ReturnType<typeof calculateAutomatedScorecard>,
  creditRiskInsights: ReturnType<typeof calculateCreditRiskInsights>,
  aiRecommendation: ReturnType<typeof calculateAiRecommendation>,
) => {
  const canonicalEmail = getCanonicalBorrowerEmail(application);
  const canonicalPhone = getCanonicalBorrowerPhone(application);
  const canonicalAddress = getCanonicalBorrowerAddress(application);
  const quantSummary = calculateQuantScoresSummary(
    application,
    calculations,
    automatedScorecard.total,
    aiRecommendation,
    creditRiskInsights,
  );
  const psychometricAssessmentScores = buildPsychometricAssessmentScores(
    application.psychometricAssessment,
    application.optionalPsychometricQuestionnaire,
  );

  const identityScore = clampScore(
    (application.borrower.govId ? 35 : 0) +
      (canonicalEmail ? 20 : 0) +
      (canonicalPhone ? 20 : 0) +
      (application.applicantPersonal.dateOfBirth ? 15 : 0) +
      (canonicalPhone ? 10 : 0),
  );
  const documentScore = Math.round(clampScore(creditRiskInsights.docsCoverage * 100));
  const geoLocationScore = canonicalAddress ? 85 : 25;
  const deviceScore = 50;
  const duplicateApplicationScore = 100;
  const fraudRiskLevel =
    creditRiskInsights.fraudScore >= 70
      ? 'Low'
      : creditRiskInsights.fraudScore >= 50
        ? 'Medium'
        : 'High';

  const residenceStabilityScore = clampScore(
    (application.addressInformation.lengthOfStay ? 60 : 35) +
      (application.otherInformation.homeOwnership ? 20 : 0) +
      (canonicalAddress ? 20 : 0),
  );
  const employmentStabilityScore = clampScore(
    (application.employmentInformation.totalYearsWorking ? 65 : 40) +
      (application.employmentInformation.employmentStatus ? 20 : 0) +
      (application.employmentInformation.employerBusinessName ? 15 : 0),
  );
  const familyStabilityScore = clampScore(
    (application.applicantPersonal.maritalStatus ? 45 : 25) +
      (application.spouseInformation.fullName ? 20 : 0) +
      (application.applicantPersonal.numberOfDependents >= 0 ? 15 : 0) +
      (application.enhancedDueDiligence.referencesFromEmployerOrCommunity ? 20 : 0),
  );
  const educationScore = mapEducationScore(
    application.otherInformation.educationalAttainment,
  );
  const bankingRelationshipScore = clampScore(
    (application.bankingRelationships.accountNumber ? 35 : 0) +
      (application.bankingRelationships.currentBalance > 0 ? 35 : 0) +
      (application.bankingRelationships.creditCardNumber ? 15 : 0) +
      (application.bankingRelationships.memberSince ? 15 : 0),
  );
  const overallSocialScore = Math.round(
    averageScore([
      residenceStabilityScore,
      employmentStabilityScore,
      familyStabilityScore,
      educationScore,
      bankingRelationshipScore,
    ]),
  );
  const socialRiskLevel =
    overallSocialScore >= 70
      ? 'Low'
      : overallSocialScore >= 50
        ? 'Medium'
        : 'High';
  const psychometricRiskLevel =
    quantSummary.psychometricScoreValue >= 70
      ? 'Low'
      : quantSummary.psychometricScoreValue >= 50
        ? 'Medium'
        : 'High';

  const ltvScore = Math.round(clampScore(100 - calculations.ltv));
  const assetQualityScore = clampScore(
    (application.collateral.assetType ? 30 : 10) +
      (application.collateral.brand ? 15 : 0) +
      (application.collateral.model ? 15 : 0) +
      (calculations.totalCollateralValue > 0 ? 40 : 0),
  );
  const marketabilityScore = clampScore(
    (application.collateral.brand ? 35 : 10) +
      (application.collateral.year ? 25 : 10) +
      (application.loan.productType === 'Auto Loan' ? 20 : 10) +
      (application.collateralInformation.propertyAddress ? 20 : 10),
  );
  const insuranceScore = clampScore(
    (application.collateral.insuranceProviderCompany ? 55 : 20) +
      (application.collateral.policyNumber ? 45 : 20),
  );
  const overallCollateralScore = Math.round(
    averageScore([ltvScore, assetQualityScore, marketabilityScore, insuranceScore]),
  );

  const profitabilityScore = Math.round(
    clampScore(50 + creditRiskInsights.originationMargin),
  );
  const numberOfAccounts =
    (application.bankingRelationships.accountNumber ? 1 : 0) +
    (application.bankingRelationships.creditCardNumber ? 1 : 0) +
    (application.bankingRelationships.loanLender ? 1 : 0);
  const priorLoans = application.enhancedDueDiligence.numberOfActiveLoans;
  const relationshipScore = Math.round(
    clampScore(
      numberOfAccounts * 25 +
        (application.bankingRelationships.currentBalance > 0 ? 35 : 0) +
        (application.bankingRelationships.memberSince ? 20 : 0) +
        (priorLoans > 0 ? 20 : 10),
    ),
  );

  const recommendation =
    isApproveBand(aiRecommendation.probability)
      ? 'Approve'
      : isReviewRecommendationProbability(aiRecommendation.probability)
        ? 'Review'
        : 'Decline';

  const finalScore = Math.round(
    averageScore([
      automatedScorecard.total * 2,
      quantSummary.fraudScoreValue,
      overallSocialScore,
      quantSummary.psychometricScoreValue,
      overallCollateralScore,
      profitabilityScore,
      relationshipScore,
    ]),
  );

  return {
    quantSummary,
    credit_scores: {
      character_score: automatedScorecard.character,
      capacity_score: automatedScorecard.capacity,
      capital_score: automatedScorecard.capital,
      collateral_score: automatedScorecard.collateral,
      conditions_score: automatedScorecard.conditions,
      bureau_score: quantSummary.creditBureauScoreValue,
      internal_score: automatedScorecard.total,
      total_credit_score: Math.round(
        averageScore([
          automatedScorecard.total * 2,
          quantSummary.creditBureauScoreValue / 8.5,
        ]),
      ),
      credit_grade: quantSummary.aCreditScore,
      model_version: 'frontend-rule-engine-v1',
    },
    fraud_scores: {
      identity_score: identityScore,
      document_score: documentScore,
      geo_location_score: geoLocationScore,
      device_score: deviceScore,
      duplicate_application_score: duplicateApplicationScore,
      overall_fraud_score: quantSummary.fraudScoreValue,
      fraud_risk_level: fraudRiskLevel,
      fraud_flags: {
        missing_government_id: !application.borrower.govId,
        missing_address: !canonicalAddress,
        parsed_documents_count: creditRiskInsights.parsedDocsCount,
        document_coverage_ratio: Number(creditRiskInsights.docsCoverage.toFixed(2)),
      },
    },
    social_scores: {
      social_risk_level: socialRiskLevel,
      residence_stability_score: residenceStabilityScore,
      employment_stability_score: employmentStabilityScore,
      family_stability_score: familyStabilityScore,
      education_score: educationScore,
      banking_relationship_score: bankingRelationshipScore,
      overall_social_score: overallSocialScore,
    },
    psychometric_scores: {
      psychometric_risk_level: psychometricRiskLevel,
      discipline_score: psychometricAssessmentScores.traitScores.discipline,
      planning_score: psychometricAssessmentScores.traitScores.planning,
      responsibility_score: psychometricAssessmentScores.traitScores.responsibility,
      honesty_score: psychometricAssessmentScores.traitScores.honesty,
      resilience_score: psychometricAssessmentScores.traitScores.resilience,
      overall_psychometric_score: quantSummary.psychometricScoreValue,
      questionnaire_answers: { ...psychometricAssessmentScores.answers },
    },
    credit_bureau_reports: {
      bureau_name: 'Modeled Internal Bureau Proxy',
      bureau_score: quantSummary.creditBureauScoreValue,
      total_loans: priorLoans,
      active_loans: priorLoans,
      closed_loans: 0,
      delinquent_accounts: 0,
      defaulted_accounts: 0,
      outstanding_balance: application.bankingRelationships.loanCurrentBalance,
      report_json: {
        modeled: true,
        source: 'lending_scorecard_frontend',
      },
      report_date: new Date().toISOString(),
    },
    collateral_scores: {
      ltv_score: ltvScore,
      asset_quality_score: assetQualityScore,
      marketability_score: marketabilityScore,
      insurance_score: insuranceScore,
      overall_collateral_score: overallCollateralScore,
    },
    profitability_scores: {
      projected_interest_income: creditRiskInsights.grossRevenue,
      fee_income: 0,
      expected_loss: creditRiskInsights.expectedLoss,
      operating_cost: creditRiskInsights.processingCost,
      funding_cost: 0,
      projected_profit: creditRiskInsights.originationProfitability,
      profitability_score: profitabilityScore,
    },
    relationship_scores: {
      customer_since: normalizeCustomerSince(application.bankingRelationships.memberSince),
      number_of_accounts: numberOfAccounts,
      deposit_balance: application.bankingRelationships.currentBalance,
      prior_loans: priorLoans,
      relationship_score: relationshipScore,
    },
    ai_recommendations: {
      recommendation,
      confidence_score: aiRecommendation.probability,
      explanation: aiRecommendation.computationLog.join(' '),
      suggested_amount: aiRecommendation.suggestedAmount,
      ai_model: 'frontend-rule-engine-v1',
    },
    overall_scores: {
      credit_score: automatedScorecard.total * 2,
      fraud_score: quantSummary.fraudScoreValue,
      social_score: overallSocialScore,
      psychometric_score: quantSummary.psychometricScoreValue,
      collateral_score: overallCollateralScore,
      profitability_score: profitabilityScore,
      relationship_score: relationshipScore,
      final_score: finalScore,
      final_grade: quantSummary.aCreditScore,
      final_decision: recommendation,
    },
  };
};

const calculateAgeFromDateOfBirth = (dateOfBirth: string) => {
  if (!dateOfBirth) {
    return 0;
  }

  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
    return 0;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  const dayDifference = today.getDate() - birthDate.getDate();

  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age -= 1;
  }

  return Math.max(age, 0);
};

const normalizeDateInput = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const raw = value.trim();
  if (!raw) {
    return '';
  }

  const isoMatch = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const dmyOrMdyMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyOrMdyMatch) {
    const first = Number.parseInt(dmyOrMdyMatch[1], 10);
    const second = Number.parseInt(dmyOrMdyMatch[2], 10);
    const year = dmyOrMdyMatch[3];
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
};

const firstTextValue = (...values: Array<unknown>): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
};

const normalizeParsedSectionUpdates = (
  extractedData: DocumentParseReview['extractedData'] | Record<string, unknown> | null | undefined,
): ParsedSectionUpdates => {
  const source = (extractedData ?? {}) as Record<string, unknown>;
  const borrower = (source.borrower ?? {}) as Record<string, unknown>;
  const applicantPersonal = (source.applicantPersonal ?? {}) as Record<string, unknown>;
  const governmentIds = (source.governmentIds ?? {}) as Record<string, unknown>;
  const contactInformation = (source.contactInformation ?? {}) as Record<string, unknown>;
  const addressInformation = (source.addressInformation ?? {}) as Record<string, unknown>;

  const normalizedGovernmentIds: Partial<GovernmentIds> = {
    tin: firstTextValue(governmentIds.tin, governmentIds.tinNumber, governmentIds.taxIdentificationNumber),
    sssGsisNumber: firstTextValue(
      governmentIds.sssGsisNumber,
      governmentIds.sssNumber,
      governmentIds.gsisNumber,
      governmentIds.sss,
      governmentIds.gsis,
    ),
    otherGovernmentId: firstTextValue(
      governmentIds.otherGovernmentId,
      governmentIds.idType,
      governmentIds.governmentIdType,
      governmentIds.cardType,
    ),
    idNumber: firstTextValue(governmentIds.idNumber, governmentIds.govId, governmentIds.governmentIdNumber),
    issueDate: normalizeDateInput(firstTextValue(governmentIds.issueDate, governmentIds.dateIssued)),
    expiryDate: normalizeDateInput(firstTextValue(governmentIds.expiryDate, governmentIds.validUntil, governmentIds.expirationDate)),
  };

  const normalizedApplicant: Partial<ApplicantPersonal> = {
    lastName: firstTextValue(applicantPersonal.lastName, applicantPersonal.surname),
    firstName: firstTextValue(applicantPersonal.firstName, applicantPersonal.givenName),
    middleName: firstTextValue(applicantPersonal.middleName, applicantPersonal.middleInitial),
    dateOfBirth: normalizeDateInput(firstTextValue(applicantPersonal.dateOfBirth, applicantPersonal.birthDate)),
    placeOfBirth: firstTextValue(applicantPersonal.placeOfBirth),
  };

  const normalizedBorrower: Partial<BorrowerInfo> = {
    ...((source.borrower ?? {}) as Partial<BorrowerInfo>),
    fullName: firstTextValue(borrower.fullName, borrower.name),
    govId: firstTextValue(
      borrower.govId,
      borrower.governmentId,
      normalizedGovernmentIds.idNumber,
      normalizedGovernmentIds.tin,
      normalizedGovernmentIds.sssGsisNumber,
    ),
  };

  return {
    ...source,
    borrower: normalizedBorrower,
    applicantPersonal: normalizedApplicant,
    contactInformation: {
      ...((source.contactInformation ?? {}) as Partial<ContactInformation>),
      mobileNumber: firstTextValue(contactInformation.mobileNumber, contactInformation.phone, contactInformation.contactNumber),
      homePhoneNumber: firstTextValue(contactInformation.homePhoneNumber),
      emailAddress: firstTextValue(contactInformation.emailAddress, contactInformation.email),
    },
    governmentIds: normalizedGovernmentIds,
    addressInformation: {
      ...((source.addressInformation ?? {}) as Partial<AddressInformation>),
      presentAddress: firstTextValue(addressInformation.presentAddress, addressInformation.address),
      permanentAddress: firstTextValue(addressInformation.permanentAddress),
      mailingAddress: firstTextValue(addressInformation.mailingAddress),
    },
  };
};

const composeApplicantFullName = (applicant: ApplicantPersonal) =>
  [applicant.firstName, applicant.middleName, applicant.lastName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');

const getCanonicalBorrowerEmail = (application: LoanApplication) =>
  application.borrower.email.trim() ||
  application.contactInformation.emailAddress.trim();

const getCanonicalBorrowerPhone = (application: LoanApplication) =>
  application.contactInformation.mobileNumber.trim() ||
  application.borrower.phone.trim();

const getCanonicalBorrowerAddress = (application: LoanApplication) =>
  application.addressInformation.presentAddress.trim() ||
  application.borrower.address.trim();

const buildCollateralVehicleInfo = (collateral: Collateral) =>
  [
    collateral.assetType,
    collateral.maker,
    collateral.brand,
    collateral.model,
    collateral.year,
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' | ');

const buildCollateralInsuranceSummary = (collateral: Collateral) =>
  [collateral.insuranceProviderCompany, collateral.policyNumber]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' | ');

const buildCollateralRegistrationSummary = (collateral: Collateral) =>
  [
    collateral.orNumber ? `OR: ${collateral.orNumber.trim()}` : '',
    collateral.crNumber ? `CR: ${collateral.crNumber.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

const calculateTotalCollateralValue = (application: LoanApplication) =>
  application.collateral.appraisedValue +
  application.collateralInformation.propertyAppraisedValue +
  application.additionalCollaterals.reduce(
    (sum, collateral) => sum + collateral.appraisedValue,
    0,
  );

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
  dueDiligence.communityReputation.trim().length > 0 &&
  dueDiligence.professionalOrganizationMemberships.trim().length > 0 &&
  dueDiligence.professionalLicenses.trim().length > 0 &&
  dueDiligence.guarantorReferences.trim().length > 0 &&
  dueDiligence.additionalPropertyDeclarations.trim().length > 0 &&
  dueDiligence.additionalVehicleDeclarations.trim().length > 0 &&
  dueDiligence.selfDeclaredAssetsAndLiabilities.trim().length > 0 &&
  dueDiligence.selfDeclaredInvestmentPortfolio.trim().length > 0 &&
  dueDiligence.existingInsurancePolicies.trim().length > 0 &&
  dueDiligence.priorBankingRelationships.trim().length > 0 &&
  dueDiligence.consentOpenBankingDataAccess &&
  dueDiligence.consentEmploymentVerification &&
  dueDiligence.consentIdentityVerification &&
  dueDiligence.communityInvolvementInformation.trim().length > 0 &&
  dueDiligence.referencesFromEmployerOrCommunity.trim().length > 0;

const hasRequiredAdditionalSupportingDocuments = (
  supportingDocuments: SupportingDocuments,
) =>
  supportingDocuments.auditedFinancialStatements &&
  supportingDocuments.proofOfRemittanceIncome &&
  supportingDocuments.investmentStatements &&
  supportingDocuments.additionalSupportingDocuments;

const psychometricAssessmentSections: Array<{
  id: string;
  title: string;
  questions: Array<{ field: string; prompt: string; options: string[] }>;
}> = [
  {
    id: 'A',
    title: 'Budgeting & Planning',
    questions: [
      {
        field: 'q01',
        prompt: 'How far ahead do you plan your finances?',
        options: ['1 month', '2 months', '3 months', '4 months', '5+ months'],
      },
      {
        field: 'q02',
        prompt: 'When preparing a budget, how often do you update it?',
        options: ['Weekly', 'Monthly', 'Quarterly', 'Annually', 'Never'],
      },
      {
        field: 'q03',
        prompt: 'If you receive extra income, how do you handle it?',
        options: [
          'Add to savings',
          'Allocate to bills',
          'Partial savings/spending',
          'Spend immediately',
          'No plan',
        ],
      },
      {
        field: 'q04',
        prompt: 'How often do you track your expenses?',
        options: ['Daily', 'Weekly', 'Monthly', 'Occasionally', 'Never'],
      },
      {
        field: 'q05',
        prompt: 'When setting financial goals, how far ahead do you plan?',
        options: ['1 year', '2-3 years', '4-5 years', '6-10 years', 'No goals'],
      },
    ],
  },
  {
    id: 'B',
    title: 'Emergency Fund & Savings',
    questions: [
      {
        field: 'q06',
        prompt: 'If you lost your income today, how long could your emergency fund cover expenses?',
        options: ['1 month', '2-3 months', '4-6 months', '7-12 months', 'More than 12 months'],
      },
      {
        field: 'q07',
        prompt: 'How often do you deposit into your emergency fund?',
        options: ['Monthly', 'Quarterly', 'Annually', 'Occasionally', 'Never'],
      },
      {
        field: 'q08',
        prompt: 'When faced with a major purchase, how do you prepare?',
        options: ['Save fully', 'Save most', 'Save partly', 'Borrow mostly', 'Buy immediately on credit'],
      },
      {
        field: 'q09',
        prompt: 'How quickly can you cover unexpected expenses without borrowing?',
        options: ['Immediately', 'Within 1 month', 'Within 2-3 months', 'Within 6 months', 'Cannot without borrowing'],
      },
      {
        field: 'q10',
        prompt: 'How often do you review your savings progress?',
        options: ['Monthly', 'Quarterly', 'Annually', 'Occasionally', 'Never'],
      },
    ],
  },
  {
    id: 'C',
    title: 'Loan Repayment Discipline',
    questions: [
      {
        field: 'q11',
        prompt: 'If you anticipate difficulty repaying a loan, when do you inform your lender?',
        options: ['Immediately', '1 month before', '2 months before', 'After missing payment', 'Never'],
      },
      {
        field: 'q12',
        prompt: 'How often do you pay loans before the due date?',
        options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
      },
      {
        field: 'q13',
        prompt: 'If faced with financial stress, how do you prioritize loan repayment?',
        options: ['Cut expenses first', 'Adjust savings', 'Delay purchases', 'Delay bills', 'Miss loan payment'],
      },
      {
        field: 'q14',
        prompt: 'How important is maintaining a good credit reputation to you?',
        options: ['Extremely', 'Very', 'Moderate', 'Slight', 'Not important'],
      },
      {
        field: 'q15',
        prompt: 'When repaying loans, how consistent are you?',
        options: ['Always on time', 'Mostly on time', 'Occasionally late', 'Frequently late', 'Never on time'],
      },
    ],
  },
  {
    id: 'D',
    title: 'Risk Awareness',
    questions: [
      {
        field: 'q16',
        prompt: 'When offered a high-risk investment, how do you respond?',
        options: ['Decline immediately', 'Decline after evaluation', 'Invest small portion', 'Invest large portion', 'Invest fully'],
      },
      {
        field: 'q17',
        prompt: 'How carefully do you read loan agreements before signing?',
        options: ['Every detail', 'Key sections', 'Skim', 'Glance quickly', 'Never read'],
      },
      {
        field: 'q18',
        prompt: 'How often do you avoid risks you do not understand?',
        options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
      },
      {
        field: 'q19',
        prompt: 'Before making commitments, how often do you consider worst-case scenarios?',
        options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
      },
      {
        field: 'q20',
        prompt: 'Do you prefer stable finances or risky opportunities?',
        options: ['Strongly prefer stability', 'Prefer stability', 'Neutral', 'Prefer risk', 'Strongly prefer risk'],
      },
    ],
  },
  {
    id: 'E',
    title: 'Integrity & Honesty',
    questions: [
      {
        field: 'q21',
        prompt: 'When completing financial applications, how accurate is your information?',
        options: ['Always accurate', 'Mostly accurate', 'Sometimes inaccurate', 'Frequently inaccurate', 'Never accurate'],
      },
      {
        field: 'q22',
        prompt: 'Would you hide important financial information from a lender?',
        options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
      },
      {
        field: 'q23',
        prompt: 'Is honesty more important than getting a loan quickly?',
        options: ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'],
      },
      {
        field: 'q24',
        prompt: 'When you make financial mistakes, how do you respond?',
        options: ['Correct immediately', 'Correct soon', 'Correct occasionally', 'Rarely correct', 'Never correct'],
      },
      {
        field: 'q25',
        prompt: 'Do you believe financial commitments should always be honored?',
        options: ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'],
      },
    ],
  },
  {
    id: 'F',
    title: 'Resilience & Adaptability',
    questions: [
      {
        field: 'q26',
        prompt: 'If your income decreases by 20%, how quickly do you adjust spending?',
        options: ['Within 1 week', 'Within 1 month', 'Within 2 months', 'Within 3 months', 'Never adjust'],
      },
      {
        field: 'q27',
        prompt: 'When facing financial challenges, how calm do you remain?',
        options: ['Always calm', 'Often calm', 'Sometimes calm', 'Rarely calm', 'Never calm'],
      },
      {
        field: 'q28',
        prompt: 'When facing problems, how often do you look for solutions instead of avoiding them?',
        options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
      },
      {
        field: 'q29',
        prompt: 'Before making difficult financial decisions, how often do you seek advice?',
        options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
      },
      {
        field: 'q30',
        prompt: 'Do you believe you can recover from financial setbacks?',
        options: ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'],
      },
    ],
  },
  {
    id: 'G',
    title: 'Social Responsibility',
    questions: [
      {
        field: 'q31',
        prompt: 'How consistently do you support your family within your means?',
        options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
      },
      {
        field: 'q32',
        prompt: 'How consistently do you fulfill responsibilities to dependents?',
        options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
      },
      {
        field: 'q33',
        prompt: 'How important is maintaining a good reputation in your community?',
        options: ['Extremely', 'Very', 'Moderate', 'Slight', 'Not important'],
      },
      {
        field: 'q34',
        prompt: 'How often do you avoid actions that could damage your financial credibility?',
        options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
      },
      {
        field: 'q35',
        prompt: 'Do you believe financial responsibility is a core personal value?',
        options: ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'],
      },
    ],
  },
  {
    id: 'H',
    title: 'Self-Control & Impulse Management',
    questions: [
      {
        field: 'q36',
        prompt: 'When you see something you want to buy, how long do you wait before purchasing?',
        options: ['5+ days', '2-3 days', '1 day', 'Same day', 'Immediately'],
      },
      {
        field: 'q37',
        prompt: 'How often do you avoid impulse purchases?',
        options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
      },
      {
        field: 'q38',
        prompt: 'How often can you delay gratification for long-term goals?',
        options: ['Always (12+ months)', 'Often (6-12 months)', 'Sometimes (3-6 months)', 'Rarely (<3 months)', 'Never'],
      },
      {
        field: 'q39',
        prompt: 'When pressured to spend beyond budget, how do you respond?',
        options: ['Always resist', 'Often resist', 'Sometimes resist', 'Rarely resist', 'Never resist'],
      },
      {
        field: 'q40',
        prompt: 'How clearly do you distinguish between wants and needs?',
        options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
      },
    ],
  },
  {
    id: 'I',
    title: 'Employment & Career Mindset',
    questions: [
      {
        field: 'q41',
        prompt: 'How often do you improve your professional skills?',
        options: ['Every year', 'Every 2-3 years', 'Occasionally', 'Rarely', 'Never'],
      },
      {
        field: 'q42',
        prompt: 'How important is long-term employment stability to you?',
        options: ['Extremely', 'Very', 'Moderate', 'Slight', 'Not important'],
      },
      {
        field: 'q43',
        prompt: 'How actively do you plan your career growth?',
        options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
      },
      {
        field: 'q44',
        prompt: 'How consistently do you maintain good relationships with employers/clients?',
        options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
      },
      {
        field: 'q45',
        prompt: 'How strongly do you strive to maintain a reliable source of income?',
        options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'],
      },
    ],
  },
  {
    id: 'J',
    title: 'Additional Situational Discipline',
    questions: [
      {
        field: 'q46',
        prompt: 'If you receive a salary increase, how do you allocate it?',
        options: ['Save fully', 'Save most', 'Split save/spend', 'Spend mostly', 'Spend all'],
      },
      {
        field: 'q47',
        prompt: 'If you lose your job, how quickly do you seek new income?',
        options: ['Immediately', 'Within 1 month', 'Within 2-3 months', 'Within 6 months', 'No plan'],
      },
      {
        field: 'q48',
        prompt: 'When offered a loan, how carefully do you compare lenders?',
        options: ['Always compare thoroughly', 'Often compare', 'Sometimes compare', 'Rarely compare', 'Never compare'],
      },
      {
        field: 'q49',
        prompt: 'If you face multiple bills, how do you prioritize payments?',
        options: ['Pay essentials first', 'Pay loans first', 'Pay savings first', 'Pay lifestyle first', 'No prioritization'],
      },
      {
        field: 'q50',
        prompt: 'When setting financial goals, how often do you review progress?',
        options: ['Monthly', 'Quarterly', 'Annually', 'Occasionally', 'Never'],
      },
    ],
  },
];

const createBlankPsychometricAssessment = (): PsychometricAssessment =>
  psychometricAssessmentSections.reduce<PsychometricAssessment>((answers, section) => {
    for (const question of section.questions) {
      answers[question.field] = '';
    }

    return answers;
  }, {});

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
    title: 'Applicant / Borrower Information',
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
      { key: 'otherGovernmentId', label: 'Other - ID Type' },
      { key: 'idNumber', label: 'Other - ID Number' },
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

const extractTopAdvisorActions = (advice: string): string[] => {
  if (!advice.trim()) {
    return [];
  }

  const lines = advice
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const headingIndex = lines.findIndex((line) => /top\s*5\s*actions/i.test(line));
  const candidateLines = headingIndex >= 0 ? lines.slice(headingIndex + 1) : lines;

  const actions = candidateLines
    .filter((line) => /^(-|\*|\d+\.|\d+\))/i.test(line))
    .map((line) => line.replace(/^(-|\*|\d+\.|\d+\))\s*/i, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 5);

  if (actions.length > 0) {
    return actions;
  }

  return candidateLines
    .filter((line) => line.length > 15)
    .slice(0, 5);
};

// --- Main Component ---
export default function LendingScorecard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthorization();
  const requestedApplicationNo = searchParams.get('applicationNo');
  const [formattedNumberDrafts, setFormattedNumberDrafts] = useState<Record<string, string>>({});
  const [documentReview, setDocumentReview] = useState<DocumentParseReview | null>(null);
  const [reviewDocumentId, setReviewDocumentId] = useState<string | null>(null);
  const [selectedWorkflowAction, setSelectedWorkflowAction] = useState<WorkflowStatus>('Credit Review');
  const isFilscoreRoute = location.pathname === '/lending-scorecard/filscore';
  const [step, setStep] = useState(() => (isFilscoreRoute ? 8 : 1));
  const [formData, setFormData] = useState<LoanApplication>(createNewApplicationInstance());
  const [isParsing, setIsParsing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hasPersistedRecord, setHasPersistedRecord] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [workflowActionState, setWorkflowActionState] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [completedWorkflowAction, setCompletedWorkflowAction] = useState<WorkflowStatus | null>(null);
  const [isLoadingApplication, setIsLoadingApplication] = useState(false);
  const [backendQuantSummary, setBackendQuantSummary] = useState<QuantScoresSummary | null>(null);
  const [loanCreationEntitlement, setLoanCreationEntitlement] = useState<LoanCreationEntitlementResponse | null>(null);
  const [showLoanStatement, setShowLoanStatement] = useState(false);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorAdvice, setAdvisorAdvice] = useState('');
  const [advisorError, setAdvisorError] = useState('');
  const [advisorMeta, setAdvisorMeta] = useState<Pick<CreditAdvisorResult, 'provider' | 'model' | 'total_tokens' | 'latency_ms'> | null>(null);
  const [advisorNotice, setAdvisorNotice] = useState('');
  const [cardAiRiskLoading, setCardAiRiskLoading] = useState(false);
  const [cardAiRiskError, setCardAiRiskError] = useState('');
  const [cardAiRiskResult, setCardAiRiskResult] = useState<CreditCardRiskCheckResult | null>(null);
  const autosaveDefaults = useMemo<LendingAutosaveDraft>(() => ({
    formData: createNewApplicationInstance(),
    step: isFilscoreRoute ? 8 : 1,
    formattedNumberDrafts: {},
    documentReview: null,
    reviewDocumentId: null,
    selectedWorkflowAction: 'Credit Review',
  }), [isFilscoreRoute]);
  const autosaveValue = useMemo<LendingAutosaveDraft>(() => ({
    formData,
    step,
    formattedNumberDrafts,
    documentReview,
    reviewDocumentId,
    selectedWorkflowAction,
  }), [
    documentReview,
    formData,
    formattedNumberDrafts,
    reviewDocumentId,
    selectedWorkflowAction,
    step,
  ]);
  const hydrateAutosaveDraft = useCallback((draft: LendingAutosaveDraft) => {
    setFormData(draft.formData);
    setStep(draft.step);
    setFormattedNumberDrafts(draft.formattedNumberDrafts);
    setDocumentReview(draft.documentReview);
    setReviewDocumentId(draft.reviewDocumentId);
    setSelectedWorkflowAction(draft.selectedWorkflowAction);
  }, []);
  const lendingAutosave = useAutosaveDraft({
    scope: 'loan-application',
    entityKey: requestedApplicationNo || 'new',
    value: autosaveValue,
    defaults: autosaveDefaults,
    onHydrate: hydrateAutosaveDraft,
    enabled: !requestedApplicationNo || hasPersistedRecord,
  });
  const isHomeLoan = formData.loan.productType === 'Home Loan';
  const isPersonalLoan = formData.loan.productType === 'Personal Loan';
  const isMarginLoan = formData.loan.productType === 'Margin Loan';
  const isCreditCard = formData.loan.productType === 'Credit Card';
  const isAutoLoan = formData.loan.productType === 'Auto Loan';
  const isMotorcycleLoan = formData.loan.productType === 'Motorcycle Loan';
  const isUnderAgeApplicant = formData.applicantPersonal.age > 0 && formData.applicantPersonal.age < 18;
  const isOverAgeApplicant = formData.applicantPersonal.age > 65;
  const isMarried = formData.applicantPersonal.maritalStatus === 'Married';
  const hasCoBorrowerSelected = formData.otherInformation.hasCoBorrower;
  const isSingleApplicant = !isMarried && !hasCoBorrowerSelected;
  const usesStructuredRetailCriteria = isHomeLoan || isPersonalLoan || isMarginLoan || isCreditCard || isAutoLoan || isMotorcycleLoan;
  const creationLocked = !hasPersistedRecord && !!loanCreationEntitlement && !loanCreationEntitlement.allowed;
  const isBorrowerSubscriber = isBorrowerSubscriberRole(user?.role);
  const reviewApplicationsPath = '/loan-repository?status=All';
  const queuePath = isBorrowerSubscriber
    ? '/loan-certification'
    : '/loan-repository?status=Credit%20Review';
  const releasedAccountsPath = isBorrowerSubscriber
    ? '/loan-certification'
    : '/loan-repository?status=Released';
  const maxVisibleStep = isBorrowerSubscriber ? 8 : 10;

  const getApplicationQuery = () => {
    const applicationNo = formData.id || requestedApplicationNo;

    if (!applicationNo) {
      return '';
    }

    return `?applicationNo=${encodeURIComponent(applicationNo)}`;
  };

  // --- Auto-Calculations (Memoized for Performance) ---
  const calculations = useMemo(() => calculateLoanMetrics(formData), [formData]);

  // --- Automated Lending Scorecard (5 Cs) ---
  const automatedScorecard = useMemo(
    () => calculateAutomatedScorecard(formData, calculations),
    [calculations, formData],
  );
  const creditCardValidationError = useMemo(
    () =>
      validateCreditCardInformation(
        formData.bankingRelationships.creditCardIssuer,
        formData.bankingRelationships.creditCardNumber,
      ),
    [formData.bankingRelationships.creditCardIssuer, formData.bankingRelationships.creditCardNumber],
  );
  const bankAccountValidationError = useMemo(
    () =>
      validateBankAccountInformation(
        formData.bankingRelationships.bankBranch,
        formData.bankingRelationships.accountNumber,
      ),
    [formData.bankingRelationships.bankBranch, formData.bankingRelationships.accountNumber],
  );

  useEffect(() => {
    const cardIssuer = formData.bankingRelationships.creditCardIssuer.trim();
    const cardDigits = formData.bankingRelationships.creditCardNumber.replace(/\D/g, '');

    if (!cardIssuer && !cardDigits) {
      setCardAiRiskLoading(false);
      setCardAiRiskError('');
      setCardAiRiskResult(null);
      return;
    }

    if (creditCardValidationError || cardDigits.length < 13 || cardDigits.length > 19) {
      setCardAiRiskLoading(false);
      setCardAiRiskError('');
      setCardAiRiskResult(null);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {

      const runAiCheck = async () => {
        setCardAiRiskLoading(true);
        setCardAiRiskError('');

        try {
          const issuerFromNumber = detectCardIssuerFromNumber(cardDigits);
          const issuerFromInput = getCanonicalCardIssuer(cardIssuer);
          const issuerMatchesPrefix =
            issuerFromNumber && issuerFromInput ? issuerFromNumber === issuerFromInput : null;

          const result = await checkCreditCardRiskWithAi({
            cardIssuer,
            cardNumberBin: cardDigits.slice(0, 6),
            cardNumberLast4: cardDigits.slice(-4),
            cardNumberLength: cardDigits.length,
            luhnValid: isValidLuhnNumber(cardDigits),
            issuerFromNumber,
            issuerMatchesPrefix,
          });

          if (!cancelled) {
            setCardAiRiskResult(result);
          }
        } catch (error) {
          if (!cancelled) {
            setCardAiRiskResult(null);
            setCardAiRiskError(getErrorMessage(error, 'AI card risk check is temporarily unavailable.'));
          }
        } finally {
          if (!cancelled) {
            setCardAiRiskLoading(false);
          }
        }
      };

      void runAiCheck();
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    creditCardValidationError,
    formData.bankingRelationships.creditCardIssuer,
    formData.bankingRelationships.creditCardNumber,
  ]);

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

  const formatCurrency = useCallback(
    (amount: number) =>
      `PHP ${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    [],
  );

  const loanStatementRows = useMemo(() => {
    const principal = Math.max(0, formData.loan.amount || 0);
    const months = Math.max(1, Math.round(formData.loan.termMonths || 1));
    const monthlyRate = Math.max(0, formData.loan.interestRate || 0) / 100 / 12;

    if (principal <= 0) {
      return [] as Array<{
        periodLabel: string;
        beginningBalance: number;
        principalPayment: number;
        interestPayment: number;
        endingBalance: number;
      }>;
    }

    const monthlyPayment =
      monthlyRate === 0
        ? principal / months
        : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));

    const startDate = new Date();
    let runningBalance = principal;

    return Array.from({ length: months }, (_, index) => {
      const rowDate = new Date(startDate.getFullYear(), startDate.getMonth() + index, 1);
      const periodLabel = rowDate.toLocaleString(undefined, {
        month: 'short',
        year: 'numeric',
      });

      const interestPayment = monthlyRate === 0 ? 0 : runningBalance * monthlyRate;
      const principalPayment = Math.min(monthlyPayment - interestPayment, runningBalance);
      const endingBalance = Math.max(runningBalance - principalPayment, 0);

      const row = {
        periodLabel,
        beginningBalance: runningBalance,
        principalPayment,
        interestPayment,
        endingBalance,
      };

      runningBalance = endingBalance;
      return row;
    });
  }, [formData.loan.amount, formData.loan.interestRate, formData.loan.termMonths]);

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
    | 'fraudVerification'
    | 'documentAnalysis'
    | 'deviceRisk'
    | 'fraudIntelligence'
    | 'optionalPsychometricQuestionnaire'
    | 'psychometricAssessment'
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
    | FraudVerification
    | DocumentAnalysis
    | DeviceRisk
    | FraudIntelligence
    | OptionalPsychometricQuestionnaire
    | PsychometricAssessment
    | Disbursement
    | FinalChecklist;

  const setTransientMessage = useCallback((message: string) => {
    setSaveMessage(message);
    window.setTimeout(() => setSaveMessage(''), 3000);
  }, []);

  const handleReviewApplication = useCallback(() => {
    navigate(reviewApplicationsPath);
  }, [navigate, reviewApplicationsPath]);

  const invalidateBackendScoring = useCallback(() => {
    setBackendQuantSummary(null);
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
    async (documentId: string, file: File, autoApplyToForm = false) => {
      setIsParsing(true);
      setSaveMessage('');

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post<DocumentParseReview>(
          '/ai/loan-documents/parse',
          formData,
          {
            timeout: 60000,
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
          extractedData: normalizeParsedSectionUpdates(response.data.extractedData),
        };

        if (autoApplyToForm) {
          setFormData((prev) => mergeReviewIntoApplication(prev, normalizedReview));
        }
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
    [mergeReviewIntoApplication, updateDocumentItem],
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
    const savedCollateralAssetDetails =
      (savedRequirements.collateralAssetDetails ?? {}) as Partial<
        LoanApplicationRequirements['collateralAssetDetails']
      >;
    const savedReleaseReadiness =
      (savedRequirements.releaseReadiness ?? {}) as Partial<
        NonNullable<LoanApplicationRequirements['releaseReadiness']>
      >;
    const savedEditorState =
      (savedRequirements.editorState ?? {}) as Partial<
        NonNullable<LoanApplicationRequirements['editorState']>
      >;
    const savedAdvisorChecklist = Array.isArray(savedReleaseReadiness.advisorChecklist)
      ? savedReleaseReadiness.advisorChecklist
          .map((item, index) => {
            if (!item || typeof item !== 'object') {
              return null;
            }

            const id =
              typeof item.id === 'string' && item.id.trim().length > 0
                ? item.id
                : `advisor-action-${index + 1}`;
            const text = typeof item.text === 'string' ? item.text.trim() : '';
            if (!text) {
              return null;
            }

            return {
              id,
              text,
              done: Boolean(item.done),
            };
          })
          .filter((item): item is AdvisorChecklistItem => item !== null)
      : [];

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
        securityClassification:
          savedCollateralAssetDetails.securityClassification ??
          blankApplication.collateral.securityClassification,
        assetType: savedCollateralAssetDetails.assetType ?? blankApplication.collateral.assetType,
        maker: savedCollateralAssetDetails.maker ?? blankApplication.collateral.maker,
        brand: savedCollateralAssetDetails.brand ?? blankApplication.collateral.brand,
        model: savedCollateralAssetDetails.model ?? record.vehicle_info ?? blankApplication.collateral.model,
        year: savedCollateralAssetDetails.year ?? blankApplication.collateral.year,
        vehicleMarketabilityCategory:
          savedCollateralAssetDetails.vehicleMarketabilityCategory ??
          blankApplication.collateral.vehicleMarketabilityCategory,
        vehicleConditionCategory:
          savedCollateralAssetDetails.vehicleConditionCategory ??
          blankApplication.collateral.vehicleConditionCategory,
        vehicleTypeCategory:
          savedCollateralAssetDetails.vehicleTypeCategory ??
          blankApplication.collateral.vehicleTypeCategory,
        motorcycleIntendedUse:
          savedCollateralAssetDetails.motorcycleIntendedUse ??
          blankApplication.collateral.motorcycleIntendedUse,
        useAsCollateral:
          savedCollateralAssetDetails.useAsCollateral ??
          blankApplication.collateral.useAsCollateral,
        appraisedValue: record.appraised_value,
        insuranceProviderCompany:
          savedCollateralAssetDetails.insuranceProviderCompany ??
          blankApplication.collateral.insuranceProviderCompany,
        policyNumber:
          savedCollateralAssetDetails.policyNumber ?? blankApplication.collateral.policyNumber,
        orNumber:
          savedCollateralAssetDetails.orNumber ?? blankApplication.collateral.orNumber,
        crNumber:
          savedCollateralAssetDetails.crNumber ?? blankApplication.collateral.crNumber,
        vehicleInfo: record.vehicle_info,
        insurance: buildCollateralInsuranceSummary({
          ...blankApplication.collateral,
          insuranceProviderCompany:
            savedCollateralAssetDetails.insuranceProviderCompany ??
            blankApplication.collateral.insuranceProviderCompany,
          policyNumber:
            savedCollateralAssetDetails.policyNumber ??
            blankApplication.collateral.policyNumber,
        }),
        registration: buildCollateralRegistrationSummary({
          ...blankApplication.collateral,
          orNumber: savedCollateralAssetDetails.orNumber ?? blankApplication.collateral.orNumber,
          crNumber: savedCollateralAssetDetails.crNumber ?? blankApplication.collateral.crNumber,
        }),
      },
      applicantPersonal: {
        ...blankApplication.applicantPersonal,
        ...savedRequirements.applicantPersonal,
        citizenship:
          savedRequirements.applicantPersonal?.citizenship ||
          blankApplication.applicantPersonal.citizenship,
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
      additionalCollaterals: Array.isArray(savedCollateralAssetDetails.additionalCollaterals)
        ? savedCollateralAssetDetails.additionalCollaterals.map((collateral, index) => ({
            id: `COL-${index}-${Date.now()}`,
            collateralType: collateral.collateralType ?? '',
            propertyType: collateral.propertyType ?? '',
            maker: collateral.maker ?? '',
            brand: collateral.brand ?? '',
            model: collateral.model ?? '',
            year: collateral.year ?? '',
            appraisedValue: parseFormattedNumber(String(collateral.appraisedValue ?? 0)),
            insuranceProviderCompany: collateral.insuranceProviderCompany ?? '',
            policyNumber: collateral.policyNumber ?? '',
            orNumber: collateral.orNumber ?? '',
            crNumber: collateral.crNumber ?? '',
            tctCctNumber: collateral.tctCctNumber ?? '',
            notes: collateral.notes ?? '',
          }))
        : blankApplication.additionalCollaterals,
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
      coBorrowers: Array.isArray(savedRequirements.coBorrowers)
        ? savedRequirements.coBorrowers.map((coBorrower, index) => ({
            id: `CO-${index}-${Date.now()}`,
            name: coBorrower.name ?? '',
            relationship: coBorrower.relationship ?? '',
            monthlyIncome: parseFormattedNumber(String(coBorrower.monthlyIncome ?? 0)),
            debtObligations: parseFormattedNumber(String(coBorrower.debtObligations ?? 0)),
            creditStanding: coBorrower.creditStanding ?? '',
          }))
        : blankApplication.coBorrowers,
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
      fraudVerification: {
        ...blankApplication.fraudVerification,
        ...(savedRequirements.fraudVerification ?? {}),
      },
      documentAnalysis: {
        ...blankApplication.documentAnalysis,
        ...(savedRequirements.documentAnalysis ?? {}),
      },
      deviceRisk: {
        ...blankApplication.deviceRisk,
        ...(savedRequirements.deviceRisk ?? {}),
      },
      fraudIntelligence: {
        ...blankApplication.fraudIntelligence,
        ...(savedRequirements.fraudIntelligence ?? {}),
      },
      optionalPsychometricQuestionnaire: {
        ...blankApplication.optionalPsychometricQuestionnaire,
        ...savedRequirements.optionalPsychometricQuestionnaire,
      },
      psychometricAssessment: {
        ...blankApplication.psychometricAssessment,
        ...(savedRequirements.psychometricAssessment ?? {}),
      },
      documents: Array.isArray(savedEditorState.documents)
        ? savedEditorState.documents.map((document) => ({
            id: document.id,
            name: document.name,
            type: document.type,
            parsedData: document.parsedData,
            status: document.status,
          }))
        : blankApplication.documents,
      committeeRemarks: record.committee_remarks,
      routing: {
        ...blankApplication.routing,
        ...(savedEditorState.routing ?? {}),
        executiveApproval: record.executive_approval,
      },
      disbursement: {
        ...blankApplication.disbursement,
        ...(savedEditorState.disbursement ?? {}),
      },
      finalChecklist: {
        ...blankApplication.finalChecklist,
        ...(savedReleaseReadiness.finalChecklist ?? {}),
      },
      releaseNotes:
        typeof savedReleaseReadiness.releaseNotes === 'string'
          ? savedReleaseReadiness.releaseNotes
          : blankApplication.releaseNotes,
      advisorChecklist:
        savedAdvisorChecklist.length > 0
          ? savedAdvisorChecklist
          : blankApplication.advisorChecklist,
    };
  }, [parseFormattedNumber]);

  const buildLoanPayload = (
    newStatus: WorkflowStatus,
    application: LoanApplication = formData,
  ): LoanApplicationPayload => {
    const canonicalEmail = getCanonicalBorrowerEmail(application);
    const canonicalPhone = getCanonicalBorrowerPhone(application);
    const canonicalAddress = getCanonicalBorrowerAddress(application);
    const payloadCalculations = calculateLoanMetrics(application);
    const payloadScorecard = calculateAutomatedScorecard(
      application,
      payloadCalculations,
    );
    const payloadCreditRiskInsights = calculateCreditRiskInsights(
      application,
      payloadCalculations,
      payloadScorecard.total,
    );
    const payloadAiRecommendation = calculateAiRecommendation(
      application,
      payloadCalculations,
      payloadScorecard.total,
    );
    const payloadScoreSections = buildScorePayloadSections(
      application,
      payloadCalculations,
      payloadScorecard,
      payloadCreditRiskInsights,
      payloadAiRecommendation,
    );
    const derivedVehicleInfo = buildCollateralVehicleInfo(application.collateral);

    return {
      application_no: application.id,
      status: newStatus,
      product_type: application.loan.productType,
      borrower_name: application.borrower.fullName,
      email: canonicalEmail,
      phone: canonicalPhone,
      gov_id: application.borrower.govId,
      address: canonicalAddress,
      monthly_income: application.employment.monthlyIncome,
      other_income: application.employment.otherIncome,
      debt_obligations: application.employment.debtObligations,
      loan_amount: application.loan.amount,
      term_months: application.loan.termMonths,
      interest_rate: application.loan.interestRate,
      purpose: application.loan.purpose,
      vehicle_info: derivedVehicleInfo,
      appraised_value: payloadCalculations.totalCollateralValue,
      committee_remarks: application.committeeRemarks,
      executive_approval: application.routing.executiveApproval,
      dti: payloadCalculations.dti,
      dsr: payloadCalculations.dsr,
      ltv: payloadCalculations.ltv,
      scorecard_total: payloadScorecard.total,
      ai_probability: payloadAiRecommendation.probability,
      requirements: buildLoanRequirements(application, application.advisorChecklist),
      credit_scores: payloadScoreSections.credit_scores,
      fraud_scores: payloadScoreSections.fraud_scores,
      social_scores: payloadScoreSections.social_scores,
      psychometric_scores: payloadScoreSections.psychometric_scores,
      credit_bureau_reports: payloadScoreSections.credit_bureau_reports,
      collateral_scores: payloadScoreSections.collateral_scores,
      profitability_scores: payloadScoreSections.profitability_scores,
      relationship_scores: payloadScoreSections.relationship_scores,
      ai_recommendations: payloadScoreSections.ai_recommendations,
      overall_scores: payloadScoreSections.overall_scores,
      decision_audit_trail: [],
    };
  };

  const informationCompletion = calculateApplicationInformationCompletion(
    buildLoanPayload(formData.status),
  );
  const informationProvidedPercent = informationCompletion.overallPercent;
  const hasSufficientInformationForRating =
    informationProvidedPercent >= CREDIT_RATING_MINIMUM_INFORMATION_PERCENT;

  const handleStepChange = async (nextStep: number) => {
    const boundedNextStep = Math.max(1, Math.min(nextStep, maxVisibleStep));

    if (nextStep !== 8) {
      if (isFilscoreRoute) {
        navigate(`/lending-scorecard${getApplicationQuery()}`);
      }
      setStep(boundedNextStep);
      return;
    }

    if (!isFilscoreRoute) {
      navigate(`/lending-scorecard/filscore${getApplicationQuery()}`);
    }

    setSaveMessage('');

    if (!hasSufficientInformationForRating) {
      setBackendQuantSummary(null);
      setSaveMessage(
        `Information provided is ${informationProvidedPercent}%. At least ${CREDIT_RATING_MINIMUM_INFORMATION_PERCENT}% is required to produce a rating.`,
      );
      setStep(boundedNextStep);
      return;
    }

    try {
      const payload = buildLoanPayload(formData.status);
      const result = await computeQuantScores(payload);
      setBackendQuantSummary(mapBackendQuantSummary(result.quant_scores));
      if (result.application_no) {
        await lendingAutosave.clear();
        await loadApplication(result.application_no);
        const editorPath = isFilscoreRoute
          ? '/lending-scorecard/filscore'
          : '/lending-scorecard';
        navigate(
          `${editorPath}?applicationNo=${encodeURIComponent(result.application_no)}`,
          { replace: true },
        );
      } else {
        setHasPersistedRecord(true);
      }
      setTransientMessage(result.message || 'QuantScores computed and stored');
    } catch (error) {
      setSaveMessage(getErrorMessage(error, 'Failed to compute QuantScores.'));
    } finally {
      setStep(boundedNextStep);
    }
  };

  useEffect(() => {
    if (isBorrowerSubscriber && step > maxVisibleStep) {
      setStep(maxVisibleStep);
    }
  }, [isBorrowerSubscriber, maxVisibleStep, step]);

  useEffect(() => {
    if (isFilscoreRoute && step !== 8) {
      setStep(8);
    }
  }, [isFilscoreRoute, step]);

  const updateField = (section: EditableSection, field: string, value: FieldValue) => {
    invalidateBackendScoring();
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as FormSectionValue),
        [field]: value,
      },
    }));
  };

  const addCoBorrower = () => {
    invalidateBackendScoring();
    const newCb: CoBorrower = { id: Date.now().toString(), name: '', relationship: '', monthlyIncome: 0, debtObligations: 0, creditStanding: 'Good' };
    setFormData(prev => ({ ...prev, coBorrowers: [...prev.coBorrowers, newCb] }));
  };

  const updateCoBorrower = (id: string, field: keyof CoBorrower, value: string | number) => {
    invalidateBackendScoring();
    setFormData(prev => ({
      ...prev,
      coBorrowers: prev.coBorrowers.map(cb => cb.id === id ? { ...cb, [field]: value } : cb)
    }));
  };

  const removeCoBorrower = (id: string) => {
    invalidateBackendScoring();
    setFormData(prev => ({ ...prev, coBorrowers: prev.coBorrowers.filter(cb => cb.id !== id) }));
  };

  const handleMaritalStatusChange = (value: string) => {
    invalidateBackendScoring();
    setFormData((prev) => ({
      ...prev,
      applicantPersonal: {
        ...prev.applicantPersonal,
        maritalStatus: value,
      },
      spouseInformation: value === 'Married' ? prev.spouseInformation : createBlankSpouseInformation(),
    }));
  };

  const handleCoBorrowerSelectionChange = (value: boolean) => {
    invalidateBackendScoring();
    setFormData((prev) => ({
      ...prev,
      otherInformation: {
        ...prev.otherInformation,
        hasCoBorrower: value,
      },
      coBorrowers: value ? prev.coBorrowers : [],
    }));
  };

  const addAdditionalCollateral = () => {
    invalidateBackendScoring();
    const newCollateral: AdditionalCollateral = {
      id: `COL-${Date.now()}`,
      collateralType: '',
      propertyType: '',
      maker: '',
      brand: '',
      model: '',
      year: '',
      appraisedValue: 0,
      insuranceProviderCompany: '',
      policyNumber: '',
      orNumber: '',
      crNumber: '',
      tctCctNumber: '',
      notes: '',
    };

    setFormData((prev) => ({
      ...prev,
      additionalCollaterals: [...prev.additionalCollaterals, newCollateral],
    }));
  };

  const updateAdditionalCollateral = (
    id: string,
    field: keyof AdditionalCollateral,
    value: string | number,
  ) => {
    invalidateBackendScoring();
    setFormData((prev) => ({
      ...prev,
      additionalCollaterals: prev.additionalCollaterals.map((collateral) =>
        collateral.id === id ? { ...collateral, [field]: value } : collateral,
      ),
    }));
  };

  const removeAdditionalCollateral = (id: string) => {
    invalidateBackendScoring();
    setFormData((prev) => ({
      ...prev,
      additionalCollaterals: prev.additionalCollaterals.filter(
        (collateral) => collateral.id !== id,
      ),
    }));
  };

  const handleIdCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isSupportedImageFile =
        file.type.startsWith('image/') ||
        /\.(heic|heif|png|jpe?g|webp|bmp)$/i.test(file.name);

      if (!isSupportedImageFile) {
        setSaveMessage('Only camera-captured ID images are allowed in Step 1 review capture.');
        e.target.value = '';
        return;
      }

      const newDoc: DocumentItem = {
        id: Date.now().toString(),
        name: `ID Capture - ${new Date().toLocaleString()}`,
        type: file.type,
        status: 'Pending',
      };
      setFormData((prev) => ({ ...prev, documents: [...prev.documents, newDoc] }));
      await parseLoanDocument(newDoc.id, file, true);

      e.target.value = '';
    }
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
  ): Promise<boolean> => {
    if (creditCardValidationError || bankAccountValidationError) {
      setSaveMessage(creditCardValidationError || bankAccountValidationError || 'Validation failed.');
      return false;
    }

    if (!hasPersistedRecord) {
      const entitlement = loanCreationEntitlement ?? await (async () => {
        try {
          return await fetchLoanCreationEntitlement();
        } catch {
          return null;
        }
      })();

      if (entitlement) {
        setLoanCreationEntitlement(entitlement);
      }

      if (entitlement && !entitlement.allowed) {
        setSaveMessage(
          'New record creation is currently unavailable.',
        );
        return false;
      }
    }

    setIsSaving(true);

    try {
      const applicationToSave = applicationOverride ?? formData;
      const payload = buildLoanPayload(newStatus, applicationToSave);
      const result = hasPersistedRecord
        ? await updateLoanApplication(applicationToSave.id, payload)
        : await createLoanApplication(payload);

      await lendingAutosave.clear();
      setHasPersistedRecord(true);
      const persistedApplicationNo = result.application_no || applicationToSave.id;
      setFormData({ ...applicationToSave, id: persistedApplicationNo, status: newStatus });
      if (!requestedApplicationNo) {
        const editorPath = isFilscoreRoute
          ? '/lending-scorecard/filscore'
          : '/lending-scorecard';
        navigate(
          `${editorPath}?applicationNo=${encodeURIComponent(persistedApplicationNo)}`,
          { replace: true },
        );
      }
      setTransientMessage(result.message || `Application saved as ${newStatus}`);
      await refreshLoanCreationEntitlement();
      return true;
    } catch (error) {
      setSaveMessage(
        getErrorMessage(error, 'Failed to save loan application.'),
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const changeWorkflowStatus = async (
    newStatus: WorkflowStatus,
    applicationOverride?: LoanApplication,
  ): Promise<boolean> => {
    if (creditCardValidationError || bankAccountValidationError) {
      setSaveMessage(creditCardValidationError || bankAccountValidationError || 'Validation failed.');
      return false;
    }

    if (
      newStatus !== 'Draft' &&
      (!enhancedDueDiligenceComplete || !enhancedSupportingDocumentsComplete)
    ) {
      setSaveMessage(
        'Complete all required enhanced due diligence fields and supporting document declarations before moving beyond Draft.',
      );
      return false;
    }

    if (applicationOverride) {
      return persistLoanApplication(newStatus, applicationOverride);
    }

    if (step === 10) {
      return persistLoanApplication(newStatus);
    }

    if (!hasPersistedRecord || formData.status === 'Draft') {
      return persistLoanApplication(newStatus);
    }

    setIsSaving(true);

    try {
      const result = await updateLoanApplicationStatus(formData.id, newStatus);
      setFormData(prev => ({ ...prev, status: newStatus }));
      setTransientMessage(result.message || `Status updated to ${newStatus}`);
      return true;
    } catch (error) {
      setSaveMessage(getErrorMessage(error, 'Failed to update status.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    await persistLoanApplication('Draft');
  };

  const handleGenerateCreditAdvisorPlan = async () => {
    setAdvisorLoading(true);
    setAdvisorError('');
    setAdvisorNotice('');

    try {
      const result = await generateCreditAdvisorPlan({
        productType: formData.loan.productType,
        monthlyIncome: calculations.totalIncome,
        debtObligations: calculations.totalExistingDebt,
        loanAmount: formData.loan.amount,
        appraisedValue: calculations.totalCollateralValue,
        dti: calculations.dti,
        dsr: calculations.dsr,
        ltv: calculations.ltv,
        finalScore: backendQuantSummary?.overall_score,
        finalDecision: formData.status,
        borrowerNotes: formData.committeeRemarks,
      });

      setAdvisorAdvice(result.advice || 'No advisory output was returned by the AI provider.');
      setAdvisorMeta({
        provider: result.provider,
        model: result.model,
        total_tokens: result.total_tokens,
        latency_ms: result.latency_ms,
      });

      const extractedActions = extractTopAdvisorActions(result.advice || '');
      if (extractedActions.length > 0) {
        setFormData((prev) => ({
          ...prev,
          advisorChecklist: extractedActions.map((item, index) => ({
            id: `advisor-action-${index + 1}`,
            text: item,
            done: false,
          })),
        }));
      }
    } catch (error) {
      setAdvisorError(getErrorMessage(error, 'Unable to generate credit advisor guidance right now.'));
    } finally {
      setAdvisorLoading(false);
    }
  };

  const handleCopyAdvisorPlan = async () => {
    if (!advisorAdvice.trim()) {
      setAdvisorNotice('Generate a plan first before copying.');
      return;
    }

    try {
      await navigator.clipboard.writeText(advisorAdvice);
      setAdvisorNotice('Advisory plan copied to clipboard.');
    } catch {
      const fallbackTextArea = document.createElement('textarea');
      fallbackTextArea.value = advisorAdvice;
      fallbackTextArea.setAttribute('readonly', '');
      fallbackTextArea.style.position = 'absolute';
      fallbackTextArea.style.left = '-9999px';
      document.body.appendChild(fallbackTextArea);
      fallbackTextArea.select();
      document.execCommand('copy');
      document.body.removeChild(fallbackTextArea);
      setAdvisorNotice('Advisory plan copied using fallback clipboard support.');
    }
  };

  const handleApplyTopActionsToChecklist = () => {
    const extractedActions = extractTopAdvisorActions(advisorAdvice);

    if (extractedActions.length === 0) {
      setAdvisorNotice('No actionable items found. Generate or refine advisory text first.');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      advisorChecklist: extractedActions.map((item, index) => ({
        id: `advisor-action-${index + 1}`,
        text: item,
        done: false,
      })),
    }));
    setAdvisorNotice('Top actions were added to the checklist.');
  };

  const handleSelectedWorkflowAction = async () => {
    setWorkflowActionState('processing');
    const didSucceed = await changeWorkflowStatus(selectedWorkflowAction);
    if (didSucceed) {
      setCompletedWorkflowAction(selectedWorkflowAction);
      setWorkflowActionState('completed');
      window.setTimeout(() => {
        setWorkflowActionState('idle');
      }, 2500);
      return;
    }

    setWorkflowActionState('error');
  };

  const handleFinalizeDocumentReview = async (newStatus: WorkflowStatus) => {
    if (!documentReview) {
      return;
    }

    const mergedApplication = mergeReviewIntoApplication(formData, documentReview);
    const didSucceed = await changeWorkflowStatus(newStatus, mergedApplication);
    if (didSucceed) {
      setDocumentReview(null);
      setReviewDocumentId(null);
    }
  };

  const loadApplication = useCallback(async (applicationNo: string) => {
    setIsLoadingApplication(true);

    try {
      const data = await fetchLoanApplication(applicationNo);

      setFormData(hydrateApplication(data));
      setHasPersistedRecord(true);
      setBackendQuantSummary(mapRecordQuantSummary(data));
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

  const refreshLoanCreationEntitlement = useCallback(async () => {
    try {
      const entitlement = await fetchLoanCreationEntitlement();
      setLoanCreationEntitlement(entitlement);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        setLoanCreationEntitlement({
          allowed: false,
          reason: 'subscription_required',
          message: 'Your current plan does not allow creating new loan records.',
          role_code: '',
          records_in_free_window: 0,
          records_this_month: 0,
          free_limit: 0,
          free_days: 0,
          free_window_active: false,
          amount_due_this_month: 0,
          has_paid_current_period: false,
        });
      } else {
        setLoanCreationEntitlement(null);
      }
    }
  }, []);

  useEffect(() => {
    void refreshLoanCreationEntitlement();
  }, [refreshLoanCreationEntitlement]);

  // --- Global Nav Actions ---
  const handleCreateNew = async () => {
    await lendingAutosave.clear();
    setFormData(createNewApplicationInstance());
    setFormattedNumberDrafts({});
    setDocumentReview(null);
    setReviewDocumentId(null);
    setBackendQuantSummary(null);
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
    { label: 'Applicant / Borrower Identity Verified', passed: !!formData.borrower.fullName && !!formData.borrower.govId },
    { label: 'Loan Amount & Collateral Valid', passed: formData.loan.amount > 0 && calculations.totalCollateralValue > 0 },
    {
      label: `Debt Service Ratio (DSR) is within acceptable limits (< ${CREDIT_POLICY_THRESHOLDS.dsr.acceptableMax}%)`,
      passed: isAcceptableDsr(calculations.dsr),
    },
    { label: 'Required Documents Uploaded & Parsed', passed: formData.documents.length >= 2 && formData.documents.every(d => d.status === 'Parsed') },
    { label: 'Product selected', passed: !!formData.loan.productType },
    { label: 'Enhanced due diligence fields completed', passed: enhancedDueDiligenceComplete },
    { label: 'Enhanced supporting document declarations completed', passed: enhancedSupportingDocumentsComplete },
  ], [calculations, enhancedDueDiligenceComplete, enhancedSupportingDocumentsComplete, formData]);
  const documentPreparationChecklist = useMemo(
    () => [
      {
        label: 'Product',
        complete:
          !!formData.loan.productType &&
          formData.loan.purpose.trim().length > 0 &&
          formData.loan.amount > 0 &&
          formData.loan.termMonths > 0 &&
          formData.loan.interestRate > 0,
      },
      {
        label: 'Applicant',
        complete:
          formData.borrower.fullName.trim().length > 0 &&
          formData.borrower.govId.trim().length > 0 &&
          formData.applicantPersonal.dateOfBirth.trim().length > 0 &&
          formData.contactInformation.mobileNumber.trim().length > 0 &&
          formData.addressInformation.presentAddress.trim().length > 0,
      },
      {
        label: 'Employment',
        complete:
          formData.employment.monthlyIncome > 0 &&
          formData.employmentInformation.employmentStatus.trim().length > 0 &&
          formData.employmentInformation.employerBusinessName.trim().length > 0,
      },
      {
        label: 'Co-Borrower',
        complete:
          (!isMarried && !hasCoBorrowerSelected) ||
          (
            (!isMarried || formData.spouseInformation.fullName.trim().length > 0) &&
            (!hasCoBorrowerSelected ||
              (
                formData.coBorrowers.length > 0 &&
                formData.coBorrowers.every(
                  (coBorrower) =>
                    coBorrower.name.trim().length > 0 &&
                    coBorrower.relationship.trim().length > 0 &&
                    coBorrower.monthlyIncome > 0,
                )
              ))
          ),
        optional: true,
      },
      {
        label: 'Banking',
        complete:
          formData.bankingRelationships.bankBranch.trim().length > 0 ||
          formData.bankingRelationships.creditCardIssuer.trim().length > 0 ||
          formData.bankingRelationships.loanLender.trim().length > 0,
      },
      {
        label: 'Collateral',
        complete:
          (
            formData.collateral.assetType.trim().length > 0 &&
            formData.collateral.maker.trim().length > 0 &&
            formData.collateral.brand.trim().length > 0 &&
            formData.collateral.model.trim().length > 0 &&
            formData.collateral.year.trim().length > 0 &&
            formData.collateral.appraisedValue > 0 &&
            formData.collateral.insuranceProviderCompany.trim().length > 0 &&
            formData.collateral.policyNumber.trim().length > 0 &&
            (formData.collateral.orNumber.trim().length > 0 ||
              formData.collateral.crNumber.trim().length > 0)
          ) ||
          (
            formData.collateralInformation.propertyAddress.trim().length > 0 &&
            formData.collateralInformation.registeredOwner.trim().length > 0 &&
            formData.collateralInformation.propertyAppraisedValue > 0
          ) ||
          formData.additionalCollaterals.some(
            (collateral) =>
              collateral.collateralType.trim().length > 0 &&
              collateral.appraisedValue > 0,
          ),
      },
      {
        label: 'Due Diligence',
        complete: enhancedDueDiligenceComplete,
      },
    ],
    [enhancedDueDiligenceComplete, formData, hasCoBorrowerSelected, isMarried],
  );
  const documentPreparationCompletedCount = documentPreparationChecklist.filter(
    (item) => item.complete,
  ).length;
  const documentPreparationCompletionPercent = Math.round(
    (documentPreparationCompletedCount / documentPreparationChecklist.length) * 100,
  );
  const allValidationChecksPassed = validationChecks.every((check) => check.passed);
  const finalChecklistComplete = Boolean(
    formData.finalChecklist?.allRequiredDocumentsProvided &&
      formData.finalChecklist?.allSignaturesCollected &&
      formData.finalChecklist?.creditCommitteeApproved &&
      formData.finalChecklist?.executiveApprovalObtained &&
      formData.finalChecklist?.collateralDocumentationReady &&
      formData.finalChecklist?.creditImprovementActionsTracked,
  );
  const advisorChecklistCompletedCount = formData.advisorChecklist.filter(
    (item) => item.done,
  ).length;
  const advisorChecklistTotalCount = formData.advisorChecklist.length;
  const advisorChecklistCompletionPercent =
    advisorChecklistTotalCount > 0
      ? Math.round((advisorChecklistCompletedCount / advisorChecklistTotalCount) * 100)
      : 0;
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
      if (
        isWorkflowAutoRejectProbability(aiRecommendation.probability) ||
        creditRiskInsights.riskScore > CREDIT_POLICY_THRESHOLDS.workflow.creditReviewRejectRiskScoreMax
      ) {
        return 'Rejected';
      }

      if (allValidationChecksPassed && isWorkflowAutoApproveProbability(aiRecommendation.probability)) {
        return 'Approved';
      }

      return 'Credit Review';
    }

    if (formData.status === 'Submitted' || formData.status === 'Under Review') {
      return 'Credit Review';
    }

    return 'Credit Review';
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

  useEffect(() => {
    const advisorChecklistComplete =
      formData.advisorChecklist.length > 0 &&
      formData.advisorChecklist.every((item) => item.done);

    if (
      formData.finalChecklist?.creditImprovementActionsTracked ===
      advisorChecklistComplete
    ) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      finalChecklist: {
        ...prev.finalChecklist,
        creditImprovementActionsTracked: advisorChecklistComplete,
      },
    }));
  }, [formData.advisorChecklist, formData.finalChecklist?.creditImprovementActionsTracked]);
  useEffect(() => {
    const calculatedAge = calculateAgeFromDateOfBirth(
      formData.applicantPersonal.dateOfBirth,
    );

    if (formData.applicantPersonal.age !== calculatedAge) {
      setFormData((prev) => ({
        ...prev,
        applicantPersonal: {
          ...prev.applicantPersonal,
          age: calculatedAge,
        },
      }));
    }
  }, [formData.applicantPersonal.age, formData.applicantPersonal.dateOfBirth]);
  useEffect(() => {
    const currentEmployer = formData.employment.history.trim();
    const employerBusinessName = formData.employmentInformation.employerBusinessName.trim();

    if (!currentEmployer || employerBusinessName) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      employmentInformation: {
        ...prev.employmentInformation,
        employerBusinessName: currentEmployer,
      },
    }));
  }, [formData.employment.history, formData.employmentInformation.employerBusinessName]);
  useEffect(() => {
    const derivedFullName = composeApplicantFullName(formData.applicantPersonal);
    const canonicalMobileNumber = formData.contactInformation.mobileNumber.trim();
    const legacyPhoneNumber = formData.borrower.phone.trim();
    const canonicalPresentAddress = formData.addressInformation.presentAddress.trim();
    const legacyBorrowerAddress = formData.borrower.address.trim();
    const canonicalBorrowerEmail = formData.borrower.email.trim();
    const supplementalIncome =
      formData.employmentInformation.otherSourcesOfIncome +
      formData.employmentInformation.investmentIncome +
      formData.employmentInformation.businessIncome +
      formData.employmentInformation.pensionIncome;
    const derivedGrossMonthlyIncome =
      formData.employment.monthlyIncome + Math.max(0, supplementalIncome);

    setFormData((prev) => {
      let changed = false;
      let borrower = prev.borrower;
      let contactInformation = prev.contactInformation;
      let addressInformation = prev.addressInformation;
      let employmentInformation = prev.employmentInformation;

      if (derivedFullName && prev.borrower.fullName !== derivedFullName) {
        borrower = { ...borrower, fullName: derivedFullName };
        changed = true;
      }

      if (canonicalMobileNumber && prev.borrower.phone !== canonicalMobileNumber) {
        borrower = { ...borrower, phone: canonicalMobileNumber };
        changed = true;
      } else if (!canonicalMobileNumber && legacyPhoneNumber && prev.contactInformation.mobileNumber !== legacyPhoneNumber) {
        contactInformation = { ...contactInformation, mobileNumber: legacyPhoneNumber };
        changed = true;
      }

      if (canonicalPresentAddress && prev.borrower.address !== canonicalPresentAddress) {
        borrower = { ...borrower, address: canonicalPresentAddress };
        changed = true;
      } else if (!canonicalPresentAddress && legacyBorrowerAddress && prev.addressInformation.presentAddress !== legacyBorrowerAddress) {
        addressInformation = { ...addressInformation, presentAddress: legacyBorrowerAddress };
        changed = true;
      }

      if (canonicalBorrowerEmail && prev.contactInformation.emailAddress !== canonicalBorrowerEmail) {
        contactInformation = { ...contactInformation, emailAddress: canonicalBorrowerEmail };
        changed = true;
      } else if (!canonicalBorrowerEmail && prev.contactInformation.emailAddress.trim()) {
        borrower = { ...borrower, email: prev.contactInformation.emailAddress.trim() };
        changed = true;
      }

      if (prev.employmentInformation.grossMonthlyIncome !== derivedGrossMonthlyIncome) {
        employmentInformation = {
          ...employmentInformation,
          grossMonthlyIncome: derivedGrossMonthlyIncome,
        };
        changed = true;
      }

      if (!changed) {
        return prev;
      }

      return {
        ...prev,
        borrower,
        contactInformation,
        addressInformation,
        employmentInformation,
      };
    });
  }, [
    formData.addressInformation.presentAddress,
    formData.applicantPersonal,
    formData.borrower.address,
    formData.borrower.email,
    formData.borrower.phone,
    formData.contactInformation.emailAddress,
    formData.contactInformation.mobileNumber,
    formData.employment.monthlyIncome,
    formData.employmentInformation.businessIncome,
    formData.employmentInformation.investmentIncome,
    formData.employmentInformation.otherSourcesOfIncome,
    formData.employmentInformation.pensionIncome,
    formData.employmentInformation.grossMonthlyIncome,
  ]);
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

    if (
      type === 'number' &&
      rawValue === 0 &&
      !(section === 'enhancedDueDiligence' && field === 'numberOfActiveLoans')
    ) {
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

  const renderInput = (
    section: EditableSection,
    field: string,
    label: string,
    type = 'text',
    disabled = false,
    placeholder?: string,
  ) => (
    <div className="mb-3">
      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">{label}</label>
      <input
        type={type}
        disabled={disabled}
        placeholder={placeholder}
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
    placeholder?: string,
  ) => (
    <div className="mb-3">
      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">
        {label}{required ? ' (Required | Indicate N/A if Not Applicable)' : ''}
      </label>
      <textarea
        rows={rows}
        placeholder={placeholder}
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

  const renderEnhancedDueDiligenceBankingSection = () => (
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
          {usesStructuredRetailCriteria && renderSelect('bankingRelationships', 'creditPaymentHistory', 'Declaration of Previously with Unpaid Loan or Credit Card', ['Excellent handling (no past due)', 'Satisfactory handling (minimal delays, settled)', 'No previous borrowing', 'Not properly handled / delayed payments'])}
          {usesStructuredRetailCriteria && renderSelect('bankingRelationships', 'accountHandling', 'Deposit / Current Account Handling', ['Excellent handling (no returned checks)', 'Satisfactory handling (minimal returned checks, settled)', 'Not properly handled'])}
          {usesStructuredRetailCriteria && renderSelect('bankingRelationships', 'utilityCreditBureauStatus', 'Payment of Utilities / Credit Bureau Findings', ['Very satisfactory to satisfactory', 'Dismissed / settled (fully settled with date)', 'Not satisfactory'])}
          {isCreditCard && renderSelect('bankingRelationships', 'creditCardRelationshipStatus', 'Existing Credit Card Relationship', ['Existing cardholder for more than 5 years with excellent payment history', 'Existing cardholder for 2–5 years with satisfactory history', 'New cardholder or less than 2 years', 'No previous credit card relationship'])}
          {renderTextarea('enhancedDueDiligence', 'additionalBankAccountsOwned', 'Additional Bank Accounts Owned', 3, true)}
          {renderTextarea('enhancedDueDiligence', 'priorBankingRelationships', 'Prior Banking Relationships', 3, true)}
          {(isPersonalLoan || isMarginLoan) && renderFormattedNumberInput('bankingRelationships', 'averageSavingsBalance', 'Average Savings Balance')}
          {usesStructuredRetailCriteria && renderFormattedNumberInput('bankingRelationships', 'averageDailyBalance', 'Average Daily Balance')}
          {(isPersonalLoan || isMarginLoan) && renderSelect('bankingRelationships', 'depositRegularity', 'Deposit Regularity', ['Regular deposits', 'Irregular deposits', 'No savings relationship'])}
          {isCreditCard && renderSelect('bankingRelationships', 'bankingRelationshipTier', 'Banking Relationship', ['Premium/Preferred banking customer with multiple products', 'Active savings/current account with regular transactions', 'Limited banking relationship', 'No banking relationship'])}
          {renderTextarea('enhancedDueDiligence', 'existingInsurancePolicies', 'Existing Insurance Policies', 3, true)}
          {renderTextarea('enhancedDueDiligence', 'selfDeclaredAssetsAndLiabilities', 'Self-Declared Assets and Liabilities', 4, true)}
          {renderTextarea('enhancedDueDiligence', 'selfDeclaredInvestmentPortfolio', 'Self-Declared Investment Portfolio', 4, true)}
        </div>
      </div>
    </div>
  );

  const renderEnhancedDueDiligenceEmploymentSection = () => (
    <div className="border-t pt-4 mt-4 space-y-6">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h5 className="font-semibold text-sm text-slate-700 mb-3">Employment, Income, and Residence Verification</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {usesStructuredRetailCriteria && renderSelect('employmentInformation', 'employmentLocation', 'Employment Location', ['Locally Employed', 'Not Locally Employed'])}
          {usesStructuredRetailCriteria && renderInput('employmentInformation', 'employerBusinessYears', 'Years in Business of Employer', 'number')}
          {renderInput('contactInformation', 'mobileYearsUsed', 'Mobile Number Years in Use')}
          {renderInput('contactInformation', 'emailYearsUsed', 'Email Address Years in Use')}
          {renderTextarea('enhancedDueDiligence', 'employmentReferencePerson', 'Employment Reference Person and Contact No.', 3, true, 'Full Name / Contact Number')}
          {renderTextarea('enhancedDueDiligence', 'hrContactInformation', 'HR Contact Information and Contact No.', 3, true, 'Full Name / Contact Number')}
          {renderTextarea('enhancedDueDiligence', 'supervisorInformation', 'Supervisor Information and Contact No.', 3, true, 'Full Name / Contact Number')}
          {renderTextarea('enhancedDueDiligence', 'sourceOfIncomeVerificationReferences', 'Source of Income Verification and Contact No.', 3, true, 'Full Name / Contact Number')}
          {renderTextarea('enhancedDueDiligence', 'lengthOfResidenceConfirmation', 'Length of Residence Confirmation', 3, true)}
          {renderTextarea('enhancedDueDiligence', 'utilityAccountReferences', 'Utility Account References', 3, true, 'Utility Type, Company and Account Number')}
          {renderCheckbox('otherInformation', 'deviceVerified', 'Device Verified / Registered')}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h5 className="font-semibold text-sm text-slate-700 mb-3">References, Declarations, and Professional Profile</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {usesStructuredRetailCriteria && renderSelect('enhancedDueDiligence', 'lifestyleIndicator', 'Lifestyle', ['Respectable lifestyle (no gambling, drinking, etc.)', 'Signs of adverse characteristics'])}
          {(isPersonalLoan || isMarginLoan || isMotorcycleLoan) && renderSelect('enhancedDueDiligence', 'secondaryIncomeProfile', 'Secondary Source of Income', ['Multiple stable income sources', 'One additional regular income source', 'Occasional additional income', 'No secondary income'])}
          {renderTextarea('enhancedDueDiligence', 'characterReferences', 'Character References and CONTACT NUMBERS', 3, true, 'Full Name and Contact Number')}
          {renderTextarea('enhancedDueDiligence', 'guarantorReferences', 'Guarantor References and CONTACT NUMBERS', 3, true, 'Full Name and Contact Number')}
          {renderTextarea('enhancedDueDiligence', 'coBorrowerReferences', 'Co-Borrower References and CONTACT NUMBERS (Optional)', 3, false, 'Full Name and Contact Number')}
          {renderTextarea('enhancedDueDiligence', 'referencesFromEmployerOrCommunity', 'References from Employer or Community and CONTACT NUMBERS', 3, true, 'Full Name and Contact Number')}
          {renderSelect('enhancedDueDiligence', 'communityReputation', 'Community Reputation', ['Excellent references', 'Good references', 'Average', 'Limited information', 'Adverse information'])}
          {renderTextarea('enhancedDueDiligence', 'professionalOrganizationMemberships', 'Professional Organization Memberships', 3, true)}
          {renderTextarea('enhancedDueDiligence', 'professionalLicenses', 'Professional Licenses', 3, true, 'Issuer Profession ID Number and Validity Date')}
          {renderTextarea('enhancedDueDiligence', 'additionalPropertyDeclarations', 'Additional Property Declarations', 3, true, 'Address')}
          {renderTextarea('enhancedDueDiligence', 'additionalVehicleDeclarations', 'Additional Vehicle Declarations', 3, true, 'Car Model and Year')}
          {renderTextarea('enhancedDueDiligence', 'communityInvolvementInformation', 'Community Involvement Information', 3, true, 'Association Name and Role')}
          {renderInput('enhancedDueDiligence', 'facebookProfile', 'Facebook Profile Links')}
          {renderInput('enhancedDueDiligence', 'facebookProfileDateOpened', 'Facebook Profile Date Opened', 'date')}
          {renderInput('enhancedDueDiligence', 'instagramProfile', 'Instagram Profile Links')}
          {renderInput('enhancedDueDiligence', 'instagramProfileDateOpened', 'Instagram Profile Date Opened', 'date')}
          {renderInput('enhancedDueDiligence', 'xProfile', 'X / Twitter Profile Links')}
          {renderInput('enhancedDueDiligence', 'xProfileDateOpened', 'X / Twitter Profile Date Opened', 'date')}
          {renderInput('enhancedDueDiligence', 'tikTokProfile', 'TikTok Profile Links')}
          {renderInput('enhancedDueDiligence', 'tikTokProfileDateOpened', 'TikTok Profile Date Opened', 'date')}
          {renderInput('enhancedDueDiligence', 'linkedInProfile', 'LinkedIn Profile Links')}
          {renderInput('enhancedDueDiligence', 'linkedInProfileDateOpened', 'LinkedIn Profile Date Opened', 'date')}
          {renderTextarea('enhancedDueDiligence', 'otherSocialMediaLinks', 'Other Social Media Links', 2)}
          {renderInput('enhancedDueDiligence', 'businessWebsite', 'Business Website (If Self-Employed / Optional)')}
        </div>
      </div>

      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
        <div className="mb-3">
          <h5 className="font-semibold text-sm text-indigo-800 mb-1">Credit Values Assessment Model</h5>
          <p className="text-sm text-indigo-700/80">
            This assessment must be completed in less than an hour. No saving and reverting back.
          </p>
        </div>
        <div className="space-y-4">
          {psychometricAssessmentSections.map((section) => (
            <div key={section.id} className="rounded-lg border border-indigo-100 bg-white p-4">
              <div className="mb-3">
                <h6 className="font-semibold text-sm text-indigo-900">
                  Section {section.id}: {section.title}
                </h6>
                <p className="text-xs text-slate-500">
                 
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.questions.map((question, questionIndex) => (
                  <div key={question.field} className="rounded-lg border border-indigo-100 bg-slate-50 p-3">
                    <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">
                      {questionIndex + 1}. {question.prompt}
                    </label>
                    <select
                      value={String(getInputValue('psychometricAssessment', question.field))}
                      onChange={(event) =>
                        updateField('psychometricAssessment', question.field, event.target.value)
                      }
                      className="loan-form-select w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select...</option>
                      {question.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
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
  );

  const renderFraudVerificationSection = () => (
    <div className="border-t pt-4 mt-4 space-y-6">
      <div>
        <h4 className="font-semibold text-sm text-gray-700 mb-2">Fraud Verification & Override Checks</h4>
        <p className="text-sm text-slate-500">
          These fields feed the FILSCORE fraud scoring engine directly and reduce reliance on backend fallback assumptions.
        </p>
      </div>

      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
        <h5 className="font-semibold text-sm text-rose-800 mb-3">Identity Verification</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderInput('fraudVerification', 'faceMatchScore', 'Face Match Score (%)', 'number')}
          {renderSelect('fraudVerification', 'livenessDetection', 'Liveness Detection', ['Passed', 'Manual review', 'Failed'])}
        </div>
      </div>

      <div className="rounded-lg border border-rose-200 bg-white p-4">
        <h5 className="font-semibold text-sm text-slate-700 mb-3">Document Verification</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelect('fraudVerification', 'incomeDocumentsStatus', 'Income Documents', ['Verified', 'Minor discrepancies', 'Suspicious'])}
          {renderSelect('fraudVerification', 'employmentVerificationStatus', 'Employment Verification', ['Verified', 'Partially verified', 'Cannot verify'])}
          {renderSelect('fraudVerification', 'bankStatementVerificationStatus', 'Bank Statement Verification', ['Matches application', 'Minor variance', 'Significant inconsistency'])}
          {renderSelect('documentAnalysis', 'ocrAnalysisStatus', 'OCR & AI Document Analysis', ['No signs of tampering', 'Minor anomalies', 'Suspected alteration'])}
        </div>
      </div>

      <div className="rounded-lg border border-rose-200 bg-white p-4">
        <h5 className="font-semibold text-sm text-slate-700 mb-3">Financial & Banking Verification</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelect('fraudVerification', 'payrollVerificationStatus', 'Payroll Verification', ['Verified', 'Partial', 'None'])}
          {renderSelect('fraudVerification', 'bankAccountOwnershipStatus', 'Bank Account Ownership', ['Verified', 'Manual verification', 'Failed'])}
        </div>
      </div>

      <div className="rounded-lg border border-rose-200 bg-white p-4">
        <h5 className="font-semibold text-sm text-slate-700 mb-3">Device & Digital Risk</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelect('deviceRisk', 'deviceReputation', 'Device Reputation', ['Trusted', 'Unknown', 'Blacklisted'])}
          {renderSelect('deviceRisk', 'ipAddressRisk', 'IP Address Risk', ['Normal', 'VPN/Proxy', 'High-risk'])}
          {renderSelect('deviceRisk', 'deviceConsistency', 'Device Consistency', ['Same device', 'Multiple trusted devices', 'Multiple unknown devices'])}
        </div>
      </div>

      <div className="rounded-lg border border-rose-200 bg-white p-4">
        <h5 className="font-semibold text-sm text-slate-700 mb-3">Fraud Intelligence & Hard Stops</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelect('fraudIntelligence', 'watchlistStatus', 'Watchlist Screening', ['Clear', 'Manual review', 'Positive match'])}
          {renderSelect('fraudIntelligence', 'previousFraudRecords', 'Previous Fraud Records', ['None', 'Minor alerts', 'Confirmed fraud'])}
          {renderSelect('fraudIntelligence', 'applicationVelocity', 'Application Velocity', ['Normal', 'Multiple recent applications', 'Excessive activity'])}
          {renderCheckbox('fraudIntelligence', 'fakeNationalId', 'Fake National ID')}
          {renderCheckbox('fraudIntelligence', 'forgedPayslip', 'Forged Payslip')}
          {renderCheckbox('fraudIntelligence', 'forgedBankStatement', 'Forged Bank Statement')}
          {renderCheckbox('fraudIntelligence', 'identityTheftIndicator', 'Identity Theft Indicator')}
          {renderCheckbox('fraudIntelligence', 'sanctionsPepMatch', 'Sanctions / PEP Match')}
        </div>
      </div>
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
  const assetVehicleTypeOptions = [
    'Passenger Cars',
    'SUVs & Crossovers',
    'Pickup Trucks',
    'Motorcycles & Scooters',
    'Buses & Minivans',
    'Commercial Trucks',
  ];
  const workflowActionOptions: Array<{ label: string; value: WorkflowStatus }> = [
    { label: 'Review', value: 'Credit Review' },
    { label: 'Reject', value: 'Rejected' },
    { label: 'Approve', value: 'Approved' },
    { label: 'Release', value: 'Released' },
  ];
  const displayedQuantSummary = backendQuantSummary;
  const compositeInternalScore = displayedQuantSummary
    ? calculateCompositeInternalScore({
        creditScore: displayedQuantSummary.credit_score,
        creditValueScore: displayedQuantSummary.psychometric_score,
        socialScore: displayedQuantSummary.social_score,
        nonStarterScore: displayedQuantSummary.fraud_score,
      })
    : null;
  const borrowerDisplayName =
    formData.borrower.fullName.trim() ||
    [
      formData.applicantPersonal.firstName,
      formData.applicantPersonal.middleName,
      formData.applicantPersonal.lastName,
    ]
      .filter((value) => value.trim().length > 0)
      .join(' ')
      .trim() ||
    'Unnamed Applicant / Borrower';

  const handleOpenCertification = () => {
    if (hasSufficientInformationForRating && !displayedQuantSummary) {
      setSaveMessage('Generate FILScore first before requesting certification.');
      return;
    }

    const ratingSummary = hasSufficientInformationForRating
      ? displayedQuantSummary
      : null;

    const qrValue =
      typeof window !== 'undefined'
        ? `${window.location.origin}/loan-certification?applicationNo=${encodeURIComponent(formData.id)}`
        : formData.id;

    navigate(`/loan-certification?applicationNo=${encodeURIComponent(formData.id)}`, {
      state: {
        certificationData: {
          applicationNo: formData.id,
          borrowerName: borrowerDisplayName,
          productType: formData.loan.productType,
          issuedAt: new Date().toISOString(),
          informationProvidedPercent,
          overallScore: ratingSummary ? compositeInternalScore : null,
          label: ratingSummary?.final_grade ?? 'Rating Not Produced',
          decision: ratingSummary?.decision ?? 'Insufficient Information',
          creditScore: ratingSummary?.credit_score ?? null,
          fraudScore: ratingSummary?.fraud_score ?? null,
          socialScore: ratingSummary?.social_score ?? null,
          creditValueScore: ratingSummary?.psychometric_score ?? null,
          qrValue,
        },
      },
    });
  };

  const executiveSummaryItems = [
    {
      label: 'Product Being Applied For',
      value: formData.loan.productType || 'Pending',
    },
    {
      label: 'Credit Score',
      value:
        displayedQuantSummary && toFilscore(displayedQuantSummary.credit_score) !== null
          ? toFilscore(displayedQuantSummary.credit_score)!.toString()
          : 'Pending',
    },
    {
      label: 'Non-Starter Score',
      value:
        displayedQuantSummary && toFilscore(displayedQuantSummary.fraud_score) !== null
          ? toFilscore(displayedQuantSummary.fraud_score)!.toString()
          : 'Pending',
    },
    {
      label: 'Social Score',
      value:
        displayedQuantSummary && toFilscore(displayedQuantSummary.social_score) !== null
          ? toFilscore(displayedQuantSummary.social_score)!.toString()
          : 'Pending',
    },
    {
      label: 'Credit Values Score',
      value:
        displayedQuantSummary && toFilscore(displayedQuantSummary.psychometric_score) !== null
          ? toFilscore(displayedQuantSummary.psychometric_score)!.toString()
          : 'Pending',
    },
  ];
  const scoringSignalItems = [
    {
      label: 'Composite Score',
      value:
        compositeInternalScore !== null && toFilscore(compositeInternalScore) !== null
          ? toFilscore(compositeInternalScore)!.toString()
          : 'Pending',
    },
    {
      label: 'AI Approval Probability',
      value: `${aiRecommendation.probability}%`,
    },
    {
      label: 'Risk Score',
      value: creditRiskInsights.riskScore.toFixed(1),
    },
    {
      label: 'Non-Starter Score',
      value: creditRiskInsights.nonStarterScore.toFixed(0),
    },
  ];
  const workflowActionButtonClass =
    workflowActionState === 'processing'
      ? 'bg-amber-500 hover:bg-amber-500 border-amber-600 text-white'
      : workflowActionState === 'completed'
        ? 'bg-emerald-600 hover:bg-emerald-600 border-emerald-700 text-white'
        : workflowActionState === 'error'
          ? 'bg-red-600 hover:bg-red-600 border-red-700 text-white'
          : selectedWorkflowAction === 'Approved'
            ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-700 text-white'
            : selectedWorkflowAction === 'Rejected'
              ? 'bg-red-600 hover:bg-red-500 border-red-700 text-white'
              : selectedWorkflowAction === 'Released'
                ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-700 text-white'
                : 'bg-blue-600 hover:bg-blue-500 border-blue-700 text-white';
  const workflowActionButtonLabel =
    workflowActionState === 'processing'
      ? `Processing ${selectedWorkflowAction}...`
      : workflowActionState === 'completed'
        ? `Completed: ${completedWorkflowAction ?? selectedWorkflowAction}`
        : workflowActionState === 'error'
          ? `Retry ${selectedWorkflowAction}`
          : `Save as ${selectedWorkflowAction}`;
  const allStepLabels = [
    'Product Selection',
    'Applicant Info',
    'Employment, Income and Credit Values',
    'Co-Borrower',
    'Banking',
    'Collateral',
    'Documents',
    'FILScore',
    'Approval',
    'Release & Booking',
  ];
  const stepLabels = isBorrowerSubscriber ? allStepLabels.slice(0, maxVisibleStep) : allStepLabels;
  const currentStepLabel = stepLabels[Math.max(0, step - 1)] ?? 'Lending Workflow';
  const completionPercent = Math.round((step / stepLabels.length) * 100);

  return (
    <div className="psychometric-page lending-psychometric-page">
      <section className="psychometric-hero lending-psychometric-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Advanced Origination Workflow</span>
          <h1>Financial Health </h1>
          <p>
            Run the end-to-end loan workflow across product intake, underwriting details, and
            FILScore certification : Credit Scorecard, Credit Values and Social Scorecards
          </p>
        </div>

        <div className="psychometric-hero-metric">
          <span>Current Step</span>
          <strong>{step}/{stepLabels.length}</strong>
          <small>{currentStepLabel}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid lending-psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Application ID</span>
          <strong>{formData.id}</strong>
          <small>Live working reference</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Product</span>
          <strong>{formData.loan.productType}</strong>
          <small>{formData.loan.purpose || 'Purpose not yet entered'}</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Workflow Status</span>
          <strong>{formData.status}</strong>
          <small>{selectedWorkflowAction} ready as next action</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Progress</span>
          <strong>{completionPercent}%</strong>
          <small>{currentStepLabel}</small>
        </article>
      </section>

      <section className="psychometric-layout lending-psychometric-layout">
        <div className="psychometric-main">
          <article className="psychometric-panel lending-psychometric-form-panel">
            <div className="psychometric-panel-header lending-psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Workflow Form</span>
                <h2>{`Step ${step}: ${currentStepLabel}`}</h2>
              </div>
              <div className="lending-psychometric-status-row">
                <span className={`loan-page-status-chip rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${getStatusColor(formData.status)}`}>
                  {formData.status}
                </span>
              </div>
            </div>

            <div className="loan-page-body lending-psychometric-body p-0 min-h-[400px]">
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
              <h3 className="workflow-duplicate-step-title col-span-full text-lg font-bold text-slate-800 border-b pb-2">Step 1: Goal Setting </h3>
              {renderInput('loan', 'purpose', 'FINANCIAL GOAL / PURPOSE')}
              {renderSelect('loan', 'productType', 'Product Being Applied For', ['Home Loan', 'Auto Loan', 'Motorcycle Loan', 'Credit Card', 'Personal Loan', 'Margin Loan'])}
              {renderFormattedNumberInput('loan', 'amount', 'Requested Loan Amount')}
              {renderInput('loan', 'termMonths', 'Loan Term (Months)', 'number')}
              {renderInput('loan', 'interestRate', 'Annual Interest Rate (%)', 'number')}
              <div className="md:col-span-2 bg-purple-50 p-4 rounded-md border border-purple-200 mt-2">
                <h4 className="font-bold text-purple-800 text-sm mb-2">Auto-Calculated Metrics</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Est. Monthly Amortization: <span className="font-bold">PHP {calculations.monthlyPayment.toFixed(2)}</span></div>
                  <div>Loan-to-Value Ratio (LTV): <span className={`font-bold ${calculations.ltv > 90 ? 'text-red-600' : 'text-green-600'}`}>{calculations.ltv.toFixed(1)}%</span></div>
                </div>
              </div>

              <div className="md:col-span-2 mt-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1">Step 1 Review Capture</h4>
                    <p className="text-sm text-slate-600">
                      Take a picture of a valid ID. AI will auto-fill applicant and ID details, then suggest requirement checks for review.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <div className="flex flex-wrap gap-3">
                      <input
                        type="file"
                        id="step1DocumentUpload"
                        className="hidden"
                        onChange={(event) => void handleIdCapture(event)}
                        accept="image/*"
                        capture="environment"
                      />
                      <label
                        htmlFor="step1DocumentUpload"
                        className="loan-inline-button loan-inline-button-primary inline-flex cursor-pointer items-center justify-center px-4 py-2 text-sm font-semibold"
                      >
                        {isParsing ? 'Analyzing ID Capture...' : 'Take Picture of ID'}
                      </label>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                   Use camera capture for a valid ID.
                </p>

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
                          Captured ID details are auto-filled. Review and edit AI-suggested details before finalizing this application as draft or for review.
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
                        disabled={isSaving || creationLocked}
                        className={`loan-inline-button px-4 py-2 rounded text-sm font-medium transition disabled:opacity-50 loan-save-action ${isSaving ? 'loan-save-action-processing' : 'loan-save-action-idle'}`}
                      >
                        {isSaving ? 'Processing Draft...' : 'Apply, Save as Draft'}
                      </button>
                      <button
                        onClick={() => void handleFinalizeDocumentReview('Credit Review')}
                        disabled={isSaving || creationLocked}
                        className={`loan-inline-button px-4 py-2 rounded text-sm font-semibold transition disabled:opacity-50 ${isSaving ? 'loan-save-action loan-save-action-processing' : 'loan-inline-button-accent bg-indigo-600 hover:bg-indigo-500'}`}
                      >
                        {isSaving ? 'Processing Review...' : 'Apply, Save for Review'}
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
              <h3 className="workflow-duplicate-step-title col-span-full text-lg font-bold text-slate-800 border-b pb-2">Step 2: Applicant Information</h3>
              {renderInput('borrower', 'fullName', 'Full Legal Name (Auto-generated)', 'text', true)}
              {renderInput('borrower', 'email', 'Email Address', 'email')}
              {renderInput('borrower', 'govId', 'Government ID Number', 'text', false, 'issuer / ID number/ expiration date')}
              <div className="md:col-span-2 border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Additional Personal Information</h4>
              </div>
              {renderInput('applicantPersonal', 'lastName', 'Last Name')}
              {renderInput('applicantPersonal', 'firstName', 'First Name')}
              {renderInput('applicantPersonal', 'middleName', 'Middle Name')}
              {renderInput('applicantPersonal', 'dateOfBirth', 'Date of Birth', 'date')}
              {renderInput('applicantPersonal', 'placeOfBirth', 'Place of Birth')}
              {renderInput('applicantPersonal', 'age', 'Age', 'number', true)}
              {isUnderAgeApplicant && (
                <p className="md:col-span-2 -mt-1 mb-2 rounded-md border-2 border-red-300 bg-red-50 px-4 py-3 text-base font-extrabold uppercase tracking-wide text-red-700">
                  Not qualified: applicant is under age (below 18).
                </p>
              )}
              {isOverAgeApplicant && (
                <p className="md:col-span-2 -mt-1 mb-2 rounded-md border-2 border-red-300 bg-red-50 px-4 py-3 text-base font-extrabold uppercase tracking-wide text-red-700">
                  Not qualified: applicant is over age (above 65).
                </p>
              )}
              {renderSelect('applicantPersonal', 'gender', 'Gender', ['Male', 'Female'])}
              {renderInput('applicantPersonal', 'citizenship', 'Citizenship')}
              <div className="mb-3">
                <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Civil Status</label>
                <select
                  value={formData.applicantPersonal.maritalStatus}
                  onChange={(event) => handleMaritalStatusChange(event.target.value)}
                  className="loan-form-select w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Civil Status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widow">Widow</option>
                  <option value="Separated">Separated</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Number of Dependents</label>
                <select
                  value={String(getInputValue('applicantPersonal', 'numberOfDependents', 'number'))}
                  onChange={(event) => updateField('applicantPersonal', 'numberOfDependents', parseInt(event.target.value, 10))}
                  className="loan-form-select w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 11 }, (_, index) => index).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Co-Borrower</label>
                <select
                  value={formData.otherInformation.hasCoBorrower ? 'With Co-Borrower' : 'No Co-Borrower'}
                  onChange={(event) =>
                    handleCoBorrowerSelectionChange(event.target.value === 'With Co-Borrower')
                  }
                  className="loan-form-select w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="No Co-Borrower">No Co-Borrower</option>
                  <option value="With Co-Borrower">With Co-Borrower- Fill out Details in Step 4</option>
                </select>
              </div>
              {renderInput('applicantPersonal', 'mothersMaidenName', "Mother's Maiden Name")}
              {renderInput('contactInformation', 'mobileNumber', 'Mobile Number')}
              {renderInput('contactInformation', 'homePhoneNumber', 'Home Phone Number')}
              {renderInput('governmentIds', 'tin', 'TIN')}
              {renderInput('governmentIds', 'sssGsisNumber', 'SSS / GSIS Number')}
              {renderInput('governmentIds', 'otherGovernmentId', 'Other - ID Type')}
              {renderInput('governmentIds', 'idNumber', 'Other - ID Number')}
              {renderInput('governmentIds', 'issueDate', 'Issue Date', 'date')}
              {renderInput('governmentIds', 'expiryDate', 'Expiry Date', 'date')}
              {renderInput('addressInformation', 'presentAddress', 'Present Address')}
              {renderInput('addressInformation', 'permanentAddress', 'Permanent Address')}
              {renderInput('addressInformation', 'mailingAddress', 'Mailing Address')}
              {renderInput('addressInformation', 'lengthOfStay', 'Length of Stay')}
              {renderSelect('otherInformation', 'homeOwnership', 'Home Ownership', ['Own', 'Mortgaged', 'Renting', 'Living with Relative'])}
              {renderSelect('otherInformation', 'educationalAttainment', 'Educational Attainment', ['PHD', 'PostGraduate', 'College Degree', 'HighSchool'])}
              {renderInput('otherInformation', 'numberOfVehiclesOwned', 'Number of Vehicles Owned', 'number')}
             </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="workflow-duplicate-step-title col-span-full text-lg font-bold text-slate-800 border-b pb-2">Step 3: Employment, Income and Credit Values</h3>
              {renderInput('employment', 'history', 'Employment History (Current Employer)')}
              {renderFormattedNumberInput('employment', 'monthlyIncome', 'Primary Monthly Income')}
              {renderFormattedNumberInput('employment', 'otherIncome', 'Other Sources of Income')}
              {renderFormattedNumberInput('employment', 'debtObligations', 'Existing Monthly Debt Obligations')}
              <div className="md:col-span-2 bg-blue-50 p-4 rounded-md border border-blue-200 mt-2">
                <h4 className="font-bold text-blue-800 text-sm mb-2">Auto-Calculated Totals</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Total Household Income: <span className="font-bold">PHP {calculations.totalIncome.toLocaleString()}</span></div>
                  <div>Total Existing Debt: <span className="font-bold">PHP {calculations.totalExistingDebt.toLocaleString()}</span></div>
                </div>
              </div>
              <div className="md:col-span-2 border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Detailed Employment Information</h4>
              </div>
              {renderSelect(
                'employmentInformation',
                'employmentStatus',
                'Employment Status',
                isMotorcycleLoan
                  ? ['Permanent Employee', 'OFW', 'Government Employee', 'Business Owner', 'Self-employed', 'Contractual', 'Unemployed']
                  : ['Regular', 'Contractual', 'Project-Basis', 'Consulting', 'Part-time'],
              )}
              {renderInput('employmentInformation', 'employerBusinessName', 'Employer / Business Name')}
              {renderInput('employmentInformation', 'officeAddress', 'Office Address')}
              {renderInput('employmentInformation', 'occupation', 'Occupation')}
              {renderInput('employmentInformation', 'position', 'Position')}
              {renderInput('employmentInformation', 'natureOfWorkBusiness', 'Nature of Work / Business')}
              {renderInput('employmentInformation', 'dateHired', 'Date Hired', 'date')}
              {renderInput('employmentInformation', 'officePhoneNumber', 'Office Phone Number')}
              {renderInput('employmentInformation', 'previousEmployer', 'Previous Employer')}
              {renderInput('employmentInformation', 'totalYearsWorking', 'Total Years Working')}
              {renderFormattedNumberInput('employmentInformation', 'grossMonthlyIncome', 'Gross Monthly Income (Auto-calculated)', true)}
              {renderInput('employmentInformation', 'monthlyLivingExpenses', 'Monthly Living Expenses', 'number')}
              {renderFormattedNumberInput('employmentInformation', 'otherSourcesOfIncome', 'Other Sources of Income')}
              {renderFormattedNumberInput('employmentInformation', 'investmentIncome', 'Investment Income')}
              {renderFormattedNumberInput('employmentInformation', 'businessIncome', 'Business Income')}
              {renderInput('employmentInformation', 'pensionIncome', 'Pension Income', 'number')}
              <div className="col-span-full">
                {renderEnhancedDueDiligenceEmploymentSection()}
                {!(isBorrowerSubscriber || isSingleApplicant) && renderFraudVerificationSection()}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="workflow-duplicate-step-title text-lg font-bold text-slate-800">Step 4: Spouse / Co-Borrower Information</h3>
                {hasCoBorrowerSelected && (
                  <button onClick={addCoBorrower} className="loan-inline-button loan-inline-button-primary text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Add Co-Borrower</button>
                )}
              </div>
              {!isMarried && !hasCoBorrowerSelected && (
                <p className="text-gray-500 italic text-sm">
                  Step 4 is not required because Civil Status is not Married and Co-Borrower is set to No Co-Borrower.
                </p>
              )}
              {hasCoBorrowerSelected && formData.coBorrowers.length === 0 && (
                <p className="text-gray-500 italic text-sm">No co-borrowers added. Click above to add.</p>
              )}
              {hasCoBorrowerSelected && formData.coBorrowers.map((cb, idx) => (
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
              {isMarried && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-semibold text-sm text-gray-700 mb-3">Spouse Information</h4>
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
                      ['spouseInformation', 'previousEmployer', 'Current Employer'],
                      ['spouseInformation', 'yearsWithEmployer', 'Years with Employer'],
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
              )}
            </div>
          )}

          {step === 5 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="workflow-duplicate-step-title col-span-full text-lg font-bold text-slate-800 border-b pb-2">Step 5: Banking Relationships</h3>
              <div className="md:col-span-2 border-b pb-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Existing Credit Card Information</h4>
              </div>
              <div className="mb-3">
                <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Card Issuer</label>
                <input
                  type="text"
                  list="credit-card-issuer-options"
                  value={String(getInputValue('bankingRelationships', 'creditCardIssuer'))}
                  onChange={(event) => updateField('bankingRelationships', 'creditCardIssuer', event.target.value)}
                  className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter card issuer"
                />
                <datalist id="credit-card-issuer-options">
                  {['Visa', 'Mastercard', 'American Express', 'Discover', 'JCB', 'Diners Club', 'UnionPay'].map((issuer) => (
                    <option key={issuer} value={issuer} />
                  ))}
                </datalist>
              </div>
              {renderInput('bankingRelationships', 'creditCardNumber', 'Card Number')}
              {creditCardValidationError && (
                <div className="md:col-span-2 -mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Internal card verification: {creditCardValidationError}
                </div>
              )}
              {!creditCardValidationError && cardAiRiskLoading && (
                <div className="md:col-span-2 -mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                  AI card risk check: analyzing masked card metadata...
                </div>
              )}
              {!creditCardValidationError && cardAiRiskError && (
                <div className="md:col-span-2 -mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  AI card risk check: {cardAiRiskError}
                </div>
              )}
              {!creditCardValidationError && cardAiRiskResult && (
                <div
                  className={`md:col-span-2 -mt-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                    cardAiRiskResult.risk_level === 'HIGH'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : cardAiRiskResult.risk_level === 'MEDIUM'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : cardAiRiskResult.risk_level === 'LOW'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  <p>
                    AI card risk check: {cardAiRiskResult.risk_level} risk. {cardAiRiskResult.summary}
                  </p>
                  <p className="mt-1 text-[11px] font-medium">
                    Recommended action: {cardAiRiskResult.recommended_action}
                  </p>
                </div>
              )}
              {renderInput('bankingRelationships', 'creditLimit', 'Credit Limit', 'number')}
              {renderInput('bankingRelationships', 'outstandingBalance', 'Outstanding Balance', 'number')}
              {renderInput('bankingRelationships', 'memberSince', 'Member Since', 'date')}
              <div className="md:col-span-2 border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Existing Bank Account Information</h4>
              </div>
              {renderInput('bankingRelationships', 'bankBranch', 'Bank / Branch')}
              {renderInput('bankingRelationships', 'accountType', 'Account Type')}
              {renderInput('bankingRelationships', 'accountNumber', 'Account Number')}
              {bankAccountValidationError && (
                <div className="md:col-span-2 -mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Internal bank verification: {bankAccountValidationError}
                </div>
              )}
              {renderInput('bankingRelationships', 'currentBalance', 'Current Balance', 'number')}
              <div className="md:col-span-2 border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Existing Loan Information</h4>
              </div>
              {renderInput('bankingRelationships', 'loanLender', 'Lender / Bank')}
              {renderInput('bankingRelationships', 'loanType', 'Loan Type')}
              {renderFormattedNumberInput('bankingRelationships', 'loanCurrentBalance', 'Current Loan Balance')}
              {renderInput('bankingRelationships', 'loanMonthlyAmortization', 'Monthly Amortization', 'number')}
              <div className="col-span-full">
                {renderEnhancedDueDiligenceBankingSection()}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="workflow-duplicate-step-title col-span-full text-lg font-bold text-slate-800 border-b pb-2">Step 6: Collateral Details</h3>
              <fieldset className="loan-collateral-classification md:col-span-2 text-xs">
                <legend className="text-xs font-semibold">Security Classification</legend>
                <div className="loan-collateral-classification-options flex flex-wrap items-center gap-2">
                  {['Secured', 'Unsecured', 'Lease'].map((classification) => {
                    const selected = formData.collateral.securityClassification === classification;

                    return (
                      <label
                        key={classification}
                        className={`loan-collateral-classification-option inline-flex items-center gap-1 px-2 py-1 text-xs${selected ? ' loan-collateral-classification-option-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            updateField(
                              'collateral',
                              'securityClassification',
                              selected ? '' : classification,
                            )
                          }
                        />
                        <span className="text-xs leading-none">{classification}</span>
                      </label>
                    );
                  })}
                </div>
                <p
                  className={`loan-collateral-classification-note${
                    isAutoLoan && formData.collateral.securityClassification !== 'Secured'
                      ? ' loan-collateral-classification-note-error'
                      : ''
                  }`}
                >
                  <strong>Auto Loan — Mandatory:</strong> Select <strong>Secured</strong>.
                </p>
              </fieldset>
              {(isCreditCard || isPersonalLoan || isMarginLoan) && (
                <p className="col-span-full -mt-2 text-sm italic text-slate-500">
                  Asset details are not required for unsecured loans; select Unsecured above.
                </p>
              )}
              {(isAutoLoan || isMotorcycleLoan) && (
                <>
                  <div className="md:col-span-2">
                    <h4 className="font-semibold text-sm text-gray-700 mb-3">
                      {isMotorcycleLoan ? 'Motorcycle Information' : 'Asset / Vehicle Information'}
                    </h4>
                  </div>
                  {renderSelect(
                    'collateral',
                    'assetType',
                    'Type',
                    isMotorcycleLoan
                      ? ['Motorcycle', 'Scooter', 'Underbone', 'Standard Bike', 'Delivery Bike']
                      : assetVehicleTypeOptions,
                  )}
                  {renderInput('collateral', 'maker', 'Maker')}
                  {renderInput('collateral', 'brand', 'Brand')}
                  {renderInput('collateral', 'model', 'Model')}
                  {renderInput('collateral', 'year', 'Year')}
                </>
              )}
              {isAutoLoan && renderSelect('collateral', 'vehicleConditionCategory', 'Vehicle Age / Condition', ['Brand New', 'Used (1–3 years), Excellent Condition', 'Used (4–6 years), Good Condition', 'More than 6 years old or Fair/Poor Condition'])}
              {isAutoLoan && renderSelect('collateral', 'vehicleTypeCategory', 'Vehicle Type', ['Passenger vehicle for personal use', 'SUV / MPV / Pickup in good condition', 'Commercial vehicle (van, light truck)', 'Heavy equipment / Specialized vehicles', 'Salvage, rebuilt, or unregistered vehicle'])}
              {isAutoLoan && renderInput('collateral', 'appraisedValue', 'Appraised Value / Brand New Price', 'number')}
              {isAutoLoan && renderInput('collateral', 'insuranceProviderCompany', 'Insurance Provider / Company')}
              {isAutoLoan && renderInput('collateral', 'policyNumber', 'Policy Number')}
              {isAutoLoan && renderInput('collateral', 'orNumber', 'OR Number')}
              {isAutoLoan && renderInput('collateral', 'crNumber', 'CR Number')}
              {isMotorcycleLoan && renderFormattedNumberInput('collateral', 'appraisedValue', 'Motorcycle Value')}
              {isMotorcycleLoan && renderSelect('collateral', 'motorcycleIntendedUse', 'Intended Use', ['Personal use', 'Personal & occasional business', 'Full-time delivery/ride-hailing', 'Commercial/high mileage'])}
              {isMotorcycleLoan && (
                <div className="md:col-span-2 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <h4 className="font-semibold text-sm text-gray-700 mb-3">Collateral Use</h4>
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                    <label className="flex items-center text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.collateral.useAsCollateral}
                        onChange={() => updateField('collateral', 'useAsCollateral', true)}
                        className="mr-3 h-4 w-4"
                      />
                      <span className="text-gray-700">To be used as collateral</span>
                    </label>
                    <label className="flex items-center text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!formData.collateral.useAsCollateral}
                        onChange={() => updateField('collateral', 'useAsCollateral', false)}
                        className="mr-3 h-4 w-4"
                      />
                      <span className="text-gray-700">Not to be used as collateral</span>
                    </label>
                  </div>
                </div>
              )}
              {isHomeLoan && (
                <div className="md:col-span-2 border-t pt-4 mt-4">
                  <h4 className="font-semibold text-sm text-gray-700 mb-3">Home Loan / Property Information</h4>
                </div>
              )}
              {isHomeLoan && renderInput('collateralInformation', 'propertyAddress', 'Property Address')}
              {isHomeLoan && renderInput('collateralInformation', 'registeredOwner', 'Registered Owner')}
              {isHomeLoan && renderInput('collateralInformation', 'lotNumber', 'Lot Number')}
              {isHomeLoan && renderInput('collateralInformation', 'blockNumber', 'Block Number')}
              {isHomeLoan && renderInput('collateralInformation', 'tctCctNumber', 'TCT/CCT Number')}
              {isHomeLoan && renderSelect('collateralInformation', 'propertyMarketabilityCategory', 'Marketability of the Property', ['Subdivision / Condominium (Class A,B,C)', 'Lowcost Subdivision / Condominium', 'Outside'])}
              {isHomeLoan && renderSelect('collateralInformation', 'houseUnitModelCategory', 'House / Unit Model', ['Single detached', 'Single attached / Condominium', 'Townhouse', 'Row house'])}
              {isHomeLoan && renderSelect('collateralInformation', 'collateralOccupancyType', 'Type of Collateral', ['Residential property used by applicant / borrower as primary residence', 'Residential property not used by applicant / borrower'])}
              {isHomeLoan && renderFormattedNumberInput('collateralInformation', 'propertyAppraisedValue', 'Property Appraised Value')}

              <div className="md:col-span-2 border-t pt-4 mt-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-sm text-gray-700 mb-0">Additional Collaterals</h4>
                  <button
                    type="button"
                    onClick={addAdditionalCollateral}
                    className="loan-inline-button loan-inline-button-primary text-sm bg-blue-600 px-3 py-1.5 text-white rounded hover:bg-blue-700"
                  >
                    Add Collateral
                  </button>
                </div>
              </div>

              {formData.additionalCollaterals.length === 0 && (
                <p className="md:col-span-2 text-sm italic text-slate-500">
                  No additional collaterals added.
                </p>
              )}

              {formData.additionalCollaterals.map((collateral, index) => (
                <div key={collateral.id} className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4 relative">
                  <button
                    type="button"
                    onClick={() => removeAdditionalCollateral(collateral.id)}
                    className="loan-icon-button absolute right-2 top-2 text-red-500 hover:text-red-700 text-sm font-bold"
                  >
                    Remove
                  </button>
                  <h5 className="font-semibold text-sm text-slate-700 mb-3">Additional Collateral #{index + 1}</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="mb-3">
                      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Type</label>
                      <input value={collateral.collateralType} onChange={(e) => updateAdditionalCollateral(collateral.id, 'collateralType', e.target.value)} className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="mb-3">
                      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Property Type</label>
                      <input value={collateral.propertyType} onChange={(e) => updateAdditionalCollateral(collateral.id, 'propertyType', e.target.value)} className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="mb-3">
                      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Maker</label>
                      <input value={collateral.maker} onChange={(e) => updateAdditionalCollateral(collateral.id, 'maker', e.target.value)} className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="mb-3">
                      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Brand</label>
                      <input value={collateral.brand} onChange={(e) => updateAdditionalCollateral(collateral.id, 'brand', e.target.value)} className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="mb-3">
                      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Model</label>
                      <input value={collateral.model} onChange={(e) => updateAdditionalCollateral(collateral.id, 'model', e.target.value)} className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="mb-3">
                      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Year</label>
                      <input value={collateral.year} onChange={(e) => updateAdditionalCollateral(collateral.id, 'year', e.target.value)} className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="mb-3">
                      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Appraised Value</label>
                      <input type="number" value={collateral.appraisedValue === 0 ? '' : collateral.appraisedValue} onChange={(e) => updateAdditionalCollateral(collateral.id, 'appraisedValue', parseFloat(e.target.value) || 0)} className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="mb-3">
                      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Insurance Provider / Company</label>
                      <input value={collateral.insuranceProviderCompany} onChange={(e) => updateAdditionalCollateral(collateral.id, 'insuranceProviderCompany', e.target.value)} className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="mb-3">
                      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Policy Number</label>
                      <input value={collateral.policyNumber} onChange={(e) => updateAdditionalCollateral(collateral.id, 'policyNumber', e.target.value)} className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="mb-3">
                      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">OR Number</label>
                      <input value={collateral.orNumber} onChange={(e) => updateAdditionalCollateral(collateral.id, 'orNumber', e.target.value)} className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="mb-3">
                      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">CR Number</label>
                      <input value={collateral.crNumber} onChange={(e) => updateAdditionalCollateral(collateral.id, 'crNumber', e.target.value)} className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="mb-3">
                      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">TCT / CTC Number</label>
                      <input value={collateral.tctCctNumber} onChange={(e) => updateAdditionalCollateral(collateral.id, 'tctCctNumber', e.target.value)} className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="md:col-span-2 mb-3">
                      <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-600">Notes</label>
                      <textarea rows={3} value={collateral.notes} onChange={(e) => updateAdditionalCollateral(collateral.id, 'notes', e.target.value)} className="loan-form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <h3 className="workflow-duplicate-step-title text-lg font-bold text-slate-800 border-b pb-2">Step 7: Document Upload Center</h3>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-amber-900 text-sm mb-1">Pre-Upload Completion Checklist</h4>
                    <p className="text-xs text-amber-800/80">
                      Quick readiness view before uploading supporting documents.
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-amber-900">
                      {documentPreparationCompletionPercent}%
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-amber-800/80">
                      Ready
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900/80">
                    <span>Overall Completion</span>
                    <span>
                      {documentPreparationCompletedCount}/{documentPreparationChecklist.length}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-amber-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
                      style={{ width: `${documentPreparationCompletionPercent}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {documentPreparationChecklist.map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-lg border px-3 py-2 ${
                        item.complete
                          ? 'border-emerald-200 bg-white text-emerald-700'
                          : 'border-amber-300 bg-amber-50 text-amber-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                          {item.label}
                        </div>
                        <div className="text-sm font-bold leading-none">
                          {item.complete ? '✓' : '✕'}
                        </div>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-600">
                        {item.optional ? 'Optional' : item.complete ? 'Complete' : 'Incomplete'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
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
              </div>
              
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 mt-4">
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

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Required Supporting Documents</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['supportingDocuments', 'validGovernmentId', 'Valid Government ID'],
                    ['supportingDocuments', 'selfiePhotoOptional', 'Selfie Photo (Optional) - not counted in completion score'],
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
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLoanStatement((prev) => !prev)}
                  disabled={!hasSufficientInformationForRating}
                  className="loan-inline-button loan-inline-button-primary"
                >
                  {showLoanStatement ? 'Hide Loan Statement' : 'Generate Loan Statement'}
                </button>
                <button
                  type="button"
                  onClick={handleOpenCertification}
                  className="loan-inline-button loan-inline-button-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Request Certification
                </button>
              </div>
              {!hasSufficientInformationForRating ? (
                <div className="loan-rating-readiness-notice" role="alert">
                  <strong>Rating Not Produced</strong>
                  <span>
                    Information provided is {informationProvidedPercent}%. A minimum of{' '}
                    {CREDIT_RATING_MINIMUM_INFORMATION_PERCENT}% is required before FILScore can
                    produce a rating.
                  </span>
                  <small>
                    Complete the missing information in Steps 1–7, then return to Step 8.
                  </small>
                </div>
              ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
                <h3 className="workflow-duplicate-step-title mb-4 text-lg font-bold text-amber-900">Step 8: FILScore</h3>
                <div className="grid grid-cols-2 gap-4">
                  {executiveSummaryItems.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-md border border-amber-300 bg-amber-50 p-4"
                    >
                      <p className="text-sm font-bold text-amber-800">{item.label}</p>
                      <p className="mt-3 text-3xl font-bold leading-none text-amber-900">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-amber-800">
                    Scoring Signals
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {scoringSignalItems.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-md border border-amber-300 bg-amber-50 p-4"
                      >
                        <p className="text-sm font-bold text-amber-800">{item.label}</p>
                        <p className="mt-3 text-2xl font-bold leading-none text-amber-900">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {showLoanStatement && (
                  <div className="border-t border-slate-200 pt-6">
                    <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-amber-800">
                      Loan Statement
                    </h4>

                    <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-slate-700">
                      <p><strong>Applicant / Borrower:</strong> {borrowerDisplayName}</p>
                      <p><strong>Product:</strong> {formData.loan.productType}</p>
                    </div>

                    <div className="overflow-x-auto rounded-md border border-slate-200">
                      <table className="min-w-full bg-white">
                        <thead>
                          <tr>
                            <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">Month / Year</th>
                            <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">Total Balance Prior</th>
                            <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">Principal and Interest for Payment</th>
                            <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">Remaining Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loanStatementRows.map((row, index) => (
                            <tr key={`${row.periodLabel}-${index}`}>
                              <td className="px-3 py-2 text-sm text-slate-700">{row.periodLabel}</td>
                              <td className="px-3 py-2 text-sm text-slate-700">{formatCurrency(row.beginningBalance)}</td>
                              <td className="px-3 py-2 text-sm text-slate-700">
                                Principal: {formatCurrency(row.principalPayment)} | Interest: {formatCurrency(row.interestPayment)}
                              </td>
                              <td className="px-3 py-2 text-sm text-slate-700">{formatCurrency(row.endingBalance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-200 pt-6">
                  <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-amber-800">
                    Final Workflow Actions
                  </h4>
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
                    <div className="grid gap-4">
                      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-end">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-blue-700">
                            Action: Change Status
                          </label>
                          <select
                            value={selectedWorkflowAction}
                            onChange={(event) => {
                              setSelectedWorkflowAction(event.target.value as WorkflowStatus);
                              setWorkflowActionState('idle');
                              setCompletedWorkflowAction(null);
                            }}
                            className="loan-form-select w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {workflowActionOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-blue-700">
                            Comments / Basis of Action
                          </label>
                          <textarea
                            value={formData.committeeRemarks}
                            onChange={(event) =>
                              setFormData((prev) => ({
                                ...prev,
                                committeeRemarks: event.target.value,
                              }))
                            }
                            rows={3}
                            className="loan-form-input w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter comments or basis for the status change"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={handleSelectedWorkflowAction}
                          disabled={isSaving || creationLocked}
                          className={`loan-inline-button inline-flex min-h-[42px] items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold tracking-wide transition disabled:opacity-50 ${workflowActionButtonClass}`}
                        >
                          {workflowActionButtonLabel}
                        </button>
                        <button
                          onClick={() => void handleStepChange(Math.max(step - 1, 1))}
                          className={`${footerButtonClass} loan-footer-button-secondary border border-gray-300 text-gray-700 hover:bg-gray-100`}
                        >
                          Previous Step
                        </button>
                        <button
                          onClick={handleSaveDraft}
                          disabled={isSaving || creationLocked}
                          className={`loan-footer-link loan-save-action inline-flex min-h-[42px] items-center justify-center px-4 py-2 text-sm font-semibold tracking-wide disabled:opacity-50 ${isSaving ? 'loan-save-action-processing' : 'loan-save-action-idle'}`}
                        >
                          {isSaving ? 'Processing Draft...' : 'Save Draft'}
                        </button>
                      </div>

                      {workflowActionState === 'completed' && (
                        <div className="rounded-md border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-800">
                          Completed: Record status changed to {completedWorkflowAction}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}

          {!isBorrowerSubscriber && step === 9 && (
            <div className="space-y-4">
              <h3 className="workflow-duplicate-step-title text-lg font-bold text-slate-800 border-b pb-2">Step 9: Approval Workflow</h3>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Origination Profitability
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  PHP {creditRiskInsights.originationProfitability.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Margin {creditRiskInsights.originationMargin.toFixed(1)}%
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Credit Committee Remarks</label>
                <div className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {formData.committeeRemarks.trim().length > 0
                    ? formData.committeeRemarks
                    : 'No remarks yet. Use Step 8 to update this field.'}
                </div>
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
                    ['signatures', 'borrowerSignatureAutoLoanInsurance', 'Applicant / Borrower Signature (Auto Loan Insurance)'],
                    ['signatures', 'extensionCardholderSignature', 'Extension Cardholder Signature'],
                  ].map(([section, field, label]) => renderInput(section as EditableSection, field, label))}
                </div>
              </div>

            </div>
          )}

          {!isBorrowerSubscriber && step === 10 && (
            <div className="space-y-4">
              <h3 className="workflow-duplicate-step-title text-lg font-bold text-slate-800 border-b pb-2">Step 10: Loan Release & Booking</h3>
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
                    <p className="text-xl font-bold text-green-700">PHP {formData.loan.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-white/50 p-3 rounded">
                    <span className="text-gray-600">Approved Loan Amount:</span>
                    <p className="text-xl font-bold text-blue-700">PHP {aiRecommendation.suggestedAmount.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/50 p-3 rounded">
                    <span className="text-gray-600">Monthly Amortization:</span>
                    <p className="text-xl font-bold text-orange-700">PHP {calculations.monthlyPayment.toFixed(2)}</p>
                  </div>
                  <div className="bg-white/50 p-3 rounded">
                    <span className="text-gray-600">AI Approval Probability:</span>
                    <p className="text-xl font-bold text-indigo-700">{aiRecommendation.probability}%</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 mb-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h4 className="font-bold text-indigo-900 text-sm uppercase">AI Credit Advisor</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleGenerateCreditAdvisorPlan()}
                      disabled={advisorLoading}
                      className="loan-inline-button inline-flex min-h-[38px] items-center justify-center rounded-md border border-indigo-700 bg-indigo-700 px-3 py-1.5 text-xs font-semibold tracking-wide text-white transition hover:bg-indigo-600 disabled:opacity-50"
                    >
                      {advisorLoading ? 'Generating Plan...' : 'Generate Improvement Plan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyAdvisorPlan()}
                      disabled={advisorLoading || !advisorAdvice.trim()}
                      className="loan-inline-button inline-flex min-h-[38px] items-center justify-center rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-indigo-800 transition hover:bg-indigo-100 disabled:opacity-50"
                    >
                      Copy Plan
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApplyTopActionsToChecklist()}
                      disabled={advisorLoading || !advisorAdvice.trim()}
                      className="loan-inline-button inline-flex min-h-[38px] items-center justify-center rounded-md border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-800 transition hover:bg-emerald-200 disabled:opacity-50"
                    >
                      Apply Top Actions to Checklist
                    </button>
                  </div>
                </div>

                <p className="text-xs text-indigo-800/90 mb-3">
                  Uses current DTI, DSR, LTV, income, debt, and workflow posture to propose priority actions for improving credit readiness.
                </p>

                {advisorError ? (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">
                    {advisorError}
                  </div>
                ) : null}

                {advisorMeta ? (
                  <div className="text-xs text-indigo-800/80 mb-3">
                    Provider: {advisorMeta.provider} | Model: {advisorMeta.model} | Tokens: {advisorMeta.total_tokens} | Latency: {advisorMeta.latency_ms}ms
                  </div>
                ) : null}

                {advisorNotice ? (
                  <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 mb-3">
                    {advisorNotice}
                  </div>
                ) : null}

                <textarea
                  value={advisorAdvice}
                  onChange={(event) => setAdvisorAdvice(event.target.value)}
                  rows={12}
                  className="w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Generated AI advisory plan will appear here."
                />

                {formData.advisorChecklist.length > 0 ? (
                  <div className="mt-4 rounded-md border border-emerald-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Advisor Action Checklist</h5>
                      <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {advisorChecklistCompletedCount}/{advisorChecklistTotalCount} done ({advisorChecklistCompletionPercent}%)
                      </span>
                    </div>
                    <div className="space-y-2">
                      {formData.advisorChecklist.map((item) => (
                        <label key={item.id} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={(event) => {
                              setFormData((prev) => ({
                                ...prev,
                                advisorChecklist: prev.advisorChecklist.map((checkItem) =>
                                  checkItem.id === item.id
                                    ? { ...checkItem, done: event.target.checked }
                                    : checkItem,
                                ),
                              }));
                            }}
                            className="mt-0.5 h-4 w-4"
                          />
                          <span className={item.done ? 'line-through text-slate-500' : ''}>{item.text}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
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
                  <label className="flex items-center text-sm cursor-not-allowed">
                    <input
                      type="checkbox"
                      checked={formData.finalChecklist?.creditImprovementActionsTracked || false}
                      disabled
                      readOnly
                      className="mr-3 h-4 w-4"
                    />
                    <span className="text-gray-700">Advisor top actions completed (auto-tracked)</span>
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
                  <div className="min-w-[220px]">
                    <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-300">
                      Action: Change Status
                    </label>
                    <select
                      value={selectedWorkflowAction}
                      onChange={(event) => {
                        setSelectedWorkflowAction(event.target.value as WorkflowStatus);
                        setWorkflowActionState('idle');
                        setCompletedWorkflowAction(null);
                      }}
                      className="loan-form-select w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {workflowActionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-w-[280px] flex-1">
                    <label className="loan-form-label mb-1.5 block text-xs font-semibold tracking-wide text-slate-300">
                      Comments / Basis of Action
                    </label>
                    <textarea
                      value={formData.committeeRemarks}
                      readOnly
                      rows={2}
                      className="loan-form-input w-full rounded-md border border-slate-500 bg-slate-100 px-3 py-2 text-sm text-slate-800"
                      placeholder="Use Step 8 to edit comments"
                    />
                  </div>

                  <button
                    onClick={handleSelectedWorkflowAction}
                    disabled={isSaving || creationLocked}
                    className={`loan-inline-button inline-flex min-h-[42px] items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold tracking-wide transition disabled:opacity-50 ${workflowActionButtonClass}`}
                  >
                    {workflowActionButtonLabel}
                  </button>

                  {workflowActionState === 'completed' && (
                    <span className="rounded border border-emerald-600 bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800">
                      Completed: Record status changed to {completedWorkflowAction}
                    </span>
                  )}

                  {formData.status === 'Released' && workflowActionState !== 'completed' && (
                    <span className="px-4 py-2 bg-green-800 text-green-100 rounded text-sm font-bold border border-green-600">Application Successfully Released</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
            <div className="lending-psychometric-footer border-t border-slate-200 pt-6">
              <div className="lending-psychometric-footer-actions">
                <button
                  onClick={() => void handleStepChange(Math.max(step - 1, 1))}
                  disabled={step === 1}
                  className={`${footerButtonClass} loan-footer-button-secondary border border-gray-300 text-gray-700 hover:bg-gray-100`}
                >
                  Previous Step
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={isSaving || creationLocked}
                  className={`loan-footer-link loan-save-action inline-flex min-h-[42px] items-center justify-center px-4 py-2 text-sm font-semibold tracking-wide disabled:opacity-50 ${isSaving ? 'loan-save-action-processing' : 'loan-save-action-idle'}`}
                >
                  {isSaving ? 'Processing Draft...' : 'Save Draft'}
                </button>
                <button
                  onClick={() => void handleStepChange(Math.min(step + 1, maxVisibleStep))}
                  className={`${footerButtonClass} loan-footer-button-primary bg-blue-600 text-white shadow-sm hover:bg-blue-700`}
                >
                  Next Step
                </button>
              </div>
            </div>
          </article>
        </div>

        <aside className="psychometric-side-panel lending-psychometric-side-panel">
          <article className="psychometric-panel lending-psychometric-toolbar-panel">
            <div className="lending-psychometric-toolbar-grid">
              <button
                onClick={handleCreateNew}
                className={`${topNavButtonClass} loan-toolbar-button-primary lending-psychometric-tool-button`}
              >
                Create New Application
              </button>
              <button
                onClick={() => void handleReviewApplication()}
                className={`${topNavButtonClass} loan-toolbar-button-secondary lending-psychometric-tool-button`}
              >
                {isBorrowerSubscriber || isSingleApplicant ? 'Review Application' : 'Review Applications'}
              </button>
              <button
                onClick={() => void handleStepChange(8)}
                className={`${topNavButtonClass} loan-toolbar-button-secondary lending-psychometric-tool-button`}
              >
                Open FILScore Page
              </button>
              {!isBorrowerSubscriber && (
                <button
                  onClick={() => navigate(queuePath)}
                  className={`${topNavButtonClass} loan-toolbar-button-secondary lending-psychometric-tool-button`}
                >
                  Approval Queue
                </button>
              )}
              {!isBorrowerSubscriber && (
                <button
                  onClick={() => navigate(releasedAccountsPath)}
                  className={`${topNavButtonClass} loan-toolbar-button-secondary lending-psychometric-tool-button`}
                >
                  Released Accounts
                </button>
              )}
            </div>
          </article>

          <article className="psychometric-panel lending-psychometric-step-panel">
            <div className="psychometric-panel-header lending-psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Workflow Steps</span>
                <h2>Navigate the scorecard</h2>
              </div>
            </div>

            <div className="lending-psychometric-step-list">
              {stepLabels.map((label, i) => {
                const stepNumber = i + 1;
                const stepInformation = stepNumber <= 7
                  ? informationCompletion.steps[stepNumber as InformationStepNumber]
                  : null;
                const stepStatus = stepInformation
                  ? stepInformation.applicable
                    ? `${stepInformation.percent}% information provided`
                    : '100% information provided · Not required'
                  : stepNumber === 8
                    ? hasSufficientInformationForRating
                      ? 'Rating available'
                      : 'Rating not produced'
                    : step === stepNumber
                      ? 'Current step'
                      : step > stepNumber
                        ? 'Completed'
                        : 'Pending';

                return (
                <button
                  key={label}
                  onClick={() => void handleStepChange(stepNumber)}
                  className={`${stepperButtonClass} lending-psychometric-step-button ${step === stepNumber ? 'loan-stepper-button-active border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'loan-stepper-button-idle border-gray-200 bg-white hover:border-blue-400 hover:text-blue-600'}`}
                >
                  <div className={`lending-psychometric-step-index ${step >= stepNumber ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                    {stepNumber}
                  </div>
                  <div className="lending-psychometric-step-copy">
                    <strong>{label}</strong>
                    <span>{stepStatus}</span>
                    {stepInformation ? (
                      <div className="lending-step-information-track" aria-hidden="true">
                        <div
                          className={`lending-step-information-bar${stepInformation.percent < CREDIT_RATING_MINIMUM_INFORMATION_PERCENT ? ' lending-step-information-bar-low' : ''}`}
                          style={{ width: `${stepInformation.percent}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                </button>
                );
              })}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
