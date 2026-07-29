import { getSelectedBuildProfileApplicationNo } from '../pages/scoring/buildProfileReplication'

export function resolveSelectedApplicationNo(searchParams: URLSearchParams): string {
  return searchParams.get('applicationNo')?.trim()
    || getSelectedBuildProfileApplicationNo()
}

export function useSelectedAnalysisEntity() {
  const selectedApplicationNo = resolveSelectedApplicationNo(
    new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search),
  )
  const entityKey = selectedApplicationNo || 'primary'

  return {
    selectedApplicationNo,
    entityKey,
    isIdentityReady: true,
  }
}