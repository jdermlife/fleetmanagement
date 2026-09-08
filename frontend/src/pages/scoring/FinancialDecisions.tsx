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

type DecisionId = 'affordability' | 'savings' | 'debt' | 'investing' | 'emergency' | 'health' | 'what-if'

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
  const [activeDecision, setActiveDecision] = useState<DecisionId>('affordability')
  const [question, setQuestion] = useState('')
  const result = useMemo(() => computeAffordability(inputs), [inputs])
  const savingsResult = useMemo(() => computeSavingsGoalOptimization(savingsInputs), [savingsInputs])
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
    </main>
  )
}
