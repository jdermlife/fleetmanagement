import { useEffect, useState } from 'react'

import {
  AUTOSAVE_STATUS_EVENT,
  AutosaveStatusDetail,
  getLatestAutosaveStatus,
} from '../autosave/autosaveStatus'

export interface AutosaveStatusProps {
  scope?: string
  entityKey?: string
  className?: string
}

function statusText(status: AutosaveStatusDetail): string {
  if (status.message) {
    return status.message
  }

  switch (status.state) {
    case 'hydrating':
      return 'Restoring saved changes…'
    case 'pending':
      return 'Unsaved changes'
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'All changes saved'
    case 'offline':
      return 'Saved on this device — waiting for connection'
    case 'conflict':
      return 'Saved on this device — another session has a newer copy'
    case 'error':
      return 'Autosave needs attention'
    default:
      return 'Autosave ready'
  }
}

export default function AutosaveStatus({
  scope,
  entityKey,
  className = '',
}: AutosaveStatusProps) {
  const [status, setStatus] = useState<AutosaveStatusDetail | null>(() =>
    getLatestAutosaveStatus(scope, entityKey)
  )

  useEffect(() => {
    setStatus(getLatestAutosaveStatus(scope, entityKey))

    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<AutosaveStatusDetail>).detail
      if (!detail) {
        return
      }
      if (scope && detail.scope !== scope) {
        return
      }
      if (entityKey && detail.entityKey !== entityKey) {
        return
      }
      setStatus(detail)
    }

    window.addEventListener(AUTOSAVE_STATUS_EVENT, handleStatus)
    return () => window.removeEventListener(AUTOSAVE_STATUS_EVENT, handleStatus)
  }, [entityKey, scope])

  if (!status) {
    return null
  }

  const combinedClassName = [
    'autosave-status',
    `autosave-status--${status.state}`,
    className,
  ].filter(Boolean).join(' ')

  return (
    <span
      aria-live="polite"
      className={combinedClassName}
      data-autosave-state={status.state}
      role="status"
    >
      {statusText(status)}
    </span>
  )
}
