import { readReplicatedBuildProfile } from '../../pages/scoring/buildProfileReplication'

export function resolveSelectedProfileId(searchParams: URLSearchParams): string {
  const requestedProfileId = searchParams.get('applicationNo')?.trim()
    || searchParams.get('profileId')?.trim()

  return requestedProfileId || readReplicatedBuildProfile()?.profileId || ''
}

type SelectedProfileIdCardProps = {
  className?: string
  compactId?: boolean
  label?: string
  name?: string
}

export default function SelectedProfileIdCard({
  className = 'psychometric-summary-card psychometric-summary-card-highlight',
  compactId = false,
  label = 'Profile ID',
  name,
}: SelectedProfileIdCardProps) {
  const searchParams = new URLSearchParams(
    typeof window === 'undefined' ? '' : window.location.search,
  )
  const profileId = resolveSelectedProfileId(searchParams)

  return (
    <article className={className}>
      <span>{label}</span>
      <strong className={compactId ? 'selected-profile-id-compact' : undefined}>{profileId || 'Not selected'}</strong>
      <small>
        {profileId && name
          ? <><span className="selected-profile-name-label">Name</span><b className="selected-profile-name">{name}</b></>
          : profileId
            ? 'Selected personal profile reference'
          : <a href="/build-profile" className="auth-link-button">Select a profile in Build Profile</a>}
      </small>
    </article>
  )
}