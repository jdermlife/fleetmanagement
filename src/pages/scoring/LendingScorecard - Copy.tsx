import { useMemo, } from 'react'
import React, { useState } from 'react';
import { CreditApi } from '../../services/creditApi';


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


// ✅ 1. DEFINE TYPES (Kept inline to avoid import errors)
type BorrowerInput = {
  is_primary: boolean;
  full_name: string;
  is_married: boolean;
  dsr_percent: number;
  net_disposable_income: number;
  household_members: number;
  adb_amount: number;
  is_locally_employed: boolean;
  employer_years: number;
  service_years: number;
  address_stay_years: number;
  loan_history: 'excellent'|'satisfactory'|'none'|'poor';
  deposit_handling: 'excellent'|'satisfactory'|'poor';
  utility_payment: 'very_satisfactory'|'satisfactory'|'dismissed_settled'|'not_satisfactory';
  lifestyle: 'respectable'|'adverse';
};

type PropertyInput = {
  property_class: 'a'|'b'|'c'|'lowcost'|'outside';
  appraised_value: number;
  property_type: 'single_detached'|'single_attached'|'condominium'|'townhouse'|'row_house';
  is_primary_residence: boolean;
};

// ✅ 2. DEFAULT OBJECTS
const EMPTY_BORROWER: BorrowerInput = {
  is_primary: false, full_name: '', is_married: false, dsr_percent: 0,
  net_disposable_income: 0, household_members: 0, adb_amount: 0,
  is_locally_employed: true, employer_years: 0, service_years: 0, address_stay_years: 0,
  loan_history: 'none', deposit_handling: 'excellent', utility_payment: 'very_satisfactory', lifestyle: 'respectable'
};

const EMPTY_PROPERTY: PropertyInput = {
  property_class: 'c', appraised_value: 0, property_type: 'single_detached', is_primary_residence: false
};

