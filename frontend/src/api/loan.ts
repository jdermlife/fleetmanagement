import { api } from '../api'

const LOAN_REPOSITORY_IMPORT_TIMEOUT_MS = 600000
const LOAN_REPOSITORY_EXPORT_TIMEOUT_MS = 120000

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
    otherSourcesOfIncome: number
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
    propertyAppraisedValue: number
  }
  collateralAssetDetails: {
    assetType: string
    maker: string
    brand: string
    model: string
    year: string
    insuranceProviderCompany: string
    policyNumber: string
    orNumber: string
    crNumber: string
    additionalCollaterals: Array<{
      collateralType: string
      maker: string
      brand: string
      model: string
      year: string
      appraisedValue: number
      insuranceProviderCompany: string
      policyNumber: string
      orNumber: string
      crNumber: string
      notes: string
    }>
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
    additionalSupportingDocuments: boolean
    auditedFinancialStatements: boolean
    proofOfRemittanceIncome: boolean
    investmentStatements: boolean
  }
  enhancedDueDiligence: {
    previousLendersAndExistingLoanAccounts: string
    numberOfActiveLoans: number
    previousLoanRestructuringDisclosures: string
    employmentReferencePerson: string
    hrContactInformation: string
    supervisorInformation: string
    additionalBankAccountsOwned: string
    sourceOfIncomeVerificationReferences: string
    lengthOfResidenceConfirmation: string
    utilityAccountReferences: string
    characterReferences: string
    professionalOrganizationMemberships: string
    professionalLicenses: string
    facebookProfile: string
    instagramProfile: string
    xProfile: string
    tikTokProfile: string
    linkedInProfile: string
    otherSocialMediaLinks: string
    businessWebsite: string
    guarantorReferences: string
    coBorrowerReferences: string
    additionalPropertyDeclarations: string
    additionalVehicleDeclarations: string
    selfDeclaredAssetsAndLiabilities: string
    selfDeclaredInvestmentPortfolio: string
    existingInsurancePolicies: string
    priorBankingRelationships: string
    consentOpenBankingDataAccess: boolean
    consentEmploymentVerification: boolean
    consentIdentityVerification: boolean
    psychometricQuestionnaireResponses: string
    financialBehaviorQuestionnaireResponses: string
    riskAppetiteQuestionnaireResponses: string
    businessOutlookQuestionnaireResponses: string
    futureFinancialPlansQuestionnaire: string
    spendingBehaviorQuestionnaire: string
    householdBudgetingQuestionnaire: string
    emergencyPreparednessQuestionnaire: string
    characterAndIntegrityAssessmentAnswers: string
    communityInvolvementInformation: string
    referencesFromEmployerOrCommunity: string
  }
  optionalPsychometricQuestionnaire: {
    question01: string
    question02: string
    question03: string
    question04: string
    question05: string
    question06: string
    question07: string
    question08: string
    question09: string
    question10: string
    question11: string
    question12: string
    question13: string
    question14: string
    question15: string
    question16: string
    question17: string
    question18: string
    question19: string
    question20: string
  }
}

export interface CreditScoreRecord {
  id?: number
  created_at?: string
  character_score?: number | null
  capacity_score?: number | null
  capital_score?: number | null
  collateral_score?: number | null
  conditions_score?: number | null
  bureau_score?: number | null
  internal_score?: number | null
  total_credit_score?: number | null
  credit_grade?: string | null
  model_version?: string | null
}

export interface FraudScoreRecord {
  id?: number
  created_at?: string
  identity_score?: number | null
  document_score?: number | null
  geo_location_score?: number | null
  device_score?: number | null
  duplicate_application_score?: number | null
  overall_fraud_score?: number | null
  fraud_risk_level?: string | null
  fraud_flags?: Record<string, unknown>
}

export interface SocialScoreRecord {
  id?: number
  created_at?: string
  residence_stability_score?: number | null
  employment_stability_score?: number | null
  family_stability_score?: number | null
  education_score?: number | null
  banking_relationship_score?: number | null
  overall_social_score?: number | null
}

export interface PsychometricScoreRecord {
  id?: number
  created_at?: string
  discipline_score?: number | null
  planning_score?: number | null
  responsibility_score?: number | null
  honesty_score?: number | null
  resilience_score?: number | null
  overall_psychometric_score?: number | null
  questionnaire_answers?: Record<string, unknown>
}

export interface CreditBureauReportRecord {
  id?: number
  created_at?: string
  bureau_name?: string | null
  bureau_score?: number | null
  total_loans?: number | null
  active_loans?: number | null
  closed_loans?: number | null
  delinquent_accounts?: number | null
  defaulted_accounts?: number | null
  outstanding_balance?: number | null
  report_json?: Record<string, unknown>
  report_date?: string | null
}

export interface CollateralScoreRecord {
  id?: number
  created_at?: string
  ltv_score?: number | null
  asset_quality_score?: number | null
  marketability_score?: number | null
  insurance_score?: number | null
  overall_collateral_score?: number | null
}

export interface ProfitabilityScoreRecord {
  id?: number
  created_at?: string
  projected_interest_income?: number | null
  fee_income?: number | null
  expected_loss?: number | null
  operating_cost?: number | null
  funding_cost?: number | null
  projected_profit?: number | null
  profitability_score?: number | null
}

