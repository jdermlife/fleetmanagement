import { useMemo, useState } from 'react'

type ProfileStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11

type ProfileData = {
  profileId: string
  step: ProfileStep
  values: Record<string, string>
  documents: string[]
  suitabilityAnswers: Record<string, string>
}

type FieldDefinition = {
  key: string
  label: string
  type?: 'date' | 'email' | 'number' | 'select' | 'tel' | 'text'
  options?: string[]
  wide?: boolean
}

const STORAGE_KEY = 'fms:build-profile'
const FINANCIAL_GOAL_OPTIONS = [
  'Build Emergency Fund', 'Pay off High Interest Debt', 'Save for Property Down Payment',
  'Fund Education or Certification', 'Grow an Investment Portfolio', 'Establish Insurance Coverage',
  'Build Retirement Savings', 'Buy First Home', 'Buy Car', 'Start or Expand a Business',
  'Achieve Financial Independence', 'Create Generational Wealth', 'Other',
]

const WORKFLOW_STEPS: Array<{ id: ProfileStep; label: string; description: string }> = [
  { id: 1, label: 'Tell Us About Yourself', description: 'Start with your essential personal and contact details.' },
  { id: 2, label: 'Applicant Information', description: 'Complete identity, household, and residence information.' },
  { id: 3, label: 'Employment, Income and Credit Values', description: 'Record employment, income, expenses, and obligations.' },
  { id: 4, label: 'Spouse / Co-Borrower Information', description: 'Add a spouse or co-borrower supporting the profile.' },
  { id: 5, label: 'Banking Relationships', description: 'Describe credit cards, bank accounts, and existing loans.' },
  { id: 6, label: 'Goal Setting', description: 'Define the financial purpose, product, amount, and timeframe.' },
  { id: 7, label: 'Collateral Details', description: 'Identify assets that may support future financing.' },
  { id: 8, label: 'Document Upload Center', description: 'Add identity, income, banking, and asset documents.' },
  { id: 9, label: 'Set As Of Date', description: 'Set the statement date, goal, target, and target period.' },
  { id: 10, label: 'Set Up Baseline', description: 'Enter assets, liabilities, income, and monthly expenses.' },
  { id: 11, label: 'Suitability Assessment', description: 'Assess investment objectives, horizon, and risk capacity.' },
]

