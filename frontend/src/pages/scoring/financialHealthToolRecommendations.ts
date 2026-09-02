export type FinancialHealthToolStatusKey =
  | 'creditHealth'
  | 'wealthBuilder'
  | 'budgetTargets'
  | 'billsLoans'
  | 'billManager'

export type FinancialHealthToolRecommendation = {
  name: string
  route: string
  statusKey: FinancialHealthToolStatusKey
  reason: string
}

export const FINANCIAL_HEALTH_TOOL_RECOMMENDATIONS: Record<
  string,
  readonly FinancialHealthToolRecommendation[]
> = {
  credit: [{
    name: 'Credit Health',
    route: '/lending-scorecard',
    statusKey: 'creditHealth',
    reason: 'Review lending readiness, capacity, and credit-profile inputs.',
  }],
  'cash-flow': [
    {
      name: 'Budget & Expense Tracker',
      route: '/budget-expense-tracker',
      statusKey: 'budgetTargets',
      reason: 'Track income, expenses, savings, and recurring cash-flow variance.',
    },
    {
      name: 'Bill Reminder',
      route: '/bill-reminder',
      statusKey: 'billManager',
      reason: 'Manage bill timing and reduce pressure on monthly cash flow.',
    },
  ],
  wealth: [{
    name: 'Net Worth Positioning',
    route: '/net-worth-positioning',
    statusKey: 'wealthBuilder',
    reason: 'Review assets, liabilities, liquidity, and net-worth progress.',
  }],
  budget: [{
    name: 'Budget & Expense Tracker',
    route: '/budget-expense-tracker',
    statusKey: 'budgetTargets',
    reason: 'Set category limits and compare planned amounts with actual spending.',
  }],
  payment: [
    {
      name: 'Loan Monitoring',
      route: '/loan-monitoring',
      statusKey: 'billsLoans',
      reason: 'Review balances, repayment performance, and debt optimization options.',
    },
    {
      name: 'Bill Reminder',
      route: '/bill-reminder',
      statusKey: 'billManager',
      reason: 'Track due dates and payment consistency across recurring obligations.',
    },
  ],
  protection: [{
    name: 'Net Worth Positioning',
    route: '/net-worth-positioning',
    statusKey: 'wealthBuilder',
    reason: 'Review insurance coverage alongside assets and financial obligations.',
  }],
  investment: [{
    name: 'Net Worth Positioning',
    route: '/net-worth-positioning',
    statusKey: 'wealthBuilder',
    reason: 'Review investment readiness, retirement coverage, and diversification.',
  }],
  goal: [{
    name: 'Net Worth Positioning',
    route: '/net-worth-positioning',
    statusKey: 'wealthBuilder',
    reason: 'Set a target amount and monitor projected progress toward the goal.',
  }],
}