export type GoalSettingField = {
  key: string
  label: string
  type?: 'number' | 'select' | 'text'
  options?: string[]
}

export const GOAL_SETTING_FIELDS: GoalSettingField[] = [
  { key: 'loanPurpose', label: 'Financial Goal / Purpose' },
  {
    key: 'productType',
    label: 'Product Being Applied For',
    type: 'select',
    options: ['Home Loan', 'Auto Loan', 'Motorcycle Loan', 'Credit Card', 'Personal Loan', 'Margin Loan'],
  },
  { key: 'requestedAmount', label: 'Requested Loan Amount', type: 'number' },
  { key: 'loanTerm', label: 'Loan Term (Months)', type: 'number' },
  { key: 'interestRate', label: 'Annual Interest Rate (%)', type: 'number' },
]

export const calculateMonthlyAmortization = (
  principal: number,
  termMonths: number,
  annualInterestRate: number,
): number => {
  if (principal <= 0 || termMonths <= 0) return 0
  const monthlyRate = Math.max(0, annualInterestRate) / 100 / 12
  if (monthlyRate === 0) return principal / termMonths
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths))
}