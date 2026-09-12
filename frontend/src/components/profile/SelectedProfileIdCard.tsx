import { readReplicatedBuildProfile } from '../../pages/scoring/buildProfileReplication'

export function resolveSelectedProfileId(searchParams: URLSearchParams): string {
  const requestedProfileId = searchParams.get('applicationNo')?.trim()
    || searchParams.get('profileId')?.trim()

  return requestedProfileId || readReplicatedBuildProfile()?.profileId || ''
}

export function resolveSelectedProfileName(searchParams: URLSearchParams): string {
  const profile = readReplicatedBuildProfile()
  if (!profile) return ''

  const requestedProfileId = searchParams.get('applicationNo')?.trim()
    || searchParams.get('profileId')?.trim()
  if (
    requestedProfileId
    && requestedProfileId !== profile.selectedApplicationNo?.trim()
    && requestedProfileId !== profile.profileId.trim()
  ) {
    return ''
  }

  return profile.values.fullName?.trim() || ''
}

type SelectedProfileIdCardProps = {
  className?: string
  compactId?: boolean
  description?: string
  label?: string
  name?: string
  nameFirst?: boolean
  profileId?: string
}

export default function SelectedProfileIdCard({
  className = 'psychometric-summary-card psychometric-summary-card-highlight',
  compactId = false,
  description = 'Selected personal profile reference',
  label = 'Profile ID',
  name,
  nameFirst = false,
  profileId: providedProfileId,
}: SelectedProfileIdCardProps) {
  const searchParams = new URLSearchParams(
    typeof window === 'undefined' ? '' : window.location.search,
  )
  const profileId = providedProfileId?.trim() || resolveSelectedProfileId(searchParams)
  const resolvedName = name?.trim() || resolveSelectedProfileName(searchParams)

  if (nameFirst) {
    return (
      <article className={className}>
        <span>Name</span>
        <strong className="selected-profile-name-primary">{resolvedName || 'Name not available'}</strong>
        <small className="selected-profile-reference">
          <span>{label}</span>
          <b className={compactId ? 'selected-profile-id-compact' : undefined}>
            {profileId || 'Not selected'}
          </b>
        </small>
      </article>
    )
  }

  return (
    <article className={className}>
      <span>{label}</span>
      <strong className={compactId ? 'selected-profile-id-compact' : undefined}>{profileId || 'Not selected'}</strong>
      <small>
        {profileId && resolvedName
          ? <><span className="selected-profile-name-label">Name</span><b className="selected-profile-name">{resolvedName}</b></>
          : profileId
            ? description
          : <a href="/build-profile" className="auth-link-button">Select a profile in Build Profile</a>}
      </small>
    </article>
  )
}