import { HeartPulse, Save, ShieldCheck } from 'lucide-react'
import { FormEvent, useState } from 'react'

import { api, getErrorMessage } from '../../api'
import FinancialHealthJourneyMenu from '../../components/financial-health/FinancialHealthJourneyMenu'

type LifeProtectTab = 'pre-assessment' | 'insurance-availed' | 'insurance-existing'
type FormValues = Record<string, string>

const PRIORITIES = [
  'Have Funds Ready for Critical Illness',
  'Worry-Free Retirement Fund',
  "Children's Education & Future Fund",
  'Business Capital & Expansion',
  'Pay My Estate Tax / Estate Planning',
  'Travel / Lifestyle Fund',
  'Debt-Free Goal',
  "Parents' Financial Security Fund",
  'OFW Return Fund',
  'Home & Mortgage Fund',
  'Wealth Accumulation / Investment Growth',
  'Legacy Planning / Inheritance for My Family',
  'Marriage Fund / Building My Family Future',
  'Charitable Giving Fund',
  'Passive Income Fund',
]

const GOAL_AMOUNTS = [
  ' 500,000 -  1,000,000',
  ' 1,000,000 -  5,000,000',
  ' 5,000,000 -  10,000,000',
  ' 10,000,000 -  100,000,000',
  ' 100,000,000 and above',
]

const BUDGET_AMOUNTS = [
  ' 3,000 -  5,000',
  ' 5,000 -  10,000',
  ' 10,000 -  20,000',
  ' 20,000 -  50,000',
  ' 100,000 -  1,000,000',
  ' 1,000,000 and above',
]

const GROWTH_PERIODS = ['5 years and above', '10 years and above', '15 years and above', '20 years and above']

const HEALTH_CONCERNS = [
  'Being diagnosed with a critical illness and facing millions in medical expenses',
  'Losing my income because of disability',
  'Having to sell assets or property to pay medical bills',
  'Being hospitalized for a long period and draining my lifetime savings',
  "My children's education being affected because of my illness",
  'Having to depend financially on family and relatives when I can no longer work',
  'Leaving my family with financial burdens, loans, debts, or other obligations',
  'Not leaving enough money or inheritance for my family',
]

const SOURCE_OF_INCOME = ['Employed', 'Self Employed', 'Not Employed', 'Business Owner']

function Field({ label, name, type = 'text', required = true, values, onChange }: {
  label: string
  name: string
  type?: string
  required?: boolean
  values: FormValues
  onChange: (name: string, value: string) => void
}) {
  return (
    <label className="life-protect-field">
      <span>{label}{required ? <b aria-hidden="true"> *</b> : null}</span>
      <input
        name={name}
        type={type}
        required={required}
        value={values[name] ?? ''}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </label>
  )
}

