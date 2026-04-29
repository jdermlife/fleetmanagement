import { useMemo, useState } from 'react'


type ScorecardCriterion = {
  id: string
  label: string
  hint: string
  weight: number
  critical?: boolean
}

type ScorecardSection = {
  id: string
  title: string
  weight: number
  description: string
  criteria: ScorecardCriterion[]
}


const ratingLabels = {
  1: 'Exceptional',
  2: 'Strong',
  3: 'Acceptable',
  4: 'Weak',
  5: 'High Risk',
} as const

const scorecardSections: ScorecardSection[] = [
  {
    id: 'financial-based-lending',
    title: 'Financial Based Lending',
    weight: 35,
    description: 'Core financial capacity and management strength, following the structure shown in the paper scorecard.',
    criteria: [
      { id: 'profitability', label: 'Profitability / Earnings Quality', hint: 'Measure earnings consistency, margin stability, and resilience of core income.', weight: 20 },
      { id: 'debt-service', label: 'Capacity to Service Debt', hint: 'Assess whether current and projected cash flow can comfortably cover debt obligations.', weight: 25, critical: true },
      { id: 'organization', label: 'Organization Structure / Succession Planning', hint: 'Review depth of management bench and continuity planning.', weight: 15 },
      { id: 'financial-management', label: 'Financial Management Capabilities', hint: 'Evaluate reporting discipline, planning rigor, and finance leadership quality.', weight: 20 },
      { id: 'planning-mis', label: 'Planning Capabilities / MIS', hint: 'Review budgeting, management reports, and decision-useful information systems.', weight: 10 },
      { id: 'ownership-strength', label: 'Ownership Strength', hint: 'Consider sponsor commitment, reputation, and strategic alignment with the business.', weight: 10 },
    ],
  },
  {
    id: 'industry-evaluation',
    title: 'Industry Evaluation',
    weight: 15,
    description: 'Balance-sheet and operating indicators derived from the industry and business structure portions of the illustration.',
    criteria: [
      { id: 'leverage-ratios', label: 'Debt Service / Leverage Ratios', hint: 'Rate leverage, gearing, and debt-service tolerance versus sector norms.', weight: 30, critical: true },
      { id: 'capital-structure', label: 'Capital Structure / Net Worth', hint: 'Score capitalization quality, retained strength, and balance-sheet buffer.', weight: 20 },
      { id: 'asset-structure', label: 'Asset Structure', hint: 'Review asset mix, convertibility, and supportiveness for stable operations.', weight: 10 },
      { id: 'earnings-assessment', label: 'Earnings Assessment', hint: 'Look at revenue durability, margin behavior, and forward earnings momentum.', weight: 20 },
      { id: 'liquidity', label: 'Liquidity', hint: 'Measure short-term coverage, working-capital comfort, and liquidity discipline.', weight: 20, critical: true },
    ],
  },
  {
    id: 'qualitative-assessment',
    title: 'Qualitative Assessment',
    weight: 15,
    description: 'Business quality, operational positioning, and structural soundness beyond the raw numbers.',
    criteria: [
      { id: 'cultural-fit', label: 'Cultural Fit', hint: 'Match between borrower culture, lender expectations, and governance style.', weight: 20 },
      { id: 'raw-materials', label: 'Quality of Raw Materials / Dependencies', hint: 'Concentration, sourcing risk, and input reliability for business continuity.', weight: 20 },
      { id: 'pricing-attainment', label: 'Pricing Attainment', hint: 'Ability to pass on cost pressure and protect margin quality.', weight: 20 },
      { id: 'customer-franchise', label: 'Product / Customer Franchise', hint: 'Durability of the business proposition, customer stickiness, and competitive position.', weight: 20 },
      { id: 'employee-turnover', label: 'Employee Turnover / Workforce Stability', hint: 'Operational continuity risk caused by labor instability or key-person churn.', weight: 20 },
    ],
  },
  {
    id: 'behavioral-qualities',
    title: 'Behavioral Qualities',
    weight: 20,
    description: 'Borrower behavior, sponsor support, and relationship posture that can materially change actual risk.',
    criteria: [
      { id: 'payment-behavior', label: 'Payment Behavior', hint: 'Observed payment discipline, covenant behavior, and frequency of delays.', weight: 25, critical: true },
      { id: 'ability-infuse', label: 'Ability to Infuse Capital', hint: 'Sponsor liquidity and practical ability to inject funds if needed.', weight: 20 },
      { id: 'willingness-infuse', label: 'Willingness to Infuse Capital', hint: 'Likelihood that the sponsor will support the account in a stress event.', weight: 15 },
      { id: 'competence-pattern', label: 'Competence Pattern', hint: 'Decision quality, execution discipline, and management judgement in past cycles.', weight: 15 },
      { id: 'bargaining-ability', label: 'Bargaining Ability', hint: 'Commercial leverage with customers, suppliers, and counterparties.', weight: 10 },
      { id: 'field-visit', label: 'Cooperative Behavior / Field Visit', hint: 'Transparency, responsiveness, and observable operating discipline on review.', weight: 15 },
    ],
  },
  {
    id: 'collateral-evaluation',
    title: 'Collateral Evaluation',
    weight: 15,
    description: 'Security coverage and enforceability, modeled after the collateral section of the form.',
    criteria: [
      { id: 'collateral-coverage', label: 'Collateral Coverage', hint: 'Coverage versus exposure after prudent haircut assumptions.', weight: 40, critical: true },
      { id: 'encumbrance-terms', label: 'Encumbrance of Collateral / Terms', hint: 'Title clarity, competing claims, and practical recovery constraints.', weight: 35 },
      { id: 'lien-position', label: 'Lien Position / Enforceability', hint: 'Legal perfection, documentation quality, and ease of enforcement.', weight: 25, critical: true },
    ],
  },
]