export interface RelationshipScoreRecord {
  id?: number
  created_at?: string
  customer_since?: string | null
  number_of_accounts?: number | null
  deposit_balance?: number | null
  prior_loans?: number | null
  relationship_score?: number | null
}

export interface AIRecommendationRecord {
  id?: number
  created_at?: string
  recommendation?: string | null
  confidence_score?: number | null
  explanation?: string | null
  suggested_amount?: number | null
  ai_model?: string | null
}

export interface OverallScoreRecord {
  id?: number
  created_at?: string
  credit_score?: number | null
  fraud_score?: number | null
  social_score?: number | null
  psychometric_score?: number | null
  collateral_score?: number | null
  profitability_score?: number | null
  relationship_score?: number | null
  final_score?: number | null
  final_grade?: string | null
  final_decision?: string | null
}

export interface DecisionAuditTrailRecord {
  id?: number
  changed_at?: string
  previous_status?: string | null
  new_status?: string | null
  remarks?: string | null
  changed_by?: string | null
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
  credit_scores: CreditScoreRecord
  fraud_scores: FraudScoreRecord
  social_scores: SocialScoreRecord
  psychometric_scores: PsychometricScoreRecord
  credit_bureau_reports: CreditBureauReportRecord
  collateral_scores: CollateralScoreRecord
  profitability_scores: ProfitabilityScoreRecord
  relationship_scores: RelationshipScoreRecord
  ai_recommendations: AIRecommendationRecord
  overall_scores: OverallScoreRecord
  decision_audit_trail?: DecisionAuditTrailRecord[]
}

export interface LoanApplicationRecord extends LoanApplicationPayload {
  id?: number
  created_by_user_id?: number
  created_at?: string
  updated_at?: string
}

export interface LoanMutationResponse {
  message: string
  application_no?: string
}

export interface QuantScoresSummary {
  credit_score: number
  fraud_score: number
  social_score: number
  psychometric_score: number
  relationship_score: number
  profitability_score: number
  overall_score: number
  final_grade: string
  decision: string
}

export interface QuantScoresResponse extends LoanMutationResponse {
  summary: QuantScoresSummary
}

export interface LoanBulkMutationResponse {
  inserted: number
  message: string
  skipped: number
  updated: number
}

const LOAN_APPLICATIONS_PATH = '/api/loan-applications'

export interface LoanApplicationQueryParams {
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
  status?: 'All' | WorkflowStatus | string
}

export interface DashboardStatistics {
  totalApplications: number
  approved: number
  pending: number
  rejected: number
}

export interface LoanApplicationsPageResponse {
  total: number
  limit: number
  offset: number
  records: LoanApplicationRecord[]
}

export async function fetchDashboardStatistics(): Promise<DashboardStatistics> {
  const response = await api.get<DashboardStatistics>('/dashboard/statistics')
  return response.data
}

async function fetchLoanApplicationsPage(
  params: LoanApplicationQueryParams = {},
): Promise<LoanApplicationsPageResponse> {
  const response = await api.get<LoanApplicationsPageResponse>(LOAN_APPLICATIONS_PATH, {
    params: {
      date_from: params.dateFrom || undefined,
      date_to: params.dateTo || undefined,
      limit: params.limit,
      offset: params.offset,
      status: params.status && params.status !== 'All' ? params.status : undefined,
    },
  })
  return response.data
}

export async function fetchLoanApplications(
  params: LoanApplicationQueryParams = {},
): Promise<LoanApplicationRecord[]> {
  if (params.limit !== undefined || params.offset !== undefined) {
    const response = await fetchLoanApplicationsPage(params)
    return response.records
  }

  return fetchAllLoanApplications(params)
}

export async function fetchAllLoanApplications(
  params: Omit<LoanApplicationQueryParams, 'limit' | 'offset'> = {},
): Promise<LoanApplicationRecord[]> {
  const allRecords: LoanApplicationRecord[] = []
  const pageSize = 10000

  for (let offset = 0; ; offset += pageSize) {
    const batch = await fetchLoanApplicationsPage({
      ...params,
      limit: pageSize,
      offset,
    })

    allRecords.push(...batch.records)

    if (batch.records.length < pageSize) {
      break
    }
  }

  return allRecords
}

export async function importLoanApplications(
  file: File,
): Promise<LoanBulkMutationResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post<LoanBulkMutationResponse>(
    `${LOAN_APPLICATIONS_PATH}/import`,
    formData,
    {
      timeout: LOAN_REPOSITORY_IMPORT_TIMEOUT_MS,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )

  return response.data
}

export async function exportLoanApplications(params: {
  dateFrom?: string
  dateTo?: string
  format: 'csv' | 'xlsx'
  status?: 'All' | WorkflowStatus
}): Promise<Blob> {
  const response = await api.get<Blob>(`${LOAN_APPLICATIONS_PATH}/export`, {
    timeout: LOAN_REPOSITORY_EXPORT_TIMEOUT_MS,
    params: {
      date_from: params.dateFrom || undefined,
      date_to: params.dateTo || undefined,
      format: params.format,
      status: params.status && params.status !== 'All' ? params.status : undefined,
    },
    responseType: 'blob',
  })

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

export async function computeQuantScores(
  payload: LoanApplicationPayload,
): Promise<QuantScoresResponse> {
  const response = await api.post<QuantScoresResponse>(
    `${LOAN_APPLICATIONS_PATH}/compute-quant-scores`,
    payload,
  )
  return response.data
}
