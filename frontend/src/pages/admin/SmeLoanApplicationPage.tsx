import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { CheckCircle2, Printer, RotateCcw, Save } from 'lucide-react'

const STORAGE_KEY = 'fms:admin:sme-loan-application'
const registrationTypes = ['CDA', 'DTI', 'SEC', 'BIR', "Barangay/Mayor's Permit", 'Other']
const facilities = ['SME Term Loan with Prime Rebate', 'SME Credit Line', 'SME Business Credit Line', 'SME Standby Credit Line Certification', 'Other']
const purposes = ['Working capital', 'Business expansion', 'Construction/development or real estate acquisition', 'Equipment or motor vehicle purchase', 'Biological asset purchase', 'Loan takeout/refinancing', 'Savings/investment', 'Other']
const securityTypes = ['Real estate', 'Movable property', 'Financial assets', 'Inventory', 'Receivables', 'Intellectual property', 'Title documents', 'Third-party guarantee/continuing suretyship', 'Other']
const declarations = [
  'Information and supporting documents are true, accurate, and complete', 'PSBank will be notified of material changes',
  'The bank is authorized to obtain information relevant to this application', 'Applicable laws, BSP regulations, and PSBank policies are acknowledged',
  'Data Privacy Consent has been read and accepted', 'Personal-data processing, storage, and sharing are acknowledged',
  'Credit Information Corporation data-submission provisions are acknowledged',
]
const supportingDocuments = [
  'Completed and signed Business Loan Application Form', 'Valid government-issued ID of authorized representative',
  "Board/Partnership Resolution or Secretary's Certificate", 'Special Power of Attorney, if applicable', 'FFEDIS Certificate, if applicable',
  'DTI Certificate of Registration', 'SEC Certificate of Registration', 'Articles of Partnership', 'General Information Sheet',
  'Latest amended Articles of Incorporation and By-Laws', 'CDA Certificate of Registration', 'Certificate of Compliance', 'List of elected officers',
  'Three years of AFS with latest ITR', 'In-house or pre-operating financial statements', 'Six months of bank statements/passbook copies',
  'Business background or company profile', 'Proof of other income', 'Three months of utility bills', 'Current lender Statement of Account',
  'Refinancing/loan takeout official receipts', 'Movable property Certificate of Ownership', 'Other bank-requested documents',
]
const securityDocuments = [
  'Photocopy of TCT/CCT', 'Tax Declaration for land and improvements', 'Location/vicinity map', "Original owner's TCT/CCT",
  'Original Tax Clearance', 'Certified true copy of latest Tax Declaration', 'Latest full-year RETR', 'Property insurance policies',
  'Condominium Master Deed of Declaration', 'Affidavit of Consent to Mortgage Family Home', 'LTO OR/CR or motor vehicle Deed of Sale',
  'Basic and income documents of surety', 'Building/floor plan', 'Bill of materials', 'Proposed finish specifications', 'Building permit', 'Appraisal fee',
]
const finalChecklist = [
  'All applicable form fields are completed', 'Non-applicable fields are marked N/A',
  'Loan amount, purpose, facility, tenor, and repayment source are consistent', "Representatives' details and IDs are complete",
  'Financial and bank statements are attached', 'Registration documents match the entity type',
  "Board/Partnership Resolution or Secretary's Certificate is attached", 'Collateral and security documents are attached',
  'Required signatures, names, designations, and dates are present', 'Consent and Undertaking/Declaration have been read',
  'Addendum is completed, if applicable', 'Additional sheets are attached where required',
]

type Values = Record<string, string | boolean>

function Field({ label, name, values, type = 'text', required = false }: { label: string; name: string; values: Values; type?: string; required?: boolean }) {
  return <label>{label}<input name={name} type={type} required={required} value={String(values[name] ?? '')} /></label>
}

function SelectField({ label, name, options, values, required = false }: { label: string; name: string; options: string[]; values: Values; required?: boolean }) {
  return <label>{label}<select name={name} required={required} value={String(values[name] ?? '')}><option value="">Select</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
}

function Checks({ legend, name, options, values }: { legend: string; name: string; options: string[]; values: Values }) {
  return <fieldset className="sme-checkbox-group"><legend>{legend}</legend>{options.map((option) => {
    const key = `${name}-${option}`
    return <label key={option}><input type="checkbox" name={key} checked={Boolean(values[key])} /><span>{option}</span></label>
  })}</fieldset>
}

function Section({ number, title, description, children }: { number: string; title: string; description?: string; children: ReactNode }) {
  return <section className="sme-section"><div className="sme-section-heading"><span>{number}</span><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div></div>{children}</section>
}

function loadSavedValues(): Values {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as { values?: Values }).values ?? {} : {}
  } catch { return {} }
}