export const CreditScoreForm: React.FC = () => {
  // ✅ 3. CRITICAL: STATE MUST BE DEFINED HERE
  const [borrowers, setBorrowers] = useState<BorrowerInput[]>([{...EMPTY_BORROWER, is_primary: true}]);
  const [properties, setProperties] = useState<PropertyInput[]>([EMPTY_PROPERTY]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update helpers
  const updateBorrower = (idx: number, field: keyof BorrowerInput, val: any) => {
    const updated: any[] = [...borrowers];
    updated[idx][field] = val;
    if (field === 'is_primary' && val === true) {
      updated.forEach((b, i) => i !== idx && (b.is_primary = false));
    }
    setBorrowers(updated);
  };

  const updateProperty = (idx: number, field: keyof PropertyInput, val: any) => {
    const updated: any[] = [...properties];
    updated[idx][field] = val;
    setProperties(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      // ✅ Sends exactly what backend expects
      const score = await CreditApi.computeScore({ borrowers, properties });
      setResult(score);
    } catch (err: any) { 
      setError(err.message || 'Submission failed'); 
    } finally { 
      setLoading(false); 
    }
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px',
    padding: '15px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    background: '#fafafa'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    marginBottom: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    boxSizing: 'border-box'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '4px',
    fontWeight: '500',
    fontSize: '14px'
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#1976d2', marginBottom: '20px' }}>🏦 Multi-Borrower Credit Scoring</h2>

      {/* BORROWERS SECTION */}
      {borrowers.map((b, i) => (
        <div key={i} style={sectionStyle}>
          <h3 style={{ marginTop: 0 }}>👤 Borrower {i + 1} {b.is_primary && '⭐ (Primary)'}</h3>
          <label style={labelStyle}>Full Name <input style={inputStyle} value={b.full_name} onChange={e => updateBorrower(i, 'full_name', e.target.value)} required /></label>
          <label style={labelStyle}><input type="checkbox" checked={b.is_primary} onChange={e => updateBorrower(i, 'is_primary', e.target.checked)} /> Primary Applicant</label>
          <label style={labelStyle}><input type="checkbox" checked={b.is_married} onChange={e => updateBorrower(i, 'is_married', e.target.checked)} /> Married</label>
          <label style={labelStyle}>DSR % <input type="number" step="0.01" style={inputStyle} value={b.dsr_percent} onChange={e => updateBorrower(i, 'dsr_percent', parseFloat(e.target.value))} /></label>
          <label style={labelStyle}>Net Income (₱) <input type="number" step="0.01" style={inputStyle} value={b.net_disposable_income} onChange={e => updateBorrower(i, 'net_disposable_income', parseFloat(e.target.value))} /></label>
          <label style={labelStyle}>Household Members <input type="number" min="0" style={inputStyle} value={b.household_members} onChange={e => updateBorrower(i, 'household_members', parseInt(e.target.value))} /></label>
          <label style={labelStyle}>ADB (₱) <input type="number" step="0.01" style={inputStyle} value={b.adb_amount} onChange={e => updateBorrower(i, 'adb_amount', parseFloat(e.target.value))} /></label>
          <label style={labelStyle}><input type="checkbox" checked={b.is_locally_employed} onChange={e => updateBorrower(i, 'is_locally_employed', e.target.checked)} /> Locally Employed</label>
          <label style={labelStyle}>Employer Yrs <input type="number" min="0" style={inputStyle} value={b.employer_years} onChange={e => updateBorrower(i, 'employer_years', parseInt(e.target.value))} /></label>
          <label style={labelStyle}>Service Yrs <input type="number" min="0" style={inputStyle} value={b.service_years} onChange={e => updateBorrower(i, 'service_years', parseInt(e.target.value))} /></label>
          <label style={labelStyle}>Address Yrs <input type="number" step="0.1" min="0" style={inputStyle} value={b.address_stay_years} onChange={e => updateBorrower(i, 'address_stay_years', parseFloat(e.target.value))} /></label>
          <label style={labelStyle}>Loan History 
            <select style={inputStyle} value={b.loan_history} onChange={e => updateBorrower(i, 'loan_history', e.target.value)}>
              <option value="excellent">Excellent</option><option value="satisfactory">Satisfactory</option>
              <option value="none">None</option><option value="poor">Poor</option>
            </select>
          </label>
          <label style={labelStyle}>Deposit Handling 
            <select style={inputStyle} value={b.deposit_handling} onChange={e => updateBorrower(i, 'deposit_handling', e.target.value)}>
              <option value="excellent">Excellent</option><option value="satisfactory">Satisfactory</option><option value="poor">Poor</option>
            </select>
          </label>
          <label style={labelStyle}>Utility Payment 
            <select style={inputStyle} value={b.utility_payment} onChange={e => updateBorrower(i, 'utility_payment', e.target.value)}>
              <option value="very_satisfactory">Very Satisfactory</option><option value="satisfactory">Satisfactory</option>
              <option value="dismissed_settled">Dismissed/Settled</option><option value="not_satisfactory">Not Satisfactory</option>
            </select>
          </label>
          <label style={labelStyle}>Lifestyle 
            <select style={inputStyle} value={b.lifestyle} onChange={e => updateBorrower(i, 'lifestyle', e.target.value)}>
              <option value="respectable">Respectable</option><option value="adverse">Adverse</option>
            </select>
          </label>
        </div>
      ))}
      <button type="button" onClick={() => setBorrowers([...borrowers, {...EMPTY_BORROWER, is_primary: false}])} style={{ marginBottom: '15px', padding: '8px 12px', cursor: 'pointer' }}>+ Add Co-Borrower</button>

      {/* PROPERTIES SECTION */}
      {properties.map((p, i) => (
        <div key={i} style={sectionStyle}>
          <h3 style={{ marginTop: 0 }}>🏠 Property {i + 1}</h3>
          <label style={labelStyle}>Property Class 
            <select style={inputStyle} value={p.property_class} onChange={e => updateProperty(i, 'property_class', e.target.value)}>
              <option value="a">Class A</option><option value="b">Class B</option><option value="c">Class C</option>
              <option value="lowcost">Lowcost</option><option value="outside">Outside</option>
            </select>
          </label>
          <label style={labelStyle}>Appraised Value (₱) <input type="number" step="0.01" style={inputStyle} value={p.appraised_value} onChange={e => updateProperty(i, 'appraised_value', parseFloat(e.target.value))} /></label>
          <label style={labelStyle}>Property Type 
            <select style={inputStyle} value={p.property_type} onChange={e => updateProperty(i, 'property_type', e.target.value)}>
              <option value="single_detached">Single Detached</option><option value="single_attached">Single Attached</option>
              <option value="condominium">Condominium</option><option value="townhouse">Townhouse</option><option value="row_house">Row House</option>
            </select>
          </label>
          <label style={labelStyle}><input type="checkbox" checked={p.is_primary_residence} onChange={e => updateProperty(i, 'is_primary_residence', e.target.checked)} /> Primary Residence</label>
        </div>
      ))}
      <button type="button" onClick={() => setProperties([...properties, EMPTY_PROPERTY])} style={{ marginBottom: '15px', padding: '8px 12px', cursor: 'pointer' }}>+ Add Property</button>

      <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', background: loading ? '#999' : '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
        {loading ? 'Computing...' : '🧮 Compute & Save Application'}
      </button>

      {error && <div style={{ padding: '12px', margin: '15px 0', background: '#ffebee', border: '1px solid #f44336', borderRadius: '4px', color: '#c62828' }}>❌ {error}</div>}
      
      {result && (
        <div style={{ marginTop: '20px', padding: '20px', border: '2px solid #4CAF50', borderRadius: '8px', background: '#f1f8e9' }}>
          <h3 style={{ marginTop: 0 }}>📊 Result</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', textAlign: 'center' }}>
            <div><strong>Capacity</strong><br/>{result.capacity_score}/25</div>
            <div><strong>Character</strong><br/>{result.character_score}/25</div>
            <div><strong>Collateral</strong><br/>{result.collateral_score}/25</div>
            <div><strong>Condition</strong><br/>{result.condition_score}/25</div>
          </div>
          <h4 style={{ textAlign: 'center', marginTop: '15px' }}>🎯 Total: {result.total_score}/100 → {result.risk_classification}</h4>
        </div>
      )}
    </form>
  );
};

export default LendingScorecard
