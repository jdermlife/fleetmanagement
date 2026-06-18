import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { getErrorMessage } from '../../api';
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
interface EmploymentInformation { employmentStatus: string; employerBusinessName: string; officeAddress: string; occupation: string; position: string; natureOfWorkBusiness: string; dateHired: string; officePhoneNumber: string; previousEmployer: string; totalYearsWorking: string; grossMonthlyIncome: number; monthlyLivingExpenses: number; otherSourcesOfIncome: string; investmentIncome: number; businessIncome: number; pensionIncome: number; otherIncome: string; }
interface CollateralInformation { propertyAddress: string; registeredOwner: string; lotNumber: string; blockNumber: string; tctCctNumber: string; }
interface SpouseInformation { fullName: string; dateOfBirth: string; placeOfBirth: string; citizenship: string; mobileNumber: string; presentAddress: string; employerBusinessName: string; officeAddress: string; occupation: string; position: string; natureOfWork: string; yearsWithEmployer: string; previousEmployer: string; totalYearsWorking: string; grossMonthlyIncome: number; monthlyExpenses: number; otherIncomeSources: string; }
interface BankingRelationships { creditCardIssuer: string; creditCardNumber: string; creditLimit: number; outstandingBalance: number; memberSince: string; bankBranch: string; accountType: string; accountNumber: string; currentBalance: number; loanLender: string; loanType: string; loanCurrentBalance: number; loanMonthlyAmortization: number; }
interface Signatures { applicantSignature: string; spouseOrCoBorrowerSignature: string; borrowerSignatureAutoLoanInsurance: string; extensionCardholderSignature: string; }
interface SupportingDocuments { validGovernmentId: boolean; passportIfApplicable: boolean; driversLicense: boolean; philSysId: boolean; certificateOfEmployment: boolean; latestPayslips: boolean; latestItr: boolean; dtiSecRegistration: boolean; businessPermit: boolean; financialStatements: boolean; utilityBill: boolean; waterBill: boolean; internetBill: boolean; titleTctCct: boolean; taxDeclaration: boolean; lotPlan: boolean; propertyPhotos: boolean; vehicleQuotation: boolean; vehicleInvoice: boolean; orCrForRefinancing: boolean; proofOfIncome: boolean; bankStatements: boolean; existingCreditCardStatements: boolean; }
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
  documents: DocumentItem[];
  committeeRemarks: string;
  routing: { creditOfficer: string; branchManager: string; creditCommittee: string; executiveApproval: boolean; };
  disbursement: Disbursement;
  finalChecklist?: FinalChecklist;
  releaseNotes?: string;
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
  employmentInformation: { employmentStatus: '', employerBusinessName: '', officeAddress: '', occupation: '', position: '', natureOfWorkBusiness: '', dateHired: '', officePhoneNumber: '', previousEmployer: '', totalYearsWorking: '', grossMonthlyIncome: 0, monthlyLivingExpenses: 0, otherSourcesOfIncome: '', investmentIncome: 0, businessIncome: 0, pensionIncome: 0, otherIncome: '' },
  collateralInformation: { propertyAddress: '', registeredOwner: '', lotNumber: '', blockNumber: '', tctCctNumber: '' },
  spouseInformation: { fullName: '', dateOfBirth: '', placeOfBirth: '', citizenship: '', mobileNumber: '', presentAddress: '', employerBusinessName: '', officeAddress: '', occupation: '', position: '', natureOfWork: '', yearsWithEmployer: '', previousEmployer: '', totalYearsWorking: '', grossMonthlyIncome: 0, monthlyExpenses: 0, otherIncomeSources: '' },
  bankingRelationships: { creditCardIssuer: '', creditCardNumber: '', creditLimit: 0, outstandingBalance: 0, memberSince: '', bankBranch: '', accountType: '', accountNumber: '', currentBalance: 0, loanLender: '', loanType: '', loanCurrentBalance: 0, loanMonthlyAmortization: 0 },
  signatures: { applicantSignature: '', spouseOrCoBorrowerSignature: '', borrowerSignatureAutoLoanInsurance: '', extensionCardholderSignature: '' },
  supportingDocuments: { validGovernmentId: false, passportIfApplicable: false, driversLicense: false, philSysId: false, certificateOfEmployment: false, latestPayslips: false, latestItr: false, dtiSecRegistration: false, businessPermit: false, financialStatements: false, utilityBill: false, waterBill: false, internetBill: false, titleTctCct: false, taxDeclaration: false, lotPlan: false, propertyPhotos: false, vehicleQuotation: false, vehicleInvoice: false, orCrForRefinancing: false, proofOfIncome: false, bankStatements: false, existingCreditCardStatements: false },
  documents: [],
  committeeRemarks: '',
  routing: { creditOfficer: '', branchManager: '', creditCommittee: 'Pending', executiveApproval: false },
  disbursement: { bankAccount: '', accountNumber: '', disbursementDate: '', bookingDate: '', startRepaymentDate: '', firstPaymentDate: '' },
  finalChecklist: { allRequiredDocumentsProvided: false, allSignaturesCollected: false, creditCommitteeApproved: false, executiveApprovalObtained: false, collateralDocumentationReady: false },
  releaseNotes: '',
});

