import { api } from '../api'

export type WorkflowStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Credit Review'
  | 'Approved'
  | 'Rejected'
  | 'Released'

export type ProductType = 'Home Loan' | 'Auto Loan' | 'Credit Card' | 'Personal Loan'

export interface LoanApplicationRequirements {
  productInformation: {
    productType: ProductType
    homePurposeOfLoan: string
    homeDesiredLoanAmount: number
    homeLoanTerm: number
    homeCollateralType: string
    autoPurpose: string
    autoVehicleClassification: string
    autoUnitModel: string
    autoYearModel: string
    autoSellingPrice: number
    autoDesiredLoanAmount: number
    autoDownPayment: number
    autoYearsToPay: number
    creditCardType: string
    creditCardExtensionRequested: boolean
  }
  applicantPersonal: {
    lastName: string
    firstName: string
    middleName: string
    dateOfBirth: string
    placeOfBirth: string
    age: number
    gender: string
    citizenship: string
    numberOfDependents: number
    maritalStatus: string
    mothersMaidenName: string
  }
  contactInformation: {
    mobileNumber: string
    homePhoneNumber: string
    emailAddress: string
  }
  governmentIds: {
    tin: string
    sssGsisNumber: string
    otherGovernmentId: string
    idNumber: string
    issueDate: string
    expiryDate: string
  }
  addressInformation: {
    presentAddress: string
    permanentAddress: string
    mailingAddress: string
    lengthOfStay: string
  }
  otherInformation: {
    homeOwnership: string
    educationalAttainment: string
    numberOfVehiclesOwned: number
    recentPhotoUploaded: boolean
  }
  employmentInformation: {
    employmentStatus: string
    employerBusinessName: string
    officeAddress: string
    occupation: string
    position: string
    natureOfWorkBusiness: string
    dateHired: string
    officePhoneNumber: string
    previousEmployer: string
    totalYearsWorking: string
    grossMonthlyIncome: number
    monthlyLivingExpenses: number
    otherSourcesOfIncome: string
    investmentIncome: number
    businessIncome: number
    pensionIncome: number
    otherIncome: string
  }
  collateralInformation: {
    propertyAddress: string
    registeredOwner: string
    lotNumber: string
    blockNumber: string
    tctCctNumber: string
  }
  spouseInformation: {
    fullName: string
    dateOfBirth: string
    placeOfBirth: string
    citizenship: string
    mobileNumber: string
    presentAddress: string
    employerBusinessName: string
    officeAddress: string
    occupation: string
    position: string
    natureOfWork: string
    yearsWithEmployer: string
    previousEmployer: string
    totalYearsWorking: string
    grossMonthlyIncome: number
    monthlyExpenses: number
    otherIncomeSources: string
  }
  bankingRelationships: {
    creditCardIssuer: string
    creditCardNumber: string
    creditLimit: number
    outstandingBalance: number
    memberSince: string
    bankBranch: string
    accountType: string
    accountNumber: string
    currentBalance: number
    loanLender: string
    loanType: string
    loanCurrentBalance: number
    loanMonthlyAmortization: number
  }
  signatures: {
    applicantSignature: string
    spouseOrCoBorrowerSignature: string
    borrowerSignatureAutoLoanInsurance: string
    extensionCardholderSignature: string
  }
  supportingDocuments: {
    validGovernmentId: boolean
    passportIfApplicable: boolean
    driversLicense: boolean
    philSysId: boolean
    certificateOfEmployment: boolean
    latestPayslips: boolean
    latestItr: boolean
    dtiSecRegistration: boolean
    businessPermit: boolean
    financialStatements: boolean
    utilityBill: boolean
    waterBill: boolean
    internetBill: boolean
    titleTctCct: boolean
    taxDeclaration: boolean
    lotPlan: boolean
    propertyPhotos: boolean
    vehicleQuotation: boolean
    vehicleInvoice: boolean
    orCrForRefinancing: boolean
    proofOfIncome: boolean
    bankStatements: boolean
    existingCreditCardStatements: boolean
  }
}

export interface LoanApplicationPayload {
  application_no: string
  status: WorkflowStatus
  product_type: ProductType
  borrower_name: string
  email: string
  phone: string
  gov_id: string
  address: string
  monthly_income: number
  other_income: number
  debt_obligations: number
  loan_amount: number
  term_months: number
  interest_rate: number
  purpose: string
  vehicle_info: string
  appraised_value: number
  committee_remarks: string
  executive_approval: boolean
  dti: number
  dsr: number
  ltv: number
  scorecard_total: number
  ai_probability: number
  requirements: LoanApplicationRequirements
}

export interface LoanApplicationRecord extends LoanApplicationPayload {
  id?: number
  created_at?: string
}

export interface LoanMutationResponse {
  message: string
  application_no?: string
}

const LOAN_APPLICATIONS_PATH = '/api/loan-applications'

export async function fetchLoanApplications(): Promise<LoanApplicationRecord[]> {
  const response = await api.get<LoanApplicationRecord[]>(LOAN_APPLICATIONS_PATH)
  return response.data
}

export async function fetchLoanApplication(
  applicationNo: string,
): Promise<LoanApplicationRecord> {
  const response = await api.get<LoanApplicationRecord>(
    `${LOAN_APPLICATIONS_PATH}/${encodeURIComponent(applicationNo)}`,
  )
  return response.data
}

export async function createLoanApplication(
  payload: LoanApplicationPayload,
): Promise<LoanMutationResponse> {
  const response = await api.post<LoanMutationResponse>(
    LOAN_APPLICATIONS_PATH,
    payload,
  )
  return response.data
}

export async function updateLoanApplication(
  applicationNo: string,
  payload: LoanApplicationPayload,
): Promise<LoanMutationResponse> {
  const response = await api.put<LoanMutationResponse>(
    `${LOAN_APPLICATIONS_PATH}/${encodeURIComponent(applicationNo)}`,
    payload,
  )
  return response.data
}

export async function updateLoanApplicationStatus(
  applicationNo: string,
  status: WorkflowStatus,
): Promise<LoanMutationResponse> {
  const response = await api.put<LoanMutationResponse>(
    `${LOAN_APPLICATIONS_PATH}/${encodeURIComponent(applicationNo)}/status`,
    null,
    {
      params: { status },
    },
  )
  return response.data
}