const defaultRatings = Object.fromEntries(
  scorecardSections.flatMap((section) => section.criteria.map((criterion) => [criterion.id, 3])),
) as Record<string, number>


function LendingScorecard() {
  const [accountName, setAccountName] = useState('EDWHOW')
  const [facilityType, setFacilityType] = useState('Financial Based Lending')
  const [ratings, setRatings] = useState<Record<string, number>>(defaultRatings)
  const [relationshipNotes, setRelationshipNotes] = useState('')

  const summary = useMemo(() => {
    const sectionScores = scorecardSections.map((section) => {
      const sectionScore =
        section.criteria.reduce((total, criterion) => total + ratings[criterion.id] * criterion.weight, 0) /
        section.criteria.reduce((total, criterion) => total + criterion.weight, 0)

      return {
        ...section,
        score: sectionScore,
        contribution: (sectionScore * section.weight) / 100,
      }
    })

    const overallScore = sectionScores.reduce((total, section) => total + section.contribution, 0)
    const strengthPercent = Math.round(((5 - overallScore) / 4) * 100)
    const hasCriticalOverride = scorecardSections.some((section) =>
      section.criteria.some((criterion) => criterion.critical && ratings[criterion.id] === 5),
    )

    const grade = hasCriticalOverride ? 'Override' : getRiskGrade(overallScore)
    const gradeLabel = hasCriticalOverride ? 'Default Risk Override' : getRiskLabel(grade)
    const narrative = hasCriticalOverride ? 'At least one critical driver was rated at the highest-risk level, so the scorecard raises a hard override.' : getRiskNarrative(grade)

    return {
      overallScore,
      strengthPercent,
      grade,
      gradeLabel,
      narrative,
      sectionScores,
    }
  }, [ratings])

  function updateRating(criterionId: string, value: number) {
    setRatings((currentRatings) => ({
      ...currentRatings,
      [criterionId]: value,
    }))
  }

  return (
    <div className="scorecard-page">
      <div className="scorecard-header">
        <div>
          <h2>Lending Scorecard</h2>
          <p>
            Interactive version of the paper-based credit scorecard. Rate each line from <strong>1</strong> (best)
            to <strong>5</strong> (highest risk) and the page computes weighted section scores, an overall risk
            signal, and an override when a critical criterion is max-risk.
          </p>
        </div>

        <div className="scorecard-summary-card">
          <span className="scorecard-pill">{facilityType}</span>
          <strong className="scorecard-total">{summary.overallScore.toFixed(2)} / 5.00</strong>
          <span className={`scorecard-grade scorecard-grade-${summary.grade.toLowerCase()}`}>{summary.gradeLabel}</span>
          <small>{summary.strengthPercent}% portfolio fit</small>
        </div>
      </div>

      <div className="scorecard-meta">
        <label>
          Name of Account
          <input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Borrower / account name" />
        </label>
        <label>
          Scorecard Type
          <input value={facilityType} onChange={(event) => setFacilityType(event.target.value)} placeholder="Facility type" />
        </label>
      </div>

      <div className="scorecard-legend">
        {Object.entries(ratingLabels).map(([value, label]) => (
          <div className={`scorecard-legend-item scorecard-legend-${value}`} key={value}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="scorecard-grid">
        <div className="scorecard-sections">
          {scorecardSections.map((section) => {
            const sectionSummary = summary.sectionScores.find((sectionScore) => sectionScore.id === section.id)

            return (
              <section className="scorecard-section-card" key={section.id}>
                <div className="scorecard-section-header">
                  <div>
                    <h3>{section.title}</h3>
                    <p>{section.description}</p>
                  </div>
                  <div className="scorecard-section-badge">
                    <strong>{section.weight}%</strong>
                    <span>{sectionSummary?.score.toFixed(2)} avg</span>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="scorecard-table">
                    <thead>
                      <tr>
                        <th>Criterion</th>
                        <th>Guide</th>
                        <th>Weight</th>
                        <th>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.criteria.map((criterion) => (
                        <tr key={criterion.id}>
                          <td>
                            <div className="scorecard-criterion-title">
                              {criterion.label}
                              {criterion.critical ? <span className="scorecard-critical-chip">Critical</span> : null}
                            </div>
                          </td>
                          <td>{criterion.hint}</td>
                          <td>{criterion.weight}%</td>
                          <td>
                            <select
                              value={ratings[criterion.id]}
                              onChange={(event) => updateRating(criterion.id, Number(event.target.value))}
                            >
                              {Object.entries(ratingLabels).map(([value, label]) => (
                                <option value={value} key={value}>
                                  {value} - {label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>

        <aside className="scorecard-side-panel">
          <div className="scorecard-outcome-card">
            <h3>Computed Result</h3>
            <div className="scorecard-outcome-grid">
              <div>
                <span>Account</span>
                <strong>{accountName || 'Unnamed account'}</strong>
              </div>
              <div>
                <span>Overall Score</span>
                <strong>{summary.overallScore.toFixed(2)}</strong>
              </div>
              <div>
                <span>Risk Grade</span>
                <strong>{summary.gradeLabel}</strong>
              </div>
              <div>
                <span>Portfolio Fit</span>
                <strong>{summary.strengthPercent}%</strong>
              </div>
            </div>
            <p>{summary.narrative}</p>
          </div>

          <div className="scorecard-outcome-card">
            <h3>Section Totals</h3>
            <ul className="scorecard-section-totals">
              {summary.sectionScores.map((section) => (
                <li key={section.id}>
                  <span>{section.title}</span>
                  <strong>{section.score.toFixed(2)}</strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="scorecard-outcome-card">
            <h3>Relationship Manager Notes</h3>
            <textarea
              value={relationshipNotes}
              onChange={(event) => setRelationshipNotes(event.target.value)}
              placeholder="Add exceptions, mitigants, and remarks here."
            />
          </div>
        </aside>
      </div>
    </div>
  )
}


function getRiskGrade(score: number) {
  if (score <= 1.8) {
    return 'A'
  }
  if (score <= 2.6) {
    return 'B'
  }
  if (score <= 3.4) {
    return 'C'
  }
  if (score <= 4.2) {
    return 'D'
  }
  return 'E'
}


function getRiskLabel(grade: string) {
  switch (grade) {
    case 'A':
      return 'A - Prime'
    case 'B':
      return 'B - Strong'
    case 'C':
      return 'C - Acceptable'
    case 'D':
      return 'D - Watchlist'
    default:
      return 'E - High Risk'
  }
}


function getRiskNarrative(grade: string) {
  switch (grade) {
    case 'A':
      return 'The combined indicators reflect a strong account with comfortable financial capacity and low observed credit friction.'
    case 'B':
      return 'The account remains healthy, with manageable risk considerations that should be monitored through normal review cycles.'
    case 'C':
      return 'The score sits in the middle band. The account is workable, but the lender should track weakness drivers and mitigation actions.'
    case 'D':
      return 'Several areas are fragile. The account would usually require tighter structure, more frequent monitoring, or additional support.'
    default:
      return 'The rating points to elevated credit risk and likely restructuring, tighter collateral, or decline unless strong mitigants exist.'
  }
}


export default LendingScorecard
