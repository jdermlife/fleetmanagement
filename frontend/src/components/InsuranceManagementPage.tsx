import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { api, getErrorMessage } from '../api'
import type { DatabaseStatus, InsuranceRecord, InsuranceRecordSubmission, Vehicle } from '../types'


const initialForm: InsuranceRecordSubmission = {
  vehicleId: null,
  vehicleLabel: '',
  provider: '',
  policyNumber: '',
  coverageType: '',
  premiumAmount: 0,
  insuredValue: 0,
  startDate: '',
  endDate: '',
  status: 'Active',
  contactPerson: '',
  notes: '',
}


function InsuranceManagementPage() {
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [records, setRecords] = useState<InsuranceRecord[]>([])
  const [form, setForm] = useState<InsuranceRecordSubmission>(initialForm)
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
      const [databaseResponse, vehiclesResponse, recordsResponse] = await Promise.all([
        api.get<DatabaseStatus>('/database/status'),
        api.get<Vehicle[]>('/vehicles'),
        api.get<InsuranceRecord[]>('/insurance-records'),
      ])
      setDatabaseStatus(databaseResponse.data)
      setVehicles(vehiclesResponse.data)
      setRecords(recordsResponse.data)
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Unable to load insurance management data right now.'))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')
    setIsSaving(true)

    try {
      const response = await api.post<InsuranceRecord>('/insurance-records', form)
      setRecords((current) => [response.data, ...current])
      setSuccessMessage('Insurance record saved successfully.')
      setForm(initialForm)
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, 'Insurance record could not be saved.'))
    } finally {
      setIsSaving(false)
    }
  }

  function updateVehicle(value: string) {
    if (!value) {
      setForm((current) => ({ ...current, vehicleId: null, vehicleLabel: '' }))
      return
    }

    const vehicle = vehicles.find((entry) => entry.id === Number(value))
    setForm((current) => ({
      ...current,
      vehicleId: vehicle?.id ?? null,
      vehicleLabel: vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.year})` : '',
    }))
  }

  function updateNumberField<K extends keyof InsuranceRecordSubmission>(key: K, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value === '' ? 0 : Number(value),
    }))
  }

  return (
    <div className="insurance-page">
      <div className="insurance-header">
        <div>
          <h2>Insurance Management</h2>
          <p>
            Central insurance page for all policy records linked to the vehicle inventory. Required policy details are
            saved into the active database, including PostgreSQL when `DATABASE_URL` is configured.
          </p>
        </div>
        <button type="button" onClick={() => void loadPage()} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh Insurance'}
        </button>
      </div>

      <div className="insurance-grid">
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
          <h3>Insurance List Scope</h3>
          <ul className="lease-scorecard-list">
            <li>Each insurance record is linked to a vehicle from the fleet inventory.</li>
            <li>The page stores provider, policy number, coverage type, dates, insured value, and premium amount.</li>
            <li>Saved policies can later drive expiry reminders, claim workflows, and compliance reporting.</li>
          </ul>
        </article>
      </div>

      <div className="lease-scorecard-workspace">
        <article className="lease-card">
          <h3>Insurance Entry Form</h3>
          <form className="lease-scorecard-form" onSubmit={handleSubmit}>
            <label>
              Vehicle
              <select
                value={form.vehicleId ?? ''}
                onChange={(event) => updateVehicle(event.target.value)}
                required
              >
                <option value="">Select vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.make} {vehicle.model} ({vehicle.year})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Provider
              <input
                value={form.provider}
                onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
                required
              />
            </label>
            <label>
              Policy Number
              <input
                value={form.policyNumber}
                onChange={(event) => setForm((current) => ({ ...current, policyNumber: event.target.value }))}
                required
              />
            </label>
            <label>
              Coverage Type
              <input
                value={form.coverageType}
                onChange={(event) => setForm((current) => ({ ...current, coverageType: event.target.value }))}
                placeholder="Comprehensive, TPL, Commercial"
                required
              />
            </label>
            <label>
              Premium Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.premiumAmount || ''}
                onChange={(event) => updateNumberField('premiumAmount', event.target.value)}
                required
              />
            </label>
            <label>
              Insured Value
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.insuredValue || ''}
                onChange={(event) => updateNumberField('insuredValue', event.target.value)}
                required
              />
            </label>
            <label>
              Start Date
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                required
              />
            </label>
            <label>
              End Date
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                required
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="Active">Active</option>
                <option value="Pending Renewal">Pending Renewal</option>
                <option value="Expired">Expired</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </label>
            <label>
              Contact Person
              <input
                value={form.contactPerson}
                onChange={(event) => setForm((current) => ({ ...current, contactPerson: event.target.value }))}
              />
            </label>
            <label className="maintenance-notes-field">
              Notes
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Claims history, endorsements, and renewal notes"
              />
            </label>
            <div className="form-actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving Insurance...' : 'Save Insurance Record'}
              </button>
            </div>
          </form>
        </article>

        <aside className="lease-side-panel">
          <article className="lease-card">
            <h3>Insurance List</h3>
            {records.length === 0 ? (
              <p className="empty-state">No insurance records saved yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Provider</th>
                      <th>Policy</th>
                      <th>Status</th>
                      <th>End Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td>{record.vehicleLabel}</td>
                        <td>{record.provider}</td>
                        <td>{record.policyNumber}</td>
                        <td>{record.status}</td>
                        <td>{record.endDate}</td>
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


export default InsuranceManagementPage
