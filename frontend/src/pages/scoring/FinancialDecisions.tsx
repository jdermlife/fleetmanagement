import { useMemo, useState } from 'react'

import SelectedProfileIdCard from '../../components/profile/SelectedProfileIdCard'
import { readReplicatedBuildProfile } from './buildProfileReplication'
import { computeNetWorthBuildingScore } from './netWorthBuildingEngine'
import { computeAffordability, type AffordabilityInputs } from './affordabilityEngine'
import {
  computeSavingsGoalOptimization,
  type SavingsGoalInputs,
} from './savingsGoalOptimizationEngine'

const HYPOTHETICAL_INPUTS: AffordabilityInputs = {
  netMonthlyIncome: 120000,
  essentialLivingExpenses: 48000,
  existingDebtPayments: 12000,
  minimumSavingsRequirement: 12000,
  existingGoalContributions: 8000,
  principalAmount: 800000,
  annualInterestRate: 7.5,
  termMonths: 60,
  monthlyAmortization: 0,
  insurancePerYear: 24000,
  maintenancePerMonth: 4000,
  fuelPerMonth: 7000,
  otherExpensesPerMonth: 2500,
  monthlyBenefit: 5000,
  emergencyFundBalance: 240000,
  financialHealthScore: 72,
  spendingStabilityScore: 70,
  goalImpactPercent: 15,
}

const HYPOTHETICAL_SAVINGS_INPUTS: SavingsGoalInputs = {
  targetSavingsGoal: 500000,
  actualSavings: 100000,
  currentMonthlySavings: 20000,
  targetMonths: 12,
  annualReturnRate: 0,
}

const SAVINGS_ASSET_KEYS = [
  'asset-cash-on-hand',
  'asset-savings-account',
  'asset-time-deposit',
  'asset-foreign-currency-account',
  'asset-digital-wallet',
  'asset-emergency-fund',
]

const ESSENTIAL_EXPENSE_KEYS = [
  'expense-housing', 'expense-utilities', 'expense-groceries', 'expense-transportation',
  'expense-communications', 'expense-internet', 'expense-education', 'expense-childcare',
  'expense-medical', 'expense-household-help', 'expense-family-support', 'expense-insurance-premiums',
  'expense-taxes',
]

