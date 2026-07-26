export type BankingField = {
  key: string
  label: string
  type?: 'datalist' | 'date' | 'number' | 'radio' | 'select' | 'text' | 'textarea'
  options?: string[]
  rows?: number
}

export type BankingSection = {
  title: string
  description?: string
  fields: BankingField[]
}

export const BANKING_RELATIONSHIP_SECTIONS: BankingSection[] = [
  {
    title: 'Existing Credit Card Information',
    fields: [
      { key: 'creditCardIssuer', label: 'Card Issuer', type: 'datalist', options: ['Visa', 'Mastercard', 'American Express', 'Discover', 'JCB', 'Diners Club', 'UnionPay'] },
      { key: 'creditCardNumber', label: 'Card Number' },
      { key: 'creditLimit', label: 'Credit Limit', type: 'number' },
      { key: 'outstandingBalance', label: 'Outstanding Balance', type: 'number' },
      { key: 'memberSince', label: 'Member Since', type: 'date' },
    ],
  },
  {
    title: 'Existing Bank Account Information',
    fields: [
      { key: 'bankBranch', label: 'Bank / Branch' },
      { key: 'accountType', label: 'Account Type' },
      { key: 'accountNumber', label: 'Account Number' },
      { key: 'currentBalance', label: 'Current Balance', type: 'number' },
    ],
  },
  {
    title: 'Existing Loan Information',
    fields: [
      { key: 'loanLender', label: 'Lender / Bank' },
      { key: 'loanType', label: 'Loan Type' },
      { key: 'loanCurrentBalance', label: 'Current Loan Balance', type: 'number' },
      { key: 'loanMonthlyAmortization', label: 'Monthly Amortization', type: 'number' },
    ],
  },
  {
    title: 'Credit Bureau Records',
    description: 'Select one answer for each credit bureau question.',
    fields: [
      {
        key: 'creditBureauUnpaidDebtRecord',
        label: '1. Do you have a record of unpaid debt in Credit Bureau and when?',
        type: 'radio',
        options: ['None', 'Yes - in last 5 years', 'Yes - in the last 10 years', 'Yes - More than 10 years already'],
      },
      {
        key: 'creditBureauLoanAmount',
        label: '2. What is the amount of the loan?',
        type: 'radio',
        options: ['Less than 1,000', 'More than 1,000 but less than 5,000', 'More than 5,000', 'Not Applicable'],
      },
      {
        key: 'creditBureauLoanPaidStatus',
        label: '3. Is the loan paid?',
        type: 'radio',
        options: ['Fully paid with Certification', 'Fully paid without Certification', 'Not yet', 'Not Applicable - No loan'],
      },
    ],
  },
  {
    title: 'Enhanced Due Diligence & Declarations',
    description: 'Provide the underwriting details required for credit exposure and banking background review.',
    fields: [
      { key: 'previousLendersAndExistingLoanAccounts', label: 'Previous Lenders and Existing Loan Accounts', type: 'textarea', rows: 3 },
      { key: 'numberOfActiveLoans', label: 'Number of Active Loans', type: 'number' },
      { key: 'previousLoanRestructuringDisclosures', label: 'Previous Loan Restructuring Disclosures', type: 'textarea', rows: 3 },
      { key: 'creditPaymentHistory', label: 'Declaration of Previously with Unpaid Loan or Credit Card', type: 'select', options: ['Excellent handling (no past due)', 'Satisfactory handling (minimal delays, settled)', 'No previous borrowing', 'Not properly handled / delayed payments'] },
      { key: 'accountHandling', label: 'Deposit / Current Account Handling', type: 'select', options: ['Excellent handling (no returned checks)', 'Satisfactory handling (minimal returned checks, settled)', 'Not properly handled'] },
      { key: 'utilityCreditBureauStatus', label: 'Payment of Utilities / Credit Bureau Findings', type: 'select', options: ['Very satisfactory to satisfactory', 'Dismissed / settled (fully settled with date)', 'Not satisfactory'] },
      { key: 'creditCardRelationshipStatus', label: 'Existing Credit Card Relationship', type: 'select', options: ['Existing cardholder for more than 5 years with excellent payment history', 'Existing cardholder for 2–5 years with satisfactory history', 'New cardholder or less than 2 years', 'No previous credit card relationship'] },
      { key: 'additionalBankAccountsOwned', label: 'Additional Bank Accounts Owned', type: 'textarea', rows: 3 },
      { key: 'priorBankingRelationships', label: 'Prior Banking Relationships', type: 'textarea', rows: 3 },
      { key: 'averageSavingsBalance', label: 'Average Savings Balance', type: 'number' },
      { key: 'averageDailyBalance', label: 'Average Daily Balance', type: 'number' },
      { key: 'depositRegularity', label: 'Deposit Regularity', type: 'select', options: ['Regular deposits', 'Irregular deposits', 'No savings relationship'] },
      { key: 'bankingRelationshipTier', label: 'Banking Relationship', type: 'select', options: ['Premium/Preferred banking customer with multiple products', 'Active savings/current account with regular transactions', 'Limited banking relationship', 'No banking relationship'] },
      { key: 'existingInsurancePolicies', label: 'Existing Insurance Policies', type: 'textarea', rows: 3 },
      { key: 'selfDeclaredAssetsAndLiabilities', label: 'Self-Declared Assets and Liabilities', type: 'textarea', rows: 4 },
      { key: 'selfDeclaredInvestmentPortfolio', label: 'Self-Declared Investment Portfolio', type: 'textarea', rows: 4 },
    ],
  },
]

export const BANKING_RELATIONSHIP_FIELDS = BANKING_RELATIONSHIP_SECTIONS.flatMap((section) => section.fields)