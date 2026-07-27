export type RelatedPartyField = {
  key: string
  label: string
  type?: 'date' | 'number' | 'select' | 'tel' | 'text'
  options?: string[]
}

export const SPOUSE_FIELDS: RelatedPartyField[] = [
  { key: 'spouseFullName', label: 'Spouse Full Name' },
  { key: 'spouseDateOfBirth', label: 'Spouse Date of Birth', type: 'date' },
  { key: 'spousePlaceOfBirth', label: 'Spouse Place of Birth' },
  { key: 'spouseCitizenship', label: 'Spouse Citizenship' },
  { key: 'spouseMobileNumber', label: 'Spouse Mobile Number', type: 'tel' },
  { key: 'spousePresentAddress', label: 'Spouse Present Address' },
]

export const SPOUSE_EMPLOYMENT_FIELDS: RelatedPartyField[] = [
  { key: 'spouseEmployerBusinessName', label: 'Spouse Employer / Business Name' },
  { key: 'spouseOfficeAddress', label: 'Spouse Office Address' },
  { key: 'spouseOccupation', label: 'Spouse Occupation' },
  { key: 'spousePosition', label: 'Spouse Position' },
  { key: 'spouseNatureOfWork', label: 'Spouse Nature of Work' },
  { key: 'spousePreviousEmployer', label: 'Spouse Current Employer' },
  { key: 'spouseYearsWithEmployer', label: 'Spouse Years with Employer' },
  { key: 'spouseTotalYearsWorking', label: 'Spouse Total Years Working' },
  { key: 'spouseGrossMonthlyIncome', label: 'Spouse Gross Monthly Income', type: 'number' },
  { key: 'spouseMonthlyExpenses', label: 'Spouse Monthly Expenses', type: 'number' },
  { key: 'spouseOtherIncomeSources', label: 'Spouse Other Income Sources' },
]

export const CO_BORROWER_FIELDS: RelatedPartyField[] = [
  { key: 'name', label: 'Full Name' },
  { key: 'relationship', label: 'Relationship' },
  { key: 'monthlyIncome', label: 'Monthly Income', type: 'number' },
  { key: 'debtObligations', label: 'Debt Obligations', type: 'number' },
  { key: 'creditStanding', label: 'Credit Standing', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
]

export const GUARANTOR_FIELDS: RelatedPartyField[] = [
  { key: 'name', label: 'Full Name' },
  { key: 'relationship', label: 'Relationship to Applicant' },
  { key: 'mobileNumber', label: 'Mobile Number', type: 'tel' },
  { key: 'presentAddress', label: 'Present Address' },
  { key: 'employerBusinessName', label: 'Employer / Business Name' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'monthlyIncome', label: 'Monthly Income', type: 'number' },
  { key: 'debtObligations', label: 'Debt Obligations', type: 'number' },
  { key: 'creditStanding', label: 'Credit Standing', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
]

export type CoBorrower = {
  id: string
  name: string
  relationship: string
  monthlyIncome: string
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
  monthlyIncome: '',
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