const STEP_FIELDS: Record<Exclude<ProfileStep, 8 | 11>, FieldDefinition[]> = {
  1: [
    { key: 'fullName', label: 'Full Name' },
    { key: 'email', label: 'Email Address', type: 'email' },
    { key: 'mobileNumber', label: 'Mobile Number', type: 'tel' },
    { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
    { key: 'address', label: 'Present Address', wide: true },
  ],
  2: [
    { key: 'governmentId', label: 'Government ID Number' }, { key: 'placeOfBirth', label: 'Place of Birth' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Prefer not to say'] },
    { key: 'citizenship', label: 'Citizenship' },
    { key: 'civilStatus', label: 'Civil Status', type: 'select', options: ['Single', 'Married', 'Widow', 'Separated'] },
    { key: 'dependents', label: 'Number of Dependents', type: 'number' }, { key: 'tin', label: 'TIN' },
    { key: 'sssGsis', label: 'SSS / GSIS Number' }, { key: 'permanentAddress', label: 'Permanent Address', wide: true },
    { key: 'homeOwnership', label: 'Home Ownership', type: 'select', options: ['Own', 'Mortgaged', 'Renting', 'Living with Relative'] },
    { key: 'education', label: 'Educational Attainment', type: 'select', options: ['Postgraduate', 'College Degree', 'Vocational', 'High School'] },
  ],
  3: [
    { key: 'employmentStatus', label: 'Employment Status', type: 'select', options: ['Regular', 'Contractual', 'Self-employed', 'Business Owner', 'Freelancer', 'Not currently employed'] },
    { key: 'employerName', label: 'Employer / Business Name' }, { key: 'occupation', label: 'Occupation' },
    { key: 'position', label: 'Position' }, { key: 'officeAddress', label: 'Office Address', wide: true },
    { key: 'monthlyIncome', label: 'Primary Monthly Income', type: 'number' },
    { key: 'otherIncome', label: 'Other Sources of Income', type: 'number' },
    { key: 'monthlyExpenses', label: 'Monthly Living Expenses', type: 'number' },
    { key: 'debtObligations', label: 'Existing Monthly Debt Obligations', type: 'number' },
  ],
  4: [
    { key: 'supportType', label: 'Profile Support', type: 'select', options: ['No Spouse / Co-Borrower', 'Spouse', 'Co-Borrower'] },
    { key: 'supportName', label: 'Full Name' }, { key: 'supportRelationship', label: 'Relationship' },
    { key: 'supportMobile', label: 'Mobile Number', type: 'tel' }, { key: 'supportEmployer', label: 'Employer / Business Name' },
    { key: 'supportOccupation', label: 'Occupation' }, { key: 'supportIncome', label: 'Gross Monthly Income', type: 'number' },
    { key: 'supportDebt', label: 'Debt Obligations', type: 'number' },
    { key: 'supportCreditStanding', label: 'Credit Standing', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
  ],
  5: [
    { key: 'cardIssuer', label: 'Credit Card Issuer' }, { key: 'creditLimit', label: 'Credit Limit', type: 'number' },
    { key: 'outstandingBalance', label: 'Outstanding Balance', type: 'number' }, { key: 'bankBranch', label: 'Bank / Branch' },
    { key: 'accountType', label: 'Account Type' }, { key: 'currentBalance', label: 'Current Balance', type: 'number' },
    { key: 'loanLender', label: 'Existing Lender / Bank' }, { key: 'loanType', label: 'Existing Loan Type' },
    { key: 'loanBalance', label: 'Current Loan Balance', type: 'number' },
    { key: 'monthlyAmortization', label: 'Monthly Amortization', type: 'number' },
  ],
  6: [
    { key: 'loanPurpose', label: 'Financial Goal / Purpose', wide: true },
    { key: 'productType', label: 'Product Being Considered', type: 'select', options: ['Home Loan', 'Auto Loan', 'Motorcycle Loan', 'Credit Card', 'Personal Loan', 'Margin Loan'] },
    { key: 'requestedAmount', label: 'Requested Amount', type: 'number' },
    { key: 'loanTerm', label: 'Loan Term (Months)', type: 'number' },
    { key: 'interestRate', label: 'Annual Interest Rate (%)', type: 'number' },
  ],
  7: [
    { key: 'securityClassification', label: 'Security Classification', type: 'select', options: ['Secured', 'Unsecured', 'Lease'] },
    { key: 'assetType', label: 'Asset Type', type: 'select', options: ['Property', 'Vehicle', 'Investment', 'Equipment', 'Other'] },
    { key: 'assetDescription', label: 'Asset Description', wide: true }, { key: 'registeredOwner', label: 'Registered Owner' },
    { key: 'appraisedValue', label: 'Appraised Value', type: 'number' }, { key: 'insuranceProvider', label: 'Insurance Provider' },
    { key: 'policyNumber', label: 'Policy Number' },
  ],
  9: [
    { key: 'asOfDate', label: 'As Of Date', type: 'date' },
    { key: 'financialGoal', label: 'Financial Goal', type: 'select', options: FINANCIAL_GOAL_OPTIONS },
    { key: 'targetAmount', label: 'Target Amount (PHP)', type: 'number' },
    { key: 'targetMonths', label: 'Months to Achieve', type: 'number' },
  ],
  10: [
    { key: 'cashSavings', label: 'Cash and Savings', type: 'number' }, { key: 'investments', label: 'Investments', type: 'number' },
    { key: 'propertyValue', label: 'Property Value', type: 'number' }, { key: 'vehicleValue', label: 'Vehicle Value', type: 'number' },
    { key: 'totalLiabilities', label: 'Total Liabilities', type: 'number' },
    { key: 'baselineMonthlyIncome', label: 'Monthly Income', type: 'number' },
    { key: 'baselineMonthlyExpenses', label: 'Monthly Expenses', type: 'number' },
  ],
}

const SUITABILITY_QUESTIONS = [
  { key: 'objective', prompt: 'What is your key investment objective?', options: ['Preserve principal', 'Generate income', 'Balanced growth', 'Aggressive growth'] },
  { key: 'horizon', prompt: 'How long can your funds remain invested?', options: ['Less than 1 year', '1 to 3 years', '3 to 5 years', 'More than 5 years'] },
  { key: 'liquidity', prompt: 'How often do you expect to need these funds?', options: ['Regularly', 'Occasionally', 'Rarely', 'Not for the foreseeable future'] },
  { key: 'experience', prompt: 'Which investments have you owned?', options: ['Savings only', 'Fixed income', 'Funds and bonds', 'Equities or alternatives'] },
  { key: 'risk', prompt: 'How would you respond to a temporary 20% decline?', options: ['Sell immediately', 'Reduce exposure', 'Hold', 'Invest more'] },
]

function createProfileId(): string {
  return `PRO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function createEmptyProfile(): ProfileData {
  return { profileId: createProfileId(), step: 1, values: {}, documents: [], suitabilityAnswers: {} }
}

function loadProfile(): ProfileData {
  if (typeof window === 'undefined') return createEmptyProfile()
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return createEmptyProfile()
    const parsed = JSON.parse(saved)
    if (parsed.values) return { ...createEmptyProfile(), ...parsed }
    const { profileId, ...legacyValues } = parsed
    return { ...createEmptyProfile(), profileId: profileId || createProfileId(), values: legacyValues }
  } catch {
    return createEmptyProfile()
  }
}

function formatCurrency(value: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return 'Not set'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount)
}

export default function BuildProfilePage() {
  const [profile, setProfile] = useState<ProfileData>(loadProfile)
  const [saveMessage, setSaveMessage] = useState('')
  const currentStep = WORKFLOW_STEPS.find((item) => item.id === profile.step) ?? WORKFLOW_STEPS[0]

  const stepCompletion = useMemo(() => {
    const result = {} as Record<ProfileStep, number>
    WORKFLOW_STEPS.forEach(({ id }) => {
      if (id === 8) result[id] = profile.documents.length > 0 ? 100 : 0
      else if (id === 11) result[id] = Math.round((SUITABILITY_QUESTIONS.filter((question) => profile.suitabilityAnswers[question.key]).length / SUITABILITY_QUESTIONS.length) * 100)
      else {
        const fields = STEP_FIELDS[id]
        result[id] = Math.round((fields.filter((field) => profile.values[field.key]?.trim()).length / fields.length) * 100)
      }
    })
    return result
  }, [profile])

  const completionPercent = Math.round(Object.values(stepCompletion).reduce((sum, percent) => sum + percent, 0) / WORKFLOW_STEPS.length)
  const profileStatus = completionPercent === 100 ? 'Complete' : completionPercent > 0 ? 'In Progress' : 'Getting Started'
  const updateValue = (key: string, value: string) => setProfile((current) => ({ ...current, values: { ...current.values, [key]: value } }))
  const goToStep = (step: ProfileStep) => setProfile((current) => ({ ...current, step }))

  const saveProfile = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
      setSaveMessage('Profile saved successfully.')
    } catch {
      setSaveMessage('Unable to save this profile in your browser.')
    }
  }

  const renderField = (field: FieldDefinition) => (
    <label key={field.key} className={field.wide ? 'build-profile-field-wide' : undefined}>
      {field.label}
      {field.type === 'select' ? (
        <select value={profile.values[field.key] ?? ''} onChange={(event) => updateValue(field.key, event.target.value)}>
          <option value="">Select {field.label.toLowerCase()}</option>
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input type={field.type ?? 'text'} min={field.type === 'number' ? '0' : undefined} value={profile.values[field.key] ?? ''} onChange={(event) => updateValue(field.key, event.target.value)} />
      )}
    </label>
  )

  const renderCurrentStep = () => {
    if (profile.step === 8) {
      return <div className="build-profile-step-content">
        <h3>Step 8: Document Upload Center</h3>
        <p className="psychometric-section-note">Upload identity, income, banking, and collateral support documents.</p>
        <label className="build-profile-upload-zone">
          <input type="file" multiple accept="image/*,.pdf" onChange={(event) => {
            const names = Array.from(event.target.files ?? []).map((file) => file.name)
            setProfile((current) => ({ ...current, documents: [...current.documents, ...names] }))
          }} />
          <strong>Choose supporting documents</strong><span>Images and PDF files</span>
        </label>
        <ul className="psychometric-breakdown-list">
          {profile.documents.length ? profile.documents.map((document, index) => <li key={`${document}-${index}`}><span>{document}</span><strong>Ready</strong></li>) : <li><span>No documents selected</span><strong>Pending</strong></li>}
        </ul>
      </div>
    }

    if (profile.step === 11) {
      const score = Object.values(profile.suitabilityAnswers).reduce((sum, answer) => sum + Number(answer), 0)
      const profileName = score >= 17 ? 'Aggressive' : score >= 13 ? 'Growth' : score >= 9 ? 'Balanced' : score >= 5 ? 'Conservative' : 'Pending completion'
      return <div className="build-profile-step-content">
        <h3>Step 11: Suitability Assessment</h3>
        <p className="psychometric-section-note">Complete all questions to establish an initial investment profile.</p>
        <div className="build-profile-question-list">
          {SUITABILITY_QUESTIONS.map((question) => <fieldset key={question.key}>
            <legend>{question.prompt}</legend>
            {question.options.map((option, index) => <label key={option}>
              <input type="radio" name={question.key} value={String(index + 1)} checked={profile.suitabilityAnswers[question.key] === String(index + 1)} onChange={(event) => setProfile((current) => ({ ...current, suitabilityAnswers: { ...current.suitabilityAnswers, [question.key]: event.target.value } }))} />
              <span>{option}</span>
            </label>)}
          </fieldset>)}
        </div>
        <div className="build-profile-calculation-card"><span>Investor Profile</span><strong>{profileName}</strong><small>Total suitability score: {score || 'Pending'}</small></div>
      </div>
    }

    const monthlySavings = Number(profile.values.targetMonths) > 0 ? Number(profile.values.targetAmount) / Number(profile.values.targetMonths) : 0
    const assets = ['cashSavings', 'investments', 'propertyValue', 'vehicleValue'].reduce((sum, key) => sum + Number(profile.values[key] || 0), 0)
    const netWorth = assets - Number(profile.values.totalLiabilities || 0)
    return <div className="build-profile-step-content">
      <h3>Step {profile.step}: {currentStep.label}</h3>
      <p className="psychometric-section-note">{currentStep.description}</p>
      <div className="build-profile-form-grid">{STEP_FIELDS[profile.step].map(renderField)}</div>
      {profile.step === 6 ? <div className="build-profile-calculation-card"><span>Planning Snapshot</span><strong>{profile.values.loanPurpose || 'Define your financial purpose'}</strong><small>{formatCurrency(profile.values.requestedAmount)} over {profile.values.loanTerm || '0'} months</small></div> : null}
      {profile.step === 9 ? <div className="build-profile-calculation-card"><span>Monthly Savings Required</span><strong>{formatCurrency(String(monthlySavings))}</strong><small>{profile.values.financialGoal || 'Select a financial goal'}</small></div> : null}
      {profile.step === 10 ? <div className="build-profile-calculation-card"><span>Baseline Net Worth</span><strong>{netWorth < 0 ? `-${formatCurrency(String(Math.abs(netWorth)))}` : formatCurrency(String(netWorth))}</strong><small>Assets less liabilities</small></div> : null}
    </div>
  }

  return <div className="psychometric-page lending-psychometric-page build-profile-page">
    <section className="psychometric-hero lending-psychometric-hero">
      <div className="psychometric-hero-copy"><span className="psychometric-eyebrow">Personal Financial Profile</span><h1>Shape Your Financial Future</h1><p>Build a complete profile across personal, credit, wealth, and suitability information.</p></div>
      <div className="psychometric-hero-metric build-profile-completion" aria-label={`${completionPercent}% profile completion`}><span>Profile Completion</span><strong>{completionPercent}%</strong><small>Step {profile.step} of 11: {currentStep.label}</small><div className="build-profile-progress-track" aria-hidden="true"><div style={{ width: `${completionPercent}%` }} /></div></div>
    </section>

    <section className="psychometric-summary-grid lending-psychometric-summary-grid">
      <article className="psychometric-summary-card psychometric-summary-card-highlight"><span>Profile ID</span><strong>{profile.profileId}</strong><small>Your personal profile reference</small></article>
      <article className="psychometric-summary-card build-profile-goal-summary"><span>Financial Goal</span><strong>{profile.values.financialGoal || profile.values.loanPurpose || 'Not selected'}</strong><small>{formatCurrency(profile.values.targetAmount || profile.values.requestedAmount)}</small></article>
      <article className="psychometric-summary-card"><span>Profile Status</span><strong>{profileStatus}</strong><small>Based on information provided</small></article>
      <article className="psychometric-summary-card"><span>Current Step</span><strong>{profile.step} / 11</strong><small>{currentStep.label}</small></article>
    </section>

    <section className="build-profile-layout">
      <article className="psychometric-panel build-profile-form-panel">
        <div className="psychometric-panel-header"><div><span className="psychometric-panel-kicker">Workflow Form</span><h2>{currentStep.label}</h2></div><span className="loan-page-status-chip build-profile-status-chip">{stepCompletion[profile.step]}% complete</span></div>
        {renderCurrentStep()}
        <div className="build-profile-form-actions">
          <button type="button" className="loan-footer-button" disabled={profile.step === 1} onClick={() => goToStep((profile.step - 1) as ProfileStep)}>Previous</button>
          <button type="button" className="loan-inline-button loan-inline-button-primary" onClick={saveProfile}>Save Profile</button>
          <button type="button" className="loan-footer-button" disabled={profile.step === 11} onClick={() => goToStep((profile.step + 1) as ProfileStep)}>Next</button>
        </div>
        {saveMessage ? <p className="status-message" role="status">{saveMessage}</p> : null}
      </article>

      <aside className="psychometric-panel lending-psychometric-step-panel build-profile-workflow-panel">
        <div className="psychometric-panel-header"><div><span className="psychometric-panel-kicker">Workflow Steps</span><h2>Build your Profile</h2></div></div>
        <div className="lending-psychometric-step-list">
          {WORKFLOW_STEPS.map((workflowStep) => <button key={workflowStep.id} type="button" onClick={() => goToStep(workflowStep.id)} className={`loan-stepper-button lending-psychometric-step-button ${profile.step === workflowStep.id ? 'loan-stepper-button-active' : 'loan-stepper-button-idle'}`}>
            <div className={`lending-psychometric-step-index ${profile.step >= workflowStep.id ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>{workflowStep.id}</div>
            <div className="lending-psychometric-step-copy"><strong>{workflowStep.label}</strong><span>{stepCompletion[workflowStep.id]}% information provided</span><div className="lending-step-information-track" aria-hidden="true"><div className={`lending-step-information-bar${stepCompletion[workflowStep.id] < 60 ? ' lending-step-information-bar-low' : ''}`} style={{ width: `${stepCompletion[workflowStep.id]}%` }} /></div><small>{workflowStep.description}</small></div>
          </button>)}
        </div>
      </aside>
    </section>
  </div>
}
