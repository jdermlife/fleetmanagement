import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { api, getErrorMessage } from '../api'
import type { DatabaseStatus, LeaseScorecardRecord, LeaseScorecardSubmission } from '../types'


const initialForm: LeaseScorecardSubmission = {
  customerName: '',
  companyName: '',
  vehicleType: '',
  vehicleValue: 0,
  downPayment: 0,
  requestedAmount: 0,
  monthlyIncome: 0,
  existingDebt: 0,
  leaseTermMonths: 36,
  creditScore: 680,
  yearsInBusiness: 0,
  employmentYears: 0,
}


function LeaseScorecardPage() {
  const [form, setForm] = useState<LeaseScorecardSubmission>(initialForm)
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null)
  const [recentRecords, setRecentRecords] = useState<LeaseScorecardRecord[]>([])
  const [savedRecord, setSavedRecord] = useState<LeaseScorecardRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    void loadPage()
  }, [])

  async function loadPage() {
    setIsLoading(true)
    setError('')

    try {
      const [databaseResponse, recordsResponse] = await Promise.all([
        api.get<DatabaseStatus>('/database/status'),
        api.get<LeaseScorecardRecord[]>('/lease-scorecards'),
      ])
      setDatabaseStatus(databaseResponse.data)
      setRecentRecords(recordsResponse.data)
      if (recordsResponse.data[0]) {
        setSavedRecord(recordsResponse.data[0])
      }
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Unable to load lease scorecard data right now.'))
    } finally {
      setIsLoading(false)
    }
  }

  const estimatedFinancedAmount = useMemo(
    () => Math.max(form.requestedAmount - form.downPayment, 0),
    [form.requestedAmount, form.downPayment],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')
    setIsSaving(true)

    try {
      const response = await api.post<LeaseScorecardRecord>('/lease-scorecards', form)
      setSavedRecord(response.data)
      setRecentRecords((current) => [response.data, ...current.filter((record) => record.id !== response.data.id)].slice(0, 20))
      setSuccessMessage('Lease scorecard saved successfully.')
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, 'Lease scorecard could not be saved.'))
    } finally {
      setIsSaving(false)
    }
  }

  function updateNumberField<K extends keyof LeaseScorecardSubmission>(key: K, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value === '' ? 0 : Number(value),
    }))
  }

  return (
    <div className="lease-scorecard-page">
      <div className="lease-scorecard-header">
        <div>
          <h2>Lease Scorecard</h2>
          <p>
            Customer application page for lease evaluation. Required customer inputs are sent to the backend, saved in
            the active database, and scored using the Python algorithm that powers lease decisions.
          </p>
        </div>
        <button type="button" onClick={() => void loadPage()} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh Records'}
        </button>
      </div>

      <div className="lease-scorecard-grid">
        <article className="lease-card">
          <h3>Database Link</h3>
          {databaseStatus ? (
            <div className="vehicle-db-status">
              <div>
                <span>Engine</span>
                <strong>{databaseStatus.engine}</strong>
              </div>
              <div>
                <span>Database</span>
                <strong>{databaseStatus.database || 'Not provided'}</strong>
              </div>
              <div>
                <span>Host</span>
                <strong>{databaseStatus.host || 'Local file storage'}</strong>
              </div>
              <div>
                <span>Port</span>
                <strong>{databaseStatus.port ?? 'n/a'}</strong>
              </div>
              <div className="vehicle-db-source">
                <span>Resolved Source</span>
                <code>{databaseStatus.source}</code>
              </div>
            </div>
          ) : (
            <p className="empty-state">No database connection details available yet.</p>
          )}
        </article>

        <article className="lease-card">
          <h3>Python Scoring Basis</h3>
          <ul className="lease-scorecard-list">
            <li>Credit quality contributes `35%`.</li>
            <li>Affordability and debt service contribute `30%`.</li>
            <li>Equity contribution contributes `15%`.</li>
            <li>Customer stability contributes `10%`.</li>
            <li>Asset coverage contributes `10%`.</li>
          </ul>
          <p className="lease-scorecard-note">
            When the customer submits the required information, the backend computes the score in Python and stores the
            full result set in the active SQLite or PostgreSQL database.
          </p>
        </article>
      </div>

      <div className="lease-scorecard-workspace">
        <article className="lease-card">
          <h3>Customer Lease Application</h3>
          <form className="lease-scorecard-form" onSubmit={handleSubmit}>
            <label>
              Customer Name
              <input
                value={form.customerName}
                onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                required
              />
            </label>
            <label>
              Company Name
              <input
                value={form.companyName}
                onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
              />
            </label>
            <label>
              Vehicle Type
              <input
                value={form.vehicleType}
                onChange={(event) => setForm((current) => ({ ...current, vehicleType: event.target.value }))}
                placeholder="SUV, Sedan, Van, Truck"
                required
              />
            </label>
            <label>
              Vehicle Value
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.vehicleValue || ''}
                onChange={(event) => updateNumberField('vehicleValue', event.target.value)}
                required
              />
            </label>
            <label>
              Down Payment
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.downPayment || ''}
                onChange={(event) => updateNumberField('downPayment', event.target.value)}
                required
              />
            </label>
            <label>
              Requested Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.requestedAmount || ''}
                onChange={(event) => updateNumberField('requestedAmount', event.target.value)}
                required
              />
            </label>
            <label>
              Monthly Income
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthlyIncome || ''}
                onChange={(event) => updateNumberField('monthlyIncome', event.target.value)}
                required
              />
            </label>
            <label>
              Existing Debt
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.existingDebt || ''}
                onChange={(event) => updateNumberField('existingDebt', event.target.value)}
                required
              />
            </label>
            <label>
              Lease Term (Months)
              <input
                type="number"
                min="6"
                step="1"
                value={form.leaseTermMonths || ''}
                onChange={(event) => updateNumberField('leaseTermMonths', event.target.value)}
                required
              />
            </label>
            <label>
              Credit Score
              <input
                type="number"
                min="300"
                max="850"
                step="1"
                value={form.creditScore || ''}
                onChange={(event) => updateNumberField('creditScore', event.target.value)}
                required
              />
            </label>
            <label>
              Years in Business
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.yearsInBusiness || ''}
                onChange={(event) => updateNumberField('yearsInBusiness', event.target.value)}
              />
            </label>
            <label>
              Employment Years
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.employmentYears || ''}
                onChange={(event) => updateNumberField('employmentYears', event.target.value)}
              />
            </label>
            <div className="lease-scorecard-preview">
              <span>Estimated financed amount</span>
              <strong>{estimatedFinancedAmount.toFixed(2)}</strong>
            </div>
            <div className="form-actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving Scorecard...' : 'Save and Compute Lease Score'}
              </button>
            </div>
          </form>
        </article>

        <aside className="lease-side-panel">
          <article className="lease-card">
            <h3>Latest Computed Result</h3>
            {savedRecord ? (
              <div className="lease-result-grid">
                <div>
                  <span>Customer</span>
                  <strong>{savedRecord.customerName}</strong>
                </div>
                <div>
                  <span>Grade</span>
                  <strong>{savedRecord.riskGrade}</strong>
                </div>
                <div>
                  <span>Decision</span>
                  <strong>{savedRecord.decision}</strong>
                </div>
                <div>
                  <span>Final Score</span>
                  <strong>{savedRecord.finalScore.toFixed(2)}</strong>
                </div>
                <div>
                  <span>Est. Monthly Payment</span>
                  <strong>{savedRecord.monthlyEstimatedPayment.toFixed(2)}</strong>
                </div>
                <div>
                  <span>Loan-to-Value</span>
                  <strong>{(savedRecord.loanToValue * 100).toFixed(1)}%</strong>
                </div>
                <div className="lease-result-summary">
                  <span>Summary</span>
                  <p>{savedRecord.summary}</p>
                </div>
              </div>
            ) : (
              <p className="empty-state">No scorecards have been saved yet.</p>
            )}
          </article>

          <article className="lease-card">
            <h3>Recent Saved Scorecards</h3>
            {recentRecords.length === 0 ? (
              <p className="empty-state">No saved records yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Score</th>
                      <th>Grade</th>
                      <th>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRecords.map((record) => (
                      <tr key={record.id}>
                        <td>{record.customerName}</td>
                        <td>{record.finalScore.toFixed(2)}</td>
                        <td>{record.riskGrade}</td>
                        <td>{record.decision}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </aside>
      </div>

      {error ? <p className="status-message status-error">{error}</p> : null}
      {successMessage ? <p className="status-message status-success">{successMessage}</p> : null}
    </div>
  )
}


export default LeaseScorecardPage
