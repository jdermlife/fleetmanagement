export const AUTOSAVE_STATUS_EVENT = 'fms:autosave-status'

export type AutosaveState =
  | 'idle'
  | 'hydrating'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'conflict'
  | 'error'

export interface AutosaveStatusDetail {
  scope: string
  entityKey: string
  state: AutosaveState
  message?: string
  savedAt?: number
  source?: 'local' | 'remote'
}

const latestStatuses = new Map<string, AutosaveStatusDetail>()

function statusKey(scope: string, entityKey: string): string {
  return `${scope}\u0000${entityKey}`
}

export function getLatestAutosaveStatus(
  scope?: string,
  entityKey?: string,
): AutosaveStatusDetail | null {
  if (scope && entityKey) {
    return latestStatuses.get(statusKey(scope, entityKey)) ?? null
  }

  const statuses = Array.from(latestStatuses.values()).reverse()
  return statuses.find((status) =>
    (!scope || status.scope === scope) && (!entityKey || status.entityKey === entityKey)
  ) ?? null
}

export function emitAutosaveStatus(detail: AutosaveStatusDetail): void {
  latestStatuses.delete(statusKey(detail.scope, detail.entityKey))
  latestStatuses.set(statusKey(detail.scope, detail.entityKey), detail)

  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent<AutosaveStatusDetail>(AUTOSAVE_STATUS_EVENT, { detail }),
  )
}