const FAQ_ITEMS = [
  { question: 'Am I spending too much?', feature: 'Spending Intelligence', answer: 'Compare category trends against your own three-month baseline. FIN Health can flag increases, recurring subscriptions, and lower-impact cuts without treating every expense as equally discretionary.' },
  { question: 'How much should I save?', feature: 'Smart Savings Planner', answer: 'Start with required reserves and essential obligations, then divide the remaining capacity among emergency savings and dated goals. The appropriate amount depends on your income stability, dependents, debt, and target dates.' },
  { question: 'When can I reach my savings goal?', feature: 'Savings and Goal Optimization Engine', answer: 'Compare the savings target, actual savings, current monthly contribution, and deadline to quantify the required monthly amount and expected completion date.' },
  { question: 'Should I pay off debt or invest?', feature: 'Debt vs. Investment Optimizer', answer: 'Prioritize overdue and high-interest debt, preserve minimum emergency reserves, then compare guaranteed interest savings with realistic risk-adjusted investment returns.' },
  { question: 'How much debt can I safely handle?', feature: 'Debt Capacity Advisor', answer: 'Evaluate total monthly debt payments against net income, post-payment cash flow, emergency reserves, and rate stress. A technically approvable loan may still be financially unsafe.' },
  { question: 'Where should I put my money?', feature: 'Personal Asset Allocation Advisor', answer: 'Allocate cash among near-term reserves, debt reduction, dated goals, and investments according to liquidity needs, risk appetite, and time horizon.' },
  { question: 'Am I financially healthy?', feature: 'Financial Health Intelligence', answer: 'Explain the score through cash flow, savings, debt, emergency funds, investments, retirement readiness, spending discipline, and resilience, then show which actions can improve it.' },
  { question: 'What should I do with my extra money?', feature: 'Surplus Allocation Coach', answer: 'Protect essential reserves first, reduce expensive debt second, then fund priority goals and investments. Keep a reasonable lifestyle allocation so the plan remains sustainable.' },
  { question: 'What happens if...?', feature: 'Financial What-If Simulator', answer: 'Test job loss, income changes, purchases, family changes, inflation, retirement dates, extra debt payments, and investment pauses against cash flow, resilience, and goals.' },
  { question: 'Why am I not getting ahead financially?', feature: 'Financial Progress Diagnosis', answer: 'Trace income growth through spending, debt, savings, investments, and net-worth change to identify where additional earnings are being absorbed.' },
  { question: 'What is my net worth?', feature: 'Net Worth Intelligence', answer: 'Track assets less liabilities, explain period-over-period changes, identify productive and declining assets, and project possible five-, ten-, and twenty-year outcomes.' },
  { question: 'What bills are coming?', feature: 'Financial Obligation Radar', answer: 'Combine recurring bills, subscriptions, loans, cards, insurance, taxes, tuition, and irregular expenses to forecast upcoming obligations and low-balance dates.' },
  { question: 'What subscriptions am I paying for?', feature: 'Subscription Intelligence', answer: 'Identify recurring merchants, monthly equivalents, price increases, and potentially unused services, then rank cancellation opportunities by likely lifestyle impact.' },
  { question: 'When can I become financially independent?', feature: 'Financial Independence / Retirement Simulator', answer: 'Project current assets, monthly investments, inflation, expected returns, and retirement spending. Test lower-income and higher-inflation scenarios before relying on a target retirement date.' },
  { question: 'How much should I have in an emergency fund?', feature: 'Emergency Reserve Planner', answer: 'Base the target on actual essential expenses, debt payments, dependents, insurance exposure, and income stability rather than a generic rule alone.' },
  { question: 'Am I on track?', feature: 'Financial Trajectory Check', answer: 'Evaluate the chain from income and cash flow through debt, savings, investments, net worth, goals, and retirement, highlighting where progress has slowed.' },
  { question: 'What should I prioritize?', feature: 'Top Financial Actions', answer: 'Rank three actions by urgency, financial impact, effort, and time to benefit, with quantified savings or progress wherever the underlying data supports it.' },
] as const

const FIELD_GROUPS: Array<{ title: string; fields: Array<{ key: keyof AffordabilityInputs; label: string; suffix?: string }> }> = [
  {
    title: 'Real Monthly Capacity',
    fields: [
      { key: 'netMonthlyIncome', label: 'Net Monthly Income' },
      { key: 'essentialLivingExpenses', label: 'Essential Living Expenses' },
      { key: 'existingDebtPayments', label: 'Existing Debt Payments' },
      { key: 'minimumSavingsRequirement', label: 'Minimum Savings Requirement' },
      { key: 'existingGoalContributions', label: 'Existing Goal Contributions' },
      { key: 'emergencyFundBalance', label: 'Emergency Fund Balance' },
    ],
  },
  {
    title: 'Proposed Purchase',
    fields: [
      { key: 'principalAmount', label: 'Principal Amount' },
      { key: 'annualInterestRate', label: 'Annual Interest Rate', suffix: '%' },
      { key: 'termMonths', label: 'Term', suffix: 'months' },
      { key: 'monthlyAmortization', label: 'Monthly Amortization (0 = calculate)' },
      { key: 'insurancePerYear', label: 'Insurance per Year' },
      { key: 'maintenancePerMonth', label: 'Maintenance per Month' },
      { key: 'fuelPerMonth', label: 'Fuel Expense per Month' },
      { key: 'otherExpensesPerMonth', label: 'Other Expenses per Month' },
      { key: 'monthlyBenefit', label: 'Quantified Monthly Benefit' },
    ],
  },
  {
    title: 'Decision Factors',
    fields: [
      { key: 'financialHealthScore', label: 'Financial Health', suffix: '/ 100' },
      { key: 'spendingStabilityScore', label: 'Spending Stability', suffix: '/ 100' },
      { key: 'goalImpactPercent', label: 'Goal Impact', suffix: '%' },
    ],
  },
]

