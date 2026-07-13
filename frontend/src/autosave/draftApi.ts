import axios from 'axios'

import { api } from '../api'

export interface RemoteDraft<T> {
  scope: string
  entityKey: string
  payload: T
  revision: number
  updatedAt: string
}

export interface SaveRemoteDraftInput<T> {
  payload: T
  expectedRevision: number | null
}

export interface AutosaveDraftClient {
  get<T>(scope: string, entityKey: string): Promise<RemoteDraft<T> | null>
  put<T>(
    scope: string,
    entityKey: string,
    input: SaveRemoteDraftInput<T>,
  ): Promise<RemoteDraft<T>>
  delete(scope: string, entityKey: string): Promise<void>
}

interface DraftApiPayload<T> {
  scope?: string
  entity_key?: string
  payload?: T
  data?: T
  revision?: number
  updated_at?: string
}

function draftPath(scope: string, entityKey: string): string {
  return `/api/drafts/${encodeURIComponent(scope)}/${encodeURIComponent(entityKey)}`
}

function normalizeDraft<T>(
  response: DraftApiPayload<T>,
  scope: string,
  entityKey: string,
): RemoteDraft<T> {
  const payload = Object.prototype.hasOwnProperty.call(response, 'payload')
    ? response.payload
    : response.data

  if (payload === undefined || typeof response.revision !== 'number') {
    throw new Error('The autosave service returned an invalid draft.')
  }

  return {
    scope: response.scope ?? scope,
    entityKey: response.entity_key ?? entityKey,
    payload,
    revision: response.revision,
    updatedAt: response.updated_at ?? new Date().toISOString(),
  }
}

export class AutosaveConflictError<T = unknown> extends Error {
  readonly currentDraft: RemoteDraft<T> | null

  constructor(currentDraft: RemoteDraft<T> | null) {
    super('This draft was updated in another session.')
    this.name = 'AutosaveConflictError'
    this.currentDraft = currentDraft
  }
}

export function isAutosaveConflictError(error: unknown): error is AutosaveConflictError {
  return error instanceof AutosaveConflictError
}

export function isAutosaveNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response
}

export async function fetchAutosaveDraft<T>(
  scope: string,
  entityKey: string,
): Promise<RemoteDraft<T> | null> {
  try {
    const response = await api.get<DraftApiPayload<T>>(draftPath(scope, entityKey))
    return normalizeDraft(response.data, scope, entityKey)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null
    }
    throw error
  }
}

export async function saveAutosaveDraftRemote<T>(
  scope: string,
  entityKey: string,
  input: SaveRemoteDraftInput<T>,
): Promise<RemoteDraft<T>> {
  try {
    const response = await api.put<DraftApiPayload<T>>(draftPath(scope, entityKey), {
      payload: input.payload,
      expected_revision: input.expectedRevision ?? 0,
    })
    return normalizeDraft(response.data, scope, entityKey)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      let currentDraft: RemoteDraft<T> | null = null
      try {
        currentDraft = await fetchAutosaveDraft<T>(scope, entityKey)
      } catch {
        // Preserve the original conflict even if the follow-up read fails.
      }
      throw new AutosaveConflictError(currentDraft)
    }
    throw error
  }
}

export async function deleteAutosaveDraftRemote(
  scope: string,
  entityKey: string,
): Promise<void> {
  try {
    await api.delete(draftPath(scope, entityKey))
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 404) {
      throw error
    }
  }
}

export const autosaveDraftClient: AutosaveDraftClient = {
  get: fetchAutosaveDraft,
  put: saveAutosaveDraftRemote,
  delete: deleteAutosaveDraftRemote,
}