export default function SmeLoanApplicationPage() {
  const [values, setValues] = useState<Values>(loadSavedValues)
  const [status, setStatus] = useState('')
  const completed = useMemo(() => finalChecklist.filter((item) => values[`final-${item}`]).length, [values])

  function handleChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return
    if (!target.name) return
    const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value
    setValues((current) => ({ ...current, [target.name]: value }))
    setStatus('Unsaved changes')
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ values, savedAt: new Date().toISOString() }))
    setStatus(`Application saved ${new Date().toLocaleString()}`)
  }

  function handleReset() {
    if (!window.confirm('Clear all SME application fields and the saved draft?')) return
    window.localStorage.removeItem(STORAGE_KEY)
    setValues({})
    setStatus('Application cleared')
  }

  return <main className="sme-page">
    <header className="sme-page-header"><div><span className="sme-eyebrow">Administration / Credit origination</span><h1>SME</h1><p>Business loan application, due-diligence details, and document readiness.</p></div><div className="sme-progress"><strong>{completed}/12</strong><span>submission checks</span></div></header>
    <form className="sme-form" onChange={handleChange} onSubmit={handleSave}>
      <Section number="01" title="Business information" description="Registration, operating profile, contact details, and authorized representatives.">
        <div className="sme-subsection"><h3>Registration and profile</h3><div className="sme-field-grid">
          <Field label="Registered business / trade name" name="businessName" required values={values} />
          <SelectField label="Business address ownership" name="addressOwnership" options={['Owned', 'Mortgaged', 'Rented']} values={values} />
          <label className="sme-field-wide">Principal business address<textarea name="businessAddress" value={String(values.businessAddress ?? '')} rows={2} /></label>
          <Checks legend="Registration type" name="registration" options={registrationTypes} values={values} />
          <Field label="Registration date" name="registrationDate" type="date" values={values} /><Field label="Expiry date" name="registrationExpiry" type="date" values={values} /><Field label="Registration number" name="registrationNumber" values={values} />
          <SelectField label="Nature of business" name="businessNature" options={['Agriculture', 'Manufacturing', 'Wholesale/Retail', 'Construction', 'Transportation', 'Food/Accommodation', 'Technology', 'Professional Services', 'Other']} values={values} />
          <Field label="Specific activity (PSIC)" name="businessActivity" values={values} /><SelectField label="Firm size" name="firmSize" options={['Micro', 'Small', 'Medium']} values={values} /><Field label="Years in operation" name="yearsOperating" type="number" values={values} />
          <Field label="Full-time employees" name="employeesFullTime" type="number" values={values} /><Field label="Part-time employees" name="employeesPartTime" type="number" values={values} /><Field label="Contractual employees" name="employeesContractual" type="number" values={values} />
          <Field label="Branches" name="branchCount" type="number" values={values} /><Field label="Subsidiaries" name="subsidiaryCount" type="number" values={values} /><Field label="Female ownership (%)" name="femaleOwnership" type="number" values={values} /><Field label="Female management (%)" name="femaleManagement" type="number" values={values} />
        </div></div>
        <div className="sme-subsection"><h3>Contact information</h3><div className="sme-field-grid"><Field label="Website / social media" name="website" type="url" values={values} /><Field label="Year established online" name="websiteYear" type="number" values={values} /><Field label="Landline" name="businessLandline" type="tel" values={values} /><Field label="Business email" name="businessEmail" type="email" required values={values} /></div></div>
        {[1, 2].map((index) => <div className="sme-subsection" key={index}><h3>Authorized representative {index}{index === 2 ? ' (optional)' : ''}</h3><div className="sme-field-grid">
          <Field label="First name" name={`representative${index}FirstName`} required={index === 1} values={values} /><Field label="Middle name" name={`representative${index}MiddleName`} values={values} /><Field label="Last name" name={`representative${index}LastName`} required={index === 1} values={values} /><Field label="Suffix" name={`representative${index}Suffix`} values={values} />
          <Field label="Date of birth" name={`representative${index}BirthDate`} type="date" values={values} /><SelectField label="Sex" name={`representative${index}Sex`} options={['Female', 'Male', 'Prefer not to say']} values={values} /><Field label="TIN" name={`representative${index}Tin`} values={values} /><Field label="Government ID and number" name={`representative${index}GovernmentId`} values={values} />
          <Field label="Mobile" name={`representative${index}Mobile`} type="tel" values={values} /><Field label="Landline" name={`representative${index}Landline`} type="tel" values={values} /><Field label="Email" name={`representative${index}Email`} type="email" values={values} />
        </div></div>)}
      </Section>

      <Section number="02" title="Loan application" description="Requested facility, borrowing purpose, repayment, and security."><div className="sme-field-grid">
        <SelectField label="Application type" name="applicationType" options={['New application', 'Additional loan', 'Renewal', 'Restructuring']} required values={values} /><Field label="Loan amount (PHP)" name="loanAmount" type="number" required values={values} />
        <SelectField label="Loan facility" name="loanFacility" options={facilities} required values={values} /><SelectField label="Type of loan" name="loanType" options={['Term loan', 'Credit line', 'Other']} values={values} /><Checks legend="Loan purpose" name="purpose" options={purposes} values={values} />
        <Field label="Tenor (months)" name="tenorMonths" type="number" values={values} /><Field label="Target availment date" name="availmentDate" type="date" values={values} /><Field label="Source of repayment" name="repaymentSource" values={values} /><SelectField label="Repayment frequency" name="repaymentFrequency" options={['Weekly', 'Monthly', 'Quarterly', 'Annually', 'Lump sum', 'Other']} values={values} />
        <Checks legend="Security offered" name="security" options={securityTypes} values={values} /><label className="sme-field-wide">Renewal/restructuring changes and other details<textarea name="applicationChanges" value={String(values.applicationChanges ?? '')} rows={3} /></label>
      </div></Section>

      <Section number="03" title="Financial information" description="Financial capacity, accounts, existing credit, and trade relationships.">
        <div className="sme-field-grid"><Field label="Annual sales / revenue (PHP)" name="annualRevenue" type="number" required values={values} /></div>
        <div className="sme-subsection"><h3>Deposit, e-money, credit card, and loan relationships (up to 3)</h3>{[1, 2, 3].map((index) => <div className="sme-repeat-row" key={index}><strong>{index}</strong><Field label="Institution" name={`bank${index}Institution`} values={values} /><Field label="Account name / number" name={`bank${index}Account`} values={values} /><Field label="Type / ownership" name={`bank${index}Type`} values={values} /><Field label="Year opened" name={`bank${index}Year`} type="number" values={values} /><Field label="Credit limit / loan amount" name={`bank${index}Limit`} type="number" values={values} /><Field label="Outstanding balance" name={`bank${index}Balance`} type="number" values={values} /><Field label="Date granted" name={`bank${index}Granted`} type="date" values={values} /><Field label="Maturity date" name={`bank${index}Maturity`} type="date" values={values} /><Field label="Collateral" name={`bank${index}Collateral`} values={values} /></div>)}</div>
        {['Supplier', 'Customer'].map((kind) => <div className="sme-subsection" key={kind}><h3>Top {kind.toLowerCase()} references</h3>{[1, 2, 3].map((index) => <div className="sme-repeat-row sme-trade-row" key={index}><strong>{index}</strong><Field label={`${kind} name`} name={`${kind}${index}Name`} values={values} /><Field label="Contact person" name={`${kind}${index}Contact`} values={values} /><Field label="Contact information" name={`${kind}${index}Info`} values={values} /><Field label="Goods / services" name={`${kind}${index}Goods`} values={values} /></div>)}</div>)}
      </Section>

      <Section number="04" title="Undertaking, declaration, and consent"><Checks legend="Applicant acknowledgements" name="declaration" options={declarations} values={values} /><div className="sme-field-grid sme-top-gap"><Field label="Guarantor / security grantor" name="guarantorName" values={values} /><Field label="Affiliation / relationship" name="guarantorRelationship" values={values} /><Field label="Authorized signatory" name="signatoryName" values={values} /><Field label="Designation" name="signatoryDesignation" values={values} /><Field label="Signature date" name="signatureDate" type="date" values={values} /></div></Section>
      <Section number="05" title="Supporting documents" description="Select documents received or verified for this application."><Checks legend="Basic, registration, income, and other documents" name="document" options={supportingDocuments} values={values} /><Checks legend="Security, construction, and post-approval documents" name="securityDocument" options={securityDocuments} values={values} /></Section>
      <Section number="06" title="Application addendum" description="For cooperatives, partnerships, OPCs, and corporations."><div className="sme-field-grid"><Field label="Property / asset offered" name="addendumAsset" values={values} /><Field label="Title / registration details" name="addendumRegistration" values={values} /><Field label="Registered owner" name="addendumOwner" values={values} /><Field label="Asset amount (PHP)" name="addendumAmount" type="number" values={values} /><Field label="Authorized signatory" name="addendumSignatory" values={values} /><Field label="Designation" name="addendumDesignation" values={values} /><Field label="Date" name="addendumDate" type="date" values={values} /><Checks legend="Terms reviewed" name="addendumTerms" options={['Insurance', 'Taxes', 'Maintenance of mortgaged property', 'Events and consequences of default']} values={values} /></div></Section>
      <Section number="07" title="Final submission review"><div className="sme-checklist-summary"><CheckCircle2 size={24} /><strong>{completed} of 12 complete</strong><progress value={completed} max={12} /></div><Checks legend="Ready-to-submit checklist" name="final" options={finalChecklist} values={values} /></Section>
      <footer className="sme-form-actions"><span role="status">{status}</span><button type="button" className="secondary" onClick={() => window.print()}><Printer size={18} /> Print</button><button type="button" className="secondary" onClick={handleReset}><RotateCcw size={18} /> Reset</button><button type="submit"><Save size={18} /> Save application</button></footer>
    </form>
  </main>
}