function getCurrentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin
}

export const DEFAULT_GOOGLE_CLIENT_ID =
  '542183516756-2q3nuh3oui4cjdvcr7hpts6b40kfhheo.apps.googleusercontent.com'

export function resolveApiBase(configuredApiBase: string | undefined, isDevelopment: boolean): string {
  const normalizedApiBase = configuredApiBase?.trim().replace(/\/$/, '')
  if (normalizedApiBase) {
    return normalizedApiBase
  }

  return isDevelopment ? 'http://localhost:5000' : '/api'
}

export function resolveGoogleClientId(configuredClientId: string | undefined): string {
  return configuredClientId?.trim() || DEFAULT_GOOGLE_CLIENT_ID
}

export const APP_CONFIG = {
  get apiBase() {
    return resolveApiBase(import.meta.env.VITE_API_URL, import.meta.env.DEV)
  },
  get appleClientId() {
    return import.meta.env.VITE_APPLE_CLIENT_ID?.trim() || 'com.quantech.filscore.web'
  },
  get appleRedirect() {
    return `${getCurrentOrigin()}/auth/apple/callback`
  },
  get googleClientId() {
    return resolveGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID)
  },
  get googleRedirect() {
    return `${getCurrentOrigin()}/auth/google/callback`
  },
  get turnstileSiteKey() {
    return import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || ''
  },
} as const
