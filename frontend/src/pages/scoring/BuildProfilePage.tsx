import { useEffect, useMemo, useState } from 'react'

type ProfileData = {
  profileId: string
  fullName: string
  email: string
  mobileNumber: string
  dateOfBirth: string
  address: string
  employmentStatus: string
  occupation: string
  monthlyIncome: string
  financialGoal: string
  targetAmount: string
  targetMonths: string
}

const STORAGE_KEY = 'fms:build-profile'

const FINANCIAL_GOAL_OPTIONS = [
  'Build Emergency Fund',
  'Pay off High Interest Debt',
  'Save for Property Down Payment',
  'Fund Education or Certification',
  'Grow an Investment Portfolio',
  'Establish Insurance Coverage',
  'Build Retirement Savings',
  'Buy First Home',
  'Buy Car',
  'Start or Expand a Business',
  'Achieve Financial Independence',
  'Create Generational Wealth',
  'Other',
]

function createProfileId(): string {
  return `PRO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function createEmptyProfile(): ProfileData {
  return {
    profileId: createProfileId(),
    fullName: '',
    email: '',
    mobileNumber: '',
    dateOfBirth: '',
    address: '',
    employmentStatus: '',
    occupation: '',
    monthlyIncome: '',
    financialGoal: '',
    targetAmount: '',
    targetMonths: '',
  }
}

function loadProfile(): ProfileData {
  if (typeof window === 'undefined') {
    return createEmptyProfile()
  }

  try {
    const savedProfile = window.localStorage.getItem(STORAGE_KEY)
    if (!savedProfile) {
      return createEmptyProfile()
    }

    return { ...createEmptyProfile(), ...JSON.parse(savedProfile) }
  } catch {
    return createEmptyProfile()
  }
}

function formatTargetAmount(value: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Not set'
  }

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function BuildProfilePage() {
  const [profile, setProfile] = useState<ProfileData>(loadProfile)
  const [saveMessage, setSaveMessage] = useState('')

  const completedFields = useMemo(
    () => [
      profile.fullName,
      profile.email,
      profile.mobileNumber,
      profile.dateOfBirth,
      profile.address,
      profile.employmentStatus,
      profile.occupation,
      profile.monthlyIncome,
      profile.financialGoal,
      profile.targetAmount,
      profile.targetMonths,
    ].filter((value) => value.trim().length > 0).length,
    [profile],
  )
  const totalFields = 11
  const completionPercent = Math.round((completedFields / totalFields) * 100)
  const profileStatus = completionPercent === 100
    ? 'Complete'
    : completionPercent > 0
      ? 'In Progress'
      : 'Getting Started'

  useEffect(() => {
    setSaveMessage('')
  }, [profile])

  const updateProfile = (field: keyof ProfileData, value: string) => {
    setProfile((currentProfile) => ({ ...currentProfile, [field]: value }))
  }

  const saveProfile = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
      setSaveMessage('Profile saved successfully.')
    } catch {
      setSaveMessage('Unable to save this profile in your browser.')
    }
  }

  return (
    <div className="psychometric-page lending-psychometric-page build-profile-page">
      <section className="psychometric-hero lending-psychometric-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Personal Financial Profile</span>
          <h1>Shape Your Financial Future</h1>
          <p>
            Build a complete financial profile to receive more relevant insights, recommendations,
            and planning guidance. Your completion percentage updates as information is added.
          </p>
        </div>

        <div className="psychometric-hero-metric build-profile-completion" aria-label={`${completionPercent}% profile completion`}>
          <span>Profile Completion</span>
          <strong>{completionPercent}%</strong>
          <small>{completedFields} of {totalFields} profile fields completed</small>
          <div className="build-profile-progress-track" aria-hidden="true">
            <div style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
      </section>

      <section className="psychometric-summary-grid lending-psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Profile ID</span>
          <strong>{profile.profileId}</strong>
          <small>Your personal profile reference</small>
        </article>
        <article className="psychometric-summary-card build-profile-goal-summary">
          <span>Financial Goal</span>
          <strong>{profile.financialGoal || 'Not selected'}</strong>
          <small>{formatTargetAmount(profile.targetAmount)}</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Profile Status</span>
          <strong>{profileStatus}</strong>
          <small>Based on information provided</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Data Completion</span>
          <strong>{completionPercent}%</strong>
          <small>{totalFields - completedFields} fields remaining</small>
        </article>
      </section>

      <section className="build-profile-layout">
        <article className="psychometric-panel build-profile-form-panel">
          <div className="psychometric-panel-header">
            <div>
              <span className="psychometric-panel-kicker">Profile Details</span>
              <h2>Tell us about yourself</h2>
            </div>
            <span className="loan-page-status-chip build-profile-status-chip">{profileStatus}</span>
          </div>

          <div className="build-profile-form-grid">
            <label>
              Full Name
              <input value={profile.fullName} onChange={(event) => updateProfile('fullName', event.target.value)} autoComplete="name" />
            </label>
            <label>
              Email Address
              <input type="email" value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} autoComplete="email" />
            </label>
            <label>
              Mobile Number
              <input type="tel" value={profile.mobileNumber} onChange={(event) => updateProfile('mobileNumber', event.target.value)} autoComplete="tel" />
            </label>
            <label>
              Date of Birth
              <input type="date" value={profile.dateOfBirth} onChange={(event) => updateProfile('dateOfBirth', event.target.value)} autoComplete="bday" />
            </label>
            <label className="build-profile-field-wide">
              Address
              <input value={profile.address} onChange={(event) => updateProfile('address', event.target.value)} autoComplete="street-address" />
            </label>
            <label>
              Employment Status
              <select value={profile.employmentStatus} onChange={(event) => updateProfile('employmentStatus', event.target.value)}>
                <option value="">Select employment status</option>
                <option value="Employed">Employed</option>
                <option value="Self-employed">Self-employed</option>
                <option value="Business owner">Business owner</option>
                <option value="Freelancer">Freelancer</option>
                <option value="Student">Student</option>
                <option value="Retired">Retired</option>
                <option value="Not currently employed">Not currently employed</option>
              </select>
            </label>
            <label>
              Occupation
              <input value={profile.occupation} onChange={(event) => updateProfile('occupation', event.target.value)} autoComplete="organization-title" />
            </label>
            <label>
              Gross Monthly Income
              <input type="number" min="0" step="100" value={profile.monthlyIncome} onChange={(event) => updateProfile('monthlyIncome', event.target.value)} inputMode="decimal" />
            </label>
          </div>
        </article>

        <aside className="psychometric-panel build-profile-goal-card">
          <span className="psychometric-panel-kicker">Financial Goal</span>
          <h2>Define what you are building toward</h2>
          <p className="psychometric-section-note">
            Set a goal, target amount, and timeframe similar to your Net Worth Positioning plan.
          </p>

          <label>
            Financial Goal
            <select value={profile.financialGoal} onChange={(event) => updateProfile('financialGoal', event.target.value)}>
              <option value="">Select a financial goal</option>
              {FINANCIAL_GOAL_OPTIONS.map((goal) => <option key={goal} value={goal}>{goal}</option>)}
            </select>
          </label>
          <label>
            Target Amount (PHP)
            <input type="number" min="0" step="1000" value={profile.targetAmount} onChange={(event) => updateProfile('targetAmount', event.target.value)} inputMode="decimal" />
          </label>
          <label>
            Target Timeframe (Months)
            <input type="number" min="1" max="600" value={profile.targetMonths} onChange={(event) => updateProfile('targetMonths', event.target.value)} inputMode="numeric" />
          </label>

          <div className="build-profile-goal-snapshot">
            <span>Selected Goal</span>
            <strong>{profile.financialGoal || 'Not selected'}</strong>
            <small>
              {formatTargetAmount(profile.targetAmount)}
              {profile.targetMonths ? ` over ${profile.targetMonths} months` : ''}
            </small>
          </div>

          <button type="button" className="loan-inline-button loan-inline-button-primary build-profile-save" onClick={saveProfile}>
            Save Profile
          </button>
          {saveMessage ? <p className="status-message" role="status">{saveMessage}</p> : null}
        </aside>
      </section>
    </div>
  )
}