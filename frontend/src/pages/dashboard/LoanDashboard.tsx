import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditApi } from '../../services/creditApi';

// ==========================================
// 1. TYPES & CONSTANTS
// ==========================================

type ScorecardCriterion = {
  id: string; label: string; hint: string; weight: number; critical?: boolean;
}
type ScorecardSection = {
  id: string; title: string; weight: number; description: string; criteria: ScorecardCriterion[];
}

const ratingLabels = {
  1: 'Exceptional', 2: 'Strong', 3: 'Acceptable', 4: 'Weak', 5: 'High Risk',
} as const;

const scorecardSections: ScorecardSection[] = [
  {
    id: 'financial-based-lending', title: 'Financial Based Lending', weight: 35,
    description: 'Core financial capacity and management strength.',
    criteria: [
      { id: 'profitability', label: 'Profitability / Earnings Quality', hint: 'Measure earnings consistency and margin stability.', weight: 20 },
      { id: 'debt-service', label: 'Capacity to Service Debt', hint: 'Assess cash flow vs debt obligations.', weight: 25, critical: true },
      { id: 'organization', label: 'Organization Structure', hint: 'Review depth of management bench.', weight: 15 },
      { id: 'financial-management', label: 'Financial Management', hint: 'Evaluate reporting discipline and planning.', weight: 20 },
      { id: 'planning-mis', label: 'Planning Capabilities / MIS', hint: 'Review budgeting and management reports.', weight: 10 },
      { id: 'ownership-strength', label: 'Ownership Strength', hint: 'Sponsor commitment and strategic alignment.', weight: 10 },
    ],
  },
  {
    id: 'industry-evaluation', title: 'Industry Evaluation', weight: 15,
    description: 'Balance-sheet and operating indicators.',
    criteria: [
      { id: 'leverage-ratios', label: 'Debt Service / Leverage Ratios', hint: 'Rate leverage vs sector norms.', weight: 30, critical: true },
      { id: 'capital-structure', label: 'Capital Structure / Net Worth', hint: 'Score capitalization quality.', weight: 20 },
      { id: 'asset-structure', label: 'Asset Structure', hint: 'Review asset mix and convertibility.', weight: 10 },
      { id: 'earnings-assessment', label: 'Earnings Assessment', hint: 'Revenue durability and margin behavior.', weight: 20 },
      { id: 'liquidity', label: 'Liquidity', hint: 'Short-term coverage and working-capital.', weight: 20, critical: true },
    ],
  },
  {
    id: 'qualitative-assessment', title: 'Qualitative Assessment', weight: 15,
    description: 'Business quality and operational positioning.',
    criteria: [
      { id: 'cultural-fit', label: 'Cultural Fit', hint: 'Match between borrower culture and lender expectations.', weight: 20 },
      { id: 'raw-materials', label: 'Quality of Raw Materials', hint: 'Sourcing risk and input reliability.', weight: 20 },
      { id: 'pricing-attainment', label: 'Pricing Attainment', hint: 'Ability to pass on cost pressure.', weight: 20 },
      { id: 'customer-franchise', label: 'Product / Customer Franchise', hint: 'Durability of business proposition.', weight: 20 },
      { id: 'employee-turnover', label: 'Employee Turnover', hint: 'Operational continuity risk.', weight: 20 },
    ],
  },
  {
    id: 'behavioral-qualities', title: 'Behavioral Qualities', weight: 20,
    description: 'Borrower behavior and relationship posture.',
    criteria: [
      { id: 'payment-behavior', label: 'Payment Behavior', hint: 'Observed payment discipline.', weight: 25, critical: true },
      { id: 'ability-infuse', label: 'Ability to Infuse Capital', hint: 'Sponsor liquidity.', weight: 20 },
      { id: 'willingness-infuse', label: 'Willingness to Infuse Capital', hint: 'Likelihood of sponsor support.', weight: 15 },
      { id: 'competence-pattern', label: 'Competence Pattern', hint: 'Decision quality and execution.', weight: 15 },
      { id: 'bargaining-ability', label: 'Bargaining Ability', hint: 'Commercial leverage.', weight: 10 },
      { id: 'field-visit', label: 'Cooperative Behavior', hint: 'Transparency and responsiveness.', weight: 15 },
    ],
  },
  {
    id: 'collateral-evaluation', title: 'Collateral Evaluation', weight: 15,
    description: 'Security coverage and enforceability.',
    criteria: [
      { id: 'collateral-coverage', label: 'Collateral Coverage', hint: 'Coverage vs exposure after haircuts.', weight: 40, critical: true },
      { id: 'encumbrance-terms', label: 'Encumbrance / Terms', hint: 'Title clarity and competing claims.', weight: 35 },
      { id: 'lien-position', label: 'Lien Position', hint: 'Legal perfection and ease of enforcement.', weight: 25, critical: true },
    ],
  },
];