function ChoiceGroup({ legend, name, options, values, onChange, columns = false }: {
  legend: string
  name: string
  options: readonly string[]
  values: FormValues
  onChange: (name: string, value: string) => void
  columns?: boolean
}) {
  return (
    <fieldset className="life-protect-choice-group">
      <legend>{legend}<b aria-hidden="true"> *</b></legend>
      <div className={columns ? 'life-protect-choice-grid' : 'life-protect-choice-row'}>
        {options.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={values[name] === option}
              required
              onChange={(event) => onChange(name, event.target.value)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function LifeProtectPage() {
  const [activeTab, setActiveTab] = useState<LifeProtectTab>('pre-assessment')
  const [values, setValues] = useState<FormValues>({})
  const [notice, setNotice] = useState('')
  const [noticeIsError, setNoticeIsError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateValue = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }))
    setNotice('')
    setNoticeIsError(false)
  }

  const saveDraft = () => {
    setNotice('Draft retained for this open page only. Sensitive information is not stored in browser storage.')
    setNoticeIsError(false)
  }

  const submitAssessment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setNotice('')
    setNoticeIsError(false)
    const { recipientEmail, ...assessment } = values

    try {
      const response = await api.post<{ message: string }>('/api/life-protect/pre-assessment/email', {
        recipient_email: recipientEmail,
        assessment,
      })
      setNotice(response.data.message)
    } catch (error) {
      setNotice(getErrorMessage(error, 'Unable to email the pre-assessment. Please try again.'))
      setNoticeIsError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="psychometric-page life-protect-page">
      <section className="psychometric-hero life-protect-hero psychometric-hero-with-journey-menu" aria-labelledby="life-protect-title">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Protection Needs Assessment</span>
          <h1 id="life-protect-title">Life Protect</h1>
          <p>Organize your protection priorities, health context, financial capacity, and family information in one guided assessment.</p>
        </div>
        <FinancialHealthJourneyMenu className="financial-health-journey-menu-in-hero" />
        <div className="life-protect-hero-mark" aria-hidden="true">
          <ShieldCheck />
          <strong>3</strong>
          <span>protection views</span>
        </div>
      </section>

      <nav className="life-protect-tabs" aria-label="Life Protect sections" role="tablist">
        {([
          ['pre-assessment', 'Pre-assessment'],
          ['insurance-availed', 'Insurance Availed'],
          ['insurance-existing', 'Insurance Existing'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={activeTab === id ? 'is-active' : undefined}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab !== 'pre-assessment' ? (
        <section className="psychometric-panel life-protect-empty-panel" role="tabpanel">
          <HeartPulse aria-hidden="true" />
          <span className="psychometric-panel-kicker">{activeTab === 'insurance-availed' ? 'Insurance Availed' : 'Insurance Existing'}</span>
          <h2>No insurance details configured yet</h2>
          <p>This section is ready for the policy fields and workflow requirements to be defined.</p>
        </section>
      ) : (
        <form className="life-protect-form" onSubmit={submitAssessment} role="tabpanel">
          <section className="psychometric-panel life-protect-privacy-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Financial Planning &amp; Need Analysis</span>
                <h2>Data Privacy Consent</h2>
              </div>
              <ShieldCheck aria-hidden="true" />
            </div>
            <p>By signing this application form, you allow the collection, use, and processing of your personal information and sensitive personal information, to the requestor of this assessment for the purposes of this assessment, in accordance with applicable data privacy regulations, including Republic Act No. 10173, the Data Privacy Act of 2012.</p>
            <label className="life-protect-consent">
              <input
                type="checkbox"
                required
                checked={values.privacyConsent === 'yes'}
                onChange={(event) => updateValue('privacyConsent', event.target.checked ? 'yes' : '')}
              />
              <span>I have read and agree to the data privacy consent. <b>*</b></span>
            </label>
            <small><b>*</b> Indicates a required question.</small>
          </section>

          <section className="psychometric-section-card life-protect-section">
            <header className="psychometric-section-header">
              <div><span className="psychometric-section-code">Section A</span><h3>Personal Information</h3><p>Identity and contact details for this needs analysis.</p></div>
            </header>
            <div className="life-protect-form-grid">
              <Field label="Email" name="email" type="email" values={values} onChange={updateValue} />
              <Field label="Full Name (First, Middle, Last)" name="fullName" values={values} onChange={updateValue} />
              <Field label="Birth Date" name="birthDate" type="date" values={values} onChange={updateValue} />
              <Field label="Assessment Date" name="assessmentDate" type="date" values={values} onChange={updateValue} />
              <Field label="City of Birth" name="cityOfBirth" values={values} onChange={updateValue} />
              <Field label="Contact Number" name="contactNumber" type="tel" values={values} onChange={updateValue} />
              <Field label="Permanent Address" name="permanentAddress" values={values} onChange={updateValue} />
              <Field label="Height (Feet/ft)" name="height" values={values} onChange={updateValue} />
              <Field label="Weight (kg)" name="weight" type="number" values={values} onChange={updateValue} />
            </div>
          </section>

          <section className="psychometric-section-card life-protect-section">
            <header className="psychometric-section-header">
              <div><span className="psychometric-section-code">Section B</span><h3>Health &amp; Protection Priorities</h3><p>Health history, financial goals, and the risks that matter most.</p></div>
            </header>
            <ChoiceGroup legend="Have you been hospitalized or admitted to a clinic within the past 5 years?" name="hospitalized" options={['Yes', 'No']} values={values} onChange={updateValue} />
            <label className="life-protect-field life-protect-field-wide"><span>Health Condition <b>*</b></span><textarea name="healthCondition" required rows={3} placeholder="Good/Fair/Poor" value={values.healthCondition ?? ''} onChange={(event) => updateValue('healthCondition', event.target.value)} /></label>
            <ChoiceGroup legend="Given the chance to invest for your future, what would you prioritize?" name="futurePriority" options={PRIORITIES} values={values} onChange={updateValue} columns />
            <ChoiceGroup legend="How much do you need to reach your financial goal?" name="goalAmount" options={GOAL_AMOUNTS} values={values} onChange={updateValue} columns />
            <ChoiceGroup legend="How much budget can you allocate to reach your goal?" name="allocatedBudget" options={BUDGET_AMOUNTS} values={values} onChange={updateValue} columns />
            <ChoiceGroup legend="How long will you allow your money to grow before you need access to it?" name="growthPeriod" options={GROWTH_PERIODS} values={values} onChange={updateValue} />
            <ChoiceGroup legend="For your health security, what worries you most?" name="healthConcern" options={HEALTH_CONCERNS} values={values} onChange={updateValue} columns />
            <ChoiceGroup legend="Do you have insurance that is now in force?" name="hasInsurance" options={['Yes', 'No']} values={values} onChange={updateValue} />
          </section>

          <section className="psychometric-section-card life-protect-section">
            <header className="psychometric-section-header">
              <div><span className="psychometric-section-code">Section C</span><h3>Financial Capacity</h3><p>Income source, employment, expenses, and net-worth context.</p></div>
            </header>
            <ChoiceGroup legend="Source of Income" name="incomeSource" options={SOURCE_OF_INCOME} values={values} onChange={updateValue} />
            <div className="life-protect-form-grid">
              <Field label="Occupation" name="occupation" values={values} onChange={updateValue} />
              <Field label="Type of Business" name="businessType" required={false} values={values} onChange={updateValue} />
              <Field label="Name of Employer" name="employerName" required={false} values={values} onChange={updateValue} />
              <Field label="Business Address" name="businessAddress" required={false} values={values} onChange={updateValue} />
              <Field label="Estimated Monthly Income" name="monthlyIncome" type="number" values={values} onChange={updateValue} />
              <Field label="Estimated Monthly Expenses" name="monthlyExpenses" type="number" values={values} onChange={updateValue} />
              <Field label="Estimated Net Worth" name="netWorth" type="number" values={values} onChange={updateValue} />
            </div>
          </section>

          <section className="psychometric-section-card life-protect-section">
            <header className="psychometric-section-header">
              <div><span className="psychometric-section-code">Section D</span><h3>Family &amp; Beneficiaries</h3><p>Family health context and direct-family beneficiary information.</p></div>
            </header>
            <div className="life-protect-form-grid">
              <Field label="Name of Father" name="fatherName" values={values} onChange={updateValue} />
              <Field label="Age of Father" name="fatherAge" type="number" values={values} onChange={updateValue} />
              <Field label="Health Condition of Father" name="fatherHealth" values={values} onChange={updateValue} />
              <Field label="Name of Mother" name="motherName" values={values} onChange={updateValue} />
              <Field label="Age of Mother" name="motherAge" type="number" values={values} onChange={updateValue} />
              <Field label="Health Condition of Mother" name="motherHealth" values={values} onChange={updateValue} />
            </div>
            {[
              ['siblings', 'All Siblings (include age and health conditions)'],
              ['spouse', 'Spouse (include age and health conditions)'],
              ['children', 'Children (include age and health conditions)'],
              ['beneficiary1', 'Beneficiary 1 - direct family only (birthdate, birthplace, relationship, contact number, and email)'],
              ['beneficiary2', 'Beneficiary 2 - direct family only (birthdate, birthplace, relationship, contact number, and email)'],
            ].map(([name, label]) => (
              <label key={name} className="life-protect-field life-protect-field-wide"><span>{label} <b>*</b></span><textarea name={name} required rows={3} value={values[name] ?? ''} onChange={(event) => updateValue(name, event.target.value)} /></label>
            ))}
            <div className="life-protect-form-grid">
              <Field label="Philippine Government ID Type" name="governmentIdType" values={values} onChange={updateValue} />
              <Field label="Philippine Government ID Number" name="governmentIdNumber" values={values} onChange={updateValue} />
            </div>
            <label className="life-protect-field life-protect-field-wide"><span>Other Information <b>*</b></span><textarea name="additionalAnswer" required rows={4} value={values.additionalAnswer ?? ''} onChange={(event) => updateValue('additionalAnswer', event.target.value)} /></label>
          </section>

          <section className="psychometric-panel life-protect-delivery-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Secure Submission</span>
                <h2>Email Completed Pre-assessment</h2>
                <p className="psychometric-section-note">The complete filled form will be sent as a plain-text email to this address.</p>
              </div>
            </div>
            <div className="life-protect-email-sender" aria-label="Email sender">
              <span></span>
              <strong>FINANCIAL HEALTH</strong>
              <small></small>
            </div>
            <div className="life-protect-form-grid">
              <Field label="Send Completed Form To" name="recipientEmail" type="email" values={values} onChange={updateValue} />
            </div>
            <label className="life-protect-consent life-protect-email-consent">
              <input
                type="checkbox"
                required
                checked={values.emailDeliveryConsent === 'yes'}
                onChange={(event) => updateValue('emailDeliveryConsent', event.target.checked ? 'yes' : '')}
              />
              <span>I consent to sending this personal and sensitive information to the email address entered above. <b>*</b></span>
            </label>
          </section>

          <div className="life-protect-form-actions">
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem" }}>
              <button type="button" className="psychometric-reset-button life-protect-save-button" onClick={saveDraft}><Save aria-hidden="true" /> Save Draft</button>
              <button type="submit" className="psychometric-reset-button" disabled={isSubmitting}><ShieldCheck aria-hidden="true" /> {isSubmitting ? 'Sending...' : 'Submit & Email Pre-assessment'}</button>
            </div>
            {notice ? <span className={noticeIsError ? 'is-error' : undefined} role={noticeIsError ? 'alert' : 'status'}>{notice}</span> : null}
          </div>
        </form>
      )}
    </main>
  )
}
