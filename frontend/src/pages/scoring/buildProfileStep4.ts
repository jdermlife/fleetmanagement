export type RelatedPartyField = {
  key: string
  label: string
  type?: 'date' | 'number' | 'select' | 'tel' | 'text'
  options?: string[]
}

export const SPOUSE_FIELDS: RelatedPartyField[] = [
  { key: 'spouseFullName', label: 'Spouse Full Name (Optional)' },
  { key: 'spouseDateOfBirth', label: 'Spouse Date of Birth (Optional)', type: 'date' },
  { key: 'spousePlaceOfBirth', label: 'Spouse Place of Birth (Optional)' },
  { key: 'spouseCitizenship', label: 'Spouse Citizenship (Optional' },
  { key: 'spouseMobileNumber', label: 'Spouse Mobile Number (Optional)', type: 'tel' },
  { key: 'spousePresentAddress', label: 'Spouse Present Address (Optional)' },
]

export const SPOUSE_EMPLOYMENT_FIELDS: RelatedPartyField[] = [
  { key: 'spouseEmployerBusinessName', label: 'Spouse Current Employer / Business Name (Optional)' },
  { key: 'spouseOfficeAddress', label: 'Spouse Office Address (Optional)' },
  { key: 'spouseOccupation', label: 'Spouse Occupation (Optional)' },
  { key: 'spousePosition', label: 'Spouse Position (Optional)' },
  { key: 'spouseNatureOfWork', label: 'Spouse Nature of Work (Optional)' },
  { key: 'spousePreviousEmployer', label: 'Spouse Previous Employer (Optional)' },
  { key: 'spouseYearsWithEmployer', label: 'Spouse Years - Current Employer (Optional)' },
  { key: 'spouseTotalYearsWorking', label: 'Spouse Total Years Working' },
  { key: 'spouseGrossMonthlyIncome', label: 'Spouse Gross Monthly Income', type: 'number' },
  { key: 'spouseMonthlyExpenses', label: 'Spouse Monthly Expenses(', type: 'number' },
  { key: 'spouseOtherIncomeSources', label: 'Spouse Other Income Sources' },
]

export const CO_BORROWER_FIELDS: RelatedPartyField[] = [
  { key: 'name', label: 'Full Name (Demo Data Accepted)' },
  { key: 'relationship', label: 'Relationship' },
  { key: 'employerBusinessName', label: 'Current Employer / Business Name (Optional)' },
  { key: 'officeAddress', label: 'Office Address (Optional)' },
  { key: 'occupation', label: 'Occupation (Optional)' },
  { key: 'position', label: 'Position (Optional)' },
  { key: 'natureOfWork', label: 'Nature of Work (Optional)' },
  { key: 'previousEmployer', label: 'Previous Employer (Optional)' },
  { key: 'yearsWithEmployer', label: 'Years - Current Employer (Optional)' },
  { key: 'totalYearsWorking', label: 'Total Years Working' },
  { key: 'monthlyIncome', label: 'Gross Monthly Income', type: 'number' },
  { key: 'monthlyExpenses', label: 'Monthly Expenses', type: 'number' },
  { key: 'otherIncomeSources', label: 'Other Income Sources' },
  { key: 'debtObligations', label: 'Debt Obligations', type: 'number' },
  { key: 'creditStanding', label: 'Credit Standing', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
]

export const GUARANTOR_FIELDS: RelatedPartyField[] = [
  { key: 'name', label: 'Full Name (Demo Data Accepted)' },
  { key: 'relationship', label: 'Relationship to Applicant (Demo Data Accepted)' },
  { key: 'mobileNumber', label: 'Mobile Number (Optional)', type: 'tel' },
  { key: 'presentAddress', label: 'Present Address (Optional)' },
  { key: 'employerBusinessName', label: 'Employer / Business Name (Optional)' },
  { key: 'occupation', label: 'Occupation (Optional)' },
  { key: 'monthlyIncome', label: 'Monthly Income', type: 'number' },
  { key: 'debtObligations', label: 'Debt Obligations', type: 'number' },
  { key: 'creditStanding', label: 'Credit Standing', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
]

export type CoBorrower = {
  id: string
  name: string
  relationship: string
  employerBusinessName: string
  officeAddress: string
  occupation: string
  position: string
  natureOfWork: string
  previousEmployer: string
  yearsWithEmployer: string
  totalYearsWorking: string
  monthlyIncome: string
  monthlyExpenses: string
  otherIncomeSources: string
  debtObligations: string
  creditStanding: string
}

export type Guarantor = {
  id: string
  name: string
  relationship: string
  mobileNumber: string
  presentAddress: string
  employerBusinessName: string
  occupation: string
  monthlyIncome: string
  debtObligations: string
  creditStanding: string
}

export const createCoBorrower = (): CoBorrower => ({
  id: `CB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  name: '',
  relationship: '',
  employerBusinessName: '',
  officeAddress: '',
  occupation: '',
  position: '',
  natureOfWork: '',
  previousEmployer: '',
  yearsWithEmployer: '',
  totalYearsWorking: '',
  monthlyIncome: '',
  monthlyExpenses: '',
  otherIncomeSources: '',
  debtObligations: '',
  creditStanding: '',
})

export const createGuarantor = (): Guarantor => ({
  id: `GUA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  name: '',
  relationship: '',
  mobileNumber: '',
  presentAddress: '',
  employerBusinessName: '',
  occupation: '',
  monthlyIncome: '',
  debtObligations: '',
  creditStanding: '',
})
