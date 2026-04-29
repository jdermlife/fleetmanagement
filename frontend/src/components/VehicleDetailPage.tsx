import { useEffect, useMemo, useState } from 'react'

import { api, getErrorMessage } from '../api'
import type { DatabaseStatus, Vehicle } from '../types'


function VehicleDetailPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null)
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void initializePage()
  }, [])

  async function initializePage() {
    setIsLoading(true)
    setError('')

    try {
      const [vehiclesResponse, databaseResponse] = await Promise.all([
        api.get<Vehicle[]>('/vehicles'),
        api.get<DatabaseStatus>('/database/status'),
      ])
      setVehicles(vehiclesResponse.data)
      setDatabaseStatus(databaseResponse.data)
      setSelectedVehicleId(vehiclesResponse.data[0]?.id ?? null)
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Unable to load vehicle detail information right now.'))
    } finally {
      setIsLoading(false)
    }
  }

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [selectedVehicleId, vehicles],
  )

  return (
    <div className="vehicle-detail-page">
      <div className="vehicle-detail-header">
        <div>
          <h2>Vehicle Detail Page</h2>
          <p>
            Detailed vehicle profile page linked from the sidebar. It reads the current fleet record and shows which
            database connection is backing the page, including PostgreSQL when `DATABASE_URL` is active.
          </p>
        </div>
        <button type="button" onClick={() => void initializePage()} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh Vehicle Detail'}
        </button>
      </div>

      <div className="vehicle-detail-grid">
        <article className="vehicle-detail-card">
          <h3>Select Vehicle</h3>
          <label>
            Fleet Record
            <select
              value={selectedVehicleId ?? ''}
              onChange={(event) => setSelectedVehicleId(Number(event.target.value))}
              disabled={vehicles.length === 0}
            >
              {vehicles.length === 0 ? <option value="">No vehicles found</option> : null}
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.make} {vehicle.model} ({vehicle.year})
                </option>
              ))}
            </select>
          </label>
          <p className="vehicle-detail-note">
            This page can point at PostgreSQL-backed fleet records automatically when the backend is started with a
            PostgreSQL `DATABASE_URL`.
          </p>
        </article>

        <article className="vehicle-detail-card">
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
      </div>

      {selectedVehicle ? (
        <div className="vehicle-detail-panels">
          <article className="vehicle-detail-card vehicle-profile-card">
            <h3>Vehicle Record</h3>
            <div className="vehicle-profile-grid">
              <div>
                <span>Vehicle ID</span>
                <strong>{selectedVehicle.id}</strong>
              </div>
              <div>
                <span>Make</span>
                <strong>{selectedVehicle.make}</strong>
              </div>
              <div>
                <span>Model</span>
                <strong>{selectedVehicle.model}</strong>
              </div>
              <div>
                <span>Year</span>
                <strong>{selectedVehicle.year}</strong>
              </div>
              <div>
                <span>Created</span>
                <strong>{selectedVehicle.createdAt}</strong>
              </div>
              <div>
                <span>Last Updated</span>
                <strong>{selectedVehicle.updatedAt}</strong>
              </div>
            </div>
          </article>

          <article className="vehicle-detail-card">
            <h3>Illustrative Detail Blocks</h3>
            <div className="vehicle-detail-columns">
              <div>
                <h4>Maintenance History</h4>
                <ul>
                  <li>Preventive service cadence can be sourced from the PostgreSQL vehicle table extension.</li>
                  <li>Last service and next due mileage can be attached to this selected vehicle record.</li>
                  <li>Repair notes can be linked through a related maintenance table.</li>
                </ul>
              </div>
              <div>
                <h4>Documents & Telematics</h4>
                <ul>
                  <li>Insurance and registration references can be stored with the master record.</li>
                  <li>GPS status and route activity can be joined to the same vehicle key.</li>
                  <li>Attachments can be surfaced once the PostgreSQL schema is expanded.</li>
                </ul>
              </div>
            </div>
          </article>
        </div>
      ) : (
        <p className="empty-state">Select a vehicle to view the detailed page.</p>
      )}

      {error ? <p className="status-message status-error">{error}</p> : null}
    </div>
  )
}


export default VehicleDetailPage
