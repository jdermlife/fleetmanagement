import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { api, getErrorMessage } from '../api'
import type { DriverRegistrationRecord, DriverRegistrationSubmission } from '../types'

const initialForm: DriverRegistrationSubmission = {
  firstName: '',
  lastName: '',
  licenseNumber: '',
  phone: '',
  email: '',
  status: 'Active',
}

const statusOptions = ['Active', 'Inactive', 'Suspended', 'Pending']

function DriverRegistrationPage() {
  const [form, setForm] = useState<DriverRegistrationSubmission>(initialForm)
  const [drivers, setDrivers] = useState<DriverRegistrationRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    void loadDrivers()
  }, [])

  async function loadDrivers() {
    setIsLoading(true)
    setError('')
    try {
      const response = await api.get<DriverRegistrationRecord[]>('/drivers')
      setDrivers(response.data)
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Unable to load registered drivers right now.'))
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
      const response = await api.post<DriverRegistrationRecord>('/drivers', form)
      setDrivers((current) => [response.data, ...current])
      setSuccessMessage('Driver profile registered successfully.')
      setForm(initialForm)
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, 'Unable to register the driver right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="driver-registration-page">
      <div className="driver-registration-header">
        <h2>Driver Registration</h2>
        <p>Register a driver with license and contact details, then store the profile in the fleet database.</p>
      </div>

      <div className="registration-grid">
        <article className="lease-card">
          <h3>New Driver Profile</h3>
          <form className="lease-scorecard-form" onSubmit={handleSubmit}>
            <label>
              First Name
              <input
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                required
              />
            </label>
            <label>
              Last Name
              <input
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                required
              />
            </label>
            <label>
              License Number
              <input
                value={form.licenseNumber}
                onChange={(event) => setForm((current) => ({ ...current, licenseNumber: event.target.value }))}
                required
              />
            </label>
            <label>
              Phone
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-footer">
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Registering...' : 'Register Driver'}
              </button>
            </div>

            {error ? <p className="form-error">{error}</p> : null}
            {successMessage ? <p className="form-success">{successMessage}</p> : null}
          </form>
        </article>

        <article className="lease-card driver-list-card">
          <div className="driver-list-header">
            <h3>Registered Drivers</h3>
            <button type="button" onClick={() => void loadDrivers()} disabled={isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {drivers.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>License</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver) => (
                  <tr key={driver.id}>
                    <td>{`${driver.firstName} ${driver.lastName}`}</td>
                    <td>{driver.licenseNumber}</td>
                    <td>{driver.phone}</td>
                    <td>{driver.email}</td>
                    <td>{driver.status}</td>
                    <td>{driver.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-state">No drivers have been registered yet.</p>
          )}
        </article>
      </div>
    </div>
  )
}

export default DriverRegistrationPage
