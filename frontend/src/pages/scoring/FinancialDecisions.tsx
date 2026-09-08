import { useMemo, useState } from 'react'
import {
  Activity,
  BadgeDollarSign,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  HeartPulse,
  PiggyBank,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'

import SelectedProfileIdCard from '../../components/profile/SelectedProfileIdCard'
import { readReplicatedBuildProfile } from './buildProfileReplication'
import { computeNetWorthBuildingScore } from './netWorthBuildingEngine'
import { computeAffordability, type AffordabilityInputs } from './affordabilityEngine'
import {
  computeSavingsGoalOptimization,
  type SavingsGoalInputs,
} from './savingsGoalOptimizationEngine'
import {
  computeRetirementModel,
  type RetirementModelInputs,
} from './retirementModelEngine'

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

const HYPOTHETICAL_RETIREMENT_INPUTS: RetirementModelInputs = {
  currentAge: 35,
  retirementAge: 60,
  lifeExpectancy: 85,
  currentMonthlyExpenses: 50000,
  retirementSpendingPercent: 80,
  currentRetirementSavings: 1000000,
  monthlyContribution: 20000,
  annualPreRetirementReturn: 7,
  annualPostRetirementReturn: 5,
  annualReturnVolatility: 10,
  inflationRate: 3,
  annualPensionIncome: 120000,
  withdrawalRate: 4,
  annualContributionIncrease: 3,
}

const RETIREMENT_ASSET_KEYS = [
  'asset-retirement-fund',
  'asset-pension-benefits',
  'asset-provident-fund',
  'asset-employer-retirement-plan',
]

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

type DecisionId = 'affordability' | 'savings' | 'debt' | 'investing' | 'emergency' | 'health' | 'what-if'
type RetirementLinkedField = 'currentAge' | 'currentMonthlyExpenses' | 'currentRetirementSavings' | 'monthlyContribution'

type DecisionCard = {
  id: DecisionId
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
  tone: string
}

const DECISION_CARDS: DecisionCard[] = [
  { id: 'affordability', eyebrow: 'Purchase decision', title: 'Can I afford this?', description: 'Test the full monthly cost against cash flow, debt load, and resilience.', icon: BadgeDollarSign, tone: 'cyan' },
  { id: 'savings', eyebrow: 'Goal planning', title: 'How much should I save?', description: 'Quantify the monthly amount and time required to fund your next goal.', icon: PiggyBank, tone: 'teal' },
  { id: 'debt', eyebrow: 'Debt strategy', title: 'Pay debt or invest?', description: 'Compare guaranteed interest savings with your realistic investment return.', icon: WalletCards, tone: 'amber' },
  { id: 'investing', eyebrow: 'Capital allocation', title: 'Where should I invest?', description: 'Balance liquidity, time horizon, and risk before allocating surplus cash.', icon: TrendingUp, tone: 'blue' },
  { id: 'emergency', eyebrow: 'Financial resilience', title: 'Emergency fund', description: 'Measure how many months of essential obligations your reserves can cover.', icon: ShieldCheck, tone: 'green' },
  { id: 'health', eyebrow: 'Financial health', title: 'Am I financially healthy?', description: 'Review cash flow, debt capacity, reserves, and progress in one view.', icon: HeartPulse, tone: 'coral' },
  { id: 'what-if', eyebrow: 'Scenario simulator', title: 'What if...?', description: 'Stress-test a change in income, expenses, rates, or purchase cost.', icon: Activity, tone: 'violet' },
]

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

const RETIREMENT_FIELD_GROUPS: Array<{ title: string; fields: Array<{ key: keyof RetirementModelInputs; label: string; suffix?: string }> }> = [
  {
    title: 'Timeline and Lifestyle',
    fields: [
      { key: 'currentAge', label: 'Current Age', suffix: 'years' },
      { key: 'retirementAge', label: 'Target Retirement Age', suffix: 'years' },
      { key: 'lifeExpectancy', label: 'Planning Life Expectancy', suffix: 'years' },
      { key: 'currentMonthlyExpenses', label: 'Current Monthly Expenses' },
      { key: 'retirementSpendingPercent', label: 'Retirement Spending Need', suffix: '% of current' },
    ],
  },
  {
    title: 'Savings and Income',
    fields: [
      { key: 'currentRetirementSavings', label: 'Current Retirement Savings' },
      { key: 'monthlyContribution', label: 'Monthly Investment' },
      { key: 'annualPensionIncome', label: 'Annual Pension at Retirement' },
      { key: 'annualContributionIncrease', label: 'Annual Contribution Increase', suffix: '%' },
    ],
  },
  {
    title: 'Planning Assumptions',
    fields: [
      { key: 'inflationRate', label: 'Annual Inflation', suffix: '%' },
      { key: 'annualPreRetirementReturn', label: 'Return Before Retirement', suffix: '%' },
      { key: 'annualPostRetirementReturn', label: 'Return During Retirement', suffix: '%' },
      { key: 'annualReturnVolatility', label: 'Expected Volatility', suffix: '%' },
      { key: 'withdrawalRate', label: 'Sustainable Withdrawal Rate', suffix: '%' },
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

function ageFromDateOfBirth(dateOfBirth: string): number {
  const birthDate = new Date(`${dateOfBirth}T00:00:00`)
  if (Number.isNaN(birthDate.getTime())) return 0
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age -= 1
  return Math.max(0, age)
}

function profileRetirementInputs(): { inputs: RetirementModelInputs; usesHypotheticalData: boolean; linkedFields: RetirementLinkedField[] } {
  const profile = readReplicatedBuildProfile()
  if (!profile) return { inputs: HYPOTHETICAL_RETIREMENT_INPUTS, usesHypotheticalData: true, linkedFields: [] }

  const values = profile.values
  const sourceValue = (key: string) => values[`wealthActual.${key}`] ?? values[key]
  const amount = (key: string) => Math.max(0, Number(sourceValue(key) || 0))
  const hasValue = (key: string) => sourceValue(key) !== undefined && sourceValue(key) !== ''
  const currentAge = amount('age') || ageFromDateOfBirth(values.dateOfBirth || '')
  const expenseKeys = Object.keys(values)
    .filter((key) => !key.includes('.') && key.startsWith('expense-'))
  const currentMonthlyExpenses = expenseKeys
    .reduce((total, key) => total + amount(key), 0)
  const currentRetirementSavings = RETIREMENT_ASSET_KEYS.reduce((total, key) => total + amount(key), 0)
  const monthlyContribution = amount('expense-retirement-savings')
  const hasRetirementData = currentAge > 0 || currentMonthlyExpenses > 0 || currentRetirementSavings > 0 || monthlyContribution > 0
  if (!hasRetirementData) return { inputs: HYPOTHETICAL_RETIREMENT_INPUTS, usesHypotheticalData: true, linkedFields: [] }

  const linkedFields: RetirementLinkedField[] = []
  if (hasValue('age') || Boolean(values.dateOfBirth)) linkedFields.push('currentAge')
  if (expenseKeys.some(hasValue) || hasValue('monthlyExpenses')) linkedFields.push('currentMonthlyExpenses')
  if (RETIREMENT_ASSET_KEYS.some(hasValue)) linkedFields.push('currentRetirementSavings')
  if (hasValue('expense-retirement-savings')) linkedFields.push('monthlyContribution')

  return {
    usesHypotheticalData: false,
    linkedFields,
    inputs: {
      ...HYPOTHETICAL_RETIREMENT_INPUTS,
      currentAge: currentAge || HYPOTHETICAL_RETIREMENT_INPUTS.currentAge,
      currentMonthlyExpenses: currentMonthlyExpenses || amount('monthlyExpenses') || HYPOTHETICAL_RETIREMENT_INPUTS.currentMonthlyExpenses,
      currentRetirementSavings,
      monthlyContribution,
      annualPensionIncome: amount('income-pension') * 12,
    },
  }
}

export default function FinancialDecisions() {
  const initial = useMemo(profileInputs, [])
  const initialSavings = useMemo(profileSavingsInputs, [])
  const initialRetirement = useMemo(profileRetirementInputs, [])
  const [inputs, setInputs] = useState(initial.inputs)
  const [usesHypotheticalData, setUsesHypotheticalData] = useState(initial.usesHypotheticalData)
  const [savingsInputs, setSavingsInputs] = useState(initialSavings.inputs)
  const [usesHypotheticalSavings, setUsesHypotheticalSavings] = useState(initialSavings.usesHypotheticalData)
  const [savingsGoalName, setSavingsGoalName] = useState(initialSavings.goalName)
  const [retirementInputs, setRetirementInputs] = useState(initialRetirement.inputs)
  const [usesHypotheticalRetirement, setUsesHypotheticalRetirement] = useState(initialRetirement.usesHypotheticalData)
  const [linkedRetirementFields, setLinkedRetirementFields] = useState(initialRetirement.linkedFields)
  const [activeDecision, setActiveDecision] = useState<DecisionId>('affordability')
  const [question, setQuestion] = useState('')
  const result = useMemo(() => computeAffordability(inputs), [inputs])
  const savingsResult = useMemo(() => computeSavingsGoalOptimization(savingsInputs), [savingsInputs])
  const retirementResult = useMemo(() => computeRetirementModel(retirementInputs), [retirementInputs])
  const emergencyFundMonths = inputs.essentialLivingExpenses + inputs.existingDebtPayments > 0
    ? inputs.emergencyFundBalance / (inputs.essentialLivingExpenses + inputs.existingDebtPayments)
    : 0
  const savingsRate = inputs.netMonthlyIncome > 0
    ? ((inputs.minimumSavingsRequirement + inputs.existingGoalContributions) / inputs.netMonthlyIncome) * 100
    : 0
  const debtRatio = inputs.netMonthlyIncome > 0
    ? (inputs.existingDebtPayments / inputs.netMonthlyIncome) * 100
    : 0
  const updateInput = (key: keyof AffordabilityInputs, value: string) => {
    setUsesHypotheticalData(false)
    setInputs((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }))
  }

  const refreshFromProfile = () => {
    const refreshed = profileInputs()
    const refreshedSavings = profileSavingsInputs()
    const refreshedRetirement = profileRetirementInputs()
    setInputs(refreshed.inputs)
    setUsesHypotheticalData(refreshed.usesHypotheticalData)
    setSavingsInputs(refreshedSavings.inputs)
    setUsesHypotheticalSavings(refreshedSavings.usesHypotheticalData)
    setSavingsGoalName(refreshedSavings.goalName)
    setRetirementInputs(refreshedRetirement.inputs)
    setUsesHypotheticalRetirement(refreshedRetirement.usesHypotheticalData)
    setLinkedRetirementFields(refreshedRetirement.linkedFields)
  }

  const updateSavingsInput = (key: keyof SavingsGoalInputs, value: string) => {
    setUsesHypotheticalSavings(false)
    setSavingsInputs((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }))
  }

  const updateRetirementInput = (key: keyof RetirementModelInputs, value: string) => {
    setUsesHypotheticalRetirement(false)
    setLinkedRetirementFields((current) => current.filter((field) => field !== key))
    setRetirementInputs((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }))
  }

  const openDecision = (decision: DecisionId) => {
    setActiveDecision(decision)
    window.setTimeout(() => {
      const workspace = document.getElementById('financial-decision-workspace')
      if (typeof workspace?.scrollIntoView === 'function') {
        workspace.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 0)
  }

  const askFin = () => {
    const normalized = question.toLowerCase()
    if (/retir|financially independent|financial independence/.test(normalized)) {
      window.setTimeout(() => document.getElementById('retirement-model')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
      return
    }
    const decision: DecisionId = /sav|goal/.test(normalized)
      ? 'savings'
      : /debt|loan|credit/.test(normalized)
        ? 'debt'
        : /invest|portfolio|asset/.test(normalized)
          ? 'investing'
          : /emergency|reserve/.test(normalized)
            ? 'emergency'
            : /health|score|track/.test(normalized)
              ? 'health'
              : /what if|scenario|change/.test(normalized)
                ? 'what-if'
                : 'affordability'
    openDecision(decision)
  }

  const activeCard = DECISION_CARDS.find((card) => card.id === activeDecision) ?? DECISION_CARDS[0]
  const ActiveIcon = activeCard.icon

  return (
    <main className="financial-decisions-page">
      <header className="financial-decisions-header">
        <div>
          <span className="financial-decisions-brand"><Sparkles size={16} aria-hidden="true" /> FIN HEALTH DECISION INTELLIGENCE</span>
          <h1>Financial Decisions</h1>
          <p>Make confident choices with data-driven insights from your financial profile.</p>
        </div>
        <button type="button" className="financial-decisions-profile-button" onClick={refreshFromProfile}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh Profile
        </button>
      </header>

      <section className="financial-snapshot" aria-labelledby="financial-snapshot-title">
        <div className="financial-snapshot-heading">
          <div><span>Live profile</span><h2 id="financial-snapshot-title">Your Financial Snapshot</h2></div>
          <small>{usesHypotheticalData ? 'Illustrative data' : 'Profile data'} · Updated just now</small>
        </div>
        <div className="financial-snapshot-grid">
          <div className="financial-snapshot-record"><span>Selected profile</span><SelectedProfileIdCard compactId label="Record ID" /></div>
          <article><span>Monthly Income</span><strong>{currency.format(inputs.netMonthlyIncome)}</strong><small>Net available income</small></article>
          <article><span>Savings Rate</span><strong>{percent.format(savingsRate)}%</strong><div className="financial-metric-track"><i style={{ width: `${Math.min(100, savingsRate)}%` }} /></div><small>{savingsRate >= 20 ? 'Healthy savings pace' : 'Below the 20% target'}</small></article>
          <article><span>Emergency Fund</span><strong>{percent.format(emergencyFundMonths)} months</strong><div className="financial-metric-track"><i style={{ width: `${Math.min(100, emergencyFundMonths / 6 * 100)}%` }} /></div><small>{emergencyFundMonths >= 6 ? 'Fully resilient' : 'Target: 6 months'}</small></article>
          <article><span>Debt-to-Income</span><strong>{percent.format(debtRatio)}%</strong><div className="financial-metric-track is-amber"><i style={{ width: `${Math.min(100, debtRatio / 50 * 100)}%` }} /></div><small>{debtRatio <= 30 ? 'Within a healthy range' : 'Requires attention'}</small></article>
          <article><span>Financial Health</span><strong>{Math.round(inputs.financialHealthScore)} / 100</strong><div className="financial-metric-track"><i style={{ width: `${inputs.financialHealthScore}%` }} /></div><small>{inputs.financialHealthScore >= 80 ? 'Strong' : inputs.financialHealthScore >= 60 ? 'Stable' : 'Priority'}</small></article>
        </div>
      </section>

      <section className="decision-centre" aria-labelledby="decision-centre-title">
        <div className="decision-centre-heading"><span>Decision centre</span><h2 id="decision-centre-title">What are you deciding today?</h2><p>Select a topic to open a focused calculator and recommendation workspace.</p></div>
        <div className="decision-card-grid">
          {DECISION_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <button key={card.id} type="button" className={`decision-card is-${card.tone} ${activeDecision === card.id ? 'is-active' : ''}`} onClick={() => openDecision(card.id)} aria-pressed={activeDecision === card.id}>
                <span className="decision-card-icon"><Icon size={24} strokeWidth={1.8} aria-hidden="true" /></span>
                <span className="decision-card-copy"><small>{card.eyebrow}</small><strong>{card.title}</strong><span>{card.description}</span></span>
                <ChevronRight className="decision-card-arrow" size={20} aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </section>

      <section className="ask-fin-panel" aria-labelledby="ask-fin-title">
        <div><span><CircleDollarSign size={18} aria-hidden="true" /> Ask FIN</span><h2 id="ask-fin-title">Have a specific question?</h2><p>Describe the decision in plain language and FIN will route you to the right analysis.</p></div>
        <form onSubmit={(event) => { event.preventDefault(); askFin() }}>
          <Search size={19} aria-hidden="true" />
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="e.g. Can I afford a ₱50,000 purchase?" aria-label="Ask FIN a financial question" />
          <button type="submit"><Sparkles size={17} aria-hidden="true" /> Ask FIN</button>
        </form>
      </section>

      <section id="financial-decision-workspace" className="decision-workspace" aria-labelledby="decision-workspace-title">
        <header className="decision-workspace-header">
          <span className={`decision-card-icon is-${activeCard.tone}`}><ActiveIcon size={24} aria-hidden="true" /></span>
          <div><small>{activeCard.eyebrow}</small><h2 id="decision-workspace-title">{activeCard.title}</h2><p>{activeCard.description}</p></div>
        </header>

        {activeDecision === 'affordability' ? (
          <div className="decision-tool-body">
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
        ) : activeDecision === 'savings' ? (
          <div className="decision-tool-body">
            <div className={`affordability-data-notice ${usesHypotheticalSavings ? 'is-hypothetical' : 'is-profile'}`} role="status">
              <strong>{usesHypotheticalSavings ? 'Hypothetical savings data in use' : 'Savings profile data loaded'}</strong>
              <span>{usesHypotheticalSavings ? 'Enter your target and actual savings, or refresh after completing Build Profile.' : `${savingsGoalName} values were loaded from Build Profile and remain editable here.`}</span>
              <button type="button" className="financial-health-journey-main-fab" onClick={refreshFromProfile}><RefreshCw size={15} aria-hidden="true" /> Refresh from Profile</button>
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
        ) : (
          <div className="decision-guidance-grid">
            <article><Gauge size={22} aria-hidden="true" /><span>Current signal</span><strong>{activeDecision === 'debt' ? `${percent.format(debtRatio)}% debt-to-income` : activeDecision === 'emergency' ? `${percent.format(emergencyFundMonths)} months covered` : `${Math.round(inputs.financialHealthScore)} / 100 health score`}</strong><p>Your profile data is used as the baseline for this decision.</p></article>
            <article><TrendingUp size={22} aria-hidden="true" /><span>Recommended approach</span><strong>{activeDecision === 'investing' ? 'Protect liquidity first' : activeDecision === 'what-if' ? 'Change one variable at a time' : 'Address the highest-impact gap'}</strong><p>Compare the result against your savings goals and essential obligations before acting.</p></article>
            <article><WalletCards size={22} aria-hidden="true" /><span>Next action</span><strong>Review your profile assumptions</strong><p>Refresh the profile, verify each figure, then use the affordability or savings calculator for a quantified decision.</p></article>
          </div>
        )}
      </section>

      <section id="retirement-model" className="retirement-model" aria-labelledby="retirement-model-title">
        <header className="retirement-model-header">
          <div className="retirement-model-title">
            <span><ShieldCheck size={18} aria-hidden="true" /> Long-term planning</span>
            <h2 id="retirement-model-title">Retirement Model Engine</h2>
            <p>Connect today&apos;s spending and investments to your retirement income, financial independence date, and plan resilience.</p>
          </div>
          <div className={`retirement-model-source ${usesHypotheticalRetirement ? 'is-hypothetical' : 'is-profile'}`} role="status">
            <strong>{usesHypotheticalRetirement ? 'Planning assumptions in use' : 'Build Profile data loaded'}</strong>
            <button type="button" onClick={refreshFromProfile}><RefreshCw size={15} aria-hidden="true" /> Refresh from Profile</button>
          </div>
        </header>

        <div className="retirement-model-inputs">
          {RETIREMENT_FIELD_GROUPS.map((group) => (
            <fieldset key={group.title}>
              <legend>{group.title}</legend>
              {group.fields.map((field) => (
                <label key={field.key}>
                  <span>{field.label}</span>
                  <div className={linkedRetirementFields.includes(field.key as RetirementLinkedField) ? 'is-profile-linked' : undefined}>
                    <input
                      aria-label={field.label}
                      type="number"
                      min="0"
                      step={field.key.includes('Age') ? '1' : 'any'}
                      value={retirementInputs[field.key]}
                      onChange={(event) => updateRetirementInput(field.key, event.target.value)}
                    />
                    {field.suffix ? <small>{field.suffix}</small> : null}
                  </div>
                </label>
              ))}
            </fieldset>
          ))}
        </div>

        <div className="retirement-model-results" aria-label="Retirement model results">
          <article>
            <span>Retirement Needs Engine</span><h3>How much will I need?</h3>
            <strong>{currency.format(retirementResult.retirementNeeds.monthlyExpensesAtRetirement)} / month</strong>
            <p>{currency.format(retirementResult.retirementNeeds.lifetimeSpending)} estimated spending across {retirementResult.retirementYears} retirement years.</p>
          </article>
          <article>
            <span>Inflation Engine</span><h3>What will that cost in the future?</h3>
            <strong>{currency.format(retirementResult.inflation.futureCostOfCurrentMonthlyExpenses)} / month</strong>
            <p>Current expenses rise {percent.format(retirementResult.inflation.cumulativeIncreasePercent)}% by age {retirementInputs.retirementAge}.</p>
          </article>
          <article>
            <span>Retirement Income Engine</span><h3>How much income will I have?</h3>
            <strong>{currency.format(retirementResult.retirementIncome.totalAnnualIncome)} / year</strong>
            <p>Includes portfolio withdrawals and {currency.format(retirementResult.retirementIncome.annualPensionIncome)} annual pension income.</p>
          </article>
          <article>
            <span>Investment Projection Engine</span><h3>How much can my portfolio grow?</h3>
            <strong>{currency.format(retirementResult.investmentProjection.projectedPortfolioAtRetirement)}</strong>
            <p>{currency.format(retirementResult.investmentProjection.investmentGrowth)} is projected investment growth by retirement.</p>
          </article>
          <article>
            <span>Retirement Corpus Engine</span><h3>How much capital do I need?</h3>
            <strong>{currency.format(retirementResult.retirementCorpus.requiredCorpus)}</strong>
            <p>{percent.format(retirementResult.retirementCorpus.fundingRatioPercent)}% funded with a {currency.format(retirementResult.retirementCorpus.fundingGap)} remaining gap.</p>
          </article>
          <article>
            <span>FI Date Engine</span><h3>When can I become financially independent?</h3>
            <strong>{retirementResult.financialIndependence.age === null ? 'Beyond current projection' : `Age ${percent.format(retirementResult.financialIndependence.age)}`}</strong>
            <p>{retirementResult.financialIndependence.yearsFromNow === null ? 'Increase contributions or adjust the plan.' : `${percent.format(retirementResult.financialIndependence.yearsFromNow)} years from now at the current trajectory.`}</p>
          </article>
          <article>
            <span>Contribution Optimizer</span><h3>How much should I invest monthly?</h3>
            <strong>{currency.format(retirementResult.contributionOptimizer.requiredMonthlyContribution)}</strong>
            <p>{retirementResult.contributionOptimizer.monthlyContributionGap > 0 ? `${currency.format(retirementResult.contributionOptimizer.monthlyContributionGap)} more than your current monthly amount.` : 'Your current monthly amount meets the base projection.'}</p>
          </article>
          <article className="retirement-scenario-result">
            <span>Scenario Engine</span><h3>What happens if things change?</h3>
            <div>{retirementResult.scenarios.map((scenario) => <p key={scenario.id}><b>{scenario.label}</b><strong>{currency.format(scenario.projectedPortfolio)}</strong><small>{percent.format(scenario.fundingRatioPercent)}% funded</small></p>)}</div>
          </article>
          <article className="retirement-monte-carlo-result">
            <span>Stress / Monte Carlo Engine</span><h3>How resilient is my plan?</h3>
            <strong>{percent.format(retirementResult.monteCarlo.successProbabilityPercent)}% · {retirementResult.monteCarlo.resilience}</strong>
            <p>{retirementResult.monteCarlo.trials} market paths. Median ending balance: {currency.format(retirementResult.monteCarlo.medianEndingBalance)}.</p>
            <small>10th to 90th percentile: {currency.format(retirementResult.monteCarlo.percentile10EndingBalance)} to {currency.format(retirementResult.monteCarlo.percentile90EndingBalance)}</small>
          </article>
        </div>
        <p className="retirement-model-disclaimer">Planning projection only. Returns, inflation, pension income, longevity, taxes, and withdrawal needs can differ materially from these assumptions.</p>
      </section>
    </main>
  )
}
