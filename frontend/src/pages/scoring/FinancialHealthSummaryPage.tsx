import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'

import {
  createProfileHistory,
  getErrorMessage,
  listProfileHistory,
} from '../../api'
import { fetchAutosaveDraft } from '../../autosave/draftApi'
import SelectedProfileIdCard from '../../components/profile/SelectedProfileIdCard'
import { useAuthorization } from '../../hooks/useAuthorization'
import { useSelectedAnalysisEntity } from '../../hooks/useSelectedAnalysisEntity'
import { calculateAndSaveMonthlyProfile } from '../../services/profilemonthlysnapshotcalculator'

import {
  buildFinancialHealthGroupRings,
  calculateWeightedContribution,
  getFinancialHealthBand,
} from './financialHealthModel'
import {
  computeFinancialHealthSummary,
  type FinancialHealthSummaryInputs,
} from './financialHealthSummaryEngine'
import {
  financialHealthIndicatorSources,
  financialHealthMetricSources,
} from './financialHealthComputationSources'
import { FINANCIAL_HEALTH_TOOL_RECOMMENDATIONS } from './financialHealthToolRecommendations'
import { toFilscore } from './filscoreScale'
import {
  computeNetWorthBuildingScore,
  type NetWorthBuildingDraftInput,
  type NetWorthBuildingScoreResult,
} from './netWorthBuildingEngine'
import {
  computeWealthFoundationScore,
  type WealthFoundationScoreResult,
} from './wealthFoundationEngine'
import { readReplicatedBuildProfile } from './buildProfileReplication'
import {
  computeBudgetHealthScore,
  type BudgetHealthDraftInput,
  type BudgetHealthScoreResult,
} from './budgetHealthEngine'
import type { BillPaymentHealthBiller } from './billPaymentHealthEngine'
import type { LoanMonitoringScoreResult } from './loanMonitoringScoreEngine'
import { computePhilippineIncomeBenchmark, countryCodeFromCitizenship } from './widBenchmarkEngine'
import {
  buildFinancialHealthSnapshotPayload,
  currentReportingMonth,
  formatReportingMonth,
  parseFinancialHealthSnapshot,
  reportingMonthEnd,
  type FinancialHealthSnapshot,
} from './financialHealthSnapshots'

type IndicatorStyle = CSSProperties & {
  '--health-accent': string
  '--health-soft': string
}

type LendingLeafScores = {
  creditScore: number | null
  psychometricScore: number | null
  socialScore: number | null
  nonStarterScore: number | null
  monthlyIncome: number
  monthlyDebtCommitments: number
  parsedDocumentCount: number
  totalDocumentCount: number
}

type PositionRingRecommendation = {
  summary: string
  actions: string[]
}

type LendingLeafSegment = {
  id: 'credit' | 'psychometric' | 'social' | 'nonStarter'
  label: string
  score: number | null
  filscore: number | null
  path: string
  fill: string
}

type JourneyStepId = 'createProfile' | 'creditHealth' | 'wealthBuilder' | 'budgetTargets' | 'billsLoans' | 'billManager'

type JourneyStep = {
  id: JourneyStepId
  label: string
  launchLabel: string
  route: string
  description: string
}

type JourneyDetailId = JourneyStepId | 'financialHealth'

type JourneyDetail = {
  title: string
  points: string[]
}

type BenchmarkContext = {
  countryCode: string
  currency: string
  monthlyIncome: number
  netWorth: number
  dependents: number
}
type Step8ProfileMetrics = {
  actualNetWorth: number
  netIncome: number
  protectionLevelAmount: number
}

type MonthlySnapshotDrafts = {
  profileData: Record<string, unknown>
  profileId?: string
  netWorth: (NetWorthBuildingDraftInput & {
    suitabilityAnswers?: Record<string, number>
    actualEntries?: Record<string, string | number | undefined>
  }) | null
  budget: BudgetHealthDraftInput
  billReminder: {
    draftBillers?: BillPaymentHealthBiller[]
    savedSetup?: BillPaymentHealthBiller[]
    paymentEntries?: Record<string, Array<{ datePaid?: string; amountPaid?: string | number }>>
  } | null
  loanMonitoring: { publishedScore?: LoanMonitoringScoreResult } | null
}

type InvestmentSuitabilityRisk = {
  outsideRiskAppetite: string[]
  profile: 'Risk Averse' | 'Conservative' | 'Moderate' | 'Aggressive' | 'Pending'
}

type VitalGuidance = {
  positive: string
  negative: string
  recommendation: string
}

type RecommendedProduct = {
  name: string
  outcome: string
  marketExamples: string
}

type FinancialHealthTrendPoint = {
  period: string
  healthScore: number
  creditHealth: number
  wealthBuilding: number
}

type FinancialHealthTrendSeries = {
  id: 'healthScore' | 'creditHealth' | 'wealthBuilding'
  label: string
  color: string
  value: (point: FinancialHealthTrendPoint) => number
  plotValue: (point: FinancialHealthTrendPoint) => number
}

const VITAL_GUIDANCE: Record<string, VitalGuidance> = {
  credit: {
    positive: 'Your credit capacity and lending profile are strong.',
    negative: 'Credit capacity or lending-profile gaps may limit approval options.',
    recommendation: 'Pay obligations on time, reduce debt balances, and keep identification and income records current.',
  },
  'cash-flow': {
    positive: 'Your income currently provides a healthy cushion after expenses.',
    negative: 'Your monthly income has limited room after recurring expenses.',
    recommendation: 'Review recurring costs and direct part of each income payment to savings before discretionary spending.',
  },
  wealth: {
    positive: 'Your assets, liquidity, and liabilities form a solid wealth base.',
    negative: 'Your current assets and liabilities leave room to strengthen net worth.',
    recommendation: 'Build liquid savings, reduce high-cost liabilities, and add consistently to long-term assets.',
  },
  budget: {
    positive: 'Your plan and actual spending are aligned with healthy targets.',
    negative: 'Budget gaps or spending variance are weakening financial control.',
    recommendation: 'Set category limits, record actual expenses weekly, and adjust any category that repeatedly exceeds plan.',
  },
  payment: {
    positive: 'Your debt level is manageable relative to your assets.',
    negative: 'Debt leverage is high enough to reduce your financial flexibility.',
    recommendation: 'Prioritize high-interest balances and avoid adding new debt until leverage improves.',
  },
  protection: {
    positive: 'Your insurance coverage provides broad protection against major financial shocks.',
    negative: 'Important insurance coverage gaps may expose your savings and income.',
    recommendation: 'Review life, health, disability, property, and other relevant coverage, starting with the largest uninsured risk.',
  },
  investment: {
    positive: 'Your investments, retirement preparation, and passive income are progressing well.',
    negative: 'Investment and retirement readiness are below the recommended level.',
    recommendation: 'Automate a sustainable monthly contribution and review diversification and retirement targets regularly.',
  },
  goal: {
    positive: 'Your projected progress is on track for your saved financial goal.',
    negative: 'Your current pace may not reach the saved goal by its target date.',
    recommendation: 'Increase the monthly goal contribution, extend the timeline, or revise the target to a realistic amount.',
  },
}

const RECOMMENDED_PRODUCTS: Record<string, RecommendedProduct> = {
  credit: {
    name: 'Credit Health Builder',
    outcome: 'Strengthen credit readiness and improve access to suitable financing options.',
    marketExamples: 'Secured credit card or credit-builder loan',
  },
  'cash-flow': {
    name: 'Cash Flow Planner',
    outcome: 'Create more room for savings and recurring goal contributions.',
    marketExamples: 'High-yield savings account with automatic transfers',
  },
  wealth: {
    name: 'Wealth Builder',
    outcome: 'Grow net worth through a balanced assets, savings, and liabilities plan.',
    marketExamples: 'Low-cost diversified index fund or retirement account',
  },
  budget: {
    name: 'Budget & Expense Tracker',
    outcome: 'Align monthly spending with savings and investment targets.',
    marketExamples: 'Budgeting app or account with spending controls',
  },
  payment: {
    name: 'Debt Optimization',
    outcome: 'Prioritize costly balances and improve payment capacity.',
    marketExamples: 'Debt-consolidation loan or balance-transfer card',
  },
  protection: {
    name: 'Protection Gap Review',
    outcome: 'Identify insurance gaps that could put financial goals at risk.',
    marketExamples: 'Term life, health, disability, property, or vehicle insurance',
  },
  investment: {
    name: 'Investment Readiness Plan',
    outcome: 'Build consistent, risk-aligned contributions toward long-term goals.',
    marketExamples: 'Low-cost diversified fund or regulated retirement plan',
  },
  goal: {
    name: 'Goal Achievement Plan',
    outcome: 'Set a realistic target, contribution amount, and completion timeline.',
    marketExamples: 'High-yield savings account, time deposit, or target-date fund',
  },
}

function indicatorRating(score: number): { label: string; explanation: string } {
  if (score >= 80) return { label: 'Strong', explanation: 'At or above the current 80-point health target.' }
  if (score >= 60) return { label: 'Watch', explanation: 'Below target; steady improvement can reduce this risk.' }
  return { label: 'Priority', explanation: 'Materially below target and should be reviewed first.' }
}

const FINANCIAL_HEALTH_TREND_SERIES: readonly FinancialHealthTrendSeries[] = [
  {
    id: 'healthScore',
    label: 'Financial Health Score',
    color: '#0f766e',
    value: (point) => point.healthScore,
    plotValue: (point) => point.healthScore / 10,
  },
  {
    id: 'creditHealth',
    label: 'Credit Health',
    color: '#5856d6',
    value: (point) => point.creditHealth,
    plotValue: (point) => point.creditHealth,
  },
  {
    id: 'wealthBuilding',
    label: 'Wealth Building Score',
    color: '#d4a017',
    value: (point) => point.wealthBuilding,
    plotValue: (point) => point.wealthBuilding,
  },
]

const TREND_CHART_WIDTH = 720
const TREND_CHART_HEIGHT = 286
const TREND_CHART_LEFT = 52
const TREND_CHART_RIGHT = 694
const TREND_CHART_TOP = 24
const TREND_CHART_BOTTOM = 238
const FINANCIAL_HEALTH_RING_LEGEND = [
  'Gold · Foundation',
  'Silver · Controls',
  'Bronze · Future',
] as const
const FINANCIAL_HEALTH_RING_STROKES = [
  'url(#financial-health-ring-gold)',
  'url(#financial-health-ring-silver)',
  'url(#financial-health-ring-bronze)',
] as const

function trendChartX(index: number, count: number): number {
  return TREND_CHART_LEFT + (index * (TREND_CHART_RIGHT - TREND_CHART_LEFT)) / Math.max(count - 1, 1)
}

function trendChartY(value: number): number {
  return TREND_CHART_BOTTOM - (clampScore(value) / 100) * (TREND_CHART_BOTTOM - TREND_CHART_TOP)
}

function trendSeriesPath(series: FinancialHealthTrendSeries, points: readonly FinancialHealthTrendPoint[]): string {
  return points.map((point, index) => {
    const command = index === 0 ? 'M' : 'L'
    return `${command}${trendChartX(index, points.length)} ${trendChartY(series.plotValue(point))}`
  }).join(' ')
}

const FINANCIAL_HEALTH_JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 'createProfile',
    label: '1.Personalize',
    launchLabel: 'Create / Update Profile',
    route: '/build-profile',
    description:
      'Create your financial profile first so each health score and recommendation can use your information.',
  },
  {
    id: 'creditHealth',
    label: '2.  Loan & Wealth Ready?',
    launchLabel: 'Launch Credit Health',
    route: '/lending-scorecard',
    description:
      'Launch the Credit Health section and complete your personal profile to improve score precision.',
  },
  {
    id: 'wealthBuilder',
    label: '3. Growth Ready?',
    launchLabel: 'Launch Wealth Builder',
    route: '/net-worth-positioning',
    description:
      'Define long-term goals, complete your initial net worth profile, and record your assets and liabilities.',
  },
  {
    id: 'budgetTargets',
    label: '4. Budget Ready?',
    launchLabel: 'Budget & Expense Tracker',
    route: '/budget-expense-tracker',
    description:
      'Set monthly income, spending limits, savings goals, and investment targets to track progress accurately.',
  },
  {
    id: 'billsLoans',
    label: '5. Resource Ready?',
    launchLabel: 'Resource Optimizer',
    route: '/loan-monitoring',
    description:
      'Enter loans and credit obligations to get optimization recommendations.',
  },
  {
    id: 'billManager',
    label: '6. Bill Managed Ready?',
    launchLabel: 'Manage Bills',
    route: '/bill-reminder',
    description:
      'Manage your bills.',
  },
]

