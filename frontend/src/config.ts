function getCurrentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin
}

export function resolveApiBase(configuredApiBase: string | undefined, isDevelopment: boolean): string {
  const normalizedApiBase = configuredApiBase?.trim().replace(/\/$/, '')
  if (normalizedApiBase) {
    return normalizedApiBase
  }

  return isDevelopment ? 'http://localhost:5000' : '/api'
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
    return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || ''
  },
  get googleRedirect() {
    return `${getCurrentOrigin()}/auth/google/callback`
  },
} as const
