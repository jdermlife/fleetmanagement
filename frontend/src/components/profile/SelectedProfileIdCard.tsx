import { readReplicatedBuildProfile } from '../../pages/scoring/buildProfileReplication'

export function resolveSelectedProfileId(searchParams: URLSearchParams): string {
  const requestedProfileId = searchParams.get('applicationNo')?.trim()
    || searchParams.get('profileId')?.trim()

  return requestedProfileId || readReplicatedBuildProfile()?.profileId || ''
}

type SelectedProfileIdCardProps = {
  className?: string
}

export default function SelectedProfileIdCard({
  className = 'psychometric-summary-card psychometric-summary-card-highlight',
}: SelectedProfileIdCardProps) {
  const searchParams = new URLSearchParams(
    typeof window === 'undefined' ? '' : window.location.search,
  )
  const profileId = resolveSelectedProfileId(searchParams)

  return (
    <article className={className}>
      <span>Profile ID</span>
      <strong>{profileId || 'Not selected'}</strong>
      <small>
        {profileId
          ? 'Selected personal profile reference'
          : <a href="/build-profile" className="auth-link-button">Select a profile in Build Profile</a>}
      </small>
    </article>
  )
}