const FINANCIAL_HEALTH_JOURNEY_DETAILS: Record<JourneyDetailId, JourneyDetail> = {
  createProfile: {
    title: 'Create / Update Profile',
    points: [
      'Complete the 12-step workflow form to establish your Financial Health Summary.',
      'Enter zero, none, or not applicable where relevant.',
      'A completion percentage is displayed in the main dashboard.',
      'Each step is color-coded to highlight progress and pending items.',
    ],
  },
  creditHealth: {
    title: 'Credit Health',
    points: [
      'Derived from Credit Score, Non-Starter Score, Social Score, and Psychometric Score.',
      'Goes beyond numbers by reflecting reputation, reliability, and financial trustworthiness.',
      'Indicates the likelihood of loan approval and highlights areas for improvement.',
    ],
  },
  wealthBuilder: {
    title: 'Composite Wealth Score',
    points: [
      'Combines Net Worth Positioning, Wealth Behaviour, Wealth Foundation, and Wealth Authenticity.',
      'Answers: Where am I today?',
      'Answers: Why am I here?',
      'Answers: Where am I going?',
      'Answers: What should I do next?',
    ],
  },
  budgetTargets: {
    title: 'Budget & Expense Tracker',
    points: [
      'Guides budget setup and regular updates of actual expenses.',
      'Captures both financial discipline and behavioral patterns.',
      'Directly contributes to the Financial Health Score.',
    ],
  },
  billsLoans: {
    title: 'Resources Performance Oversight',
    points: [
      'Measures how Debt, Cash, and Collateral are optimized.',
      'Covers loan setup and loan statement management.',
      'Includes collateral tracking linked to the Profile section.',
      'Provides visibility into resource efficiency and risk exposure.',
    ],
  },
  billManager: {
    title: 'Bill Manager',
    points: [
      'Enables payment reminders and monitoring of billing cycles.',
      'Reduces missed payments and strengthens financial reliability.',
      'Integrates seamlessly into the Financial Health Scorecard.',
    ],
  },
  financialHealth: {
    title: 'Financial Health',
    points: [
      'Provides an overall assessment of financial stability and resilience.',
      'Captures Stability & Reliability, Control & Resilience, and Future Progress.',
      'Shows what your financial health is today.',
      'Shows how your income compares to your work.',
      'Highlights the risks and opportunities that lie ahead.',
    ],
  },
}

const JOURNEY_MINIMIZED_STORAGE_KEY = 'fms:journey:minimized'
const JOURNEY_DO_NOT_SHOW_STORAGE_KEY = 'fms:journey:do-not-show'
const DEFAULT_FINANCIAL_HEALTH_SUMMARY = computeFinancialHealthSummary()

function safeStorageGet(key: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const storage = window.localStorage as Partial<Storage> | undefined
  if (!storage || typeof storage.getItem !== 'function') {
    return null
  }

  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return
  }

  const storage = window.localStorage as Partial<Storage> | undefined
  if (!storage || typeof storage.setItem !== 'function') {
    return
  }

  try {
    storage.setItem(key, value)
  } catch {
    // Ignore storage write failures.
  }
}

function safeStorageRemove(key: string): void {
  if (typeof window === 'undefined') {
    return
  }

  const storage = window.localStorage as Partial<Storage> | undefined
  if (!storage || typeof storage.removeItem !== 'function') {
    return
  }

  try {
    storage.removeItem(key)
  } catch {
    // Ignore storage removal failures.
  }
}

const healthBands = [
  { label: 'Excellent', range: '840–1000', className: 'financial-health-band-excellent' },
  { label: 'Very Good', range: '760–839', className: 'financial-health-band-healthy' },
  { label: 'Good', range: '680–759', className: 'financial-health-band-good' },
  { label: 'Fair', range: '600–679', className: 'financial-health-band-building' },
  { label: 'Needs Attention', range: 'Below 600', className: 'financial-health-band-attention' },
] as const

function indicatorStyle(accent: string, softAccent: string): IndicatorStyle {
  return {
    '--health-accent': accent,
    '--health-soft': softAccent,
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function blendChannel(start: number, end: number, ratio: number): number {
  return Math.round(start + (end - start) * ratio)
}

function scoreTone(score: number | null, alpha = 1): string {
  if (score === null) {
    return `rgba(134, 239, 172, ${alpha})`
  }

  const normalized = clampScore(score) / 100
  const start = { red: 239, green: 68, blue: 68 }
  const middle = { red: 220, green: 252, blue: 231 }
  const end = { red: 34, green: 197, blue: 94 }

  const from = normalized < 0.5 ? start : middle
  const to = normalized < 0.5 ? middle : end
  const ratio = normalized < 0.5 ? normalized / 0.5 : (normalized - 0.5) / 0.5

  return `rgba(${blendChannel(from.red, to.red, ratio)}, ${blendChannel(from.green, to.green, ratio)}, ${blendChannel(from.blue, to.blue, ratio)}, ${alpha})`
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false
  }

  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.some((entry) => hasMeaningfulValue(entry))
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((entry) => hasMeaningfulValue(entry))
  }

  return false
}

function averageScore(values: Array<number | null | undefined>): number {
  const validValues = values.filter((value): value is number => typeof value === 'number')
  if (validValues.length === 0) {
    return 0
  }

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length
}

function mapEducationScore(education: string): number {
  switch (education.trim().toLowerCase()) {
    case 'post graduate':
    case 'postgraduate':
      return 95
    case 'college':
    case 'college graduate':
      return 85
    case 'vocational':
      return 72
    case 'high school':
      return 65
    case 'elementary':
      return 50
    default:
      return 40
  }
}

function psychometricResponseToPoints(response: string): number {
  switch (response) {
    case 'Strongly Agree':
      return 5
    case 'Agree':
      return 4
    case 'Neutral':
      return 3
    case 'Disagree':
      return 2
    case 'Strongly Disagree':
      return 1
    default:
      return 0
  }
}

function derivePsychometricScore(application: Record<string, unknown>): number | null {
  const assessment = application.psychometricAssessment
  if (assessment && typeof assessment === 'object') {
    const values = Object.values(assessment).map((response) => psychometricResponseToPoints(textValue(response)))
    const answeredValues = values.filter((value) => value > 0)
    if (answeredValues.length > 0) {
      return Math.round((averageScore(answeredValues) / 5) * 100)
    }
  }

  const legacyQuestionnaire = application.optionalPsychometricQuestionnaire
  if (legacyQuestionnaire && typeof legacyQuestionnaire === 'object') {
    const values = Object.values(legacyQuestionnaire).map((response) => psychometricResponseToPoints(textValue(response)))
    const answeredValues = values.filter((value) => value > 0)
    if (answeredValues.length > 0) {
      return Math.round((averageScore(answeredValues) / 5) * 100)
    }
  }

  return null
}

function deriveLendingLeafScores(payload: unknown): LendingLeafScores | null {
  const applicationContainer = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null
  const application = applicationContainer?.formData
  if (!application || typeof application !== 'object') {
    return null
  }

  const loanApplication = application as Record<string, unknown>
  const borrower = (loanApplication.borrower as Record<string, unknown> | undefined) ?? {}
  const contactInformation = (loanApplication.contactInformation as Record<string, unknown> | undefined) ?? {}
  const addressInformation = (loanApplication.addressInformation as Record<string, unknown> | undefined) ?? {}
  const employment = (loanApplication.employment as Record<string, unknown> | undefined) ?? {}
  const otherInformation = (loanApplication.otherInformation as Record<string, unknown> | undefined) ?? {}
  const employmentInformation = (loanApplication.employmentInformation as Record<string, unknown> | undefined) ?? {}
  const applicantPersonal = (loanApplication.applicantPersonal as Record<string, unknown> | undefined) ?? {}
  const enhancedDueDiligence = (loanApplication.enhancedDueDiligence as Record<string, unknown> | undefined) ?? {}
  const bankingRelationships = (loanApplication.bankingRelationships as Record<string, unknown> | undefined) ?? {}
  const collateral = (loanApplication.collateral as Record<string, unknown> | undefined) ?? {}
  const collateralInformation = (loanApplication.collateralInformation as Record<string, unknown> | undefined) ?? {}
  const loan = (loanApplication.loan as Record<string, unknown> | undefined) ?? {}
  const coBorrowers = Array.isArray(loanApplication.coBorrowers) ? loanApplication.coBorrowers as Array<Record<string, unknown>> : []
  const additionalCollaterals = Array.isArray(loanApplication.additionalCollaterals) ? loanApplication.additionalCollaterals as Array<Record<string, unknown>> : []
  const documents = Array.isArray(loanApplication.documents) ? loanApplication.documents as Array<Record<string, unknown>> : []

  const totalCollateralValue =
    numberValue(collateral.appraisedValue) +
    numberValue(collateralInformation.propertyAppraisedValue) +
    additionalCollaterals.reduce((sum, item) => sum + numberValue(item.appraisedValue), 0)
  const totalIncome =
    numberValue(employment.monthlyIncome) +
    numberValue(employment.otherIncome) +
    coBorrowers.reduce((sum, item) => sum + numberValue(item.monthlyIncome), 0)
  const totalExistingDebt =
    numberValue(employment.debtObligations) +
    coBorrowers.reduce((sum, item) => sum + numberValue(item.debtObligations), 0)
  const monthlyRate = numberValue(loan.interestRate) / 100 / 12
  const months = numberValue(loan.termMonths)
  const principal = numberValue(loan.amount)
  const monthlyPayment =
    months === 0
      ? 0
      : monthlyRate === 0
        ? principal / months
        : principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
  const dsr = totalIncome > 0 ? ((totalExistingDebt + monthlyPayment) / totalIncome) * 100 : 0
  const ltv = totalCollateralValue > 0 ? (principal / totalCollateralValue) * 100 : 0

  const character = textValue(borrower.govId) ? 8 : 5
  const capacity = dsr < 30 ? 10 : dsr < 40 ? 7 : 4
  const capital = numberValue(employment.otherIncome) > 0 ? 8 : 5
  const collateralScore = ltv < 80 ? 10 : ltv < 90 ? 7 : 4
  const conditions = textValue(loan.purpose) ? 8 : 5
  const creditScore = clampScore((character + capacity + capital + collateralScore + conditions) * 2)

  const canonicalEmail = textValue(borrower.email) || textValue(contactInformation.emailAddress)
  const canonicalPhone = textValue(contactInformation.mobileNumber) || textValue(borrower.phone)
  const canonicalAddress = textValue(addressInformation.presentAddress) || textValue(borrower.address)
  const parsedDocsCount = documents.filter((document) => textValue(document.status) === 'Parsed').length
  const docsCoverage = documents.length > 0 ? parsedDocsCount / documents.length : 0
  const nonStarterScore = clampScore(
    (textValue(borrower.govId) ? 30 : 0) +
      (canonicalEmail ? 10 : 0) +
      (canonicalPhone ? 10 : 0) +
      (canonicalAddress ? 10 : 0) +
      Math.round(docsCoverage * 35) +
      (textValue(applicantPersonal.dateOfBirth) ? 5 : 0),
  )

  const residenceStabilityScore = clampScore(
    (textValue(addressInformation.lengthOfStay) ? 60 : 35) +
      (textValue(otherInformation.homeOwnership) ? 20 : 0) +
      (canonicalAddress ? 20 : 0),
  )
  const employmentStabilityScore = clampScore(
    (textValue(employmentInformation.totalYearsWorking) ? 65 : 40) +
      (textValue(employmentInformation.employmentStatus) ? 20 : 0) +
      (textValue(employmentInformation.employerBusinessName) ? 15 : 0),
  )
  const familyStabilityScore = clampScore(
    (textValue(applicantPersonal.maritalStatus) ? 45 : 25) +
      (textValue((loanApplication.spouseInformation as Record<string, unknown> | undefined)?.fullName) ? 20 : 0) +
      (typeof applicantPersonal.numberOfDependents === 'number' ? 15 : 0) +
      (textValue(enhancedDueDiligence.referencesFromEmployerOrCommunity) ? 20 : 0),
  )
  const bankingRelationshipScore = clampScore(
    (textValue(bankingRelationships.accountNumber) ? 35 : 0) +
      (numberValue(bankingRelationships.currentBalance) > 0 ? 35 : 0) +
      (textValue(bankingRelationships.creditCardNumber) ? 15 : 0) +
      (textValue(bankingRelationships.memberSince) ? 15 : 0),
  )
  const socialScore = Math.round(averageScore([
    residenceStabilityScore,
    employmentStabilityScore,
    familyStabilityScore,
    mapEducationScore(textValue(otherInformation.educationalAttainment)),
    bankingRelationshipScore,
  ]))
  const psychometricScore = derivePsychometricScore(loanApplication)

  return {
    creditScore,
    psychometricScore,
    socialScore,
    nonStarterScore,
    monthlyIncome: totalIncome,
    monthlyDebtCommitments: totalExistingDebt + monthlyPayment,
    parsedDocumentCount: parsedDocsCount,
    totalDocumentCount: documents.length,
  }
}

