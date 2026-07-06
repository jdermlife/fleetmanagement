import { useState } from 'react'

import { CreditApi, type CreditScoreResult } from '../../services/creditApi'

type BorrowerInput = {
  is_primary: boolean
  full_name: string
  is_married: boolean
  dsr_percent: number
  net_disposable_income: number
  household_members: number
  adb_amount: number
  is_locally_employed: boolean
  employer_years: number
  service_years: number
  address_stay_years: number
  loan_history: 'excellent' | 'satisfactory' | 'none' | 'poor'
  deposit_handling: 'excellent' | 'satisfactory' | 'poor'
  utility_payment: 'very_satisfactory' | 'satisfactory' | 'dismissed_settled' | 'not_satisfactory'
  lifestyle: 'respectable' | 'adverse'
}

type PropertyInput = {
  property_class: 'a' | 'b' | 'c' | 'lowcost' | 'outside'
  appraised_value: number
  property_type: 'single_detached' | 'single_attached' | 'condominium' | 'townhouse' | 'row_house'
  is_primary_residence: boolean
}

type BorrowerValue = BorrowerInput[keyof BorrowerInput]
type PropertyValue = PropertyInput[keyof PropertyInput]

const EMPTY_BORROWER: BorrowerInput = {
  is_primary: false,
  full_name: '',
  is_married: false,
  dsr_percent: 0,
  net_disposable_income: 0,
  household_members: 0,
  adb_amount: 0,
  is_locally_employed: true,
  employer_years: 0,
  service_years: 0,
  address_stay_years: 0,
  loan_history: 'none',
  deposit_handling: 'excellent',
  utility_payment: 'very_satisfactory',
  lifestyle: 'respectable',
}

const EMPTY_PROPERTY: PropertyInput = {
  property_class: 'c',
  appraised_value: 0,
  property_type: 'single_detached',
  is_primary_residence: false,
}