// --- Main Component ---
export default function LendingScorecard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedApplicationNo = searchParams.get('applicationNo');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<LoanApplication>(createNewApplicationInstance());
  const [isParsing, setIsParsing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hasPersistedRecord, setHasPersistedRecord] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingApplication, setIsLoadingApplication] = useState(false);

  // --- Auto-Calculations (Memoized for Performance) ---
  const calculations = useMemo(() => {
    const totalIncome = formData.employment.monthlyIncome + formData.employment.otherIncome + 
                        formData.coBorrowers.reduce((sum, cb) => sum + cb.monthlyIncome, 0);
    
    const totalExistingDebt = formData.employment.debtObligations + 
                              formData.coBorrowers.reduce((sum, cb) => sum + cb.debtObligations, 0);

    // PMT Formula: P * (r * (1 + r)^n) / ((1 + r)^n - 1)
    const r = formData.loan.interestRate / 100 / 12;
    const n = formData.loan.termMonths;
    const p = formData.loan.amount;
    const monthlyPayment = n === 0 ? 0 : (r === 0 ? p / n : p * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));

    const dti = totalIncome > 0 ? (totalExistingDebt / totalIncome) * 100 : 0;
    const dsr = totalIncome > 0 ? ((totalExistingDebt + monthlyPayment) / totalIncome) * 100 : 0;
    const ltv = formData.collateral.appraisedValue > 0 ? (formData.loan.amount / formData.collateral.appraisedValue) * 100 : 0;

    return { totalIncome, totalExistingDebt, monthlyPayment, dti, dsr, ltv };
  }, [formData]);

  const requirements = useMemo<LoanApplicationRequirements>(() => ({
    productInformation: {
      productType: formData.loan.productType,
      homePurposeOfLoan: formData.loan.purpose,
      homeDesiredLoanAmount: formData.loan.amount,
      homeLoanTerm: formData.loan.termMonths,
      homeCollateralType: formData.collateral.vehicleInfo,
      autoPurpose: formData.loan.purpose,
      autoVehicleClassification: formData.loan.productType,
      autoUnitModel: formData.collateral.vehicleInfo,
      autoYearModel: formData.loan.termMonths.toString(),
      autoSellingPrice: formData.collateral.appraisedValue,
      autoDesiredLoanAmount: formData.loan.amount,
      autoDownPayment: 0,
      autoYearsToPay: Math.max(1, Math.round(formData.loan.termMonths / 12)),
      creditCardType: formData.loan.purpose,
      creditCardExtensionRequested: formData.signatures.extensionCardholderSignature.length > 0,
    },
    applicantPersonal: formData.applicantPersonal,
    contactInformation: formData.contactInformation,
    governmentIds: formData.governmentIds,
    addressInformation: formData.addressInformation,
    otherInformation: formData.otherInformation,
    employmentInformation: formData.employmentInformation,
    collateralInformation: formData.collateralInformation,
    spouseInformation: formData.spouseInformation,
    bankingRelationships: formData.bankingRelationships,
    signatures: formData.signatures,
    supportingDocuments: formData.supportingDocuments,
  }), [formData]);

  // --- Automated Lending Scorecard (5 Cs) ---
  const automatedScorecard = useMemo(() => {
    const character = formData.borrower.govId ? 8 : 5; // Simplified logic
    const capacity = calculations.dsr < 30 ? 10 : calculations.dsr < 40 ? 7 : 4;
    const capital = formData.employment.otherIncome > 0 ? 8 : 5;
    const collateral = calculations.ltv < 80 ? 10 : calculations.ltv < 90 ? 7 : 4;
    const conditions = formData.loan.purpose ? 8 : 5;
    const total = character + capacity + capital + collateral + conditions;
    return { character, capacity, capital, collateral, conditions, total };
  }, [calculations, formData]);

  const creditRiskInsights = useMemo(() => {
    const parsedDocsCount = formData.documents.filter((doc) => doc.status === 'Parsed').length;
    const docsCoverage = formData.documents.length > 0
      ? parsedDocsCount / formData.documents.length
      : 0;

    // Higher is better: confidence that applicant identity/profile is legitimate.
    const fraudScore = Math.max(
      0,
      Math.min(
        100,
        (formData.borrower.govId ? 30 : 0) +
          (formData.borrower.email ? 10 : 0) +
          (formData.borrower.phone ? 10 : 0) +
          (formData.borrower.address ? 10 : 0) +
          Math.round(docsCoverage * 35) +
          (formData.applicantPersonal.dateOfBirth ? 5 : 0),
      ),
    );

    // Higher is better: likelihood application can move forward without early rejection.
    const nonStarterScore = Math.max(
      0,
      Math.min(
        100,
        (formData.loan.amount > 0 ? 20 : 0) +
          (formData.collateral.appraisedValue > 0 ? 20 : 0) +
          (formData.loan.productType ? 10 : 0) +
          (calculations.totalIncome > 0 ? 20 : 0) +
          (calculations.dsr < 60 ? 15 : 0) +
          (parsedDocsCount >= 2 ? 15 : 0),
      ),
    );

    // Lower is better: blended risk index from affordability, coverage, and scorecard quality.
    const riskScore = Math.max(
      0,
      Math.min(
        100,
        (calculations.dsr * 0.4) +
          (calculations.ltv * 0.3) +
          ((50 - automatedScorecard.total) * 2) +
          (parsedDocsCount === 0 ? 10 : 0),
      ),
    );

    const grossRevenue =
      formData.loan.amount *
      (formData.loan.interestRate / 100) *
      Math.max(1, formData.loan.termMonths / 12);
    const expectedLoss = formData.loan.amount * (riskScore / 100) * 0.08;
    const processingCost = Math.max(150, formData.loan.amount * 0.005);
    const originationProfitability = grossRevenue - expectedLoss - processingCost;
    const originationMargin = grossRevenue > 0
      ? (originationProfitability / grossRevenue) * 100
      : 0;

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
  }, [automatedScorecard.total, calculations, formData]);

  // --- AI Recommendation with Computations ---
  const aiRecommendation = useMemo(() => {
    let baseProb = 70;
    const computationLog = ['Base Probability: 70%'];
    
    if (calculations.dsr < 35) { baseProb += 15; computationLog.push('+15% (Strong DSR < 35%)'); }
    else if (calculations.dsr > 50) { baseProb -= 20; computationLog.push('-20% (High DSR > 50%)'); }

    if (calculations.ltv < 80) { baseProb += 10; computationLog.push('+10% (Safe LTV < 80%)'); }
    else if (calculations.ltv > 95) { baseProb -= 15; computationLog.push('-15% (Risky LTV > 95%)'); }

    if (automatedScorecard.total >= 40) { baseProb += 5; computationLog.push('+5% (High Automated Scorecard)'); }

    const finalProb = Math.min(Math.max(baseProb, 0), 100);
    return {
      probability: finalProb,
      riskLevel: finalProb > 80 ? 'Low' : finalProb > 50 ? 'Medium' : 'High',
      suggestedAmount: finalProb > 80 ? formData.loan.amount : formData.loan.amount * 0.8,
      computationLog
    };
  }, [calculations, automatedScorecard, formData.loan.amount]);

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
    | Disbursement
    | FinalChecklist;

  const setTransientMessage = useCallback((message: string) => {
    setSaveMessage(message);
    window.setTimeout(() => setSaveMessage(''), 3000);
  }, []);

  const hydrateApplication = useCallback((record: LoanApplicationRecord): LoanApplication => {
    const blankApplication = createNewApplicationInstance();
    const savedRequirements:  Partial<LoanApplicationRequirements> = record.requirements ?? {};

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
      },
      collateralInformation: {
        ...blankApplication.collateralInformation,
        ...savedRequirements.collateralInformation,
      },
      spouseInformation: {
        ...blankApplication.spouseInformation,
        ...savedRequirements.spouseInformation,
      },
      bankingRelationships: {
        ...blankApplication.bankingRelationships,
        ...savedRequirements.bankingRelationships,
      },
      signatures: {
        ...blankApplication.signatures,
        ...savedRequirements.signatures,
      },
      supportingDocuments: {
        ...blankApplication.supportingDocuments,
        ...savedRequirements.supportingDocuments,
      },
      committeeRemarks: record.committee_remarks,
      routing: {
        ...blankApplication.routing,
        executiveApproval: record.executive_approval,
      },
    };
  }, []);

  const buildLoanPayload = (newStatus: WorkflowStatus): LoanApplicationPayload => ({
    application_no: formData.id,
    status: newStatus,
    product_type: formData.loan.productType,
    borrower_name: formData.borrower.fullName,
    email: formData.borrower.email,
    phone: formData.borrower.phone,
    gov_id: formData.borrower.govId,
    address: formData.borrower.address,
    monthly_income: formData.employment.monthlyIncome,
    other_income: formData.employment.otherIncome,
    debt_obligations: formData.employment.debtObligations,
    loan_amount: formData.loan.amount,
    term_months: formData.loan.termMonths,
    interest_rate: formData.loan.interestRate,
    purpose: formData.loan.purpose,
    vehicle_info: formData.collateral.vehicleInfo,
    appraised_value: formData.collateral.appraisedValue,
    committee_remarks: formData.committeeRemarks,
    executive_approval: formData.routing.executiveApproval,
    dti: calculations.dti,
    dsr: calculations.dsr,
    ltv: calculations.ltv,
    scorecard_total: automatedScorecard.total,
    ai_probability: aiRecommendation.probability,
    requirements,
  });

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newDoc: DocumentItem = { id: Date.now().toString(), name: file.name, type: file.type, status: 'Pending' };
      setFormData(prev => ({ ...prev, documents: [...prev.documents, newDoc] }));
    }
  };

  const handleParseDocument = (docId: string) => {
    setIsParsing(true);
    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        employment: { ...prev.employment, monthlyIncome: prev.employment.monthlyIncome + 4500 },
        documents: prev.documents.map(d => d.id === docId ? { ...d, status: 'Parsed', parsedData: 'Extracted: +$4,500/mo income' } : d)
      }));
      setIsParsing(false);
    }, 1500);
  };

  const persistLoanApplication = async (newStatus: WorkflowStatus) => {
    setIsSaving(true);

    try {
      const payload = buildLoanPayload(newStatus);
      const result = hasPersistedRecord
        ? await updateLoanApplication(formData.id, payload)
        : await createLoanApplication(payload);

      setHasPersistedRecord(true);
      setFormData(prev => ({ ...prev, status: newStatus }));
      setTransientMessage(result.message || `Application saved as ${newStatus}`);
    } catch (error) {
      setSaveMessage(
        getErrorMessage(error, 'Failed to save loan application.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const changeWorkflowStatus = async (newStatus: WorkflowStatus) => {
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

  const loadApplication = useCallback(async (applicationNo: string) => {
    setIsLoadingApplication(true);

    try {
      const data = await fetchLoanApplication(applicationNo);

      setFormData(hydrateApplication(data));
      setHasPersistedRecord(true);
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
    setHasPersistedRecord(false);
    setStep(1);
    navigate('/lending-scorecard', { replace: true });
    setTransientMessage('New application draft generated.');
  };

  // --- Validation for Step 10 ---
  const validationChecks = useMemo(() => [
    { label: 'Borrower Identity Verified', passed: !!formData.borrower.fullName && !!formData.borrower.govId },
    { label: 'Loan Amount & Collateral Valid', passed: formData.loan.amount > 0 && formData.collateral.appraisedValue > 0 },
    { label: 'DSR is within acceptable limits (< 50%)', passed: calculations.dsr < 50 },
    { label: 'Required Documents Uploaded & Parsed', passed: formData.documents.length >= 2 && formData.documents.every(d => d.status === 'Parsed') },
    { label: 'Product selected', passed: !!formData.loan.productType },
  ], [formData, calculations]);
  const saveMessageIsError = saveMessage.toLowerCase().includes('failed');
  const getInputValue = (section: EditableSection, field: string): string | number => {
    const rawValue = (formData[section] as Record<string, FieldValue | undefined>)[field];

    if (typeof rawValue === 'boolean') {
      return rawValue ? 'true' : 'false';
    }

    return rawValue ?? '';
  };

  const renderInput = (section: EditableSection, field: string, label: string, type = 'text', disabled = false) => (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</label>
      <input
        type={type}
        disabled={disabled}
        value={getInputValue(section, field)}
        onChange={(e) => updateField(section, field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-gray-100 text-gray-500' : 'border-gray-300'}`}
      />
    </div>
  );

  const renderCheckbox = (section: EditableSection, field: string, label: string) => (
    <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
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
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</label>
      <select
        value={String(getInputValue(section, field))}
        onChange={(event) => updateField(section, field, event.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        
        {/* Header & Workflow Status */}
        <div className="bg-slate-800 text-white p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Advanced Loan Origination System</h1>
            <p className="text-slate-400 text-sm mt-1">Application ID: {formData.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300">Current Status:</span>
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider ${getStatusColor(formData.status)}`}>
              {formData.status}
            </span>
          </div>
        </div>

        {/* Global Pipeline Dashboard Navigation Bar */}
        <div className="bg-slate-100 border-b border-gray-200 px-6 py-3 flex flex-wrap gap-3 items-center justify-start">
          <button 
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded text-xs font-bold transition shadow-sm"
          >
            ➕ Create New Application
          </button>
          <button 
            onClick={() => navigate('/loan-repository')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-semibold transition shadow-sm"
          >
            📋 Review Applications
          </button>
          <button 
            onClick={() => navigate('/loan-repository?status=Credit%20Review')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-semibold transition shadow-sm"
          >
            ⏳ Approval Queue
          </button>
          <button 
            onClick={() => navigate('/loan-repository?status=Released')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-semibold transition shadow-sm"
          >
            💸 Released Accounts
          </button>
        </div>

        {/* Progress Stepper */}
        <div className="bg-slate-50 border-b border-gray-200 p-4 pt-6 overflow-x-auto">
          <div className="grid min-w-[1200px] grid-cols-10 gap-2 text-xs font-medium text-gray-500">
            {['Product Selection', 'Applicant Info', 'Employment & Income', 'Co-Borrower', 'Banking', 'Collateral', 'Documents', 'Credit Scoring', 'Approval', 'Release & Booking'].map((label, i) => (
              <button
                key={i}
                onClick={() => setStep(i + 1)}
                className={`flex h-full min-h-[84px] w-full flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center transition hover:border-blue-400 hover:text-blue-600 ${step === i + 1 ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold shadow-sm' : 'border-gray-200 bg-white'}`}
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step >= i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                  {i + 1}
                </div>
                <span className="leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 md:p-8 min-h-[400px]">
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
              {renderSelect('loan', 'productType', 'Product Being Applied For', ['Home Loan', 'Auto Loan', 'Credit Card'])}
              {renderInput('loan', 'purpose', 'Purpose of Loan')}
              {renderInput('loan', 'amount', 'Requested Loan Amount', 'number')}
              {renderInput('loan', 'termMonths', 'Loan Term (Months)', 'number')}
              {renderInput('loan', 'interestRate', 'Annual Interest Rate (%)', 'number')}
              <div className="md:col-span-2 bg-purple-50 p-4 rounded-md border border-purple-200 mt-2">
                <h4 className="font-bold text-purple-800 text-sm mb-2">Auto-Calculated Metrics</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Est. Monthly Amortization: <span className="font-bold">${calculations.monthlyPayment.toFixed(2)}</span></div>
                  <div>Loan-to-Value (LTV): <span className={`font-bold ${calculations.ltv > 90 ? 'text-red-600' : 'text-green-600'}`}>{calculations.ltv.toFixed(1)}%</span></div>
                </div>
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
              {renderCheckbox('otherInformation', 'recentPhotoUploaded', '1x1 Recent Photo Uploaded')}
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="col-span-full text-lg font-bold text-slate-800 border-b pb-2">Step 3: Employment & Income</h3>
              {renderInput('employment', 'history', 'Employment History (Current Employer & Tenure)')}
              {renderInput('employment', 'monthlyIncome', 'Primary Monthly Income', 'number')}
              {renderInput('employment', 'otherIncome', 'Other Sources of Income', 'number')}
              {renderInput('employment', 'debtObligations', 'Existing Monthly Debt Obligations', 'number')}
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
              {renderInput('employmentInformation', 'grossMonthlyIncome', 'Gross Monthly Income', 'number')}
              {renderInput('employmentInformation', 'monthlyLivingExpenses', 'Monthly Living Expenses', 'number')}
              {renderInput('employmentInformation', 'otherSourcesOfIncome', 'Other Sources of Income')}
              {renderInput('employmentInformation', 'investmentIncome', 'Investment Income', 'number')}
              {renderInput('employmentInformation', 'businessIncome', 'Business Income', 'number')}
              {renderInput('employmentInformation', 'pensionIncome', 'Pension Income', 'number')}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold text-slate-800">Step 4: Co-Borrower Information</h3>
                <button onClick={addCoBorrower} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">+ Add Co-Borrower</button>
              </div>
              {formData.coBorrowers.length === 0 && <p className="text-gray-500 italic text-sm">No co-borrowers added. Click above to add.</p>}
              {formData.coBorrowers.map((cb, idx) => (
                <div key={cb.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
                  <button onClick={() => removeCoBorrower(cb.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-sm font-bold">✕</button>
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
                      <input type="number" value={cb.monthlyIncome} onChange={(e) => updateCoBorrower(cb.id, 'monthlyIncome', parseFloat(e.target.value)||0)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Debt Obligations</label>
                      <input type="number" value={cb.debtObligations} onChange={(e) => updateCoBorrower(cb.id, 'debtObligations', parseFloat(e.target.value)||0)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
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
                    renderInput(
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
              {renderInput('bankingRelationships', 'loanCurrentBalance', 'Current Loan Balance', 'number')}
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
                <input type="file" id="fileUpload" className="hidden" onChange={handleFileUpload} />
                <label htmlFor="fileUpload" className="cursor-pointer flex flex-col items-center">
                  <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                  <span className="text-sm font-medium text-blue-600">Click to upload documents</span>
                  <span className="text-xs text-gray-500 mt-1">Payslips, Bank Statements, IDs (PDF, JPG)</span>
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
                        <button onClick={() => handleParseDocument(doc.id)} disabled={isParsing} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50">
                          {isParsing ? 'Parsing...' : 'AI Parse'}
                        </button>
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
                  ].map(([section, field, label]) => renderCheckbox(section as EditableSection, field, label))}
                </div>
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Step 8: Credit Scoring</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-50 p-4 rounded-md border border-red-200">
                  <h4 className="font-bold text-red-800 text-sm mb-2">Debt-to-Income (DTI)</h4>
                  <p className="text-3xl font-bold text-red-700">{calculations.dti.toFixed(1)}%</p>
                  <p className="text-xs text-red-600 mt-1">Formula: (Total Existing Debt / Total Income) * 100</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-md border border-orange-200">
                  <h4 className="font-bold text-orange-800 text-sm mb-2">Debt Service Ratio (DSR)</h4>
                  <p className="text-3xl font-bold text-orange-700">{calculations.dsr.toFixed(1)}%</p>
                  <p className="text-xs text-orange-600 mt-1">Formula: ((Existing Debt + Proposed Payment) / Total Income) * 100</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 text-sm">Automated Lending Scorecard</h4>
                <p className="text-sm text-gray-600">Scores are automatically computed based on application data inputs.</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: 'Character', score: automatedScorecard.character, desc: 'Based on ID & History' },
                    { label: 'Capacity', score: automatedScorecard.capacity, desc: 'Based on DSR' },
                    { label: 'Capital', score: automatedScorecard.capital, desc: 'Based on Other Income' },
                    { label: 'Collateral', score: automatedScorecard.collateral, desc: 'Based on LTV' },
                    { label: 'Conditions', score: automatedScorecard.conditions, desc: 'Based on Purpose' },
                  ].map((c, i) => (
                    <div key={i} className="bg-white border-2 border-gray-200 rounded-lg p-4 text-center shadow-sm">
                      <p className="text-xs font-bold text-gray-500 uppercase">{c.label}</p>
                      <p className={`text-3xl font-bold my-2 ${c.score >= 8 ? 'text-green-600' : c.score >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>{c.score}<span className="text-sm text-gray-400">/10</span></p>
                      <p className="text-[10px] text-gray-500">{c.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-800 text-white p-4 rounded-lg flex justify-between items-center">
                  <span className="font-bold text-lg">Total Automated Score</span>
                  <span className="text-3xl font-bold text-blue-400">{automatedScorecard.total}<span className="text-sm text-slate-400">/50</span></span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 text-sm">Advanced Scoring Signals</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 uppercase">Fraud Score</p>
                    <p className={`text-3xl font-bold mt-1 ${creditRiskInsights.fraudScore >= 70 ? 'text-green-600' : creditRiskInsights.fraudScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {creditRiskInsights.fraudScore}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Higher is better</p>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 uppercase">Non-starter Score</p>
                    <p className={`text-3xl font-bold mt-1 ${creditRiskInsights.nonStarterScore >= 70 ? 'text-green-600' : creditRiskInsights.nonStarterScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {creditRiskInsights.nonStarterScore}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Higher is better</p>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 uppercase">Risk Score</p>
                    <p className={`text-3xl font-bold mt-1 ${creditRiskInsights.riskScore <= 35 ? 'text-green-600' : creditRiskInsights.riskScore <= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {creditRiskInsights.riskScore.toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Lower is better</p>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 uppercase">Origination Profitability</p>
                    <p className={`text-3xl font-bold mt-1 ${creditRiskInsights.originationProfitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${creditRiskInsights.originationProfitability.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Margin: {creditRiskInsights.originationMargin.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>Gross Interest Revenue: <span className="font-semibold text-gray-800">${creditRiskInsights.grossRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                  <div>Expected Loss Reserve: <span className="font-semibold text-gray-800">${creditRiskInsights.expectedLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                  <div>Processing Cost: <span className="font-semibold text-gray-800">${creditRiskInsights.processingCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-lg border border-indigo-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                  <div>
                    <h4 className="text-sm font-bold text-indigo-800 uppercase tracking-wide">AI Approval Probability</h4>
                    <p className="text-4xl font-bold text-indigo-700 mt-1">{aiRecommendation.probability}%</p>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${aiRecommendation.riskLevel === 'Low' ? 'bg-green-200 text-green-800' : aiRecommendation.riskLevel === 'Medium' ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'}`}>
                      Risk Level: {aiRecommendation.riskLevel}
                    </span>
                  </div>
                  <div className="mt-4 md:mt-0 text-right">
                    <p className="text-sm text-gray-600">AI Suggested Loan Amount</p>
                    <p className="text-2xl font-bold text-gray-800">${aiRecommendation.suggestedAmount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-white/60 p-4 rounded-md border border-indigo-100">
                  <h5 className="font-semibold text-sm text-indigo-900 mb-2">Computation Log:</h5>
                  <ul className="space-y-1">
                    {aiRecommendation.computationLog.map((log, i) => (
                      <li key={i} className="text-sm text-gray-700 font-mono">• {log}</li>
                    ))}
                  </ul>
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
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleSaveDraft} disabled={isSaving} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm font-medium transition disabled:opacity-50">Save Draft</button>
                  
                  {formData.status === 'Approved' && (
                    <button onClick={() => changeWorkflowStatus('Released')} disabled={isSaving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-bold transition disabled:opacity-50">Release Funds</button>
                  )}

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
            <button onClick={() => setStep(prev => Math.max(prev - 1, 1))} disabled={step === 1} className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-100 disabled:opacity-50">
              ← Back
            </button>
            <div className="flex gap-3">
              <button onClick={handleSaveDraft} disabled={isSaving} className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800 text-sm disabled:opacity-50">Save Draft</button>
              <button onClick={() => setStep(prev => Math.min(prev + 1, 10))} className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 shadow-sm">
                Next Step →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
