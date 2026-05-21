import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { api, getErrorMessage } from '../api'
import type { NewVehicle, Vehicle } from '../types'
import VehicleList from './VehicleList'


const initialForm = {
  make: '',
  model: '',
  year: '',
}

interface VehicleRegistryProps {
  storageLabel?: string
}

function VehicleRegistry({ storageLabel = 'These records come from the backend API.' }: VehicleRegistryProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [form, setForm] = useState(initialForm)
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null)
  const [busyVehicleId, setBusyVehicleId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    void loadVehicles()
  }, [])

  async function loadVehicles() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.get<Vehicle[]>('/vehicles')
      setVehicles(response.data)
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to load vehicles right now. Check that the backend is running.'))
    } finally {
      setIsLoading(false)
    }
  }

  function resetForm() {
    setForm(initialForm)
    setEditingVehicleId(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    if (form.make.trim().length === 0 || form.model.trim().length === 0) {
      setError('Make and model are required.')
      return
    }

    const year = Number(form.year)
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      setError('Year must be a whole number between 1900 and 2100.')
      return
    }

    const payload: NewVehicle = {
      make: form.make.trim(),
      model: form.model.trim(),
      year,
    }

    setIsSaving(true)

    try {
      if (editingVehicleId === null) {
        const response = await api.post<Vehicle>('/vehicles', payload)
        setVehicles((currentVehicles) => sortVehicles([...currentVehicles, response.data]))
        setSuccessMessage('Vehicle saved to the fleet registry.')
      } else {
        const response = await api.put<Vehicle>(`/vehicles/${editingVehicleId}`, payload)
        setVehicles((currentVehicles) =>
          sortVehicles(currentVehicles.map((vehicle) => (vehicle.id === editingVehicleId ? response.data : vehicle))),
        )
        setSuccessMessage('Vehicle updated successfully.')
      }
      resetForm()
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Vehicle could not be saved.'))
    } finally {
      setIsSaving(false)
    }
  }

  function handleEdit(vehicle: Vehicle) {
    setEditingVehicleId(vehicle.id)
    setForm({
      make: vehicle.make,
      model: vehicle.model,
      year: String(vehicle.year),
    })
    setSuccessMessage('')
    setError('')
  }

  async function handleDelete(vehicle: Vehicle) {
    const confirmed = window.confirm(`Delete ${vehicle.make} ${vehicle.model} from the fleet registry?`)
    if (!confirmed) {
      return
    }

    setBusyVehicleId(vehicle.id)
    setError('')
    setSuccessMessage('')

    try {
      await api.delete(`/vehicles/${vehicle.id}`)
      setVehicles((currentVehicles) => currentVehicles.filter((currentVehicle) => currentVehicle.id !== vehicle.id))
      if (editingVehicleId === vehicle.id) {
        resetForm()
      }
      setSuccessMessage('Vehicle deleted successfully.')
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Vehicle could not be deleted.'))
    } finally {
      setBusyVehicleId(null)
    }
  }

  return (
    <div className="vehicle-registry">
      <h2>Vehicle Registry</h2>
      <div className="card vehicle-grid">
        <div>
          <h3>Current Fleet</h3>
          <p>{storageLabel}</p>
          {isLoading ? (
            <p>Loading vehicles...</p>
          ) : (
            <VehicleList
              vehicles={vehicles}
              onEdit={handleEdit}
              onDelete={handleDelete}
              busyVehicleId={busyVehicleId}
            />
          )}
        </div>

        <div>
          <h3>{editingVehicleId === null ? 'Add A Vehicle' : 'Edit Vehicle'}</h3>
          <form onSubmit={handleSubmit}>
            <label>
              Make
              <input
                type="text"
                value={form.make}
                onChange={(event) => setForm((current) => ({ ...current, make: event.target.value }))}
                placeholder="Toyota"
                required
              />
            </label>
            <label>
              Model
              <input
                type="text"
                value={form.model}
                onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
                placeholder="Hilux"
                required
              />
            </label>
            <label>
              Year
              <input
                type="number"
                value={form.year}
                onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))}
                min="1900"
                max="2100"
                placeholder="2024"
                required
              />
            </label>
            <div className="form-actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingVehicleId === null ? 'Add Vehicle' : 'Save Changes'}
              </button>
              {editingVehicleId !== null ? (
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
    </div>
  )
}


function sortVehicles(vehicles: Vehicle[]) {
  return [...vehicles].sort((a, b) => b.year - a.year || a.make.localeCompare(b.make) || a.model.localeCompare(b.model))
}


export default VehicleRegistry
