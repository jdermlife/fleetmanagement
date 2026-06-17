import React, { useState, useMemo } from 'react';



// --- TypeScript Interfaces (PostgreSQL Schema Mapping) ---
type WorkflowStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Credit Review' | 'Approved' | 'Rejected' | 'Released';

interface BorrowerInfo { fullName: string; email: string; phone: string; govId: string; address: string; }
interface CoBorrower { id: string; name: string; relationship: string; monthlyIncome: number; debtObligations: number; creditStanding: string; }
interface Employment { history: string; monthlyIncome: number; otherIncome: number; debtObligations: number; }
interface LoanDetails { amount: number; termMonths: number; interestRate: number; purpose: string; productType: string; }
interface Collateral { vehicleInfo: string; appraisedValue: number; insurance: string; registration: string; }
interface DocumentItem { id: string; name: string; type: string; parsedData?: string; status: 'Pending' | 'Parsed' | 'Failed'; }

interface LoanApplication {
  id: string;
  status: WorkflowStatus;
  borrower: BorrowerInfo;
  coBorrowers: CoBorrower[];
  employment: Employment;
  loan: LoanDetails;
  collateral: Collateral;
  documents: DocumentItem[];
  committeeRemarks: string;
  routing: { creditOfficer: string; branchManager: string; creditCommittee: string; executiveApproval: boolean; };
}

// --- Initial State ---
const initialData: LoanApplication = {
  id: 'APP-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
  status: 'Draft',
  borrower: { fullName: '', email: '', phone: '', govId: '', address: '' },
  coBorrowers: [],
  employment: { history: '', monthlyIncome: 0, otherIncome: 0, debtObligations: 0 },
  loan: { amount: 0, termMonths: 12, interestRate: 5.5, purpose: '', productType: 'Auto Loan' },
  collateral: { vehicleInfo: '', appraisedValue: 0, insurance: '', registration: '' },
  documents: [],
  committeeRemarks: '',
  routing: { creditOfficer: '', branchManager: '', creditCommittee: 'Pending', executiveApproval: false },
};

// --- Main Component ---
export default function AdvancedLoanWorkflow() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<LoanApplication>(initialData);
  const [isParsing, setIsParsing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // --- Auto-Calculations (Memoized for Performance) ---
  const calculations = useMemo(() => {
    const totalIncome = formData.employment.monthlyIncome + formData.employment.otherIncome + 
                        formData.coBorrowers.reduce((sum, cb) => sum + cb.monthlyIncome, 0);
    
    const totalExistingDebt = formData.employment.debtObligations + 
                              formData.coBorrowers.reduce((sum, cb) => sum + cb.debtObligations, 0);

    // PMT Formula: P * (r * (1 + r)^n) / ((1 + r)^n - 1)
    const r = formData.loan.interestRate / 100 / 12;
    const n = formData.loan.termMonths;
    const p = formData.loan.amount;
    const monthlyPayment = n === 0 ? 0 : (r === 0 ? p / n : p * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));

    const dti = totalIncome > 0 ? (totalExistingDebt / totalIncome) * 100 : 0;
    const dsr = totalIncome > 0 ? ((totalExistingDebt + monthlyPayment) / totalIncome) * 100 : 0;
    const ltv = formData.collateral.appraisedValue > 0 ? (formData.loan.amount / formData.collateral.appraisedValue) * 100 : 0;

    return { totalIncome, totalExistingDebt, monthlyPayment, dti, dsr, ltv };
  }, [formData]);

  // --- Automated Lending Scorecard (5 Cs) ---
  const automatedScorecard = useMemo(() => {
    const character = formData.borrower.govId ? 8 : 5; // Simplified logic
    const capacity = calculations.dsr < 30 ? 10 : calculations.dsr < 40 ? 7 : 4;
    const capital = formData.employment.otherIncome > 0 ? 8 : 5;
    const collateral = calculations.ltv < 80 ? 10 : calculations.ltv < 90 ? 7 : 4;
    const conditions = formData.loan.purpose ? 8 : 5;
    const total = character + capacity + capital + collateral + conditions;
    return { character, capacity, capital, collateral, conditions, total };
  }, [calculations, formData]);

  // --- AI Recommendation with Computations ---
  const aiRecommendation = useMemo(() => {
    let baseProb = 70;
    let computationLog = ['Base Probability: 70%'];
    
    if (calculations.dsr < 35) { baseProb += 15; computationLog.push('+15% (Strong DSR < 35%)'); }
    else if (calculations.dsr > 50) { baseProb -= 20; computationLog.push('-20% (High DSR > 50%)'); }

    if (calculations.ltv < 80) { baseProb += 10; computationLog.push('+10% (Safe LTV < 80%)'); }
    else if (calculations.ltv > 95) { baseProb -= 15; computationLog.push('-15% (Risky LTV > 95%)'); }

    if (automatedScorecard.total >= 40) { baseProb += 5; computationLog.push('+5% (High Automated Scorecard)'); }

    const finalProb = Math.min(Math.max(baseProb, 0), 100);
    return {
      probability: finalProb,
      riskLevel: finalProb > 80 ? 'Low' : finalProb > 50 ? 'Medium' : 'High',
      suggestedAmount: finalProb > 80 ? formData.loan.amount : formData.loan.amount * 0.8,
      computationLog
    };
  }, [calculations, automatedScorecard, formData.loan.amount]);

  // --- Handlers ---