const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 })
const percent = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })

function profileInputs(): { inputs: AffordabilityInputs; usesHypotheticalData: boolean } {
  const profile = readReplicatedBuildProfile()
  if (!profile) return { inputs: HYPOTHETICAL_INPUTS, usesHypotheticalData: true }

  const values = profile.values
  const actual = (key: string) => Number(values[`wealthActual.${key}`] || values[key] || 0)
  const sum = (keys: string[]) => keys.reduce((total, key) => total + Math.max(0, actual(key)), 0)
  const incomeKeys = Object.keys(values).filter((key) => !key.includes('.') && key.startsWith('income-'))
  const goalKeys = Object.keys(values).filter((key) => !key.includes('.') && key.startsWith('goal-'))
  const monthlyIncome = sum(incomeKeys) || Number(values.monthlyIncome || values.grossMonthlyIncome || 0)
  const essentialExpenses = sum(ESSENTIAL_EXPENSE_KEYS)
  const debtPayments = sum(['expense-loan-payments', 'expense-credit-card-payments']) || Number(values.debtObligations || 0)
  const savings = sum(['expense-investments', 'expense-retirement-savings', 'goal-emergency-fund'])
  const goals = sum(goalKeys.filter((key) => key !== 'goal-emergency-fund'))
  const wealthInputs = Object.fromEntries(Object.entries(values).filter(([key]) => !key.includes('.')))
  const wealth = computeNetWorthBuildingScore({ amounts: wealthInputs })
  const hasFinancialData = monthlyIncome > 0 || essentialExpenses > 0 || debtPayments > 0

  if (!hasFinancialData) return { inputs: HYPOTHETICAL_INPUTS, usesHypotheticalData: true }

  return {
    usesHypotheticalData: false,
    inputs: {
      ...HYPOTHETICAL_INPUTS,
      netMonthlyIncome: monthlyIncome,
      essentialLivingExpenses: essentialExpenses || wealth.metrics.monthlyExpenses,
      existingDebtPayments: debtPayments,
      minimumSavingsRequirement: savings,
      existingGoalContributions: goals,
      principalAmount: Number(values.requestedAmount || values.loanAmount || HYPOTHETICAL_INPUTS.principalAmount),
      annualInterestRate: Number(values.interestRate || HYPOTHETICAL_INPUTS.annualInterestRate),
      termMonths: Number(values.loanTerm || values.termMonths || HYPOTHETICAL_INPUTS.termMonths),
      monthlyAmortization: Number(values.loanMonthlyAmortization || 0),
      insurancePerYear: sum(['insurance-vehicle', 'insurance-property']),
      fuelPerMonth: actual('expense-fuel'),
      emergencyFundBalance: actual('asset-emergency-fund'),
      financialHealthScore: wealth.normalizedScore,
      spendingStabilityScore: Math.max(0, Math.min(100, 100 - Math.abs(wealth.metrics.savingsRatePercent - 20))),
    },
  }
}

function profileSavingsInputs(): { inputs: SavingsGoalInputs; usesHypotheticalData: boolean; goalName: string } {
  const profile = readReplicatedBuildProfile()
  if (!profile) return { inputs: HYPOTHETICAL_SAVINGS_INPUTS, usesHypotheticalData: true, goalName: 'Savings goal' }

  const values = profile.values
  const amount = (key: string) => Math.max(0, Number(values[key] || 0))
  const targetSavingsGoal = amount('targetAmount')
  const actualSavings = SAVINGS_ASSET_KEYS.reduce((total, key) => total + amount(key), 0)
  const currentMonthlySavings = Object.keys(values)
    .filter((key) => !key.includes('.') && key.startsWith('goal-'))
    .reduce((total, key) => total + amount(key), 0)
    + amount('expense-investments')
    + amount('expense-retirement-savings')
  const hasSavingsData = targetSavingsGoal > 0 || actualSavings > 0 || currentMonthlySavings > 0

  if (!hasSavingsData) {
    return { inputs: HYPOTHETICAL_SAVINGS_INPUTS, usesHypotheticalData: true, goalName: 'Savings goal' }
  }

  return {
    usesHypotheticalData: false,
    goalName: values.financialGoal?.trim() || 'Savings goal',
    inputs: {
      targetSavingsGoal,
      actualSavings,
      currentMonthlySavings,
      targetMonths: Math.max(1, Math.round(amount('targetMonths') || 12)),
      annualReturnRate: 0,
    },
  }
}