export const CreditScoreForm: React.FC = () => {
  const [borrowers, setBorrowers] = useState<BorrowerInput[]>([{ ...EMPTY_BORROWER, is_primary: true }])
  const [properties, setProperties] = useState<PropertyInput[]>([EMPTY_PROPERTY])
  const [result, setResult] = useState<CreditScoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateBorrower = (idx: number, field: keyof BorrowerInput, value: BorrowerValue) => {
    const updated = [...borrowers]
    updated[idx] = { ...updated[idx], [field]: value }
    if (field === 'is_primary' && value === true) {
      updated.forEach((borrower, borrowerIndex) => {
        if (borrowerIndex !== idx) {
          borrower.is_primary = false
        }
      })
    }
    setBorrowers(updated)
  }

  const updateProperty = (idx: number, field: keyof PropertyInput, value: PropertyValue) => {
    const updated = [...properties]
    updated[idx] = { ...updated[idx], [field]: value }
    setProperties(updated)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const score = await CreditApi.computeScore({ borrowers, properties })
      setResult(score)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px',
    padding: '15px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    background: '#fafafa',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    marginBottom: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '4px',
    fontWeight: '500',
    fontSize: '14px',
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '20px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h2 style={{ textAlign: 'center', color: '#1976d2', marginBottom: '20px' }}>
        Multi-Borrower Credit Scoring
      </h2>

      {borrowers.map((borrower, index) => (
        <div key={index} style={sectionStyle}>
          <h3 style={{ marginTop: 0 }}>
            Borrower {index + 1} {borrower.is_primary ? '(Primary)' : ''}
          </h3>
          <label style={labelStyle}>
            Full Name
            <input
              style={inputStyle}
              value={borrower.full_name}
              onChange={(event) => updateBorrower(index, 'full_name', event.target.value)}
              required
            />
          </label>
          <label style={labelStyle}>
            <input
              type="checkbox"
              checked={borrower.is_primary}
              onChange={(event) => updateBorrower(index, 'is_primary', event.target.checked)}
            />{' '}
            Primary Applicant
          </label>
          <label style={labelStyle}>
            <input
              type="checkbox"
              checked={borrower.is_married}
              onChange={(event) => updateBorrower(index, 'is_married', event.target.checked)}
            />{' '}
            Married
          </label>
          <label style={labelStyle}>
            Debt Service Ratio (DSR) %
            <input
              type="number"
              step="0.01"
              style={inputStyle}
              value={borrower.dsr_percent}
              onChange={(event) => updateBorrower(index, 'dsr_percent', parseFloat(event.target.value))}
            />
          </label>
          <label style={labelStyle}>
            Net Income
            <input
              type="number"
              step="0.01"
              style={inputStyle}
              value={borrower.net_disposable_income}
              onChange={(event) => updateBorrower(index, 'net_disposable_income', parseFloat(event.target.value))}
            />
          </label>
          <label style={labelStyle}>
            Household Members
            <input
              type="number"
              min="0"
              style={inputStyle}
              value={borrower.household_members}
              onChange={(event) => updateBorrower(index, 'household_members', parseInt(event.target.value, 10))}
            />
          </label>
          <label style={labelStyle}>
            ADB
            <input
              type="number"
              step="0.01"
              style={inputStyle}
              value={borrower.adb_amount}
              onChange={(event) => updateBorrower(index, 'adb_amount', parseFloat(event.target.value))}
            />
          </label>
          <label style={labelStyle}>
            <input
              type="checkbox"
              checked={borrower.is_locally_employed}
              onChange={(event) => updateBorrower(index, 'is_locally_employed', event.target.checked)}
            />{' '}
            Locally Employed
          </label>
          <label style={labelStyle}>
            Employer Years
            <input
              type="number"
              min="0"
              style={inputStyle}
              value={borrower.employer_years}
              onChange={(event) => updateBorrower(index, 'employer_years', parseInt(event.target.value, 10))}
            />
          </label>
          <label style={labelStyle}>
            Service Years
            <input
              type="number"
              min="0"
              style={inputStyle}
              value={borrower.service_years}
              onChange={(event) => updateBorrower(index, 'service_years', parseInt(event.target.value, 10))}
            />
          </label>
          <label style={labelStyle}>
            Address Years
            <input
              type="number"
              step="0.1"
              min="0"
              style={inputStyle}
              value={borrower.address_stay_years}
              onChange={(event) => updateBorrower(index, 'address_stay_years', parseFloat(event.target.value))}
            />
          </label>
          <label style={labelStyle}>
            Loan History
            <select
              style={inputStyle}
              value={borrower.loan_history}
              onChange={(event) => updateBorrower(index, 'loan_history', event.target.value as BorrowerInput['loan_history'])}
            >
              <option value="excellent">Excellent</option>
              <option value="satisfactory">Satisfactory</option>
              <option value="none">None</option>
              <option value="poor">Poor</option>
            </select>
          </label>
          <label style={labelStyle}>
            Deposit Handling
            <select
              style={inputStyle}
              value={borrower.deposit_handling}
              onChange={(event) => updateBorrower(index, 'deposit_handling', event.target.value as BorrowerInput['deposit_handling'])}
            >
              <option value="excellent">Excellent</option>
              <option value="satisfactory">Satisfactory</option>
              <option value="poor">Poor</option>
            </select>
          </label>
          <label style={labelStyle}>
            Utility Payment
            <select
              style={inputStyle}
              value={borrower.utility_payment}
              onChange={(event) => updateBorrower(index, 'utility_payment', event.target.value as BorrowerInput['utility_payment'])}
            >
              <option value="very_satisfactory">Very Satisfactory</option>
              <option value="satisfactory">Satisfactory</option>
              <option value="dismissed_settled">Dismissed/Settled</option>
              <option value="not_satisfactory">Not Satisfactory</option>
            </select>
          </label>
          <label style={labelStyle}>
            Lifestyle
            <select
              style={inputStyle}
              value={borrower.lifestyle}
              onChange={(event) => updateBorrower(index, 'lifestyle', event.target.value as BorrowerInput['lifestyle'])}
            >
              <option value="respectable">Respectable</option>
              <option value="adverse">Adverse</option>
            </select>
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setBorrowers([...borrowers, { ...EMPTY_BORROWER, is_primary: false }])}
        style={{ marginBottom: '15px', padding: '8px 12px', cursor: 'pointer' }}
      >
        + Add Co-Borrower
      </button>

      {properties.map((property, index) => (
        <div key={index} style={sectionStyle}>
          <h3 style={{ marginTop: 0 }}>Property {index + 1}</h3>
          <label style={labelStyle}>
            Property Class
            <select
              style={inputStyle}
              value={property.property_class}
              onChange={(event) => updateProperty(index, 'property_class', event.target.value as PropertyInput['property_class'])}
            >
              <option value="a">Class A</option>
              <option value="b">Class B</option>
              <option value="c">Class C</option>
              <option value="lowcost">Lowcost</option>
              <option value="outside">Outside</option>
            </select>
          </label>
          <label style={labelStyle}>
            Appraised Value
            <input
              type="number"
              step="0.01"
              style={inputStyle}
              value={property.appraised_value}
              onChange={(event) => updateProperty(index, 'appraised_value', parseFloat(event.target.value))}
            />
          </label>
          <label style={labelStyle}>
            Property Type
            <select
              style={inputStyle}
              value={property.property_type}
              onChange={(event) => updateProperty(index, 'property_type', event.target.value as PropertyInput['property_type'])}
            >
              <option value="single_detached">Single Detached</option>
              <option value="single_attached">Single Attached</option>
              <option value="condominium">Condominium</option>
              <option value="townhouse">Townhouse</option>
              <option value="row_house">Row House</option>
            </select>
          </label>
          <label style={labelStyle}>
            <input
              type="checkbox"
              checked={property.is_primary_residence}
              onChange={(event) => updateProperty(index, 'is_primary_residence', event.target.checked)}
            />{' '}
            Primary Residence
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setProperties([...properties, EMPTY_PROPERTY])}
        style={{ marginBottom: '15px', padding: '8px 12px', cursor: 'pointer' }}
      >
        + Add Property
      </button>

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '14px',
          background: loading ? '#999' : '#1976d2',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
        }}
      >
        {loading ? 'Computing...' : 'Compute & Save Application'}
      </button>

      {error ? (
        <div
          style={{
            padding: '12px',
            margin: '15px 0',
            background: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '4px',
            color: '#c62828',
          }}
        >
          {error}
        </div>
      ) : null}

      {result ? (
        <div
          style={{
            marginTop: '20px',
            padding: '20px',
            border: '2px solid #4CAF50',
            borderRadius: '8px',
            background: '#f1f8e9',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Result</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px',
              textAlign: 'center',
            }}
          >
            <div><strong>Capacity</strong><br />{result.capacity_score}/25</div>
            <div><strong>Character</strong><br />{result.character_score}/25</div>
            <div><strong>Collateral</strong><br />{result.collateral_score}/25</div>
            <div><strong>Condition</strong><br />{result.condition_score}/25</div>
          </div>
          <h4 style={{ textAlign: 'center', marginTop: '15px' }}>
            Total: {result.total_score}/100 to {result.risk_classification}
          </h4>
        </div>
      ) : null}
    </form>
  )
}
