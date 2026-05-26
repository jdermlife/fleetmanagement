import {
  useEffect,
  useState,
} from 'react'

import {
  api,
  getErrorMessage,
} from '../../api'

import type {
  AuditLog,
} from '../../types'

function AuditTrailPanel() {
  console.log(
    'SAFE AUDIT PANEL LOADED',
  )
  /*
  |--------------------------------------------------------------------------
  | STATE
  |--------------------------------------------------------------------------
  */

  const [
    auditLogs,
    setAuditLogs,
  ] = useState<
    AuditLog[]
  >([])

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  const [error, setError] =
    useState('')

  /*
  |--------------------------------------------------------------------------
  | LOAD ON PAGE START
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    void loadAuditLogs()
  }, [])

  /*
  |--------------------------------------------------------------------------
  | LOAD AUDIT LOGS
  |--------------------------------------------------------------------------
  */

  async function loadAuditLogs() {
    setIsLoading(true)

    setError('')

    try {
      const response =
        await api.get(
          '/audit-logs',
        )

      console.log(
        'AUDIT LOGS API:',
        response.data,
      )

      /*
      |--------------------------------------------------------------------------
      | SAFE RESPONSE HANDLING
      |--------------------------------------------------------------------------
      */

      const logsData =
        response.data?.data ||
        response.data?.logs ||
        response.data ||
        []

      const safeLogs =
        Array.isArray(logsData)
          ? logsData
          : []

      setAuditLogs(
        safeLogs,
      )
    } catch (
      error: unknown
    ) {
      setError(
        getErrorMessage(
          error,
          'Unable to load audit logs right now.',
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  /*
  |--------------------------------------------------------------------------
  | SAFE ARRAY PROTECTION
  |--------------------------------------------------------------------------
  */

  const safeAuditLogs =
    Array.isArray(
      auditLogs,
    )
      ? auditLogs
      : []

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="audit-trail-panel">
      <div className="dashboard-header">
        <div>
          <h2>
            Audit Trail
          </h2>

          <p>
            Recent data
            mutation events
            across the
            application.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadAuditLogs()
          }
          disabled={
            isLoading
          }
        >
          {isLoading
            ? 'Refreshing...'
            : 'Refresh Logs'}
        </button>
      </div>

      <div className="card">
        {isLoading ? (
          <p>
            Loading audit
            history...
          </p>
        ) : safeAuditLogs.length ===
          0 ? (
          <p className="empty-state">
            No audit events
            have been
            recorded yet.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Time
                  </th>

                  <th>
                    Actor
                  </th>

                  <th>
                    Action
                  </th>

                  <th>
                    Entity
                  </th>

                  <th>
                    Details
                  </th>
                </tr>
              </thead>

              <tbody>
                {safeAuditLogs.map(
                  (
                    auditLog,
                  ) => (
                    <tr
                      key={
                        auditLog.id
                      }
                    >
                      <td>
                        {
                          auditLog.createdAt
                        }
                      </td>

                      <td>
                        {auditLog.actorUsername
                          ? `${auditLog.actorUsername} (${auditLog.actorRole})`
                          : 'System'}
                      </td>

                      <td>
                        {
                          auditLog.action
                        }
                      </td>

                      <td>
                        {
                          auditLog.entityType
                        }

                        {auditLog.entityId !==
                        null
                          ? ` #${auditLog.entityId}`
                          : ''}
                      </td>

                      <td>
                        {
                          auditLog.details
                        }
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        {error ? (
          <p className="status-message status-error">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default AuditTrailPanel