function resolveStep8ProfileMetrics(values: Record<string, string>): Step8ProfileMetrics {
  const step8Amounts = Object.fromEntries(Object.entries(values)
    .filter(([key, value]) => !key.includes('.') && value.trim() !== ''))
  const score = computeNetWorthBuildingScore({ amounts: step8Amounts })
  const protectionLevelAmount = Object.entries(values)
    .filter(([key]) => key.startsWith('insurance-') && !key.includes('.'))
    .reduce((total, [, value]) => total + Math.max(0, Number(value) || 0), 0)

  return {
    actualNetWorth: score.metrics.netWorth,
    netIncome: score.metrics.monthlyCashFlow,
    protectionLevelAmount,
  }
}

function formatThousands(value: number): string {
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value / 1000)}k`
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function resolveInvestmentSuitabilityRisk(
  suitabilityAnswers: Record<string, string>,
  investments: Array<Record<string, string>>,
): InvestmentSuitabilityRisk {
  const answers = Array.from({ length: 8 }, (_, index) => Number(suitabilityAnswers[`suitability-q${index + 1}`]))
  if (answers.some((answer) => answer < 1 || answer > 4)) {
    return { outsideRiskAppetite: [], profile: 'Pending' }
  }

  const score = answers.reduce((sum, answer) => sum + answer, 0)
  const appetite = score <= 8
    ? { level: 1, profile: 'Risk Averse' as const }
    : score <= 16
      ? { level: 2, profile: 'Conservative' as const }
      : score <= 27
        ? { level: 3, profile: 'Moderate' as const }
        : { level: 4, profile: 'Aggressive' as const }
  const typeRiskLevel: Record<string, number> = {
    Bond: 2,
    'Mutual Fund': 3,
    'Equity (Stock)': 3,
    Alternative: 4,
  }

  const outsideRiskAppetite = investments.flatMap((investment) => {
    const typeLevel = typeRiskLevel[investment.investmentType] ?? 0
    const normalizedRating = investment.riskRating?.trim().toLowerCase() ?? ''
    const ratingLevel = /high|aggressive|speculative/.test(normalizedRating)
      ? 4
      : /medium|moderate/.test(normalizedRating)
        ? 3
        : /low|conservative/.test(normalizedRating)
          ? 1
          : 0
    if (Math.max(typeLevel, ratingLevel) <= appetite.level) return []

    return [investment.issuerAsset?.trim() || investment.investmentType?.trim() || 'Unnamed investment']
  })

  return { outsideRiskAppetite, profile: appetite.profile }
}

export default function FinancialHealthSummaryPage() {
  const { isAdmin } = useAuthorization()
  const { selectedApplicationNo, entityKey, isIdentityReady } = useSelectedAnalysisEntity()
  const [netWorthBuildingScore, setNetWorthBuildingScore] = useState<NetWorthBuildingScoreResult | null>(null)
  const [wealthFoundationScore, setWealthFoundationScore] = useState<WealthFoundationScoreResult | null>(null)
  const [budgetHealthScore, setBudgetHealthScore] = useState<BudgetHealthScoreResult | null>(null)
  const [lendingLeafScores, setLendingLeafScores] = useState<LendingLeafScores | null>(null)
  const [publishedSummary, setPublishedSummary] = useState(DEFAULT_FINANCIAL_HEALTH_SUMMARY)
  const [summaryInputsLoaded, setSummaryInputsLoaded] = useState(false)
  const [summaryComputedAt, setSummaryComputedAt] = useState<Date | null>(null)
  const maxAllowedMonth = currentReportingMonth().slice(0, 7)
  const [snapshotMonth, setSnapshotMonth] = useState(() => maxAllowedMonth)
  const [financialHealthSnapshots, setFinancialHealthSnapshots] = useState<FinancialHealthSnapshot[]>([])
  const [currentComparisonMonth, setCurrentComparisonMonth] = useState('')
  const [baselineComparisonMonth, setBaselineComparisonMonth] = useState('')
  const [snapshotMessage, setSnapshotMessage] = useState('')
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false)
  const [monthlySnapshotDrafts, setMonthlySnapshotDrafts] = useState<MonthlySnapshotDrafts | null>(null)
  const [activeVitalId, setActiveVitalId] = useState<string | null>(null)
  const [activePositionRingId, setActivePositionRingId] = useState<string | null>(null)
  const [activeChartIndicatorId, setActiveChartIndicatorId] = useState<string | null>(null)
  const [activeJourneyDetailId, setActiveJourneyDetailId] = useState<JourneyDetailId | null>(null)
  const [benchmarkContext, setBenchmarkContext] = useState<BenchmarkContext>({
    countryCode: 'PH',
    currency: 'PHP',
    monthlyIncome: 0,
    netWorth: 0,
    dependents: 0,
  })
  const [step8ProfileMetrics, setStep8ProfileMetrics] = useState<Step8ProfileMetrics>({
    actualNetWorth: 0,
    netIncome: 0,
    protectionLevelAmount: 0,
  })
  const [investmentSuitabilityRisk, setInvestmentSuitabilityRisk] = useState<InvestmentSuitabilityRisk>({
    outsideRiskAppetite: [],
    profile: 'Pending',
  })
  const [journeyStepCompletion, setJourneyStepCompletion] = useState<Record<JourneyStepId, boolean>>({
    createProfile: false,
    creditHealth: false,
    wealthBuilder: false,
    budgetTargets: false,
    billsLoans: false,
    billManager: false,
  })
  const [isJourneyMinimized, setIsJourneyMinimized] = useState<boolean>(() => {
    return safeStorageGet(JOURNEY_MINIMIZED_STORAGE_KEY) === '1'
  })
  const [doNotShowJourneyAgain, setDoNotShowJourneyAgain] = useState<boolean>(() => {
    return safeStorageGet(JOURNEY_DO_NOT_SHOW_STORAGE_KEY) === '1'
  })
  const [isJourneyDismissed, setIsJourneyDismissed] = useState<boolean>(() => {
    return safeStorageGet(JOURNEY_DO_NOT_SHOW_STORAGE_KEY) === '1'
  })

  useEffect(() => {
    let disposed = false

    const loadNetWorthDraft = async () => {
      if (!isIdentityReady) return

      const analysisEntityKey = entityKey || 'identity-pending'
      const lendingEntityKey = selectedApplicationNo || 'new'
      const creditEntityKey = selectedApplicationNo || 'primary'
      try {
        const [
          netWorthDraft,
          lendingDraft,
          budgetDraft,
          billReminderDraft,
          creditHealthDraft,
          loanMonitoringDraft,
        ] = await Promise.all([
          fetchAutosaveDraft<NetWorthBuildingDraftInput>('net-worth-positioning', analysisEntityKey),
          fetchAutosaveDraft<unknown>('loan-application', lendingEntityKey),
          fetchAutosaveDraft<BudgetHealthDraftInput>('budget-expense-tracker', analysisEntityKey),
          fetchAutosaveDraft<unknown>('bill-reminder', analysisEntityKey),
          fetchAutosaveDraft<unknown>('credit-scoring', creditEntityKey),
          fetchAutosaveDraft<{ publishedScore?: LoanMonitoringScoreResult }>('loan-monitoring', analysisEntityKey),
        ])

        if (disposed || !netWorthDraft?.payload) {
          setNetWorthBuildingScore(null)
          setWealthFoundationScore(null)
        } else {
          setNetWorthBuildingScore(computeNetWorthBuildingScore(netWorthDraft.payload))
          setWealthFoundationScore(computeWealthFoundationScore(netWorthDraft.payload))
        }

        if (!disposed) {
          const lendingPayload = lendingDraft?.payload
          const billPayload = billReminderDraft?.payload
          const budgetPayload = budgetDraft?.payload
          const creditPayload = creditHealthDraft?.payload
          const wealthPayload = netWorthDraft?.payload
          const buildProfileDraft = readReplicatedBuildProfile()

          setMonthlySnapshotDrafts({
            profileData: buildProfileDraft ? { ...buildProfileDraft } : {},
            profileId: buildProfileDraft?.profileId,
            netWorth: netWorthDraft?.payload ?? null,
            budget: budgetPayload as BudgetHealthDraftInput ?? {},
            billReminder: billPayload as MonthlySnapshotDrafts['billReminder'],
            loanMonitoring: loanMonitoringDraft?.payload ?? null,
          })

          setStep8ProfileMetrics(resolveStep8ProfileMetrics(buildProfileDraft?.values ?? {}))
          setInvestmentSuitabilityRisk(resolveInvestmentSuitabilityRisk(
            buildProfileDraft?.suitabilityAnswers ?? {},
            buildProfileDraft?.financialInvestments ?? [],
          ))

          const buildProfileActualEntries = Object.fromEntries(Object.entries(buildProfileDraft?.values ?? {})
            .filter(([key, value]) => key.startsWith('wealthActual.') && value.trim() !== '')
            .map(([key, value]) => [key.slice('wealthActual.'.length), value]))
          const buildProfileSetupEntries = Object.fromEntries(Object.entries(buildProfileDraft?.values ?? {})
            .filter(([key, value]) => !key.includes('.') && value.trim() !== '')
            .map(([key, value]) => [key, value]))
          const buildProfileBenchmarkEntries = {
            ...buildProfileSetupEntries,
            ...buildProfileActualEntries,
          }
          const buildProfileBenchmarkScore = Object.keys(buildProfileBenchmarkEntries).length > 0
            ? computeNetWorthBuildingScore({ amounts: buildProfileBenchmarkEntries })
            : null
          const benchmarkWealthPayload = wealthPayload ?? (Object.keys(buildProfileActualEntries).length > 0
            ? { amounts: {}, actualEntries: buildProfileActualEntries }
            : null)

          if (!netWorthDraft?.payload && benchmarkWealthPayload) {
            setNetWorthBuildingScore(computeNetWorthBuildingScore(benchmarkWealthPayload))
            setWealthFoundationScore(computeWealthFoundationScore(benchmarkWealthPayload))
          }
          setBenchmarkContext({
            countryCode: countryCodeFromCitizenship(buildProfileDraft?.values.citizenship),
            currency: buildProfileDraft?.values.wealthCurrency
              || (wealthPayload as (NetWorthBuildingDraftInput & { currency?: string; currencyCode?: string }) | undefined)?.currency
              || (wealthPayload as (NetWorthBuildingDraftInput & { currencyCode?: string }) | undefined)?.currencyCode
              || 'PHP',
            monthlyIncome: buildProfileBenchmarkScore?.metrics.monthlyIncome ?? 0,
            netWorth: buildProfileBenchmarkScore?.metrics.netWorth ?? 0,
            dependents: Math.max(
              0,
              Number(buildProfileDraft?.values.dependents) || buildProfileDraft?.dependents?.length || 0,
            ),
          })

          setLendingLeafScores(lendingPayload ? deriveLendingLeafScores(lendingPayload) : null)
          setBudgetHealthScore(budgetPayload ? computeBudgetHealthScore(budgetPayload) : null)

          setJourneyStepCompletion({
            createProfile: hasMeaningfulValue(buildProfileDraft),
            creditHealth: hasMeaningfulValue(creditPayload) || hasMeaningfulValue(lendingPayload),
            wealthBuilder: hasMeaningfulValue(wealthPayload),
            budgetTargets: hasMeaningfulValue(budgetPayload),
            billsLoans: hasMeaningfulValue(billPayload) || hasMeaningfulValue(lendingPayload),
            billManager: hasMeaningfulValue(billPayload),
          })
        }
      } catch {
        if (!disposed) {
          setNetWorthBuildingScore(null)
          setWealthFoundationScore(null)
          setBudgetHealthScore(null)
          setLendingLeafScores(null)
          setMonthlySnapshotDrafts(null)
          setJourneyStepCompletion((current) => ({
            ...current,
            billManager: false,
          }))
        }
      } finally {
        if (!disposed) {
          setSummaryInputsLoaded(true)
        }
      }
    }

    void loadNetWorthDraft()

    return () => {
      disposed = true
    }
  }, [entityKey, isIdentityReady, selectedApplicationNo])

  useEffect(() => {
    let disposed = false
    if (!selectedApplicationNo) {
      setFinancialHealthSnapshots([])
      setCurrentComparisonMonth('')
      setBaselineComparisonMonth('')
      return
    }

    void listProfileHistory(selectedApplicationNo, 'financial_health_score', 100)
      .then((history) => {
        if (disposed) return
        const snapshots = history.items
          .map(parseFinancialHealthSnapshot)
          .filter((snapshot): snapshot is FinancialHealthSnapshot => snapshot !== null)
          .sort((left, right) => left.payload.reportingMonth.localeCompare(right.payload.reportingMonth))
          .slice(-12)
        setFinancialHealthSnapshots(snapshots)
        const latest = snapshots[snapshots.length - 1]?.payload.reportingMonth ?? ''
        const previous = snapshots[snapshots.length - 2]?.payload.reportingMonth ?? ''
        setCurrentComparisonMonth(latest)
        setBaselineComparisonMonth(previous)
      })
      .catch((error) => {
        if (!disposed) setSnapshotMessage(getErrorMessage(error, 'Unable to load financial health snapshots.'))
      })

    return () => {
      disposed = true
    }
  }, [selectedApplicationNo])

  useEffect(() => {
    if (!snapshotMessage.startsWith('Snapshot saved')) return
    const timeoutId = window.setTimeout(() => setSnapshotMessage(''), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [snapshotMessage])

  const completedJourneyCount = useMemo(
    () => Object.values(journeyStepCompletion).filter(Boolean).length,
    [journeyStepCompletion],
  )
  const journeyCompletionPercent = Math.round((completedJourneyCount / FINANCIAL_HEALTH_JOURNEY_STEPS.length) * 100)
  const isJourneyComplete = journeyCompletionPercent >= 100
  const latestSummaryInputs = useMemo<FinancialHealthSummaryInputs>(() => {
    const netWorthComponents = netWorthBuildingScore?.componentScores
    const investmentScore = netWorthComponents
      ? averageScore([
          netWorthComponents.investmentReadiness,
          netWorthComponents.retirementReadiness,
          netWorthComponents.financialIndependence,
        ])
      : null
    return {
      credit: lendingLeafScores?.creditScore ?? null,
      'cash-flow': netWorthComponents?.cashFlowStrength ?? null,
      wealth: netWorthBuildingScore?.normalizedScore ?? null,
      budget: budgetHealthScore?.score ?? null,
      payment: netWorthComponents?.leverageControl ?? null,
      protection: netWorthComponents?.protectionCoverage ?? null,
      investment: investmentScore,
      goal: netWorthComponents?.goalMomentum ?? null,
    }
  }, [budgetHealthScore, lendingLeafScores, netWorthBuildingScore])
  const financialHealthIndicators = publishedSummary.indicators
  const recommendedProducts = [...financialHealthIndicators]
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map((indicator) => ({
      ...RECOMMENDED_PRODUCTS[indicator.id],
      indicatorId: indicator.id,
      indicatorLabel: indicator.label,
      score: indicator.score,
    }))
  const groupRings = useMemo(
    () => buildFinancialHealthGroupRings(financialHealthIndicators),
    [financialHealthIndicators],
  )
  const index = publishedSummary.index

  const computeLatestFinancialHealth = () => {
    setPublishedSummary(computeFinancialHealthSummary(latestSummaryInputs))
    setSummaryComputedAt(new Date())
  }

 const saveFinancialHealthSnapshot = async () => {
  if (!selectedApplicationNo || !summaryComputedAt) return
  
  // Guard against saving future months
  if (snapshotMonth > maxAllowedMonth) {
    setSnapshotMessage('Cannot save a snapshot for a future month.')
    return
  }

  setIsSavingSnapshot(true)
  setSnapshotMessage('')
    try {
      if (!monthlySnapshotDrafts?.netWorth) {
        throw new Error('Complete and save Net Worth Positioning before saving a monthly profile snapshot.')
      }
      if (!monthlySnapshotDrafts.loanMonitoring?.publishedScore) {
        throw new Error('Open Loan Monitoring once to calculate and save its current score before saving the monthly snapshot.')
      }

      const billReminder = monthlySnapshotDrafts.billReminder
      const scoreBillers = billReminder?.savedSetup?.length
        ? billReminder.savedSetup
        : billReminder?.draftBillers ?? []
      const suitabilityValues = Object.values(monthlySnapshotDrafts.netWorth.suitabilityAnswers ?? {})
      const wealthBehaviourScore = suitabilityValues.length > 0
        ? Math.round((averageScore(suitabilityValues) / 4) * 100)
        : 0
      const actualEntries = Object.values(monthlySnapshotDrafts.netWorth.actualEntries ?? {})
      const completedActualEntries = actualEntries.filter((value) => String(value ?? '').trim() !== '').length
      const wealthAuthenticityScore = actualEntries.length > 0
        ? Math.round((completedActualEntries / actualEntries.length) * 100)
        : 0

      await calculateAndSaveMonthlyProfile({
        snapshotMonth,
        profileData: monthlySnapshotDrafts.profileData,
        sourceProfileId: monthlySnapshotDrafts.profileId,
        sourceApplicationNo: selectedApplicationNo,
        financialHealth: latestSummaryInputs,
        creditHealth: lendingLeafScores
          ? {
              score: averageScore([
                lendingLeafScores.creditScore,
                lendingLeafScores.psychometricScore,
                lendingLeafScores.socialScore,
                lendingLeafScores.nonStarterScore,
              ]),
              summary: { ...lendingLeafScores },
            }
          : undefined,
        netWorth: monthlySnapshotDrafts.netWorth,
        budget: monthlySnapshotDrafts.budget,
        loanMonitoring: monthlySnapshotDrafts.loanMonitoring.publishedScore,
        billPayment: {
          monthlyIncome: lendingLeafScores?.monthlyIncome ?? 0,
          referenceDate: reportingMonthEnd(snapshotMonth).slice(0, 10),
          billers: scoreBillers.map((biller) => ({
            ...biller,
            payments: billReminder?.paymentEntries?.[biller.id] ?? [],
          })),
        },
        wealthComposite: { wealthBehaviourScore, wealthAuthenticityScore },
        widBenchmark: {
          netWorth: benchmarkContext.netWorth,
          annualIncome: benchmarkContext.monthlyIncome * 12,
          countryCode: benchmarkContext.countryCode,
          currency: benchmarkContext.currency,
        },
      })

      const netWorthMetrics = netWorthBuildingScore?.metrics
      const record = await createProfileHistory(selectedApplicationNo, {
        category: 'financial_health_score',
        observed_at: reportingMonthEnd(snapshotMonth),
        payload: buildFinancialHealthSnapshotPayload(snapshotMonth, publishedSummary, {
          netWorth: netWorthMetrics?.netWorth ?? step8ProfileMetrics.actualNetWorth,
          netIncome: step8ProfileMetrics.netIncome,
          monthlyCashFlow: netWorthMetrics?.monthlyCashFlow ?? 0,
          totalAssets: netWorthMetrics?.totalAssets ?? 0,
          totalLiabilities: netWorthMetrics?.totalLiabilities ?? 0,
        }),
      })
      const saved = parseFinancialHealthSnapshot(record)
      if (saved) {
        const snapshots = [...financialHealthSnapshots, saved]
          .sort((left, right) => left.payload.reportingMonth.localeCompare(right.payload.reportingMonth))
          .slice(-12)
        setFinancialHealthSnapshots(snapshots)
        setCurrentComparisonMonth(saved.payload.reportingMonth)
        setBaselineComparisonMonth(snapshots[snapshots.length - 2]?.payload.reportingMonth ?? '')
      }
      setSnapshotMessage(`Snapshot saved as of ${formatReportingMonth(snapshotMonth)}. Monthly profile and Financial Health history were saved.`)
    } catch (error) {
      setSnapshotMessage(getErrorMessage(error, 'Unable to save this financial health snapshot.'))
    } finally {
      setIsSavingSnapshot(false)
    }
  }

  const minimizeJourney = () => {
    if (doNotShowJourneyAgain) {
      safeStorageSet(JOURNEY_DO_NOT_SHOW_STORAGE_KEY, '1')
      safeStorageRemove(JOURNEY_MINIMIZED_STORAGE_KEY)
      setIsJourneyDismissed(true)
      setIsJourneyMinimized(true)
      return
    }

    setIsJourneyMinimized(true)
    safeStorageSet(JOURNEY_MINIMIZED_STORAGE_KEY, '1')
  }

  const openJourney = () => {
    setIsJourneyMinimized(false)
    safeStorageRemove(JOURNEY_MINIMIZED_STORAGE_KEY)
  }

  const launchJourneyStep = (step: JourneyStep) => {
    if (typeof window !== 'undefined') {
      const selectedQuery = selectedApplicationNo
        ? `?applicationNo=${encodeURIComponent(selectedApplicationNo)}`
        : ''
      window.location.assign(`${step.route}${selectedQuery}`)
    }
  }

  const score = publishedSummary.score
  const band = getFinancialHealthBand(score)
  const currentComparisonSnapshot = financialHealthSnapshots.find(
    (snapshot) => snapshot.payload.reportingMonth === currentComparisonMonth,
  ) ?? null
  const baselineComparisonSnapshot = financialHealthSnapshots.find(
    (snapshot) => snapshot.payload.reportingMonth === baselineComparisonMonth,
  ) ?? null
  const hasDistinctComparisonPeriods = currentComparisonMonth !== baselineComparisonMonth
  const snapshotMonthExists = financialHealthSnapshots.some(
    (snapshot) => snapshot.payload.reportingMonth === snapshotMonth,
  )
  const financialHealthChange = currentComparisonSnapshot && baselineComparisonSnapshot && hasDistinctComparisonPeriods
    ? currentComparisonSnapshot.payload.score - baselineComparisonSnapshot.payload.score
    : null
  const philippineIncomeBenchmark = computePhilippineIncomeBenchmark(benchmarkContext.monthlyIncome * 12)
  const stableMonths = budgetHealthScore?.metrics.stableMonths ?? 0
  const momentumLabel = !budgetHealthScore
    ? 'Pending'
    : stableMonths >= 10
      ? 'Improving'
      : stableMonths >= 6
        ? 'Stable'
        : 'Declining'
  const resilienceMonths = wealthFoundationScore?.metrics.emergencyFundMonths
    ?? netWorthBuildingScore?.metrics.emergencyFundMonths
    ?? null
  const riskIndicators = financialHealthIndicators.filter((indicator) => indicator.score < 80)
  const baselineIndicatorById = new Map(
    baselineComparisonSnapshot?.payload.indicators.map((indicator) => [indicator.id, indicator]) ?? [],
  )
  const currentComparisonIndicators = currentComparisonSnapshot?.payload.indicators ?? []
  const changeContributors = currentComparisonIndicators
    .map((indicator) => ({
      label: indicator.label,
      change: indicator.score - (baselineIndicatorById.get(indicator.id)?.score ?? indicator.score),
      weightedImpact: (indicator.score - (baselineIndicatorById.get(indicator.id)?.score ?? indicator.score)) * indicator.weight,
    }))
    .filter((indicator) => (financialHealthChange ?? 0) > 0 ? indicator.change > 0 : indicator.change < 0)
    .sort((left, right) => Math.abs(right.weightedImpact) - Math.abs(left.weightedImpact))
    .slice(0, 3)
  const comparisonLabel = currentComparisonSnapshot && baselineComparisonSnapshot && hasDistinctComparisonPeriods
    ? `${formatReportingMonth(currentComparisonSnapshot.payload.reportingMonth)} vs ${formatReportingMonth(baselineComparisonSnapshot.payload.reportingMonth)}`
    : ''
  const changeNarration = financialHealthChange === null
    ? 'Save at least two monthly snapshots to compare financial health.'
    : financialHealthChange === 0
    ? 'No change in your financial health yet.'
    : financialHealthChange > 0
      ? `Your financial health improved. The biggest gains came from ${changeContributors.map((indicator) => indicator.label).join(', ') || 'your latest financial inputs'}.`
      : `Your financial health declined. The biggest decreases came from ${changeContributors.map((indicator) => indicator.label).join(', ') || 'your latest financial inputs'}.`
  const financialHealthTrend = financialHealthSnapshots.map((snapshot) => ({
    period: new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' })
      .format(new Date(`${snapshot.payload.reportingMonth}-01T00:00:00Z`)),
    healthScore: snapshot.payload.score,
    creditHealth: snapshot.payload.indicators.find((indicator) => indicator.id === 'credit')?.score ?? 0,
    wealthBuilding: snapshot.payload.indicators.find((indicator) => indicator.id === 'wealth')?.score ?? 0,
  }))
  const momentumNarration = !budgetHealthScore
    ? 'Add your monthly budget activity to see your financial momentum.'
    : momentumLabel === 'Improving'
      ? `Improving for the last ${stableMonths} months. Keep it up.`
      : momentumLabel === 'Stable'
        ? `Consistent for the last ${stableMonths} months. Maintain it, then look for your next improvement.`
        : `Declining over the tracked ${stableMonths} months. Review your budget and work on improving the next month.`
  const resilienceNarration = resilienceMonths === null
    ? 'Add your emergency fund and monthly expenses to check your resilience.'
    : resilienceMonths >= 6
      ? `Your emergency fund can cover ${resilienceMonths.toFixed(1)} months of expenses. You are in a resilient position.`
      : resilienceMonths >= 3
        ? `Your emergency fund can cover ${resilienceMonths.toFixed(1)} months of expenses. Keep saving to strengthen it.`
        : `Your emergency fund covers only ${resilienceMonths.toFixed(1)} months of expenses. Prioritize building it up over the next few months.`
  const opportunityIndicators = [...riskIndicators]
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
  const totalLiabilities = netWorthBuildingScore?.metrics.totalLiabilities ?? 0
  const investmentRiskAlertCount = investmentSuitabilityRisk.outsideRiskAppetite.length
  const riskNarration = riskIndicators.length === 0
    ? 'Well positioned. No alerts right now.'
    : `${riskIndicators.map((indicator) => indicator.label).join(', ')} ${riskIndicators.length === 1 ? 'is' : 'are'} below the 80-point target and may hold back your overall financial health.`
  const investmentRiskNarration = investmentSuitabilityRisk.profile === 'Pending'
    ? 'Complete Build Profile Step 11 Suitability Assessment to evaluate investments against your risk appetite.'
    : investmentRiskAlertCount > 0
      ? `${investmentSuitabilityRisk.outsideRiskAppetite.join(', ')} ${investmentRiskAlertCount === 1 ? 'is' : 'are'} outside your ${investmentSuitabilityRisk.profile} risk appetite based on the Step 11 Suitability Assessment.`
      : `All recorded investments are within your ${investmentSuitabilityRisk.profile} risk appetite based on the Step 11 Suitability Assessment.`
  const opportunityNarration = totalLiabilities > 0
    ? `You have ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: benchmarkContext.currency, maximumFractionDigits: 0 }).format(totalLiabilities)} in liabilities. Review interest rates and consider whether debt consolidation could lower your cost. Then focus on rebuilding ${opportunityIndicators.map((indicator) => indicator.label).join(', ') || 'your financial buffer'}.`
    : opportunityIndicators.length > 0
      ? `Focus on rebuilding ${opportunityIndicators.map((indicator) => indicator.label).join(', ')}. Small, consistent improvements can lift your overall score.`
      : 'Keep building on your current habits and review your goals regularly.'
  const strongestIndicator = financialHealthIndicators.reduce((strongest, indicator) =>
    indicator.score > strongest.score ? indicator : strongest,
  )
  const priorityIndicator = financialHealthIndicators.reduce((priority, indicator) =>
    indicator.score < priority.score ? indicator : priority,
  )
  const netWorthMetrics = netWorthBuildingScore?.metrics
  const positionRecommendations: Record<string, PositionRingRecommendation> = {
    'cash-flow': netWorthMetrics
      ? {
          summary: netWorthMetrics.monthlyCashFlow >= 0
            ? `Your saved monthly surplus is ${formatCurrency(netWorthMetrics.monthlyCashFlow, benchmarkContext.currency)}, or ${netWorthMetrics.savingsRatePercent.toFixed(1)}% of income.`
            : `Your saved monthly expenses exceed income by ${formatCurrency(Math.abs(netWorthMetrics.monthlyCashFlow), benchmarkContext.currency)}.`,
          actions: netWorthMetrics.monthlyIncome <= 0
            ? ['Add your recurring income and expense records.', 'Review these amounts monthly so the guidance stays current.']
            : netWorthMetrics.monthlyCashFlow <= 0
              ? ['Reduce recurring expenses until monthly cash flow is positive.', 'Direct new or irregular income toward a dependable monthly reserve.']
              : ['Increase the amount retained each month by trimming recurring costs or growing reliable income.', 'Automate transfers from each income payment into savings and investments.'],
        }
      : {
          summary: 'No saved cash-flow details are available yet.',
          actions: ['Add recurring income and expenses in Net Worth Positioning.', 'Refresh Financial Health after saving your information.'],
        },
    credit: lendingLeafScores
      ? {
          summary: `Your saved profile shows ${formatCurrency(lendingLeafScores.monthlyIncome, benchmarkContext.currency)} in monthly income and ${formatCurrency(lendingLeafScores.monthlyDebtCommitments, benchmarkContext.currency)} in monthly debt commitments.`,
          actions: [
            'Pay every obligation on time and reduce revolving or high-cost balances.',
            lendingLeafScores.totalDocumentCount > 0 && lendingLeafScores.parsedDocumentCount < lendingLeafScores.totalDocumentCount
              ? `Complete verification for ${lendingLeafScores.totalDocumentCount - lendingLeafScores.parsedDocumentCount} outstanding document${lendingLeafScores.totalDocumentCount - lendingLeafScores.parsedDocumentCount === 1 ? '' : 's'}.`
              : 'Keep identification, address, employment, income, and banking records current.',
          ],
        }
      : {
          summary: 'No saved credit application details are available yet.',
          actions: ['Complete your loan and credit profile.', 'Add current income, debt, identity, address, employment, and supporting documents.'],
        },
    goal: netWorthMetrics
      ? {
          summary: `Your saved net worth is ${formatCurrency(netWorthMetrics.netWorth, benchmarkContext.currency)}, with projected goal-date net worth of ${formatCurrency(netWorthMetrics.projectedNetWorthAtGoalDate, benchmarkContext.currency)}.`,
          actions: netWorthMetrics.goalProgressPercent > 0
            ? ['Increase monthly contributions toward your saved net-worth goal.', 'Reduce liabilities and add consistently to assets that support long-term growth.']
            : ['Add a target amount and target date to your saved net-worth goal.', 'Build monthly surplus, reduce liabilities, and contribute consistently to long-term assets.'],
        }
      : {
          summary: 'No saved net-worth goal details are available yet.',
          actions: ['Record your assets and liabilities.', 'Add a net-worth target, target date, and regular contribution plan.'],
        },
  }
  const positionRings = [
    {
      id: 'cash-flow',
      label: 'Cash Flow Position',
      description: 'Monthly income, expenses, and savings strength',
      accent: '#32ade6',
      softAccent: '#e8f7fd',
    },
    {
      id: 'credit',
      label: 'Credit Health',
      description: 'Current credit capacity and lending profile',
      accent: '#5856d6',
      softAccent: '#efeffb',
    },
    {
      id: 'goal',
      label: 'Net Worth Growth',
      description: 'Progress toward your saved net-worth goal',
      accent: '#30b85c',
      softAccent: '#e9f8ee',
    },
  ].map((ring) => ({
    ...ring,
    score: financialHealthIndicators.find((indicator) => indicator.id === ring.id)?.score ?? 0,
    recommendation: positionRecommendations[ring.id],
  }))
  const leafSegments: LendingLeafSegment[] = [
    {
      id: 'credit',
      label: 'Credit Score',
      score: lendingLeafScores?.creditScore ?? null,
      filscore: toFilscore(lendingLeafScores?.creditScore ?? null),
      path: 'M27 24H130C118 78 143 139 128 200C117 244 138 276 130 296H27Z',
      fill: scoreTone(lendingLeafScores?.creditScore ?? null),
    },
    {
      id: 'psychometric',
      label: 'Behaviour / Psychometric Score',
      score: lendingLeafScores?.psychometricScore ?? null,
      filscore: toFilscore(lendingLeafScores?.psychometricScore ?? null),
      path: 'M130 24H233V118C205 104 174 135 134 116C140 82 123 52 130 24Z',
      fill: scoreTone(lendingLeafScores?.psychometricScore ?? null),
    },
    {
      id: 'social',
      label: 'Social Score',
      score: lendingLeafScores?.socialScore ?? null,
      filscore: toFilscore(lendingLeafScores?.socialScore ?? null),
      path: 'M134 116C174 135 205 104 233 118V205C204 190 171 221 128 200C134 170 140 145 134 116Z',
      fill: scoreTone(lendingLeafScores?.socialScore ?? null),
    },
    {
      id: 'nonStarter',
      label: 'Non-Starter Score',
      score: lendingLeafScores?.nonStarterScore ?? null,
      filscore: toFilscore(lendingLeafScores?.nonStarterScore ?? null),
      path: 'M128 200C171 221 204 190 233 205V296H130C138 276 117 244 128 200Z',
      fill: scoreTone(lendingLeafScores?.nonStarterScore ?? null),
    },
  ]
  const hasLendingLeafScores = leafSegments.some((segment) => segment.score !== null)
  const leafAriaLabel = hasLendingLeafScores
    ? leafSegments
        .map((segment) => `${segment.label} ${segment.score ?? 'Pending'} out of 100`)
        .join(', ')
    : 'Leaf graph awaiting saved lending scores'
  const activeJourneyDetail = activeJourneyDetailId
    ? FINANCIAL_HEALTH_JOURNEY_DETAILS[activeJourneyDetailId]
    : null
   
  return (
    <div className="psychometric-page financial-health-page">
      {!isJourneyMinimized && !isJourneyDismissed ? (
        <section className="financial-health-journey-overlay" role="dialog" aria-modal="true" aria-labelledby="financial-health-journey-title">
          <article className="financial-health-journey-modal">
            <button
              type="button"
              className="financial-health-journey-minimize"
              onClick={minimizeJourney}
              aria-label="Minimize Financial Health Journey"
            >
              Minimize
            </button>

            <p className="financial-health-journey-kicker">GREETINGS! We wish you well today. </p>
            <h2 id="financial-health-journey-title">Welcome to Your Financial Health Journey!</h2>
            <p>
              Congratulations on creating your FILSCORE account. Complete these steps to unlock
              the full power of your profile and receive more accurate financial recommendations. Hover in each circle to learn more about each step. Click the button to launch the step and complete it.
            </p>

            <div
              className="financial-health-journey-step-list financial-health-journey-cycle"
              role="list"
              aria-label="Financial Health journey checklist"
            >
              {FINANCIAL_HEALTH_JOURNEY_STEPS.map((step) => {
                const isCompleted = journeyStepCompletion[step.id]
                return (
                  <article
                    key={step.id}
                    className={`financial-health-journey-step ${isCompleted ? 'financial-health-journey-step-complete' : ''}`}
                    role="listitem"
                    tabIndex={0}
                    aria-describedby={activeJourneyDetailId === step.id ? 'financial-health-journey-detail' : undefined}
                    onMouseEnter={() => setActiveJourneyDetailId(step.id)}
                    onMouseLeave={() => setActiveJourneyDetailId(null)}
                    onFocus={() => setActiveJourneyDetailId(step.id)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setActiveJourneyDetailId(null)
                      }
                    }}
                  >
                    <div className="financial-health-journey-step-copy">
                      {isCompleted ? <span className="financial-health-journey-step-check" aria-label="Completed">✓</span> : null}
                      <h3>{step.label}</h3>
                      <p>{step.description}</p>
                    </div>
                    <button
                      type="button"
                      className="financial-health-journey-action"
                      onClick={() => launchJourneyStep(step)}
                    >
                      {step.launchLabel}
                    </button>
                  </article>
                )
              })}
              <div
                className="financial-health-journey-hub"
                tabIndex={0}
                aria-describedby={activeJourneyDetailId === 'financialHealth' ? 'financial-health-journey-detail' : undefined}
                onMouseEnter={() => setActiveJourneyDetailId('financialHealth')}
                onMouseLeave={() => setActiveJourneyDetailId(null)}
                onFocus={() => setActiveJourneyDetailId('financialHealth')}
                onBlur={() => setActiveJourneyDetailId(null)}
              >
                <span>Financial Health</span>
              </div>
              {activeJourneyDetail ? (
                <aside
                  id="financial-health-journey-detail"
                  className="financial-health-journey-detail"
                  role="tooltip"
                >
                  <strong>{activeJourneyDetail.title}</strong>
                  <ul>
                    {activeJourneyDetail.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                </aside>
              ) : null}
              <span className="financial-health-journey-arrow financial-health-journey-arrow-1" aria-hidden="true" />
              <span className="financial-health-journey-arrow financial-health-journey-arrow-2" aria-hidden="true" />
              <span className="financial-health-journey-arrow financial-health-journey-arrow-3" aria-hidden="true" />
              <span className="financial-health-journey-arrow financial-health-journey-arrow-4" aria-hidden="true" />
              <span className="financial-health-journey-arrow financial-health-journey-arrow-5" aria-hidden="true" />
              <span className="financial-health-journey-arrow financial-health-journey-arrow-6" aria-hidden="true" />
            </div>
            <button
              type="button"
              className="financial-health-journey-minimize"
              onClick={minimizeJourney}
              aria-label="Minimize Financial Health Journey"
            >
              Start Now
            </button>

            <div className="financial-health-journey-progress" aria-live="polite">
              <h3>Financial Health Journey</h3>
              <div className="financial-health-journey-progress-list">
                {FINANCIAL_HEALTH_JOURNEY_STEPS.map((step) => (
                  <span key={`progress-${step.id}`}>
                    {journeyStepCompletion[step.id] ? '☑' : '☐'} {step.label}
                  </span>
                ))}
              </div>
              <strong>{journeyCompletionPercent}% Complete</strong>
            </div>

            <label className="financial-health-journey-toggle">
              <input
                type="checkbox"
                checked={doNotShowJourneyAgain}
                onChange={(event) => {
                  const shouldHide = event.target.checked
                  setDoNotShowJourneyAgain(shouldHide)
                  if (shouldHide) {
                    safeStorageSet(JOURNEY_DO_NOT_SHOW_STORAGE_KEY, '1')
                  } else {
                    safeStorageRemove(JOURNEY_DO_NOT_SHOW_STORAGE_KEY)
                    setIsJourneyDismissed(false)
                  }
                }}
              />
              <span>Do not show this welcome pop-up again</span>
            </label>

            {isJourneyComplete ? (
              <div className="financial-health-journey-complete">
                <p>
                  🎉 <strong>Excellent!</strong> Your Financial Health Profile is now established.
                  FILSCORE is ready to monitor, analyze, and guide your journey with personalized insights.
                </p>
                <button
                  type="button"
                  className="financial-health-journey-action"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.location.assign('/financial-health-summary')
                    }
                  }}
                >
                  Go to Financial Health Dashboard
                </button>
              </div>
            ) : null}

            <button
              type="button"
              className="financial-health-journey-skip"
              onClick={minimizeJourney}
            >
              Skip for Now
            </button>
          </article>
        </section>
      ) : null}

      <section className="psychometric-hero financial-health-hero" aria-labelledby="financial-health-title">
        <div className="psychometric-hero-copy financial-health-hero-copy">
          <span className="psychometric-eyebrow">FILSCORE Financial Vital Signs</span>
          <h1 id="financial-health-title">Financial Health</h1>
          <p hidden>
            One clear view of your financial stability, control, and future progress—calculated
            from eight weighted health indicators.
          </p>

          <dl className="financial-health-group-guide">
            <div>
              <dt>Foundation, stability &amp; reliability</dt>
              <dd>Credit, Cash Flow, and Payment Health</dd>
            </div>
            <div>
              <dt>Control &amp; resilience</dt>
              <dd>Budget, Wealth, and Protection Health</dd>
            </div>
            <div>
              <dt>Future progress</dt>
              <dd>Investment and Goal Health</dd>
            </div>
          </dl>

          <div className="financial-health-status-row">
            <span className="financial-health-status-dot" aria-hidden="true" />
            <strong>{band}</strong>
            <span>Top health band</span>
          </div>
        </div>

        <figure
          className="financial-health-ring-figure"
          aria-label={`Financial Health score ${score} out of 1000, rated ${band}`}
        >
          <div className="financial-health-ring-visual">
            <svg viewBox="0 0 184 184" aria-hidden="true">
              <defs>
                <linearGradient id="financial-health-ring-gold" x1="22" y1="20" x2="162" y2="164" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#7b5008" />
                  <stop offset="0.24" stopColor="#f4c54f" />
                  <stop offset="0.43" stopColor="#ffe99a" />
                  <stop offset="0.68" stopColor="#d69a1e" />
                  <stop offset="1" stopColor="#845508" />
                </linearGradient>
                <linearGradient id="financial-health-ring-silver" x1="22" y1="20" x2="162" y2="164" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#656b73" />
                  <stop offset="0.24" stopColor="#d5d9de" />
                  <stop offset="0.43" stopColor="#f7f8f9" />
                  <stop offset="0.68" stopColor="#adb3ba" />
                  <stop offset="1" stopColor="#686e76" />
                </linearGradient>
                <linearGradient id="financial-health-ring-bronze" x1="22" y1="20" x2="162" y2="164" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#663213" />
                  <stop offset="0.24" stopColor="#c67a3b" />
                  <stop offset="0.43" stopColor="#f0ad70" />
                  <stop offset="0.68" stopColor="#a95726" />
                  <stop offset="1" stopColor="#653012" />
                </linearGradient>
              </defs>
              {groupRings.map((ring, index) => (
                <g key={ring.label} transform="rotate(-90 92 92)">
                  <circle
                    className="financial-health-ring-track"
                    cx="92"
                    cy="92"
                    r={ring.radius}
                    pathLength="100"
                  />
                  <circle
                    className="financial-health-ring-progress"
                    cx="92"
                    cy="92"
                    r={ring.radius}
                    pathLength="100"
                    stroke={FINANCIAL_HEALTH_RING_STROKES[index]}
                    strokeDasharray={`${ring.value} ${100 - ring.value}`}
                  />
                </g>
              ))}
            </svg>
            <div className="financial-health-ring-score">
              <strong>{score}</strong>
              <span>/ 1000</span>
            </div>
          </div>
          <figcaption className="financial-health-ring-legend">
            {groupRings.map((ring, index) => (
              <span key={ring.label}>
                <i
                  style={{
                    background: ring.color,
                    boxShadow: `0 0 8px ${ring.color}`,
                  }}
                  aria-hidden="true"
                />
                {FINANCIAL_HEALTH_RING_LEGEND[index]}
              </span>
            ))}
          </figcaption>
        </figure>
      </section>

      <section className="financial-health-compute-bar" aria-label="Financial Health computation controls">
        <div>
          <strong>{summaryComputedAt ? 'Latest saved inputs published' : 'Default Financial Health displayed. '}</strong>
          <span>
            {summaryComputedAt
              ? `Computed ${summaryComputedAt.toLocaleString()}`
              : summaryInputsLoaded
                ? 'Please refresh to compute the latest financial health.'
                : 'Checking saved inputs...'}
          </span>
        </div>

        
        <button
          type="button"
          className="financial-health-journey-main-fab"
          aria-label="Refresh Financial Health"
          onClick={computeLatestFinancialHealth}
          disabled={!summaryInputsLoaded}
        >
          Refresh
        </button>

        <div className="financial-health-snapshot-save">
       <label htmlFor="financial-health-snapshot-month">Snapshot as of</label>
       <input
         id="financial-health-snapshot-month"
         type="month"
         value={snapshotMonth}
         max={maxAllowedMonth} // Use the normalized YYYY-MM variable
         onChange={(event) => setSnapshotMonth(event.target.value)}
       />
       <button
         type="button"
         className="financial-health-journey-main-fab"
         aria-label="Save Snapshot"
         onClick={() => void saveFinancialHealthSnapshot()}
         disabled={
           !summaryComputedAt || 
           !selectedApplicationNo || 
           isSavingSnapshot || 
           !snapshotMonth || 
           snapshotMonthExists ||
           snapshotMonth > maxAllowedMonth // Disable if a future month is selected
         }
       >
            {isSavingSnapshot ? 'Saving...' : 'Save Snapshot'}
          </button>
          {snapshotMonthExists ? <span>A snapshot already exists for this month.</span> : null}
        </div>

        {isJourneyMinimized && !isJourneyDismissed ? (
          <button
            type="button"
            className="financial-health-journey-main-fab"
            onClick={() => window.location.assign('/build-profile')}
          >
            Update Profile
          </button>
          
          
        ) : null}
                {isJourneyMinimized && !isJourneyDismissed ? (
          <button
            type="button"
            className="financial-health-journey-main-fab"
            aria-label="Financial Journey Guide"
            onClick={openJourney}
          >
             Financial Guide
          </button>
          
          
        ) : null}
     
        
      </section>

      {snapshotMessage ? (
        <div
          className={`financial-health-snapshot-notice ${snapshotMessage.startsWith('Snapshot saved') ? 'is-success' : 'is-error'}`}
          role={snapshotMessage.startsWith('Snapshot saved') ? 'status' : 'alert'}
          aria-live="polite"
        >
          <strong>{snapshotMessage.startsWith('Snapshot saved') ? 'Snapshot saved' : 'Snapshot notice'}</strong>
          <span>{snapshotMessage}</span>
        </div>
      ) : null}

      <section className="financial-health-profile-line" aria-label="Selected financial health profile">
        <SelectedProfileIdCard className="financial-health-summary-tile financial-health-summary-tile-primary" compactId label="Record ID" />
        <article className="financial-health-summary-tile">
          <span>Actual Net Worth</span>
          <strong>{formatThousands(step8ProfileMetrics.actualNetWorth)}</strong>
          <small>Build Profile Step 8 current net worth</small>
        </article>
        <article className="financial-health-summary-tile">
          <span>Net Income</span>
          <strong>{formatThousands(step8ProfileMetrics.netIncome)}</strong>
          <small>Build Profile Step 8 monthly net income</small>
        </article>
        <article className="financial-health-summary-tile">
          <span>Protection Level Amount</span>
          <strong>{formatThousands(step8ProfileMetrics.protectionLevelAmount)}</strong>
          <small>Build Profile Step 8 insurance protection</small>
        </article>
      </section>


      <section className="financial-health-insight-grid" aria-label="Financial Health change, benchmarking, momentum, resilience, risks, and opportunities">
        <article className="financial-health-insight-card">
          <span>1. Financial Health Change</span>
          <strong>{financialHealthChange === null ? 'Pending' : `${financialHealthChange >= 0 ? '+' : ''}${financialHealthChange}`}</strong>
          {comparisonLabel ? <small>{comparisonLabel}</small> : null}
          <small>{changeNarration}</small>
        </article>
        <article className="financial-health-insight-card">
          <span>2. Benchmarking</span>
          <strong>World Inequality Database Result: {philippineIncomeBenchmark.globalRank}</strong>
          <small hidden>Your household income is currently in the {philippineIncomeBenchmark.nationalRank} in the Philippines.</small>
          <small>{philippineIncomeBenchmark.interpretation} · Monthly household income {new Intl.NumberFormat('en-PH', { style: 'currency', currency: benchmarkContext.currency, maximumFractionDigits: 0 }).format(philippineIncomeBenchmark.monthlyIncome)} · Annual household income {new Intl.NumberFormat('en-PH', { style: 'currency', currency: benchmarkContext.currency, maximumFractionDigits: 0 }).format(philippineIncomeBenchmark.annualIncome)} · Dependents {benchmarkContext.dependents} · Net worth {new Intl.NumberFormat('en-PH', { style: 'currency', currency: benchmarkContext.currency, maximumFractionDigits: 0 }).format(benchmarkContext.netWorth)}</small>
        </article>
        <article className="financial-health-insight-card">
          <span>3. Financial Momentum</span>
          <strong>{momentumLabel}</strong>
          <small>{momentumNarration}</small>
        </article>
        <article className="financial-health-insight-card">
          <span>4. Financial Resilience</span>
          <strong>{resilienceMonths === null ? 'Pending' : `${resilienceMonths.toFixed(1)} months`}</strong>
          <small>{resilienceNarration}</small>
        </article>
        <article className="financial-health-insight-card financial-health-insight-card-alert">
          <span>5. Risk Alerts</span>
          <strong>{riskIndicators.length + investmentRiskAlertCount}</strong>
          <small>{riskNarration}</small>
          <small>{investmentRiskNarration}</small>
        </article>
        <article className="financial-health-insight-card financial-health-insight-card-opportunity">
          <span>6. Opportunities</span>
          <strong>{opportunityIndicators.length}</strong>
          <small>{opportunityNarration}</small>
        </article>
      </section>

      <section className="financial-health-improvement-comparison" aria-labelledby="financial-health-improvement-title">
        <div className="financial-health-improvement-header">
          <div>
            <span>Improvement guide</span>
            <h2 id="financial-health-improvement-title">Risk Alerts, Opportunities and Recommended Tools</h2>
          </div>
          <p></p>
        </div>
        <div className="financial-health-improvement-table-wrap">
          <table className="financial-health-improvement-table">
            <thead>
              <tr>
                <th scope="col">Health Area</th>
                <th scope="col">Rating Explanation</th>
                <th scope="col">Risk Alert</th>
                <th scope="col">Opportunity</th>
                <th scope="col">FILSCORE Tools</th>
                <th scope="col">Generic Products</th>
              </tr>
            </thead>
            <tbody>
              {recommendedProducts.map((product) => {
                const guidance = VITAL_GUIDANCE[product.indicatorId]
                const rating = indicatorRating(product.score)
                const tools = FINANCIAL_HEALTH_TOOL_RECOMMENDATIONS[product.indicatorId] ?? []
                return (
                  <tr key={product.indicatorLabel}>
                    <th scope="row" data-label="Health Area">{product.indicatorLabel}<strong>{product.score}/100 · {rating.label}</strong></th>
                    <td data-label="Rating Explanation">{rating.explanation}</td>
                    <td data-label="Risk Alert">{product.score < 80 ? guidance?.negative : 'No current alert; maintain healthy habits.'}</td>
                    <td data-label="Opportunity">{guidance?.recommendation ?? product.outcome}</td>
                    <td data-label="FILSCORE Tools">
                      <div className="financial-health-tool-recommendations">
                        {tools.map((tool) => {
                          const hasActivity = journeyStepCompletion[tool.statusKey]
                          const status = !hasActivity ? 'Not started' : product.score < 80 ? 'In progress' : 'Updated'
                          const selectedQuery = selectedApplicationNo
                            ? `?applicationNo=${encodeURIComponent(selectedApplicationNo)}`
                            : ''
                          return (
                            <div className="financial-health-tool-recommendation" key={tool.route}>
                              <strong>{tool.name}</strong>
                              <span>{tool.reason}</span>
                              <div>
                                <span className={`financial-health-tool-status is-${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
                                <a href={`${tool.route}${selectedQuery}`}>Open tool</a>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </td>
                    <td data-label="Generic Products"><strong>{product.marketExamples}</strong><span>{product.outcome}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>



      <section className="financial-health-summary-grid financial-health-primary-summary" aria-label="Financial Health highlights">
        <article className="financial-health-summary-tile financial-health-summary-tile-primary">
          <span>Foundation & reliability</span>
          <strong>{groupRings[0].displayValue}</strong>
          <small>Credit, cash flow, and payment</small>
        </article>
        <article className="financial-health-summary-tile">
          <span>Control & resilience</span>
          <strong>{groupRings[1].displayValue}</strong>
          <small>Budget, wealth, and protection</small>
        </article>
        <article className="financial-health-summary-tile">
          <span>Future progress</span>
          <strong>{groupRings[2].displayValue}</strong>
          <small>Investment and goal health</small>
        </article>
        <article className="financial-health-summary-tile">
          <span>Strongest vital</span>
          <strong>{strongestIndicator.score}</strong>
          <small>{strongestIndicator.label}</small>
        </article>
      </section>

      <section className="psychometric-panel financial-health-position-panel" aria-labelledby="financial-position-rings-title">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">Core positions</span>
            <h2 id="financial-position-rings-title">Financial Position Rings</h2>
            <p className="financial-health-panel-intro">
              A quick view of cash flow, credit health, and progress toward your net-worth goal.
            </p>
          </div>
          <span className="financial-health-target-chip">Target 80+</span>
        </div>
        <div className="financial-health-position-rings">
          {positionRings.map((ring) => (
            <article
              key={ring.id}
              className="financial-health-position-ring-card"
              style={indicatorStyle(ring.accent, ring.softAccent)}
            >
              <div
                className="financial-health-position-ring financial-health-position-ring-trigger"
                role="progressbar"
                tabIndex={0}
                aria-label={`${ring.label} Ring: ${ring.score} out of 100`}
                aria-describedby={activePositionRingId === ring.id ? `financial-position-${ring.id}-recommendation` : undefined}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={ring.score}
                onMouseEnter={() => setActivePositionRingId(ring.id)}
                onMouseLeave={() => setActivePositionRingId(null)}
                onFocus={() => setActivePositionRingId(ring.id)}
                onBlur={() => setActivePositionRingId(null)}
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle className="financial-health-mini-track" cx="50" cy="50" r="42" pathLength="100" />
                  <circle
                    className="financial-health-mini-progress"
                    cx="50"
                    cy="50"
                    r="42"
                    pathLength="100"
                    strokeDasharray={`${ring.score} ${100 - ring.score}`}
                  />
                </svg>
                <strong>{ring.score}</strong>
                <span>/ 100</span>
              </div>
              {activePositionRingId === ring.id ? (
                <aside
                  id={`financial-position-${ring.id}-recommendation`}
                  className="financial-health-position-popover"
                  role="tooltip"
                >
                  <strong>{ring.label}: {ring.score}/100</strong>
                  <p>{ring.recommendation.summary}</p>
                  <b>To move toward 100/100:</b>
                  <ul>
                    {ring.recommendation.actions.map((action) => <li key={action}>{action}</li>)}
                  </ul>
                </aside>
              ) : null}
              <div className="financial-health-position-ring-copy">
                <h3>{ring.label}</h3>
                <p>{ring.description}</p>
                <strong>{ring.score >= 80 ? 'On track' : 'Needs attention'}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="psychometric-panel financial-health-vitals-panel" aria-labelledby="health-vitals-title">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">Health indicators</span>
            <h2 id="health-vitals-title">Your financial vital signs</h2>
            <p className="financial-health-panel-intro">
              Each ring is measured on a 0–100 scale. Scores at 80 or above are in the excellent zone.
            </p>
          </div>
          <span className="financial-health-target-chip">Target 80+</span>
        </div>

        <div className="financial-health-vitals-grid">
          {financialHealthIndicators.map((indicator) => {
            const guidance = VITAL_GUIDANCE[indicator.id]
            const isPositive = indicator.score >= 80
            const popoverId = `financial-health-vital-${indicator.id}-guidance`

            return (
              <article
                key={indicator.id}
                className="financial-health-vital-card"
                style={indicatorStyle(indicator.accent, indicator.softAccent)}
              >
                <div
                  className="financial-health-mini-ring financial-health-vital-trigger"
                  role="progressbar"
                  tabIndex={0}
                  aria-label={`${indicator.label}: ${indicator.score} out of 100`}
                  aria-describedby={activeVitalId === indicator.id ? popoverId : undefined}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={indicator.score}
                  onMouseEnter={() => setActiveVitalId(indicator.id)}
                  onMouseLeave={() => setActiveVitalId(null)}
                  onFocus={() => setActiveVitalId(indicator.id)}
                  onBlur={() => setActiveVitalId(null)}
                >
                  <svg viewBox="0 0 52 52" aria-hidden="true">
                    <circle className="financial-health-mini-track" cx="26" cy="26" r="21" pathLength="100" />
                    <circle
                      className="financial-health-mini-progress"
                      cx="26"
                      cy="26"
                      r="21"
                      pathLength="100"
                      strokeDasharray={`${indicator.score} ${100 - indicator.score}`}
                    />
                  </svg>
                  <strong>{indicator.score}</strong>
                </div>

                {activeVitalId === indicator.id ? (
                  <div
                    id={popoverId}
                    className={`financial-health-vital-popover ${isPositive ? 'is-positive' : 'is-negative'}`}
                    role="tooltip"
                  >
                    <strong>{isPositive ? 'Positive' : 'Needs improvement'}: {indicator.score}/100</strong>
                    <p>{isPositive ? guidance.positive : guidance.negative}</p>
                    <span><b>Recommendation:</b> {guidance.recommendation}</span>
                  </div>
                ) : null}

                <div className="financial-health-vital-copy">
                  <h3>{indicator.label}</h3>
                  <span>{isPositive ? 'Excellent zone' : 'Build next'}</span>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {isAdmin ? (
      <section className="psychometric-panel financial-health-source-panel" aria-labelledby="financial-health-source-title">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">Calculation transparency</span>
            <h2 id="financial-health-source-title">Computation Sources</h2>
            <p className="financial-health-panel-intro">
              Each displayed metric and indicator is traced to its saved workflow data and calculation rule.
              {summaryComputedAt
                ? ' The current values were published from the latest available saved inputs.'
                : ' Default model values remain displayed until Compute Latest Financial Health is selected.'}
            </p>
          </div>
        </div>

        <h3 className="financial-health-source-subtitle">Summary metrics</h3>
        <div className="financial-health-source-grid">
          {financialHealthMetricSources.map((metric) => (
            <article key={metric.label}>
              <strong>{metric.label}</strong>
              <span>{metric.source}</span>
              <code>{metric.formula}</code>
            </article>
          ))}
        </div>

        <section
          className="financial-health-product-recommendations"
          aria-labelledby="financial-health-recommended-products-title"
        >
          <div className="financial-health-product-recommendations-header">
            <div>
              <span>Profile priorities</span>
              <h3 id="financial-health-recommended-products-title">Recommended Products for this Profile</h3>
            </div>
            <small>Based on the three health indicators with the most room to reach the 80-point goal.</small>
          </div>
          <div className="financial-health-product-grid">
            {recommendedProducts.map((product) => (
              <article key={product.indicatorLabel}>
                <div>
                  <span>{product.indicatorLabel}</span>
                  <strong>{product.score}/100</strong>
                </div>
                <h4>{product.name}</h4>
                <p>{product.outcome}</p>
                <small>Goal: raise {product.indicatorLabel} to 80 or above.</small>
              </article>
            ))}
          </div>
        </section>

        <h3 className="financial-health-source-subtitle">Health indicators</h3>
        <div className="calculation-reference-table-wrap">
          <table className="calculation-reference-table financial-health-source-table">
            <thead>
              <tr>
                <th scope="col">Indicator</th>
                <th scope="col">Current</th>
                <th scope="col">Weight</th>
                <th scope="col">Source and basis</th>
                <th scope="col">Formula and scoring</th>
              </tr>
            </thead>
            <tbody>
              {financialHealthIndicatorSources.map((reference) => {
                const indicator = financialHealthIndicators.find((candidate) => candidate.id === reference.id)
                if (!indicator) return null

                return (
                  <tr key={reference.id}>
                    <th scope="row">{indicator.label}</th>
                    <td><strong>{indicator.score}</strong></td>
                    <td><strong>{indicator.weight}%</strong></td>
                    <td>
                      <strong>{reference.source}</strong>
                      <span>{reference.basis}</span>
                    </td>
                    <td>
                      <code>{reference.formula}</code>
                      <span>{reference.scoring}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      <section className="financial-health-detail-layout">
        <div className="financial-health-main-stack">
          <article className="psychometric-panel financial-health-trend-panel" aria-labelledby="financial-health-trend-title">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Up to 12 monthly snapshots</span>
                <h2 id="financial-health-trend-title">Monthly Financial Health Trend</h2>
                <p className="financial-health-panel-intro">
                  Published monthly history for overall health, credit health, and wealth building.
                </p>
              </div>
              <span className="financial-health-sample-chip">Saved snapshots</span>
            </div>

            <figure
              className="financial-health-trend-figure"
              role="img"
              aria-label="Monthly snapshot trend for Financial Health Score, Credit Health, and Wealth Building Score"
            >
              <div className="financial-health-trend-scroll">
                {financialHealthTrend.length === 0 ? (
                  <p className="status-message">Save a monthly snapshot to begin the trend.</p>
                ) : (
                <svg viewBox={`0 0 ${TREND_CHART_WIDTH} ${TREND_CHART_HEIGHT}`} aria-hidden="true">
                  {[0, 20, 40, 60, 80, 100].map((tick) => {
                    const y = trendChartY(tick)
                    return (
                      <g key={tick}>
                        <line
                          className={tick === 80 ? 'financial-health-trend-target' : 'financial-health-trend-grid-line'}
                          x1={TREND_CHART_LEFT}
                          x2={TREND_CHART_RIGHT}
                          y1={y}
                          y2={y}
                        />
                        <text className="financial-health-trend-axis-label" x="40" y={y + 4} textAnchor="end">{tick}</text>
                      </g>
                    )
                  })}

                  {FINANCIAL_HEALTH_TREND_SERIES.map((series) => (
                    <g key={series.id} data-trend-series={series.id}>
                      <path
                        className="financial-health-trend-line"
                        d={trendSeriesPath(series, financialHealthTrend)}
                        stroke={series.color}
                      />
                      {financialHealthTrend.map((point, index) => (
                        <g key={point.period}>
                          <circle
                            className="financial-health-trend-point"
                            data-trend-point={point.period}
                            cx={trendChartX(index, financialHealthTrend.length)}
                            cy={trendChartY(series.plotValue(point))}
                            r="5"
                            stroke={series.color}
                          />
                          <text
                            className="financial-health-trend-value"
                            x={trendChartX(index, financialHealthTrend.length)}
                            y={trendChartY(series.plotValue(point)) - 10}
                            textAnchor="middle"
                            fill={series.color}
                          >
                            {series.value(point)}
                          </text>
                        </g>
                      ))}
                    </g>
                  ))}

                  {financialHealthTrend.map((point, index) => (
                    <text
                      key={point.period}
                      className="financial-health-trend-period"
                      x={trendChartX(index, financialHealthTrend.length)}
                      y="270"
                      textAnchor="middle"
                    >
                      {point.period}
                    </text>
                  ))}
                </svg>
                )}
              </div>

              <figcaption className="financial-health-trend-legend">
                {FINANCIAL_HEALTH_TREND_SERIES.map((series) => (
                  <span key={series.id}>
                    <i style={{ background: series.color }} aria-hidden="true" />
                    {series.label}
                  </span>
                ))}
                <small>Financial Health uses the 1000-point score; lines share a normalized 0–100 plot.</small>
              </figcaption>
            </figure>
          </article>

          <article className="psychometric-panel financial-health-leaf-panel" aria-labelledby="lending-leaf-title">
          <div className="psychometric-panel-header">
            <div>
              <span className="psychometric-panel-kicker">Leaf graph</span>
              <h2 id="lending-leaf-title">Credit Health</h2>
              <p className="financial-health-panel-intro">
                The leaf darkens toward green as each score improves. Credit Score owns the left half.
                The right half is split across Behaviour or Psychometric, Social, and Non-Starter scores.
              </p>
            </div>
          </div>

          <div className="financial-health-leaf-layout">
            <figure className="financial-health-leaf-figure" role="img" aria-label={leafAriaLabel}>
              <svg className="financial-health-leaf-svg" viewBox="0 0 260 320" aria-hidden="true">
                <defs>
                  <clipPath id="financial-health-leaf-clip">
                    <path d="M130 16C80 20 44 64 36 126C28 185 52 248 108 294C117 302 126 308 130 312C134 308 143 302 152 294C208 248 232 185 224 126C216 64 180 20 130 16Z" />
                  </clipPath>
                  {leafSegments.map((segment) => (
                    <linearGradient key={segment.id} id={`financial-health-leaf-${segment.id}-gradient`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.72" />
                      <stop offset="48%" stopColor={segment.fill} stopOpacity="0.88" />
                      <stop offset="100%" stopColor={segment.fill} />
                    </linearGradient>
                  ))}
                  <linearGradient id="financial-health-leaf-sheen" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
                    <stop offset="45%" stopColor="rgba(255,255,255,0.08)" />
                    <stop offset="100%" stopColor="rgba(15,23,42,0.08)" />
                  </linearGradient>
                </defs>

                <g clipPath="url(#financial-health-leaf-clip)">
                  <rect x="27" y="24" width="206" height="272" fill="#f8fafc" />
                  {leafSegments.map((segment) => (
                    <path
                      key={segment.id}
                      className="financial-health-leaf-score-region"
                      data-score-region={segment.id}
                      d={segment.path}
                      fill={`url(#financial-health-leaf-${segment.id}-gradient)`}
                    />
                  ))}
                  <rect x="27" y="24" width="206" height="272" fill="url(#financial-health-leaf-sheen)" />
                  <path className="financial-health-leaf-score-boundary" d="M130 24C118 78 143 139 128 200C117 244 138 276 130 296" />
                  <path className="financial-health-leaf-score-boundary" d="M134 116C174 135 205 104 233 118" />
                  <path className="financial-health-leaf-score-boundary" d="M128 200C171 221 204 190 233 205" />
                </g>

                <path className="financial-health-leaf-outline" d="M130 16C80 20 44 64 36 126C28 185 52 248 108 294C117 302 126 308 130 312C134 308 143 302 152 294C208 248 232 185 224 126C216 64 180 20 130 16Z" />
                <path className="financial-health-leaf-vein" d="M130 30V286" />
                <path className="financial-health-leaf-vein" d="M130 122C112 110 90 104 66 102" />
                <path className="financial-health-leaf-vein" d="M130 170C108 162 88 160 62 165" />
                <path className="financial-health-leaf-vein" d="M130 122C148 110 170 104 194 102" />
                <path className="financial-health-leaf-vein" d="M130 170C152 162 172 160 198 165" />
                <path className="financial-health-leaf-stem" d="M130 284C130 298 128 309 121 319" />
              </svg>
            </figure>

            <div className="financial-health-leaf-legend" role="list" aria-label="Leaf graph score legend">
              {leafSegments.map((segment) => (
                <article key={segment.id} className="financial-health-leaf-legend-item" role="listitem">
                  <span className="financial-health-leaf-swatch" style={{ background: segment.fill }} aria-hidden="true" />
                  <div>
                    <strong>{segment.label}</strong>
                    <span>
                      {segment.score === null
                        ? 'Pending score'
                        : `${segment.score}/100${segment.filscore === null ? '' : ` • FILScore ${segment.filscore}`}`}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {!hasLendingLeafScores ? (
            <p className="financial-health-leaf-empty">
              Awaiting a saved loan application draft to paint the leaf with live lending scores.
            </p>
          ) : null}
          </article>

          <article className="psychometric-panel financial-health-chart-panel" aria-labelledby="health-profile-title">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Comparative graph</span>
                <h2 id="health-profile-title">Health profile and weighted contribution</h2>
                <p className="financial-health-panel-intro">
                  Bar length shows the indicator score. The marker shows the recommended 80-point target.
                </p>
              </div>
            </div>

            <div className="financial-health-chart-head" aria-hidden="true">
              <span>Indicator</span>
              <span>Score profile</span>
              <span>Score</span>
              <span>Weight</span>
              <span>Points</span>
            </div>

            <div className="financial-health-chart" role="list" aria-label="Indicator score comparison">
              {financialHealthIndicators.map((indicator) => (
                <div
                  key={indicator.id}
                  className="financial-health-chart-row"
                  role="listitem"
                  tabIndex={0}
                  aria-describedby={activeChartIndicatorId === indicator.id
                    ? `financial-health-chart-${indicator.id}-recommendation`
                    : undefined}
                  style={indicatorStyle(indicator.accent, indicator.softAccent)}
                  onMouseEnter={() => setActiveChartIndicatorId(indicator.id)}
                  onMouseLeave={() => setActiveChartIndicatorId(null)}
                  onFocus={() => setActiveChartIndicatorId(indicator.id)}
                  onBlur={() => setActiveChartIndicatorId(null)}
                >
                  <strong className="financial-health-chart-label">{indicator.label}</strong>
                  <div
                    className="financial-health-bar-track"
                    role="progressbar"
                    aria-label={`${indicator.label} score`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={indicator.score}
                  >
                    <span className="financial-health-target-line" aria-hidden="true" />
                    <span className="financial-health-bar-fill" style={{ width: `${indicator.score}%` }} />
                  </div>
                  <strong className="financial-health-chart-value">{indicator.score}</strong>
                  <span className="financial-health-chart-weight">{indicator.weight}%</span>
                  <span className="financial-health-chart-points">
                    {calculateWeightedContribution(indicator).toFixed(2)}
                  </span>
                  {activeChartIndicatorId === indicator.id ? (
                    <div
                      id={`financial-health-chart-${indicator.id}-recommendation`}
                      className={`financial-health-chart-popover ${indicator.score >= 80 ? 'is-positive' : 'is-negative'}`}
                      role="tooltip"
                    >
                      <strong>{indicator.label}: {indicator.score}/100</strong>
                      <p>
                        {indicator.score >= 80
                          ? VITAL_GUIDANCE[indicator.id].positive
                          : VITAL_GUIDANCE[indicator.id].negative}
                      </p>
                      <span><b>Overall recommendation:</b> {VITAL_GUIDANCE[indicator.id].recommendation}</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="financial-health-side-stack">


          <article className="psychometric-panel financial-health-band-panel">
            <span className="psychometric-panel-kicker">Interpretation</span>
            <h2>Health bands</h2>
            <ul className="financial-health-band-list">
              {healthBands.map((healthBand) => (
                <li
                  key={healthBand.label}
                  className={healthBand.label === band ? 'financial-health-band-current' : undefined}
                >
                  <i className={healthBand.className} aria-hidden="true" />
                  <span>{healthBand.label}</span>
                  <strong>{healthBand.range}</strong>
                </li>
              ))}
            </ul>
          </article>

          <article className="psychometric-panel financial-health-focus-panel">
            <span className="psychometric-panel-kicker">Focus next</span>
            <h2>{priorityIndicator.label}</h2>
            <div className="financial-health-focus-score">
              <strong>{priorityIndicator.score}</strong>
              <span>/ 100</span>
            </div>
            <p>
              Build investment consistency first, then strengthen Protection Health at 76. These are
              the clearest opportunities to lift Future Progress and resilience.
            </p>
          </article>

          <article className="psychometric-panel financial-health-graph-guide">
            <span className="psychometric-panel-kicker">Health Monitoring Style</span>
            <h2>Financial Health Ring system</h2>
            <ul>
              <li><strong>Activity rings</strong> for the overall glance.</li>
              <li><strong>Vital cards</strong> for the eight current readings.</li>
              <li><strong>Horizontal bars</strong> for accurate comparison and weights.</li>
              <li><strong>Trend lines</strong> once three or more reporting periods exist.</li>
            </ul>
          </article>

          <article className="psychometric-panel financial-health-formula-panel">
            <span className="psychometric-panel-kicker">In a Glance</span>
            <h2>Summary Score</h2>
            <p>
              The Scores can be saved as of {new Date().toLocaleDateString()} and covering monthly period. 
            </p>
            <div className="financial-health-equation">
              <span>Σ (indicator score × weight)</span>
              Credit: lending credit score
              Cash flow: cash-flow strength
              Wealth: normalized net-worth score
              Budget: budget-health score
              Payment: leverage-control score
              Protection: protection-coverage score
              Investment: average of investment, retirement, and financial-independence readiness
              Goal: goal-momentum score
              <small>Weights total 100%</small>
            </div>
            <p className="financial-health-method-note">
              Recommended as a transparent wellness index. Calibrate weights against real outcomes
              before using it for credit decisions. Algo is intended for guidance only.
            </p>
          </article>



        </aside>
      </section>

    </div>
  )
}
