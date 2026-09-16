import {
  autosaveDraftClient,
  isAutosaveConflictError,
  type AutosaveDraftClient,
  type RemoteDraft,
} from './draftApi'
import {
  cacheReplicatedBuildProfile,
  readReplicatedBuildProfile,
  type ReplicatedBuildProfile,
} from '../pages/scoring/buildProfileReplication'

export const BUILD_PROFILE_DRAFT_SCOPE = 'build-profile'
export const BUILD_PROFILE_DRAFT_ENTITY_KEY = 'current'

function timestamp(value?: string): number {
  const parsed = Date.parse(value ?? '')
  return Number.isFinite(parsed) ? parsed : 0
}

function isBuildProfile(value: unknown): value is ReplicatedBuildProfile {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<ReplicatedBuildProfile>
  return typeof profile.profileId === 'string'
    && profile.profileId.trim().length > 0
    && Boolean(profile.values)
    && typeof profile.values === 'object'
}

function cacheRemoteDraft(draft: RemoteDraft<ReplicatedBuildProfile>): void {
  if (isBuildProfile(draft.payload)) {
    cacheReplicatedBuildProfile(draft.payload, draft.updatedAt)
  }
}

export async function synchronizeBuildProfileDraft(
  client: AutosaveDraftClient = autosaveDraftClient,
): Promise<void> {
  const localProfile = readReplicatedBuildProfile()
  const remoteDraft = await client.get<ReplicatedBuildProfile>(
    BUILD_PROFILE_DRAFT_SCOPE,
    BUILD_PROFILE_DRAFT_ENTITY_KEY,
  )
  const validRemoteDraft = remoteDraft && isBuildProfile(remoteDraft.payload)
    ? remoteDraft
    : null

  if (!localProfile) {
    if (validRemoteDraft) cacheRemoteDraft(validRemoteDraft)
    return
  }

  if (
    validRemoteDraft
    && timestamp(validRemoteDraft.updatedAt) >= timestamp(localProfile.updatedAt)
  ) {
    cacheRemoteDraft(validRemoteDraft)
    return
  }

  try {
    const savedDraft = await client.put<ReplicatedBuildProfile>(
      BUILD_PROFILE_DRAFT_SCOPE,
      BUILD_PROFILE_DRAFT_ENTITY_KEY,
      {
        payload: localProfile,
        expectedRevision: validRemoteDraft?.revision ?? null,
      },
    )
    cacheRemoteDraft(savedDraft)
  } catch (error) {
    if (isAutosaveConflictError(error) && error.currentDraft && isBuildProfile(error.currentDraft.payload)) {
      cacheReplicatedBuildProfile(error.currentDraft.payload, error.currentDraft.updatedAt)
      return
    }
    throw error
  }
}