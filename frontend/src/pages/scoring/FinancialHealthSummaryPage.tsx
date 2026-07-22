import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { fetchAutosaveDraft } from '../../autosave/draftApi'

import {
  buildFinancialHealthGroupRings,
  calculateFinancialHealthIndex,
  calculateWeightedContribution,
  financialHealthIndicators,
  getFinancialHealthBand,
  scaleFinancialHealthIndex,
} from './financialHealthModel'
import { toFilscore } from './filscoreScale'
import {
  computeNetWorthBuildingScore,
  type NetWorthBuildingDraftInput,
  type NetWorthBuildingScoreResult,
} from './netWorthBuildingEngine'
import {
  computeWealthFoundationScore,
  explainWealthFoundationResult,
  type WealthFoundationScoreResult,
} from './wealthFoundationEngine'

type IndicatorStyle = CSSProperties & {
  '--health-accent': string
  '--health-soft': string
}

type LendingLeafScores = {
  creditScore: number | null
  psychometricScore: number | null
  socialScore: number | null
  nonStarterScore: number | null
}

type LendingLeafSegment = {
  id: 'credit' | 'psychometric' | 'social' | 'nonStarter'
  label: string
  score: number | null
  filscore: number | null
  x: number
  y: number
  width: number
  height: number
  fill: string
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
    return `rgba(203, 213, 225, ${alpha})`
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
  }
}

