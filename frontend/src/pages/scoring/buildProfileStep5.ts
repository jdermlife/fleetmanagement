export type BankingField = {
  key: string
  label: string
  type?: 'calculated' | 'datalist' | 'date' | 'number' | 'radio' | 'select' | 'text' | 'textarea'
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
    title: 'Historical Assessment Information',
    description: 'Complete each credit bureau item. Credit utilization is calculated automatically.',
    fields: [
      {
        key: 'creditBureauLatePaymentFrequency',
        label: '1. In your recollection, how many times have you had a late payment?',
        type: 'radio',
        options: ['No late payments', '1–2 late payments (≤30 days)', '3–5 late payments', 'More than 5 late payments', 'Loan in default'],
      },
      {
        key: 'creditBureauDelinquencyDefaultHistory',
        label: '2. How many delinquencies or defaults have you had before?',
        type: 'radio',
        options: ['No delinquency/default', 'Delinquency resolved over 5 years ago', 'Delinquency resolved within last 5 years', 'Current delinquency', 'Current default / foreclosure / repossession'],
      },
      {
        key: 'creditBureauOverallBalanceRatio',
        label: '3. What is your overall loan balance compared with your total approved credit?',
        type: 'radio',
        options: ['Less than 20%', '20–40%', '41–60%', '61–80%', 'Above 80%'],
      },
      {
        key: 'creditBureauCreditLimitUtilization',
        label: '4. What percentage of your credit limit are you utilizing? This is computed automatically.',
        type: 'calculated',
      },
      {
        key: 'creditBureauActiveLoanCount',
        label: '5. Number of Active Loans',
        type: 'radio',
        options: ['1–2', '3–4', '5–6', '7–8', 'More than 8'],
      },
      {
        key: 'creditBureauCollectionCallsLast12Months',
        label: '6. How many collection calls did you receive during the last 12 months?',
        type: 'radio',
        options: ['0–2', '3–4', '5–6', '7–8', 'More than 8'],
      },
      {
        key: 'creditBureauCreditHistoryLength',
        label: '7. How long ago was credit first granted to you?',
        type: 'radio',
        options: ['More than 10 years', '5–10 years', '3–5 years', '1–3 years', 'Less than 1 year'],
      },
      {
        key: 'creditBureauWrittenOffAccountStatus',
        label: '8. Do you have any settled or written-off accounts?',
        type: 'radio',
        options: ['No written-off account', 'Settled with full payment', 'Settled for less than full amount', 'Written-off but already closed', 'Active written-off account'],
      },
      {
        key: 'creditBureauLegalCaseCollectionStatus',
        label: '9. How many legal cases or collections do you have?',
        type: 'radio',
        options: ['None', 'Previous case already dismissed/resolved', 'Previous collection fully paid', 'Active collection account', 'Active legal case'],
      },
      {
        key: 'creditBureauUnpaidDebtRecord',
        label: '10. Have you ever had an unpaid debt reported to a Credit Bureau?',
        type: 'radio',
        options: ['None', 'Yes – More than 10 years ago', 'Yes – Within the last 10 years', 'Yes – Within the last 5 years'],
      },
      {
        key: 'creditBureauLoanAmount',
        label: '11. What was the approximate amount of your largest unpaid loan?',
        type: 'radio',
        options: ['Less than 1,000', '1,000–5,000', 'More than 5,000', 'Not Applicable'],
      },
      {
        key: 'creditBureauLoanPaidStatus',
        label: '12. Has that loan already been paid?',
        type: 'radio',
        options: ['Fully paid with certification', 'Fully paid without certification', 'Not yet paid', 'Not Applicable'],
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