type EditableSection =
  | 'borrower'
  | 'employment'
  | 'loan'
  | 'collateral'
  | 'routing';

const updateField = (
  section: EditableSection,
  field: string,
  value: any
) => {
  setFormData(prev => ({
    ...prev,
    [section]: {
      ...prev[section],
      [field]: value,
    },
  }));
};

  const addCoBorrower = () => {
    const newCb: CoBorrower = { id: Date.now().toString(), name: '', relationship: '', monthlyIncome: 0, debtObligations: 0, creditStanding: 'Good' };
    setFormData(prev => ({ ...prev, coBorrowers: [...prev.coBorrowers, newCb] }));
  };

  const updateCoBorrower = (id: string, field: keyof CoBorrower, value: any) => {
    setFormData(prev => ({
      ...prev,
      coBorrowers: prev.coBorrowers.map(cb => cb.id === id ? { ...cb, [field]: value } : cb)
    }));
  };

  const removeCoBorrower = (id: string) => {
    setFormData(prev => ({ ...prev, coBorrowers: prev.coBorrowers.filter(cb => cb.id !== id) }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newDoc: DocumentItem = { id: Date.now().toString(), name: file.name, type: file.type, status: 'Pending' };
      setFormData(prev => ({ ...prev, documents: [...prev.documents, newDoc] }));
    }
  };

  const handleParseDocument = (docId: string) => {
    setIsParsing(true);
    // Simulate AI OCR/NLP Parsing Delay
    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        employment: { ...prev.employment, monthlyIncome: prev.employment.monthlyIncome + 4500 }, // Simulated extraction
        documents: prev.documents.map(d => d.id === docId ? { ...d, status: 'Parsed', parsedData: 'Extracted: +$4,500/mo income' } : d)
      }));
      setIsParsing(false);
    }, 1500);
  };

 const handleSaveDraft = async () => {
  await updateLoanStatus('Draft');
  };

