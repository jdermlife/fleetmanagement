export function resolveDatabaseApplicationNo(
  searchParams: URLSearchParams,
  isFilscoreRoute: boolean,
  selectedApplicationNo: string,
): string {
  const applicationNo = searchParams.get('applicationNo')?.trim() || ''
  if (applicationNo) return applicationNo

  const profileId = searchParams.get('profileId')?.trim() || ''
  if (isFilscoreRoute) return profileId
  return profileId ? '' : selectedApplicationNo
}

export function allowsLocalBuildProfile(isFilscoreRoute: boolean): boolean {
  return !isFilscoreRoute
}
