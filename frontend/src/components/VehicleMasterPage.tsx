import { useEffect, useState } from 'react'

import { api, getErrorMessage } from '../api'
import type { DatabaseStatus } from '../types'
import VehicleRegistry from './VehicleRegistry'


function VehicleMasterPage() {
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const [statusError, setStatusError] = useState('')

  useEffect(() => {
    void loadDatabaseStatus()
  }, [])

  async function loadDatabaseStatus() {
    setIsLoadingStatus(true)
    setStatusError('')

    try {
      const response = await api.get<DatabaseStatus>('/database/status')
      setDatabaseStatus(response.data)
    } catch (error: unknown) {
      setStatusError(getErrorMessage(error, 'Unable to load database connection details right now.'))
    } finally {
      setIsLoadingStatus(false)
    }
  }

  return (
    <div className="vehicle-master-page">
      <div className="vehicle-master-header">
        <div>
          <h2>Vehicle Master Page</h2>
          <p>
            Dedicated vehicle master workspace for fleet records. This page is prepared to use a PostgreSQL-backed
            connection when `DATABASE_URL` is configured on the backend.
          </p>
        </div>
        <button type="button" onClick={() => void loadDatabaseStatus()} disabled={isLoadingStatus}>
          {isLoadingStatus ? 'Checking Database...' : 'Refresh Database Status'}
        </button>
      </div>

      <div className="vehicle-master-grid">
        <article className="vehicle-master-card">
          <h3>Database Connection</h3>
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
            <p className="empty-state">No database status loaded yet.</p>
          )}
          {statusError ? <p className="status-message status-error">{statusError}</p> : null}
        </article>

        <article className="vehicle-master-card">
          <h3>PostgreSQL Hookup Guide</h3>
          <ol className="vehicle-master-steps">
            <li>Set backend `DATABASE_URL` to your PostgreSQL connection string.</li>
            <li>Restart the Flask backend so it reinitializes the storage adapter.</li>
            <li>Refresh this page and confirm the engine switches from `sqlite` to `postgresql`.</li>
          </ol>
          <p className="vehicle-master-note">
            Example:
            <code> postgresql://postgres:password@localhost:5432/fleetmanagement </code>
          </p>
        </article>
      </div>

      <VehicleRegistry storageLabel={databaseStatus?.engine === 'postgresql' ? 'These records are flowing through the PostgreSQL vehicle master connection.' : 'These records are currently using the fallback SQLite store until PostgreSQL is configured.'} />
    </div>
  )
}

export default VehicleMasterPage