export default function FinancialHealthSummaryPage() {
  const [netWorthBuildingScore, setNetWorthBuildingScore] = useState<NetWorthBuildingScoreResult | null>(null)
  const [wealthFoundationScore, setWealthFoundationScore] = useState<WealthFoundationScoreResult | null>(null)
  const [lendingLeafScores, setLendingLeafScores] = useState<LendingLeafScores | null>(null)

  useEffect(() => {
    let disposed = false

    const loadNetWorthDraft = async () => {
      try {
        const remoteDraft = await fetchAutosaveDraft<NetWorthBuildingDraftInput>('net-worth-positioning', 'primary')
        if (disposed || !remoteDraft?.payload) {
          setNetWorthBuildingScore(null)
          setWealthFoundationScore(null)
        } else {
          setNetWorthBuildingScore(computeNetWorthBuildingScore(remoteDraft.payload))
          setWealthFoundationScore(computeWealthFoundationScore(remoteDraft.payload))
        }
      } catch {
        if (!disposed) {
          setNetWorthBuildingScore(null)
          setWealthFoundationScore(null)
        }
      }

      try {
        const lendingDraft = await fetchAutosaveDraft<unknown>('loan-application', 'new')
        if (!disposed) {
          setLendingLeafScores(lendingDraft?.payload ? deriveLendingLeafScores(lendingDraft.payload) : null)
        }
      } catch {
        if (!disposed) {
          setLendingLeafScores(null)
        }
      }
    }

    void loadNetWorthDraft()

    return () => {
      disposed = true
    }
  }, [])

  const groupRings = useMemo(
    () => buildFinancialHealthGroupRings(financialHealthIndicators),
    [],
  )
  const wealthFoundationInsight = useMemo(
    () => (wealthFoundationScore ? explainWealthFoundationResult(wealthFoundationScore) : null),
    [wealthFoundationScore],
  )
  const index = calculateFinancialHealthIndex(financialHealthIndicators)

  if (index === null) {
    return (
      <div className="psychometric-page financial-health-page">
        <section className="psychometric-panel financial-health-provisional">
          <span className="psychometric-panel-kicker">Financial Health</span>
          <h1>Provisional result</h1>
          <p>All eight weighted indicators are required before a Financial Health score can be shown.</p>
        </section>
      </div>
    )
  }

  const score = scaleFinancialHealthIndex(index)
  const band = getFinancialHealthBand(score)
  const strongestIndicator = financialHealthIndicators.reduce((strongest, indicator) =>
    indicator.score > strongest.score ? indicator : strongest,
  )
  const priorityIndicator = financialHealthIndicators.reduce((priority, indicator) =>
    indicator.score < priority.score ? indicator : priority,
  )
  const rightLeafTotal = 1 / 3 + 1 / 4 + 1 / 3
  const leafSegments: LendingLeafSegment[] = [
    {
      id: 'credit',
      label: 'Credit Score',
      score: lendingLeafScores?.creditScore ?? null,
      filscore: toFilscore(lendingLeafScores?.creditScore ?? null),
      x: 27,
      y: 24,
      width: 103,
      height: 272,
      fill: scoreTone(lendingLeafScores?.creditScore ?? null),
    },
    {
      id: 'psychometric',
      label: 'Behaviour / Psychometric Score',
      score: lendingLeafScores?.psychometricScore ?? null,
      filscore: toFilscore(lendingLeafScores?.psychometricScore ?? null),
      x: 130,
      y: 24,
      width: 103,
      height: 272 * ((1 / 3) / rightLeafTotal),
      fill: scoreTone(lendingLeafScores?.psychometricScore ?? null),
    },
    {
      id: 'social',
      label: 'Social Score',
      score: lendingLeafScores?.socialScore ?? null,
      filscore: toFilscore(lendingLeafScores?.socialScore ?? null),
      x: 130,
      y: 24 + 272 * ((1 / 3) / rightLeafTotal),
      width: 103,
      height: 272 * ((1 / 4) / rightLeafTotal),
      fill: scoreTone(lendingLeafScores?.socialScore ?? null),
    },
    {
      id: 'nonStarter',
      label: 'Non-Starter Score',
      score: lendingLeafScores?.nonStarterScore ?? null,
      filscore: toFilscore(lendingLeafScores?.nonStarterScore ?? null),
      x: 130,
      y:
        24 +
        272 * ((1 / 3) / rightLeafTotal) +
        272 * ((1 / 4) / rightLeafTotal),
      width: 103,
      height: 272 * ((1 / 3) / rightLeafTotal),
      fill: scoreTone(lendingLeafScores?.nonStarterScore ?? null),
    },
  ]
  const hasLendingLeafScores = leafSegments.some((segment) => segment.score !== null)
  const leafAriaLabel = hasLendingLeafScores
    ? leafSegments
        .map((segment) => `${segment.label} ${segment.score ?? 'Pending'} out of 100`)
        .join(', ')
    : 'Leaf graph awaiting saved lending scores'

  return (
    <div className="psychometric-page financial-health-page">
      <section className="psychometric-hero financial-health-hero" aria-labelledby="financial-health-title">
        <div className="psychometric-hero-copy financial-health-hero-copy">
          <span className="psychometric-eyebrow">FILSCORE Financial Vital Signs</span>
          <h1 id="financial-health-title">Financial Health</h1>
          <p>
            One clear view of your financial stability, control, and future progress—calculated
            from eight weighted health indicators.
          </p>

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
              {groupRings.map((ring) => (
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
                    stroke={ring.color}
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
            {groupRings.map((ring) => (
              <span key={ring.label}>
                <i style={{ background: ring.color }} aria-hidden="true" />
                {ring.label} {ring.displayValue}
              </span>
            ))}
          </figcaption>
        </figure>
      </section>

      <section className="financial-health-summary-grid" aria-label="Financial Health highlights">
        <article className="financial-health-summary-tile financial-health-summary-tile-primary">
          <span>Foundation & reliability</span>
          <strong>91.0</strong>
          <small>Credit, cash flow, and payment</small>
        </article>
        <article className="financial-health-summary-tile">
          <span>Control & resilience</span>
          <strong>80.5</strong>
          <small>Budget, wealth, and protection</small>
        </article>
        <article className="financial-health-summary-tile">
          <span>Future progress</span>
          <strong>77.3</strong>
          <small>Investment and goal health</small>
        </article>
        <article className="financial-health-summary-tile">
          <span>Strongest vital</span>
          <strong>{strongestIndicator.score}</strong>
          <small>{strongestIndicator.label}</small>
        </article>
      </section>

      <section className="psychometric-panel" aria-labelledby="net-worth-building-summary-title">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">Additional Summary Item</span>
            <h2 id="net-worth-building-summary-title">Net Worth Building Score</h2>
            <p className="financial-health-panel-intro">
              Added below the existing Financial Health summary without changing the original health indicators.
            </p>
          </div>
        </div>

        <section className="financial-health-summary-grid" aria-label="Net Worth Building highlights">
          <article className="financial-health-summary-tile financial-health-summary-tile-primary">
            <span>Net Worth Building Score</span>
            <strong>{netWorthBuildingScore ? netWorthBuildingScore.score : 'Pending'}</strong>
            <small>{netWorthBuildingScore ? `${netWorthBuildingScore.grade} - ${netWorthBuildingScore.rating}` : 'Loads from the saved Net Worth workflow'}</small>
          </article>
          <article className="financial-health-summary-tile">
            <span>Range Score</span>
            <strong>{netWorthBuildingScore ? netWorthBuildingScore.rangeScore : 'Pending'}</strong>
            <small>10-tier band from 200 to 900</small>
          </article>
          <article className="financial-health-summary-tile">
            <span>Net Worth</span>
            <strong>{netWorthBuildingScore ? netWorthBuildingScore.metrics.netWorth.toLocaleString() : 'Pending'}</strong>
            <small>Computed from saved workflow inputs</small>
          </article>
          <article className="financial-health-summary-tile">
            <span>Monthly Cash Flow</span>
            <strong>{netWorthBuildingScore ? netWorthBuildingScore.metrics.monthlyCashFlow.toLocaleString() : 'Pending'}</strong>
            <small>Supports the wealth-building position</small>
          </article>
        </section>
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
          {financialHealthIndicators.map((indicator) => (
            <article
              key={indicator.id}
              className="financial-health-vital-card"
              style={indicatorStyle(indicator.accent, indicator.softAccent)}
            >
              <div
                className="financial-health-mini-ring"
                role="progressbar"
                aria-label={`${indicator.label}: ${indicator.score} out of 100`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={indicator.score}
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

              <div className="financial-health-vital-copy">
                <h3>{indicator.label}</h3>
                <span>{indicator.score >= 80 ? 'Excellent zone' : 'Build next'}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="financial-health-detail-layout">
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
                style={indicatorStyle(indicator.accent, indicator.softAccent)}
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
              </div>
            ))}
          </div>
        </article>

        <article className="psychometric-panel financial-health-leaf-panel" aria-labelledby="lending-leaf-title">
          <div className="psychometric-panel-header">
            <div>
              <span className="psychometric-panel-kicker">Leaf graph</span>
              <h2 id="lending-leaf-title">Lending score leaf graph</h2>
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
                </defs>

                <g clipPath="url(#financial-health-leaf-clip)">
                  <rect x="27" y="24" width="206" height="272" fill="#f8fafc" />
                  {leafSegments.map((segment) => (
                    <g key={segment.id}>
                      <rect x={segment.x} y={segment.y} width={segment.width} height={segment.height} fill={segment.fill} />
                    </g>
                  ))}
                  <rect x="27" y="24" width="206" height="272" fill="url(#financial-health-leaf-sheen)" />
                </g>

                <defs>
                  <linearGradient id="financial-health-leaf-sheen" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
                    <stop offset="45%" stopColor="rgba(255,255,255,0.08)" />
                    <stop offset="100%" stopColor="rgba(15,23,42,0.08)" />
                  </linearGradient>
                </defs>

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

        <aside className="financial-health-side-stack">
          <article className="psychometric-panel financial-health-formula-panel">
            <span className="psychometric-panel-kicker">Recommended formula</span>
            <h2>Transparent weighted index</h2>
            <p>
              Give more influence to recurring liquidity, payment behavior, and goal progress while
              keeping every financial vital represented.
            </p>
            <div className="financial-health-equation">
              <span>Σ (indicator score × weight)</span>
              <strong>{index.toFixed(1)} × 10 = {score}</strong>
              <small>Weights total 100%</small>
            </div>
            <p className="financial-health-method-note">
              Recommended as a transparent wellness index. Calibrate weights against real outcomes
              before using it for credit decisions. Model FHI v1.0 does not reweight missing data.
            </p>
          </article>

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
            <span className="psychometric-panel-kicker">Graph style</span>
            <h2>Apple Health–inspired system</h2>
            <ul>
              <li><strong>Activity rings</strong> for the overall glance.</li>
              <li><strong>Vital cards</strong> for the eight current readings.</li>
              <li><strong>Horizontal bars</strong> for accurate comparison and weights.</li>
              <li><strong>Trend lines</strong> once three or more reporting periods exist.</li>
            </ul>
          </article>
        </aside>
      </section>

      <section className="financial-health-detail-layout" aria-labelledby="wealth-foundation-summary-title">
        <article className="psychometric-panel financial-health-chart-panel financial-health-wealth-panel">
          <div className="psychometric-panel-header">
            <div>
              <span className="psychometric-panel-kicker">Wealth Foundation Engine</span>
              <h2 id="wealth-foundation-summary-title">Wealth Foundation Score</h2>
              <p className="financial-health-panel-intro">
                Scaled from a 0 to 35 model into a 0 to 1000 summary score with a positioning band.
              </p>
            </div>
          </div>

          <div className="financial-health-summary-grid financial-health-wealth-summary-grid" aria-label="Wealth Foundation highlights">
            <article className="financial-health-summary-tile financial-health-summary-tile-primary">
              <span>Score</span>
              <strong>{wealthFoundationScore ? wealthFoundationScore.score : 'Pending'}</strong>
              <small>{wealthFoundationScore ? `${wealthFoundationScore.rawScore.toFixed(0)} / 35 raw` : 'Loads from the saved Net Worth workflow'}</small>
            </article>
            <article className="financial-health-summary-tile">
              <span>Position</span>
              <strong>{wealthFoundationScore ? wealthFoundationScore.positioningBand : 'Pending'}</strong>
              <small>{wealthFoundationScore ? wealthFoundationScore.rangeScore : '0 to 35 tier range'}</small>
            </article>
            <article className="financial-health-summary-tile">
              <span>Emergency Fund</span>
              <strong>
                {wealthFoundationScore ? `${wealthFoundationScore.metrics.emergencyFundMonths.toFixed(1)} months` : 'Pending'}
              </strong>
              <small>Coverage from available liquid reserves</small>
            </article>
            <article className="financial-health-summary-tile">
              <span>Cash Flow</span>
              <strong>
                {wealthFoundationScore ? wealthFoundationScore.metrics.positiveCashflowScore.toLocaleString() : 'Pending'}
              </strong>
              <small>Monthly income minus monthly expenses</small>
            </article>
          </div>
        </article>

        <aside className="financial-health-side-stack">
          <article className="psychometric-panel financial-health-formula-panel">
            <span className="psychometric-panel-kicker">Improve next</span>
            <h2>Recommendations to strengthen the foundation</h2>
            <ul className="financial-health-band-list">
              {wealthFoundationInsight?.recommendations.map((item) => (
                <li key={item}>
                  <i className="financial-health-band-building" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
              {!wealthFoundationInsight ? (
                <li>
                  <i className="financial-health-band-building" aria-hidden="true" />
                  <span>Awaiting saved workflow inputs before recommendations can be generated.</span>
                </li>
              ) : null}
            </ul>
          </article>
        </aside>
      </section>
    </div>
  )
}
