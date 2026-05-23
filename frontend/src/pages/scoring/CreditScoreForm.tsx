import React, { useState } from 'react';
import { CreditApi } from '../../services/creditApi';

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