const changeWorkflowStatus = async (newStatus: WorkflowStatus) => {
  try {
    const response = await fetch(
      `https://fleetmanagement-dq9t.onrender.com/api/loan-applications/${formData.id}/status?status=${newStatus}`,
      {
        method: "PUT",
      }
    );

    if (!response.ok) {
      throw new Error("Status update failed");
    }

    setFormData(prev => ({
      ...prev,
      status: newStatus,
    }));

    setSaveMessage(`Status updated to ${newStatus}`);

  } catch (error) {
    console.error(error);
    setSaveMessage("Failed to update status");
  }
};


  const updateLoanStatus = async (newStatus: WorkflowStatus) => {
    try {
      const response = await fetch(
        "https://fleetmanagement-dq9t.onrender.com/api/loan-applications",
         
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            application_no: formData.id,
            status: newStatus,

            borrower_name: formData.borrower.fullName,
          email: formData.borrower.email,
          phone: formData.borrower.phone,
          gov_id: formData.borrower.govId,
          address: formData.borrower.address,

          monthly_income: formData.employment.monthlyIncome,
          other_income: formData.employment.otherIncome,
          debt_obligations: formData.employment.debtObligations,

          loan_amount: formData.loan.amount,
          term_months: formData.loan.termMonths,
          interest_rate: formData.loan.interestRate,
          purpose: formData.loan.purpose,

          vehicle_info: formData.collateral.vehicleInfo,
          appraised_value: formData.collateral.appraisedValue,

          committee_remarks: formData.committeeRemarks,

           executive_approval:
    formData.routing.executiveApproval,

  dti: calculations.dti,
  dsr: calculations.dsr,
  ltv: calculations.ltv,

  scorecard_total: automatedScorecard.total,

  ai_probability: aiRecommendation.probability
}),
      }
    );

if (!response.ok) {
  throw new Error(`Server Error: ${response.status}`);
}

const result = await response.json();

setSaveMessage(result.message || "Loan application saved successfully");

    setTimeout(() => setSaveMessage(""), 3000);
  } catch (error) {
    console.error(error);
    setSaveMessage("Failed to save loan application");
  }
};

