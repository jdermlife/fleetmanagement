import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { api, getErrorMessage } from '../api'
import type { DatabaseStatus, MaintenanceRecord, MaintenanceRecordSubmission, Vehicle } from '../types'


const initialForm: MaintenanceRecordSubmission = {
  vehicleId: null,
  vehicleLabel: '',
  maintenanceType: '',
  serviceDate: '',
  nextServiceDate: null,
  odometerKm: 0,
  vendor: '',
  estimatedCost: 0,
  status: 'Scheduled',
  notes: '',
}


function MaintenanceManagementPage() {
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [form, setForm] = useState<MaintenanceRecordSubmission>(initialForm)
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
        api.get<MaintenanceRecord[]>('/maintenance-records'),
      ])
      setDatabaseStatus(databaseResponse.data)
      setVehicles(vehiclesResponse.data)
      setRecords(recordsResponse.data)
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Unable to load maintenance management data right now.'))
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
      const response = await api.post<MaintenanceRecord>('/maintenance-records', form)
      setRecords((current) => [response.data, ...current])
      setSuccessMessage('Maintenance record saved successfully.')
      setForm(initialForm)
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, 'Maintenance record could not be saved.'))
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

  function updateNumberField<K extends keyof MaintenanceRecordSubmission>(key: K, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value === '' ? 0 : Number(value),
    }))
  }

  return (
    <div className="maintenance-page">
      <div className="maintenance-header">
        <div>
          <h2>Maintenance Management</h2>
          <p>
            Save maintenance activities for fleet vehicles through a dedicated page. Required information is stored in
            the active database, including PostgreSQL when `DATABASE_URL` is configured on the backend.
          </p>
        </div>
        <button type="button" onClick={() => void loadPage()} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh Maintenance'}
        </button>
      </div>

      <div className="maintenance-grid">
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
          <h3>Storage Summary</h3>
          <ul className="lease-scorecard-list">
            <li>Vehicle selection is linked to the current fleet master list.</li>
            <li>Maintenance type, status, dates, vendor, and cost are saved as structured records.</li>
            <li>Submitted maintenance entries are persisted into SQLite or PostgreSQL through the backend adapter.</li>
          </ul>
        </article>
      </div>

      <div className="lease-scorecard-workspace">
        <article className="lease-card">
          <h3>Maintenance Entry Form</h3>
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
              Maintenance Type
              <input
                value={form.maintenanceType}
                onChange={(event) => setForm((current) => ({ ...current, maintenanceType: event.target.value }))}
                placeholder="Preventive, Repair, Inspection"
                required
              />
            </label>
            <label>
              Service Date
              <input
                type="date"
                value={form.serviceDate}
                onChange={(event) => setForm((current) => ({ ...current, serviceDate: event.target.value }))}
                required
              />
            </label>
            <label>
              Next Service Date
              <input
                type="date"
                value={form.nextServiceDate ?? ''}
                onChange={(event) => setForm((current) => ({ ...current, nextServiceDate: event.target.value || null }))}
              />
            </label>
            <label>
              Odometer (km)
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.odometerKm || ''}
                onChange={(event) => updateNumberField('odometerKm', event.target.value)}
                required
              />
            </label>
            <label>
              Vendor
              <input
                value={form.vendor}
                onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))}
              />
            </label>
            <label>
              Estimated Cost
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.estimatedCost || ''}
                onChange={(event) => updateNumberField('estimatedCost', event.target.value)}
                required
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Deferred">Deferred</option>
              </select>
            </label>
            <label className="maintenance-notes-field">
              Notes
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Service observations, parts used, and recommendations"
              />
            </label>
            <div className="form-actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving Maintenance...' : 'Save Maintenance Record'}
              </button>
            </div>
          </form>
        </article>

        <aside className="lease-side-panel">
          <article className="lease-card">
            <h3>Recent Maintenance Records</h3>
            {records.length === 0 ? (
              <p className="empty-state">No maintenance records saved yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Service Date</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td>{record.vehicleLabel}</td>
                        <td>{record.maintenanceType}</td>
                        <td>{record.status}</td>
                        <td>{record.serviceDate}</td>
                        <td>{record.estimatedCost.toFixed(2)}</td>
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


export default MaintenanceManagementPage