export default function FinancialDecisions() {
  const initial = useMemo(profileInputs, [])
  const initialSavings = useMemo(profileSavingsInputs, [])
  const [inputs, setInputs] = useState(initial.inputs)
  const [usesHypotheticalData, setUsesHypotheticalData] = useState(initial.usesHypotheticalData)
  const [savingsInputs, setSavingsInputs] = useState(initialSavings.inputs)
  const [usesHypotheticalSavings, setUsesHypotheticalSavings] = useState(initialSavings.usesHypotheticalData)
  const [savingsGoalName, setSavingsGoalName] = useState(initialSavings.goalName)
  const result = useMemo(() => computeAffordability(inputs), [inputs])
  const savingsResult = useMemo(() => computeSavingsGoalOptimization(savingsInputs), [savingsInputs])

  const updateInput = (key: keyof AffordabilityInputs, value: string) => {
    setUsesHypotheticalData(false)
    setInputs((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }))
  }

  const refreshFromProfile = () => {
    const refreshed = profileInputs()
    const refreshedSavings = profileSavingsInputs()
    setInputs(refreshed.inputs)
    setUsesHypotheticalData(refreshed.usesHypotheticalData)
    setSavingsInputs(refreshedSavings.inputs)
    setUsesHypotheticalSavings(refreshedSavings.usesHypotheticalData)
    setSavingsGoalName(refreshedSavings.goalName)
  }

  const updateSavingsInput = (key: keyof SavingsGoalInputs, value: string) => {
    setUsesHypotheticalSavings(false)
    setSavingsInputs((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }))
  }

  return (
    <div className="psychometric-page affordability-page">
      <section className="psychometric-hero affordability-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">FIN Health Decision Intelligence</span>
          <h1>Ask FIN</h1>
          <p>Open a question to explore the financial engine, assumptions, and practical next actions behind the answer.</p>
        </div>
        <div className="affordability-hero-score" aria-label={`Affordability score ${result.score} out of 100`}>
          <span>Affordability</span>
          <strong>{result.score}</strong>
          <small>{result.recommendation}</small>
        </div>
      </section>

      <section className="financial-health-profile-line" aria-label="Affordability profile context">
        <SelectedProfileIdCard className="financial-health-summary-tile financial-health-summary-tile-primary" compactId label="Record ID" />
        <article className="financial-health-summary-tile"><span>Available Capacity</span><strong>{currency.format(result.availableFinancialCapacity)}</strong><small>Before the proposed purchase</small></article>
        <article className="financial-health-summary-tile"><span>Net New Payment</span><strong>{currency.format(result.netMonthlyPayment)}</strong><small>Ownership costs less quantified benefit</small></article>
        <article className="financial-health-summary-tile"><span>Payment Burden</span><strong>{percent.format(result.paymentBurdenPercent)}%</strong><small>Existing debt plus new payment / income</small></article>
      </section>

      <section className="affordability-faq" aria-labelledby="ask-fin-questions">
        <div className="affordability-faq-heading">
          <div><span>Frequently Asked Questions</span><h2 id="ask-fin-questions">What would you like to know about your finances?</h2></div>
          <p>Answers remain hidden until you open a question.</p>
        </div>

        <details className="affordability-question affordability-question-primary">
          <summary><span>1</span><strong>Can I afford this?</strong><small>Affordability Engine and AI Recommendations</small></summary>
          <div className="affordability-answer">
            <div className={`affordability-data-notice ${usesHypotheticalData ? 'is-hypothetical' : 'is-profile'}`} role="status">
              <strong>{usesHypotheticalData ? 'Hypothetical data in use' : 'Profile data loaded'}</strong>
              <span>{usesHypotheticalData ? 'Replace these assumptions with your actual figures for a personal result.' : 'Review and adjust any values before relying on the result.'}</span>
              <button type="button" className="financial-health-journey-main-fab" onClick={refreshFromProfile}>Refresh from Profile</button>
            </div>

            <div className="affordability-input-groups">
              {FIELD_GROUPS.map((group) => (
                <fieldset key={group.title} className="affordability-input-group">
                  <legend>{group.title}</legend>
                  {group.fields.map((field) => (
                    <label key={field.key}>
                      <span>{field.label}</span>
                      <div><input type="number" min="0" step="any" value={inputs[field.key]} onChange={(event) => updateInput(field.key, event.target.value)} />{field.suffix ? <small>{field.suffix}</small> : null}</div>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>

            <section className="affordability-result" aria-label="Affordability result">
              <div className="affordability-result-score"><span>Final Recommendation</span><strong>{result.score}/100</strong><p>{result.recommendation}</p></div>
              <dl className="affordability-capacity-flow">
                <div><dt>Calculated amortization</dt><dd>{currency.format(result.calculatedMonthlyAmortization)}</dd></div>
                <div><dt>Total monthly payment</dt><dd>{currency.format(result.totalMonthlyPayment)}</dd></div>
                <div><dt>Less monthly benefit</dt><dd>-{currency.format(inputs.monthlyBenefit)}</dd></div>
                <div><dt>Net monthly payment</dt><dd>{currency.format(result.netMonthlyPayment)}</dd></div>
                <div><dt>Post-purchase capacity</dt><dd className={result.postPurchaseCapacity < 0 ? 'is-negative' : ''}>{currency.format(result.postPurchaseCapacity)}</dd></div>
              </dl>
            </section>

            <section className="affordability-score-components" aria-labelledby="affordability-score-title">
              <h3 id="affordability-score-title">Affordability Score Composition</h3>
              {result.components.map((component) => (
                <div key={component.id}><span>{component.label} · {component.weight}%</span><progress max="100" value={component.score}>{component.score}</progress><strong>{Math.round(component.score)}</strong></div>
              ))}
            </section>

            <section className="affordability-stress-grid" aria-label="Affordability stress tests">
              {result.stressScenarios.map((scenario) => (
                <article key={scenario.id} className={`affordability-stress-card is-${scenario.id}`}>
                  <span>{scenario.label}</span><strong>{currency.format(scenario.capacity)}</strong><small>{percent.format(scenario.capacityPercent)}% of scenario income</small><p>{scenario.status}</p>
                  {scenario.resilienceMonthsAfterDeficit !== null ? <small>Emergency fund covers {percent.format(scenario.resilienceMonthsAfterDeficit)} months of this deficit.</small> : null}
                </article>
              ))}
            </section>

            <section className="affordability-rules-recommendations">
              <div><h3>Hard Safety Rules</h3><ul>{result.hardRules.map((rule) => <li key={rule.id} className={rule.triggered ? 'is-triggered' : 'is-clear'}><strong>{rule.triggered ? 'Action required' : 'Clear'}</strong>{rule.message}</li>)}</ul></div>
              <div><h3>AI Recommendations</h3><ol>{result.aiRecommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ol></div>
            </section>
            <p className="affordability-disclaimer">Decision support only. Results depend on the accuracy of the inputs and are not a lending approval or financial guarantee.</p>
          </div>
        </details>

        {FAQ_ITEMS.map((item, index) => {
          const itemNumber = index + 2
          if (itemNumber === 3) {
            return (
              <details key={item.question} className="affordability-question affordability-question-savings">
                <summary><span>{itemNumber}</span><strong>{item.question}</strong><small>{item.feature}</small></summary>
                <div className="affordability-answer">
                  <div className={`affordability-data-notice ${usesHypotheticalSavings ? 'is-hypothetical' : 'is-profile'}`} role="status">
                    <strong>{usesHypotheticalSavings ? 'Hypothetical savings data in use' : 'Savings profile data loaded'}</strong>
                    <span>{usesHypotheticalSavings ? 'Enter your target and actual savings, or refresh after completing Build Profile.' : `${savingsGoalName} values were loaded from Build Profile and remain editable here.`}</span>
                    <button type="button" className="financial-health-journey-main-fab" onClick={refreshFromProfile}>Refresh from Profile</button>
                  </div>

                  <div className="savings-optimizer-layout">
                    <fieldset className="affordability-input-group savings-optimizer-inputs">
                      <legend>Savings Calculator</legend>
                      <label><span>Target Savings Goal</span><div><input aria-label="Target Savings Goal" type="number" min="0" step="any" value={savingsInputs.targetSavingsGoal} onChange={(event) => updateSavingsInput('targetSavingsGoal', event.target.value)} /></div></label>
                      <label><span>Actual Savings</span><div><input aria-label="Actual Savings" type="number" min="0" step="any" value={savingsInputs.actualSavings} onChange={(event) => updateSavingsInput('actualSavings', event.target.value)} /></div></label>
                      <label><span>Current Monthly Savings</span><div><input aria-label="Current Monthly Savings" type="number" min="0" step="any" value={savingsInputs.currentMonthlySavings} onChange={(event) => updateSavingsInput('currentMonthlySavings', event.target.value)} /></div></label>
                      <label><span>Target Timeline</span><div><input aria-label="Target Timeline" type="number" min="1" step="1" value={savingsInputs.targetMonths} onChange={(event) => updateSavingsInput('targetMonths', event.target.value)} /><small>months</small></div></label>
                      <label><span>Expected Annual Return</span><div><input aria-label="Expected Annual Return" type="number" min="0" step="0.1" value={savingsInputs.annualReturnRate} onChange={(event) => updateSavingsInput('annualReturnRate', event.target.value)} /><small>%</small></div></label>
                    </fieldset>

                    <section className="savings-optimizer-results" aria-label="Savings optimization result">
                      <div className="savings-optimizer-status"><span>{savingsGoalName}</span><strong>{savingsResult.status}</strong><progress max="100" value={savingsResult.progressPercent}>{savingsResult.progressPercent}</progress><small>{percent.format(savingsResult.progressPercent)}% funded</small></div>
                      <dl className="affordability-capacity-flow">
                        <div><dt>Remaining savings gap</dt><dd>{currency.format(savingsResult.savingsGap)}</dd></div>
                        <div><dt>Monthly amount needed</dt><dd>{currency.format(savingsResult.monthlyAmountNeeded)}</dd></div>
                        <div><dt>Months required at current pace</dt><dd>{savingsResult.monthsRequired === null ? 'Not reachable' : `${savingsResult.monthsRequired} months`}</dd></div>
                        <div><dt>Projected savings at deadline</dt><dd>{currency.format(savingsResult.projectedSavingsAtTarget)}</dd></div>
                        <div><dt>Additional monthly amount needed</dt><dd>{currency.format(savingsResult.monthlyAdjustment)}</dd></div>
                      </dl>
                      <div className="savings-optimizer-recommendations"><h3>Optimization Actions</h3><ul>{savingsResult.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ul></div>
                    </section>
                  </div>
                  <p className="affordability-disclaimer">Projections assume contributions are made monthly and any entered return remains constant. Actual returns and timing may differ.</p>
                </div>
              </details>
            )
          }

          return (
            <details key={item.question} className="affordability-question">
              <summary><span>{itemNumber}</span><strong>{item.question}</strong><small>{item.feature}</small></summary>
              <div className="affordability-answer affordability-compact-answer"><h3>{item.feature}</h3><p>{item.answer}</p></div>
            </details>
          )
        })}
      </section>
    </div>
  )
}
