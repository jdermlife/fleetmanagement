export type FinancialHealthIndicatorSource = {
  id: string
  source: string
  basis: string
  formula: string
  scoring: string
}

export type FinancialHealthMetricSource = {
  label: string
  source: string
  formula: string
}

export const financialHealthIndicatorSources: readonly FinancialHealthIndicatorSource[] = [
  {
    id: 'credit',
    source: 'Loan Application draft',
    basis: 'Government ID, debt service ratio, other income, loan-to-value ratio, and loan purpose.',
    formula: 'clamp((Character + Capacity + Capital + Collateral + Conditions) x 2, 0, 100)',
    scoring: 'Character: 8/5; Capacity: 10/7/4 at DSR <30%/<40%/40%+; Capital: 8/5; Collateral: 10/7/4 at LTV <80%/<90%/90%+; Conditions: 8/5.',
  },
  {
    id: 'cash-flow',
    source: 'Net Worth Positioning draft',
    basis: 'Recurring monthly income less recurring monthly expenses, measured relative to income.',
    formula: 'Savings rate = max(monthly income - monthly expenses, 0) / monthly income',
    scoring: '100/92/84/74/64/52 at savings rate >=35%/25%/18%/10%/5%/0%; fallback 18.',
  },
  {
    id: 'wealth',
    source: 'Net Worth Positioning draft',
    basis: 'The normalized Net Worth Building index across ten wealth components.',
    formula: '22% net worth + 14% liquidity + 14% cash flow + 12% leverage + 10% emergency + 8% investment + 7% retirement + 5% independence + 5% goal + 3% protection',
    scoring: 'Each component is scored from financial ratios, then the weighted result is used directly on the 0-100 vital-sign scale.',
  },
  {
    id: 'budget',
    source: 'Budget & Expense Tracker draft',
    basis: 'Plan completeness, budget variance, savings rate, expense allocation, stable cash-flow months, and saved adjustments.',
    formula: 'Planning (20) + adherence (30) + savings discipline (20) + expense allocation (15) + cash-flow stability (15) + adjustments',
    scoring: 'The result is clamped to 0-100. Actual entries replace planned cash flow when comparable actual income and expense rows exist.',
  },
  {
    id: 'payment',
    source: 'Net Worth Positioning draft',
    basis: 'Debt leverage relative to assets. This measures leverage control, not historical payment behavior.',
    formula: 'Debt-to-asset ratio = total liabilities / total assets',
    scoring: '100/92/84/74/64/52/40 at ratio <=10%/20%/35%/50%/65%/80%/100%; fallback 20.',
  },
  {
    id: 'protection',
    source: 'Net Worth Positioning draft',
    basis: 'Count of populated life, health, HMO, critical illness, accident, disability, property, vehicle, and business insurance entries.',
    formula: 'Coverage ratio = populated insurance categories / 9',
    scoring: '100/88/76/62/48 at coverage >=90%/70%/50%/30%/10%; fallback 30.',
  },
  {
    id: 'investment',
    source: 'Net Worth Positioning draft',
    basis: 'Average of investment readiness, retirement readiness, and financial independence.',
    formula: '(investment readiness + retirement readiness + financial independence) / 3',
    scoring: 'Investment readiness uses investment and retirement assets / total assets; retirement uses retirement assets / annual expenses; independence uses passive income / monthly expenses.',
  },
  {
    id: 'goal',
    source: 'Net Worth Positioning draft',
    basis: 'Projected net worth at the goal date compared with the saved target amount.',
    formula: 'Goal ratio = (net worth + max(monthly cash flow, 0) x target months) / target amount',
    scoring: '100/92/78/66/52/38 at ratio >=110%/100%/80%/60%/40%/20%; fallback 20. A named goal without a target uses 55; no goal uses 45.',
  },
] as const

export const financialHealthMetricSources: readonly FinancialHealthMetricSource[] = [
  {
    label: 'Overall Financial Health',
    source: 'All eight published indicator scores and model weights',
    formula: 'Index = sum(indicator score x weight) / 100; score = round(index x 10)',
  },
  {
    label: 'Foundation & reliability',
    source: 'Credit, Cash Flow, and Payment Health',
    formula: 'sum(component score x component weight) / combined component weight',
  },
  {
    label: 'Control & resilience',
    source: 'Budget, Wealth, and Protection Health',
    formula: 'sum(component score x component weight) / combined component weight',
  },
  {
    label: 'Future progress',
    source: 'Investment and Goal Health',
    formula: 'sum(component score x component weight) / combined component weight',
  },
  {
    label: 'Financial Health Change',
    source: 'Two selected published monthly financial health snapshots',
    formula: 'current-period Financial Health score - comparison-period Financial Health score',
  },
  {
    label: 'Financial Outcome',
    source: 'Financial amounts stored with the two selected monthly snapshots',
    formula: 'current-period amount - comparison-period amount for net worth, net income, and monthly cash flow',
  },
  {
    label: 'Monthly Financial Health Trend',
    source: 'Up to 12 published monthly financial health snapshots',
    formula: 'plot each saved overall, credit, and wealth score in reporting-month order',
  },
  {
    label: 'Benchmarking',
    source: 'Step 9 actual net worth and annualized income plus supplied 2024 WID income-share and wealth metadata for seven countries',
    formula: 'country income concentration rank = descending order of top-10% pre-tax national income share; personal wealth percentile requires WID amount thresholds and remains unavailable when those values are blank',
  },
  {
    label: 'Financial Momentum',
    source: 'Budget Tracker cash-flow history',
    formula: 'Improving at 10-12 stable months; Stable at 6-9; Declining below 6',
  },
  {
    label: 'Financial Resilience',
    source: 'Net Worth Positioning liquid assets and monthly expenses',
    formula: 'emergency-fund months = liquid assets / monthly expenses',
  },
  {
    label: 'Risk Alerts',
    source: 'All eight published indicators',
    formula: 'count indicators with score below the 80-point target',
  },
  {
    label: 'Opportunities',
    source: 'Published indicators below target',
    formula: 'three lowest scores; improvement gap = 80 - indicator score',
  },
  {
    label: 'Strongest vital / Focus next',
    source: 'All eight published indicators',
    formula: 'highest indicator score / lowest indicator score',
  },
] as const