const defaultRatings = Object.fromEntries(
  scorecardSections.flatMap((s) => s.criteria.map((c) => [c.id, 3]))
) as Record<string, number>;

type BorrowerInput = {
  is_primary: boolean; full_name: string; is_married: boolean; dsr_percent: number;
  net_disposable_income: number; household_members: number; adb_amount: number;
  is_locally_employed: boolean; employer_years: number; service_years: number; address_stay_years: number;
  loan_history: 'excellent'|'satisfactory'|'none'|'poor'; deposit_handling: 'excellent'|'satisfactory'|'poor';
  utility_payment: 'very_satisfactory'|'satisfactory'|'dismissed_settled'|'not_satisfactory'; lifestyle: 'respectable'|'adverse';
};

type PropertyInput = {
  property_class: 'a'|'b'|'c'|'lowcost'|'outside'; appraised_value: number;
  property_type: 'single_detached'|'single_attached'|'condominium'|'townhouse'|'row_house'; is_primary_residence: boolean;
};

const EMPTY_BORROWER: BorrowerInput = {
  is_primary: false, full_name: '', is_married: false, dsr_percent: 0,
  net_disposable_income: 0, household_members: 0, adb_amount: 0,
  is_locally_employed: true, employer_years: 0, service_years: 0, address_stay_years: 0,
  loan_history: 'none', deposit_handling: 'excellent', utility_payment: 'very_satisfactory', lifestyle: 'respectable'
};

const EMPTY_PROPERTY: PropertyInput = {
  property_class: 'c', appraised_value: 0, property_type: 'single_detached', is_primary_residence: false
};

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

function getRiskGrade(score: number) {
  if (score <= 1.8) return 'A';
  if (score <= 2.6) return 'B';
  if (score <= 3.4) return 'C';
  if (score <= 4.2) return 'D';
  return 'E';
}

function getRiskLabel(grade: string) {
  switch (grade) {
    case 'A': return 'A - Prime'; case 'B': return 'B - Strong';
    case 'C': return 'C - Acceptable'; case 'D': return 'D - Watchlist';
    default: return 'E - High Risk';
  }
}

function getRiskNarrative(grade: string) {
  switch (grade) {
    case 'A': return 'Strong account with comfortable financial capacity and low observed credit friction.';
    case 'B': return 'Healthy account with manageable risk considerations for normal review cycles.';
    case 'C': return 'Middle band. Workable, but track weakness drivers and mitigation actions.';
    case 'D': return 'Fragile areas. Requires tighter structure, frequent monitoring, or support.';
    default: return 'Elevated credit risk. Likely requires restructuring or decline.';
  }
}

// ==========================================
// 3. COMMERCIAL SCORECARD COMPONENT
// ==========================================

