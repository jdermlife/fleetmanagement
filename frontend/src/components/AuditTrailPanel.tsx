import { useEffect, useState } from 'react'

import { api, getErrorMessage } from '../api'
import type { AuditLog } from '../types'


function AuditTrailPanel() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadAuditLogs()
  }, [])

  async function loadAuditLogs() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.get<AuditLog[]>('/audit-logs')
      setAuditLogs(response.data)
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to load audit logs right now.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <h2>Audit Trail</h2>
      <p>Recent data mutation events across the application.</p>
      {isLoading ? (
        <p>Loading audit history...</p>
      ) : auditLogs.length === 0 ? (
        <p className="empty-state">No audit events have been recorded yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((auditLog) => (
                <tr key={auditLog.id}>
                  <td>{auditLog.createdAt}</td>
                  <td>{auditLog.actorUsername ? `${auditLog.actorUsername} (${auditLog.actorRole})` : 'System'}</td>
                  <td>{auditLog.action}</td>
                  <td>
                    {auditLog.entityType}
                    {auditLog.entityId !== null ? ` #${auditLog.entityId}` : ''}
                  </td>
                  <td>{auditLog.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error ? <p className="status-message status-error">{error}</p> : null}
    </div>
  )
}

export default AuditTrailPanel
