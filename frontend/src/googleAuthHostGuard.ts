const DEFAULT_GOOGLE_ALLOWED_HOSTS = [
  'localhost',
  '127.0.0.1',
  'fleetmanagement.vercel.app',
  'staging.fleetmanagement.vercel.app',
  'fleetmanagement-flame.vercel.app',
   'fleetmanagement-7f0xuuk7p-jdionedas-projects.vercel.app',
  'fleet.quantech.international',
]

function parseHosts(rawHosts: string | undefined): string[] {
  if (!rawHosts) {
    return []
  }

  return rawHosts
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
}

export function getGoogleAllowedHosts(): string[] {
  const configuredHosts = parseHosts(import.meta.env.VITE_GOOGLE_ALLOWED_HOSTS)
  return configuredHosts.length > 0 ? configuredHosts : DEFAULT_GOOGLE_ALLOWED_HOSTS
}

export function isGoogleSignInAllowedForCurrentHost(): boolean {
  if (typeof window === 'undefined') {
    return true
  }

  const currentHost = window.location.hostname.trim().toLowerCase()
  return getGoogleAllowedHosts().includes(currentHost)
}
