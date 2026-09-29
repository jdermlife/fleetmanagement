import type { LoanApplicationRecord } from '../../api/loan'

const APPLICATION_REGISTER_COLUMNS: Array<{
  header: string
  value: (record: LoanApplicationRecord) => unknown
}> = [
  { header: 'Application No', value: (record) => record.application_no },
  { header: 'Created By', value: (record) => record.created_by_username ?? '' },
  { header: 'Creator Email', value: (record) => record.created_by_email ?? '' },
  { header: 'Created At', value: (record) => record.created_at ?? '' },
  { header: 'Product', value: (record) => record.product_type },
  { header: 'Applicant / Borrower', value: (record) => record.borrower_name },
  { header: 'Email', value: (record) => record.email },
  { header: 'Phone', value: (record) => record.phone },
  { header: 'Government ID', value: (record) => record.gov_id },
  { header: 'Address', value: (record) => record.address },
  { header: 'Monthly Income', value: (record) => record.monthly_income },
  { header: 'Other Income', value: (record) => record.other_income },
  { header: 'Debt Obligations', value: (record) => record.debt_obligations },
  { header: 'Loan Amount', value: (record) => record.loan_amount },
  { header: 'Term Months', value: (record) => record.term_months },
  { header: 'Interest Rate', value: (record) => record.interest_rate },
  { header: 'Purpose', value: (record) => record.purpose },
  { header: 'Collateral', value: (record) => record.vehicle_info },
  { header: 'Committee Remarks', value: (record) => record.committee_remarks },
  { header: 'Executive Approval', value: (record) => record.executive_approval },
  { header: 'Scorecard', value: (record) => record.scorecard_total },
  { header: 'AI Probability', value: (record) => record.ai_probability },
  { header: 'DTI', value: (record) => record.dti },
  { header: 'DSR', value: (record) => record.dsr },
  { header: 'LTV', value: (record) => record.ltv },
  { header: 'Status', value: (record) => record.status },
]

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const formulaSafeText = /^[=+@]/.test(text) ? `'${text}` : text
  return `"${formulaSafeText.replace(/"/g, '""')}"`
}

export function createApplicationRegisterCsv(records: LoanApplicationRecord[]): string {
  const header = APPLICATION_REGISTER_COLUMNS.map((column) => csvCell(column.header)).join(',')
  const rows = records.map((record) => APPLICATION_REGISTER_COLUMNS
    .map((column) => csvCell(column.value(record)))
    .join(','))
  return `\uFEFF${[header, ...rows].join('\r\n')}`
}

export function downloadApplicationRegisterCsv(blob: Blob, filename: string): void {
  const csvBlob = blob.type.toLowerCase().includes('csv')
    ? blob
    : new Blob([blob], { type: 'text/csv;charset=utf-8' })
  const downloadUrl = window.URL.createObjectURL(csvBlob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  window.setTimeout(() => {
    link.remove()
    window.URL.revokeObjectURL(downloadUrl)
  }, 0)
}