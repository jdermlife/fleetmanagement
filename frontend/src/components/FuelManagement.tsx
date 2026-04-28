import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { api, getErrorMessage } from '../api'
import type { FuelLog, NewFuelLog } from '../types'


const initialForm = {
  date: '',
  vehicle: '',
  fuelCard: '',
  liters: '',
  amount: '',
  notes: '',
  theftSuspected: false,
  abnormalRefill: false,
}


function FuelManagement() {
  const [form, setForm] = useState(initialForm)
  const [logs, setLogs] = useState<FuelLog[]>([])
  const [editingLogId, setEditingLogId] = useState<number | null>(null)
  const [busyLogId, setBusyLogId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    void loadFuelLogs()
  }, [])

  const totalLiters = logs.reduce((sum, entry) => sum + entry.liters, 0)
  const totalAmount = logs.reduce((sum, entry) => sum + entry.amount, 0)
  const averageConsumption = logs.length ? totalLiters / logs.length : 0

  async function loadFuelLogs() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.get<FuelLog[]>('/fuel-logs')
      setLogs(response.data)
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to load fuel logs right now. Check that the backend is running.'))
    } finally {
      setIsLoading(false)
    }
  }

  function resetForm() {
    setForm(initialForm)
    setEditingLogId(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    const liters = Number(form.liters)
    const amount = Number(form.amount)
    if (!form.date) {
      setError('Date is required.')
      return
    }

    if (form.vehicle.trim().length === 0 || form.fuelCard.trim().length === 0) {
      setError('Vehicle and fuel card are required.')
      return
    }

    if (!Number.isFinite(liters) || liters <= 0) {
      setError('Liters must be greater than zero.')
      return
    }

    if (!Number.isFinite(amount) || amount < 0) {
      setError('Amount cannot be negative.')
      return
    }

    const payload: NewFuelLog = {
      date: form.date,
      vehicle: form.vehicle.trim(),
      fuelCard: form.fuelCard.trim(),
      liters,
      amount,
      notes: form.notes.trim(),
      theftSuspected: form.theftSuspected,
      abnormalRefill: form.abnormalRefill,
    }

    setIsSaving(true)

    try {
      if (editingLogId === null) {
        const response = await api.post<FuelLog>('/fuel-logs', payload)
        setLogs((currentLogs) => [response.data, ...currentLogs])
        setSuccessMessage('Fuel log saved to the backend.')
      } else {
        const response = await api.put<FuelLog>(`/fuel-logs/${editingLogId}`, payload)
        setLogs((currentLogs) => currentLogs.map((log) => (log.id === editingLogId ? response.data : log)))
        setSuccessMessage('Fuel log updated successfully.')
      }
      resetForm()
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Fuel log could not be saved.'))
    } finally {
      setIsSaving(false)
    }
  }

  function startEdit(log: FuelLog) {
    setEditingLogId(log.id)
    setForm({
      date: log.date,
      vehicle: log.vehicle,
      fuelCard: log.fuelCard,
      liters: String(log.liters),
      amount: String(log.amount),
      notes: log.notes,
      theftSuspected: log.theftSuspected,
      abnormalRefill: log.abnormalRefill,
    })
    setError('')
    setSuccessMessage('')
  }

  async function handleDelete(log: FuelLog) {
    const confirmed = window.confirm(`Delete the fuel log for ${log.vehicle} on ${log.date}?`)
    if (!confirmed) {
      return
    }

    setBusyLogId(log.id)
    setError('')
    setSuccessMessage('')

    try {
      await api.delete(`/fuel-logs/${log.id}`)
      setLogs((currentLogs) => currentLogs.filter((currentLog) => currentLog.id !== log.id))
      if (editingLogId === log.id) {
        resetForm()
      }
      setSuccessMessage('Fuel log deleted successfully.')
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Fuel log could not be deleted.'))
    } finally {
      setBusyLogId(null)
    }
  }

  return (
    <div className="fuel-management">
      <h2>Fuel Management</h2>
      <div className="card fuel-grid">
        <div className="fuel-summary">
          <h3>Fuel Logs</h3>
          <p>Record fuel fill-ups, card usage and consumption metrics.</p>
          <ul>
            <li>Total entries: {logs.length}</li>
            <li>Total liters: {totalLiters.toFixed(1)} L</li>
            <li>Total amount: ${totalAmount.toFixed(2)}</li>
            <li>Average liters per fill: {averageConsumption.toFixed(1)} L</li>
          </ul>
          {isLoading ? <p>Loading fuel logs...</p> : null}
        </div>

        <div className="fuel-form">
          <h3>{editingLogId === null ? 'Log Fuel Entry' : 'Edit Fuel Entry'}</h3>
          <form onSubmit={handleSubmit}>
            <label>
              Date
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                required
              />
            </label>
            <label>
              Vehicle
              <input
                type="text"
                value={form.vehicle}
                onChange={(event) => setForm((current) => ({ ...current, vehicle: event.target.value }))}
                placeholder="Vehicle ID or plate"
                required
              />
            </label>
            <label>
              Fuel Card
              <input
                type="text"
                value={form.fuelCard}
                onChange={(event) => setForm((current) => ({ ...current, fuelCard: event.target.value }))}
                placeholder="Card number or name"
                required
              />
            </label>
            <label>
              Liters
              <input
                type="number"
                value={form.liters}
                onChange={(event) => setForm((current) => ({ ...current, liters: event.target.value }))}
                placeholder="Liters filled"
                min="0"
                step="0.1"
                required
              />
            </label>
            <label>
              Amount ($)
              <input
                type="number"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="Total cost"
                min="0"
                step="0.01"
                required
              />
            </label>
            <label>
              Notes
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Optional notes"
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.theftSuspected}
                onChange={(event) => setForm((current) => ({ ...current, theftSuspected: event.target.checked }))}
              />
              Theft suspected
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.abnormalRefill}
                onChange={(event) => setForm((current) => ({ ...current, abnormalRefill: event.target.checked }))}
              />
              Abnormal refill alert
            </label>
            <div className="form-actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingLogId === null ? 'Save Fuel Log' : 'Save Changes'}
              </button>
              {editingLogId !== null ? (
                <button type="button" onClick={resetForm}>
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>

      {error ? <p className="status-message status-error">{error}</p> : null}
      {successMessage ? <p className="status-message status-success">{successMessage}</p> : null}

      <div className="card fuel-log-card">
        <h3>Fuel Log History</h3>
        {isLoading ? null : logs.length === 0 ? (
          <p>No fuel logs recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vehicle</th>
                  <th>Fuel Card</th>
                  <th>Liters</th>
                  <th>Amount</th>
                  <th>Theft</th>
                  <th>Abnormal</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.date}</td>
                    <td>{log.vehicle}</td>
                    <td>{log.fuelCard}</td>
                    <td>{log.liters.toFixed(1)}</td>
                    <td>${log.amount.toFixed(2)}</td>
                    <td>{log.theftSuspected ? 'Yes' : 'No'}</td>
                    <td>{log.abnormalRefill ? 'Yes' : 'No'}</td>
                    <td>{log.updatedAt}</td>
                    <td className="actions-cell">
                      <button type="button" onClick={() => startEdit(log)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button-danger"
                        onClick={() => handleDelete(log)}
                        disabled={busyLogId === log.id}
                      >
                        {busyLogId === log.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default FuelManagement