const updateStatus = async (newStatus: WorkflowStatus) => {
  await changeWorkflowStatus(newStatus);
};

  // --- Validation for Step 10 ---
  const validationChecks = useMemo(() => [
    { label: 'Borrower Identity Verified', passed: !!formData.borrower.fullName && !!formData.borrower.govId },
    { label: 'Loan Amount & Collateral Valid', passed: formData.loan.amount > 0 && formData.collateral.appraisedValue > 0 },
    { label: 'DSR is within acceptable limits (< 50%)', passed: calculations.dsr < 50 },
    { label: 'Required Documents Uploaded & Parsed', passed: formData.documents.length >= 2 && formData.documents.every(d => d.status === 'Parsed') },
  ], [formData, calculations]);

  const isReadyToSubmit = validationChecks.every(v => v.passed);

  // --- Render Helpers ---
  const renderInput = ( section: EditableSection, field: string, label: string, type = 'text',   disabled = false ) => (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</label>
      <input
        type={type}
        disabled={disabled}
        value={(formData[section] as any)[field] ?? ''}
        onChange={(e) => updateField(section, field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-gray-100 text-gray-500' : 'border-gray-300'}`}
      />
    </div>
  );

  const getStatusColor = (status: WorkflowStatus) => {
    const colors: Record<WorkflowStatus, string> = {
      'Draft': 'bg-gray-100 text-gray-800', 'Submitted': 'bg-blue-100 text-blue-800',
      'Under Review': 'bg-yellow-100 text-yellow-800', 'Credit Review': 'bg-purple-100 text-purple-800',
      'Approved': 'bg-green-100 text-green-800', 'Rejected': 'bg-red-100 text-red-800', 'Released': 'bg-indigo-100 text-indigo-800'
    };
    return colors[status];
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        
        {/* Header & Workflow Status */}
        <div className="bg-slate-800 text-white p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Advanced Loan Origination System</h1>
            <p className="text-slate-400 text-sm mt-1">Application ID: {formData.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300">Current Status:</span>
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider ${getStatusColor(formData.status)}`}>
              {formData.status}
            </span>
          </div>
        </div>

        {/* Progress Stepper */}
        <div className="bg-slate-50 border-b border-gray-200 p-4 overflow-x-auto">
          <div className="flex justify-between min-w-[800px] text-xs font-medium text-gray-500">
            {['Borrower', 'Co-Borrowers', 'Income', 'Loan & Collateral', 'Metrics', 'Scorecard', 'AI Rec', 'Documents', 'Committee', 'Review'].map((label, i) => (
              <button key={i} onClick={() => setStep(i + 1)} className={`flex flex-col items-center gap-1 hover:text-blue-600 transition ${step === i + 1 ? 'text-blue-700 font-bold' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>{i + 1}</div>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 md:p-8 min-h-[400px]">
          {saveMessage && <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md text-sm font-medium flex items-center">✓ {saveMessage}</div>}

          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="col-span-full text-lg font-bold text-slate-800 border-b pb-2">Step 1: Borrower Information</h3>
              {renderInput('borrower', 'fullName', 'Full Legal Name')}
              {renderInput('borrower', 'email', 'Email Address', 'email')}
              {renderInput('borrower', 'phone', 'Contact Number', 'tel')}
              {renderInput('borrower', 'govId', 'Government ID Number')}
              {renderInput('borrower', 'address', 'Complete Residential Address')}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold text-slate-800">Step 2: Co-Borrowers / Guarantors</h3>
                <button onClick={addCoBorrower} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">+ Add Co-Borrower</button>
              </div>
              {formData.coBorrowers.length === 0 && <p className="text-gray-500 italic text-sm">No co-borrowers added. Click above to add.</p>}
              {formData.coBorrowers.map((cb, idx) => (
                <div key={cb.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
                  <button onClick={() => removeCoBorrower(cb.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-sm font-bold">✕</button>
                  <h4 className="font-semibold text-sm text-gray-700 mb-3">Co-Borrower #{idx + 1}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Full Name</label>
                      <input value={cb.name} onChange={(e) => updateCoBorrower(cb.id, 'name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Relationship</label>
                      <input value={cb.relationship} onChange={(e) => updateCoBorrower(cb.id, 'relationship', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Monthly Income</label>
                      <input type="number" value={cb.monthlyIncome} onChange={(e) => updateCoBorrower(cb.id, 'monthlyIncome', parseFloat(e.target.value)||0)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Debt Obligations</label>
                      <input type="number" value={cb.debtObligations} onChange={(e) => updateCoBorrower(cb.id, 'debtObligations', parseFloat(e.target.value)||0)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Credit Standing</label>
                      <select value={cb.creditStanding} onChange={(e) => updateCoBorrower(cb.id, 'creditStanding', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                        <option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="col-span-full text-lg font-bold text-slate-800 border-b pb-2">Step 3: Employment & Income</h3>
              {renderInput('employment', 'history', 'Employment History (Current Employer & Tenure)')}
              {renderInput('employment', 'monthlyIncome', 'Primary Monthly Income', 'number')}
              {renderInput('employment', 'otherIncome', 'Other Sources of Income', 'number')}
              {renderInput('employment', 'debtObligations', 'Existing Monthly Debt Obligations', 'number')}
              <div className="md:col-span-2 bg-blue-50 p-4 rounded-md border border-blue-200 mt-2">
                <h4 className="font-bold text-blue-800 text-sm mb-2">Auto-Calculated Totals</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Total Household Income: <span className="font-bold">${calculations.totalIncome.toLocaleString()}</span></div>
                  <div>Total Existing Debt: <span className="font-bold">${calculations.totalExistingDebt.toLocaleString()}</span></div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Step 4a: Loan Details</h3>
                {renderInput('loan', 'amount', 'Requested Loan Amount', 'number')}
                {renderInput('loan', 'termMonths', 'Term (Months)', 'number')}
                {renderInput('loan', 'interestRate', 'Annual Interest Rate (%)', 'number')}
                {renderInput('loan', 'purpose', 'Purpose of Loan')}
                {renderInput('loan', 'productType', 'Product Type')}
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Step 4b: Collateral</h3>
                {renderInput('collateral', 'vehicleInfo', 'Asset/Vehicle Information')}
                {renderInput('collateral', 'appraisedValue', 'Appraised Value', 'number')}
                {renderInput('collateral', 'insurance', 'Insurance Provider & Policy #')}
                {renderInput('collateral', 'registration', 'Registration / OR/CR Number')}
              </div>
              <div className="md:col-span-2 bg-purple-50 p-4 rounded-md border border-purple-200 mt-2">
                <h4 className="font-bold text-purple-800 text-sm mb-2">Auto-Calculated Metrics</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>Est. Monthly Amortization: <span className="font-bold">${calculations.monthlyPayment.toFixed(2)}</span></div>
                  <div>Loan-to-Value (LTV): <span className={`font-bold ${calculations.ltv > 90 ? 'text-red-600' : 'text-green-600'}`}>{calculations.ltv.toFixed(1)}%</span></div>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Step 5: Credit Scoring & Auto Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-red-50 p-4 rounded-md border border-red-200">
                  <h4 className="font-bold text-red-800 text-sm mb-2">Debt-to-Income (DTI)</h4>
                  <p className="text-3xl font-bold text-red-700">{calculations.dti.toFixed(1)}%</p>
                  <p className="text-xs text-red-600 mt-1">Formula: (Total Existing Debt / Total Income) * 100</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-md border border-orange-200">
                  <h4 className="font-bold text-orange-800 text-sm mb-2">Debt Service Ratio (DSR)</h4>
                  <p className="text-3xl font-bold text-orange-700">{calculations.dsr.toFixed(1)}%</p>
                  <p className="text-xs text-orange-600 mt-1">Formula: ((Existing Debt + Proposed Payment) / Total Income) * 100</p>
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Step 6: Automated Lending Scorecard</h3>
              <p className="text-sm text-gray-600 mb-4">Scores are automatically computed based on application data inputs.</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Character', score: automatedScorecard.character, desc: 'Based on ID & History' },
                  { label: 'Capacity', score: automatedScorecard.capacity, desc: 'Based on DSR' },
                  { label: 'Capital', score: automatedScorecard.capital, desc: 'Based on Other Income' },
                  { label: 'Collateral', score: automatedScorecard.collateral, desc: 'Based on LTV' },
                  { label: 'Conditions', score: automatedScorecard.conditions, desc: 'Based on Purpose' },
                ].map((c, i) => (
                  <div key={i} className="bg-white border-2 border-gray-200 rounded-lg p-4 text-center shadow-sm">
                    <p className="text-xs font-bold text-gray-500 uppercase">{c.label}</p>
                    <p className={`text-3xl font-bold my-2 ${c.score >= 8 ? 'text-green-600' : c.score >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>{c.score}<span className="text-sm text-gray-400">/10</span></p>
                    <p className="text-[10px] text-gray-500">{c.desc}</p>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800 text-white p-4 rounded-lg flex justify-between items-center mt-4">
                <span className="font-bold text-lg">Total Automated Score</span>
                <span className="text-3xl font-bold text-blue-400">{automatedScorecard.total}<span className="text-sm text-slate-400">/50</span></span>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Step 7: AI Recommendation & Computations</h3>
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-lg border border-indigo-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                  <div>
                    <h4 className="text-sm font-bold text-indigo-800 uppercase tracking-wide">AI Approval Probability</h4>
                    <p className="text-4xl font-bold text-indigo-700 mt-1">{aiRecommendation.probability}%</p>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${aiRecommendation.riskLevel === 'Low' ? 'bg-green-200 text-green-800' : aiRecommendation.riskLevel === 'Medium' ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'}`}>
                      Risk Level: {aiRecommendation.riskLevel}
                    </span>
                  </div>
                  <div className="mt-4 md:mt-0 text-right">
                    <p className="text-sm text-gray-600">AI Suggested Loan Amount</p>
                    <p className="text-2xl font-bold text-gray-800">${aiRecommendation.suggestedAmount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-white/60 p-4 rounded-md border border-indigo-100">
                  <h5 className="font-semibold text-sm text-indigo-900 mb-2">Computation Log:</h5>
                  <ul className="space-y-1">
                    {aiRecommendation.computationLog.map((log, i) => (
                      <li key={i} className="text-sm text-gray-700 font-mono">• {log}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Step 8: Document Upload & Parsing Facility</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition">
                <input type="file" id="fileUpload" className="hidden" onChange={handleFileUpload} />
                <label htmlFor="fileUpload" className="cursor-pointer flex flex-col items-center">
                  <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                  <span className="text-sm font-medium text-blue-600">Click to upload documents</span>
                  <span className="text-xs text-gray-500 mt-1">Payslips, Bank Statements, IDs (PDF, JPG)</span>
                </label>
              </div>
              
              <div className="space-y-2 mt-4">
                {formData.documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-md shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-100 p-2 rounded">📄</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{doc.name}</p>
                        <p className="text-xs text-gray-500">{doc.parsedData || 'Awaiting parsing...'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${doc.status === 'Parsed' ? 'bg-green-100 text-green-700' : doc.status === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {doc.status}
                      </span>
                      {doc.status === 'Pending' && (
                        <button onClick={() => handleParseDocument(doc.id)} disabled={isParsing} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50">
                          {isParsing ? 'Parsing...' : 'AI Parse'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 9 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Step 9: Committee Remarks & Routing</h3>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Credit Committee Remarks</label>
                <textarea 
                  value={formData.committeeRemarks}
                  onChange={(e) =>
                  setFormData(prev => ({
                  ...prev,
                  committeeRemarks: e.target.value,
                   }))
               }
                 rows={4}
                 className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                 placeholder="Enter conditions, stipulations, or approval notes here..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderInput('routing', 'creditOfficer', 'Assigned Credit Officer')}
                {renderInput('routing', 'branchManager', 'Branch Manager')}
                {renderInput('routing', 'creditCommittee', 'Committee Status')}
                <div className="mb-3 flex items-center mt-6">
                  <input type="checkbox" checked={formData.routing.executiveApproval} onChange={(e) => updateField('routing', 'executiveApproval', e.target.checked)} className="mr-2 h-4 w-4" />
                  <label className="text-sm font-medium text-gray-700">Requires Executive Approval</label>
                </div>
              </div>
            </div>
          )}

          {step === 10 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Step 10: Review, Validation & Workflow Actions</h3>
              
              {/* Review Summary */}
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                <h4 className="font-bold text-gray-700 mb-2 text-sm uppercase">📋 Application Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-gray-500">Applicant:</span><br/><strong>{formData.borrower.fullName || 'N/A'}</strong></div>
                  <div><span className="text-gray-500">Requested Amount:</span><br/><strong>${formData.loan.amount.toLocaleString()}</strong></div>
                  <div><span className="text-gray-500">AI Probability:</span><br/><strong className={aiRecommendation.probability > 70 ? 'text-green-600' : 'text-red-600'}>{aiRecommendation.probability}%</strong></div>
                  <div><span className="text-gray-500">Auto Score:</span><br/><strong>{automatedScorecard.total}/50</strong></div>
                </div>
              </div>

              {/* Validation Check */}
              <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2 text-sm uppercase">✅ System Validation Check</h4>
                <ul className="space-y-1">
                  {validationChecks.map((check, idx) => (
                    <li key={idx} className={`text-sm flex items-center gap-2 ${check.passed ? 'text-green-700' : 'text-red-600'}`}>
                      {check.passed ? '✓' : '✗'} {check.label}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Workflow Actions */}
              <div className="bg-slate-800 text-white p-6 rounded-lg mt-6">
                <h4 className="font-bold text-lg mb-4">Workflow Management</h4>
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleSaveDraft} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm font-medium transition">💾 Save Draft</button>
                  
                  {formData.status === 'Draft' && (
                    <button onClick={() => updateStatus('Submitted')} disabled={!isReadyToSubmit} className={`px-4 py-2 rounded text-sm font-bold transition ${isReadyToSubmit ? 'bg-blue-500 hover:bg-blue-400' : 'bg-gray-500 cursor-not-allowed'}`}>
                      📤 Submit for Review
                    </button>
                  )}
                  {formData.status === 'Draft' && (
                  <button
                      onClick={() => loadApplication(formData.id)}
                      className="px-4 py-2 bg-blue-500 text-white rounded"
                      >
                      Load Record
                   </button>
                  )}




                  {formData.status === 'Submitted' && (
                    <button onClick={() => updateStatus('Under Review')} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded text-sm font-bold transition">🔍 Move to Under Review</button>
                  )}

                  {formData.status === 'Under Review' && (
                    <button onClick={() => updateStatus('Credit Review')} className="px-4 py-2 bg-purple-500 hover:bg-purple-400 rounded text-sm font-bold transition">🏦 Move to Credit Review</button>
                  )}

                  {formData.status === 'Credit Review' && (
                    <>
                      <button onClick={() => changeWorkflowStatus('Approved')} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-sm font-bold transition">✓ Approve</button>
                      <button onClick={() => changeWorkflowStatus('Rejected')} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-bold transition">✕ Reject</button>
                    </>
                  )}

                  {formData.status === 'Approved' && (
                    <button onClick={() => changeWorkflowStatus('Released')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-bold transition">💸 Release Funds</button>
                  )}





                  {formData.status === 'Released' && (
                    <span className="px-4 py-2 bg-green-800 text-green-100 rounded text-sm font-bold border border-green-600">🎉 Application Successfully Released</span>
                  )}
                </div>
                {!isReadyToSubmit && formData.status === 'Draft' && (
                  <p className="text-xs text-red-300 mt-3">* Cannot submit until all validation checks pass and documents are parsed.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {step < 10 && (
          <div className="bg-gray-50 p-6 border-t flex justify-between">
            <button onClick={() => setStep(prev => Math.max(prev - 1, 1))} disabled={step === 1} className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-100 disabled:opacity-50">
              ← Back
            </button>
            <div className="flex gap-3">
              <button onClick={handleSaveDraft} className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800 text-sm">Save Draft</button>
              <button onClick={() => setStep(prev => Math.min(prev + 1, 10))} className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 shadow-sm">
                Next Step →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
const loadApplication = async (
  applicationNo: string
) => {
  try {

    const response = await fetch(
      `https://fleetmanagement-dq9t.onrender.com/api/loan-applications/${applicationNo}`
    );

    const data = await response.json();

    setFormData(prev => ({
  ...prev,

  id: data.application_no,
  status: data.status,

  borrower: {
    ...prev.borrower,
    fullName: data.borrower_name,
    email: data.email,
    phone: data.phone,
    govId: data.gov_id,
    address: data.address,
  },

  employment: {
    ...prev.employment,
    monthlyIncome: data.monthly_income,
    otherIncome: data.other_income,
    debtObligations: data.debt_obligations,
  },

  loan: {
    ...prev.loan,
    amount: data.loan_amount,
    termMonths: data.term_months,
    interestRate: data.interest_rate,
    purpose: data.purpose,
  },

  collateral: {
    ...prev.collateral,
    vehicleInfo: data.vehicle_info,
    appraisedValue: data.appraised_value,
  },

  committeeRemarks: data.committee_remarks,
}));

  } catch (error) {

    console.error(error);

  }
};