import { api } from '../api'

export type WorkflowStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Credit Review'
  | 'Approved'
  | 'Rejected'
  | 'Released'

export interface LoanApplicationPayload {
  application_no: string
  status: WorkflowStatus
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