function LendingScorecard() {
  const [accountName, setAccountName] = useState('EDWHOW');
  const [facilityType, setFacilityType] = useState('Financial Based Lending');
  const [ratings, setRatings] = useState<Record<string, number>>(defaultRatings);
  const [relationshipNotes, setRelationshipNotes] = useState('');

  const summary = useMemo(() => {
    const sectionScores = scorecardSections.map((section) => {
      const sectionScore = section.criteria.reduce((t, c) => t + ratings[c.id] * c.weight, 0) / section.criteria.reduce((t, c) => t + c.weight, 0);
      return { ...section, score: sectionScore, contribution: (sectionScore * section.weight) / 100 };
    });

    const overallScore = sectionScores.reduce((t, s) => t + s.contribution, 0);
    const strengthPercent = Math.round(((5 - overallScore) / 4) * 100);
    const hasCriticalOverride = scorecardSections.some((s) => s.criteria.some((c) => c.critical && ratings[c.id] === 5));

    const grade = hasCriticalOverride ? 'Override' : getRiskGrade(overallScore);
    const gradeLabel = hasCriticalOverride ? 'Default Risk Override' : getRiskLabel(grade);
    const narrative = hasCriticalOverride ? 'Critical driver rated at highest-risk level, raising a hard override.' : getRiskNarrative(grade);

    return { overallScore, strengthPercent, grade, gradeLabel, narrative, sectionScores };
  }, [ratings]);

  const updateRating = (id: string, val: number) => setRatings((curr) => ({ ...curr, [id]: val }));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Commercial Lending Scorecard</h2>
          <p className="text-gray-600 mt-1 text-sm">Rate each line from <strong>1</strong> (best) to <strong>5</strong> (highest risk). Computes weighted scores and triggers overrides for max-risk critical criteria.</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-100 flex flex-col items-start md:items-end gap-2 min-w-[220px]">
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">{facilityType}</span>
          <strong className="text-3xl font-bold text-gray-800">{summary.overallScore.toFixed(2)} <span className="text-lg text-gray-400">/ 5.00</span></strong>
          <span className={`px-3 py-1 rounded-md text-white font-bold text-sm ${
            summary.grade === 'A' ? 'bg-green-600' : summary.grade === 'B' ? 'bg-blue-600' :
            summary.grade === 'C' ? 'bg-yellow-500' : summary.grade === 'D' ? 'bg-orange-600' : 'bg-red-600'
          }`}>{summary.gradeLabel}</span>
          <small className="text-gray-500 text-xs">{summary.strengthPercent}% portfolio fit</small>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Name of Account</span>
          <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Scorecard Type</span>
          <input value={facilityType} onChange={(e) => setFacilityType(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(ratingLabels).map(([val, label]) => (
          <div className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium ${
            val === '1' ? 'bg-green-100 text-green-800' : val === '2' ? 'bg-blue-100 text-blue-800' :
            val === '3' ? 'bg-yellow-100 text-yellow-800' : val === '4' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
          }`} key={val}><strong>{val}</strong><span>{label}</span></div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {scorecardSections.map((section) => {
            const secSum = summary.sectionScores.find((s) => s.id === section.id);
            return (
              <section className="bg-white p-5 rounded-lg shadow-sm border border-gray-100" key={section.id}>
                <div className="flex justify-between items-start mb-4">
                  <div><h3 className="text-lg font-semibold text-gray-800">{section.title}</h3><p className="text-sm text-gray-500 mt-1">{section.description}</p></div>
                  <div className="bg-gray-50 p-2 rounded text-center min-w-[80px] border border-gray-100">
                    <strong className="block text-lg font-bold text-gray-800">{section.weight}%</strong>
                    <span className="text-xs text-gray-500">{secSum?.score.toFixed(2)} avg</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="border-b border-gray-200">
                      <th className="pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Criterion</th>
                      <th className="pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Guide</th>
                      <th className="pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Wt</th>
                      <th className="pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Rating</th>
                    </tr></thead>
                    <tbody>
                      {section.criteria.map((c) => (
                        <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="py-3 pr-4"><div className="flex items-center gap-2 font-medium text-sm text-gray-800">{c.label}{c.critical && <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">CRITICAL</span>}</div></td>
                          <td className="py-3 pr-4 text-xs text-gray-500">{c.hint}</td>
                          <td className="py-3 pr-4 text-xs text-gray-500 text-center font-medium">{c.weight}%</td>
                          <td className="py-3 text-center">
                            <select value={ratings[c.id]} onChange={(e) => updateRating(c.id, Number(e.target.value))} className="block w-full px-2 py-1 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs">
                              {Object.entries(ratingLabels).map(([v, l]) => <option value={v} key={v}>{v} - {l}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>

        <aside className="space-y-6">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Computed Result</h3>
            <div className="grid grid-cols-2 gap-4 my-4">
              <div><span className="text-[10px] text-gray-500 uppercase font-bold">Account</span><strong className="block text-sm text-gray-800 truncate">{accountName || 'Unnamed'}</strong></div>
              <div><span className="text-[10px] text-gray-500 uppercase font-bold">Score</span><strong className="block text-sm text-gray-800">{summary.overallScore.toFixed(2)}</strong></div>
              <div><span className="text-[10px] text-gray-500 uppercase font-bold">Grade</span><strong className="block text-sm text-gray-800">{summary.gradeLabel}</strong></div>
              <div><span className="text-[10px] text-gray-500 uppercase font-bold">Fit</span><strong className="block text-sm text-gray-800">{summary.strengthPercent}%</strong></div>
            </div>
            <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md border border-gray-100">{summary.narrative}</p>
            
            <h3 className="text-sm font-semibold text-gray-800 mt-6 mb-2">Section Totals</h3>
            <ul className="space-y-2">
              {summary.sectionScores.map((s) => (
                <li key={s.id} className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 truncate pr-2">{s.title}</span>
                  <strong className="text-gray-800 font-mono">{s.score.toFixed(2)}</strong>
                </li>
              ))}
            </ul>

            <h3 className="text-sm font-semibold text-gray-800 mt-6 mb-2">RM Notes</h3>
            <textarea value={relationshipNotes} onChange={(e) => setRelationshipNotes(e.target.value)} placeholder="Add exceptions or mitigants..." className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-24 resize-none" />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ==========================================
// 4. CONSUMER CREDIT FORM COMPONENT
// ==========================================

export const CreditScoreForm: React.FC = () => {
  const [borrowers, setBorrowers] = useState<BorrowerInput[]>([{...EMPTY_BORROWER, is_primary: true}]);
  const [properties, setProperties] = useState<PropertyInput[]>([EMPTY_PROPERTY]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateBorrower = (idx: number, field: keyof BorrowerInput, val: any) => {
    const updated: any[] = [...borrowers];
    updated[idx][field] = val;
    if (field === 'is_primary' && val === true) updated.forEach((b, i) => i !== idx && (b.is_primary = false));
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
      const score = await CreditApi.computeScore({ borrowers, properties });
      setResult(score);
    } catch (err: any) { setError(err.message || 'Submission failed'); } 
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto font-sans">
      <h2 className="text-center text-blue-600 text-2xl font-bold mb-6">🏦 Multi-Borrower Credit Scoring</h2>

      {borrowers.map((b, i) => (
        <div key={i} className="mb-6 p-5 border border-gray-200 rounded-lg bg-gray-50/50 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            👤 Borrower {i + 1} {b.is_primary && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Primary</span>}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block md:col-span-2">
              <span className="block mb-1 font-medium text-xs text-gray-600 uppercase">Full Name</span>
              <input className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={b.full_name} onChange={e => updateBorrower(i, 'full_name', e.target.value)} required />
            </label>
            
            <label className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
              <input type="checkbox" checked={b.is_primary} onChange={e => updateBorrower(i, 'is_primary', e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
              <span className="text-sm font-medium text-gray-700">Primary Applicant</span>
            </label>
            <label className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
              <input type="checkbox" checked={b.is_married} onChange={e => updateBorrower(i, 'is_married', e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
              <span className="text-sm font-medium text-gray-700">Married</span>
            </label>
            <label className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
              <input type="checkbox" checked={b.is_locally_employed} onChange={e => updateBorrower(i, 'is_locally_employed', e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
              <span className="text-sm font-medium text-gray-700">Locally Employed</span>
            </label>

            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">DSR %</span><input type="number" step="0.01" className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={b.dsr_percent} onChange={e => updateBorrower(i, 'dsr_percent', parseFloat(e.target.value))} /></label>
            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">Net Income (₱)</span><input type="number" step="0.01" className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={b.net_disposable_income} onChange={e => updateBorrower(i, 'net_disposable_income', parseFloat(e.target.value))} /></label>
            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">Household Members</span><input type="number" min="0" className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={b.household_members} onChange={e => updateBorrower(i, 'household_members', parseInt(e.target.value))} /></label>
            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">ADB (₱)</span><input type="number" step="0.01" className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={b.adb_amount} onChange={e => updateBorrower(i, 'adb_amount', parseFloat(e.target.value))} /></label>
            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">Employer Yrs</span><input type="number" min="0" className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={b.employer_years} onChange={e => updateBorrower(i, 'employer_years', parseInt(e.target.value))} /></label>
            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">Service Yrs</span><input type="number" min="0" className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={b.service_years} onChange={e => updateBorrower(i, 'service_years', parseInt(e.target.value))} /></label>
            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">Address Yrs</span><input type="number" step="0.1" min="0" className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={b.address_stay_years} onChange={e => updateBorrower(i, 'address_stay_years', parseFloat(e.target.value))} /></label>
            
            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">Loan History</span><select className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={b.loan_history} onChange={e => updateBorrower(i, 'loan_history', e.target.value)}><option value="excellent">Excellent</option><option value="satisfactory">Satisfactory</option><option value="none">None</option><option value="poor">Poor</option></select></label>
            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">Deposit Handling</span><select className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={b.deposit_handling} onChange={e => updateBorrower(i, 'deposit_handling', e.target.value)}><option value="excellent">Excellent</option><option value="satisfactory">Satisfactory</option><option value="poor">Poor</option></select></label>
            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">Utility Payment</span><select className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={b.utility_payment} onChange={e => updateBorrower(i, 'utility_payment', e.target.value)}><option value="very_satisfactory">Very Satisfactory</option><option value="satisfactory">Satisfactory</option><option value="dismissed_settled">Dismissed/Settled</option><option value="not_satisfactory">Not Satisfactory</option></select></label>
            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">Lifestyle</span><select className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={b.lifestyle} onChange={e => updateBorrower(i, 'lifestyle', e.target.value)}><option value="respectable">Respectable</option><option value="adverse">Adverse</option></select></label>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setBorrowers([...borrowers, {...EMPTY_BORROWER, is_primary: false}])} className="mb-6 px-4 py-2 cursor-pointer bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 text-sm font-medium transition-colors">+ Add Co-Borrower</button>

      {properties.map((p, i) => (
        <div key={i} className="mb-6 p-5 border border-gray-200 rounded-lg bg-gray-50/50 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🏠 Property {i + 1}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">Property Class</span><select className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={p.property_class} onChange={e => updateProperty(i, 'property_class', e.target.value)}><option value="a">Class A</option><option value="b">Class B</option><option value="c">Class C</option><option value="lowcost">Lowcost</option><option value="outside">Outside</option></select></label>
            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">Appraised Value (₱)</span><input type="number" step="0.01" className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={p.appraised_value} onChange={e => updateProperty(i, 'appraised_value', parseFloat(e.target.value))} /></label>
            <label className="block"><span className="block mb-1 font-medium text-xs text-gray-600 uppercase">Property Type</span><select className="w-full p-2 rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm" value={p.property_type} onChange={e => updateProperty(i, 'property_type', e.target.value)}><option value="single_detached">Single Detached</option><option value="single_attached">Single Attached</option><option value="condominium">Condominium</option><option value="townhouse">Townhouse</option><option value="row_house">Row House</option></select></label>
            <label className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 md:col-span-2"><input type="checkbox" checked={p.is_primary_residence} onChange={e => updateProperty(i, 'is_primary_residence', e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" /><span className="text-sm font-medium text-gray-700">Primary Residence</span></label>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setProperties([...properties, EMPTY_PROPERTY])} className="mb-6 px-4 py-2 cursor-pointer bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 text-sm font-medium transition-colors">+ Add Property</button>

      <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white border-none rounded-lg cursor-pointer text-base font-bold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md mb-6">
        {loading ? 'Computing...' : '🧮 Compute & Save Application'}
      </button>

      {error && <div className="p-4 my-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">❌ {error}</div>}
      
      {result && (
        <div className="mt-6 p-6 border-2 border-green-200 rounded-xl bg-green-50/50 shadow-inner">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">📊 Scoring Result</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100"><strong className="block text-gray-500 text-xs uppercase mb-1">Capacity</strong><span className="text-2xl font-bold text-blue-600">{result.capacity_score}<span className="text-sm text-gray-400">/25</span></span></div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100"><strong className="block text-gray-500 text-xs uppercase mb-1">Character</strong><span className="text-2xl font-bold text-blue-600">{result.character_score}<span className="text-sm text-gray-400">/25</span></span></div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100"><strong className="block text-gray-500 text-xs uppercase mb-1">Collateral</strong><span className="text-2xl font-bold text-blue-600">{result.collateral_score}<span className="text-sm text-gray-400">/25</span></span></div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100"><strong className="block text-gray-500 text-xs uppercase mb-1">Condition</strong><span className="text-2xl font-bold text-blue-600">{result.condition_score}<span className="text-sm text-gray-400">/25</span></span></div>
          </div>
          <div className="text-center pt-4 border-t border-green-200">
            <h4 className="text-xl font-bold text-gray-800">🎯 Total: <span className="text-green-600">{result.total_score}</span><span className="text-gray-400 text-lg">/100</span> → <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">{result.risk_classification}</span></h4>
          </div>
        </div>
      )}
    </form>
  );
};

// ==========================================
// 5. MAIN DASHBOARD WRAPPER
// ==========================================

export default function CreditDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'commercial' | 'consumer'>('commercial');
  
  // Mocks for workflow buttons
  const setFormData = (data: any) => console.log('Form data set', data);
  const setStep = (step: number) => console.log('Step set', step);
  const initialData = {};

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans">
      {/* Workflow Management Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
        <h4 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
          <span className="w-1 h-6 bg-blue-600 rounded-full"></span> Workflow Management
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={() => { setFormData(initialData); setStep(1); }} className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg font-semibold shadow transition-all hover:shadow-md flex flex-col items-start gap-1">
            <span className="text-xl">➕</span> Create New Application
          </button>
          <button onClick={() => navigate('/loan-repository')} className="bg-amber-600 hover:bg-amber-700 text-white p-4 rounded-lg font-semibold shadow transition-all hover:shadow-md flex flex-col items-start gap-1">
            <span className="text-xl">📋</span> Review Applications
          </button>
          <button onClick={() => navigate('/approval-queue')} className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg font-semibold shadow transition-all hover:shadow-md flex flex-col items-start gap-1">
            <span className="text-xl">⏳</span> Approval Queue
          </button>
          <button onClick={() => navigate('/released-accounts')} className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg font-semibold shadow transition-all hover:shadow-md flex flex-col items-start gap-1">
            <span className="text-xl">💸</span> Released Accounts
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-t-xl border border-b-0 border-gray-200 px-4 pt-4 flex gap-2 overflow-x-auto">
        <button
          className={`px-5 py-2.5 font-medium text-sm rounded-t-lg transition-all whitespace-nowrap ${
            activeTab === 'commercial' 
              ? 'bg-blue-50 text-blue-700 border border-b-0 border-blue-200 -mb-px shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setActiveTab('commercial')}
        >
          🏢 Commercial Lending Scorecard
        </button>
        <button
          className={`px-5 py-2.5 font-medium text-sm rounded-t-lg transition-all whitespace-nowrap ${
            activeTab === 'consumer' 
              ? 'bg-blue-50 text-blue-700 border border-b-0 border-blue-200 -mb-px shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setActiveTab('consumer')}
        >
          🏠 Consumer Credit Scoring
        </button>
         
         <button
          onClick={() =>
            navigate("/loan-repository")
               }
          className="bg-blue-600 text-white px-4 py-2 rounded"
          >
           📂 Loan Repository
          </button>

      </div>

      {/* Content Area */}
      <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 p-4 md:p-8">
        {activeTab === 'commercial' ? <LendingScorecard /> : <CreditScoreForm />}
      </div>
    </div>
  );
}