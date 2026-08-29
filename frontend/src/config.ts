function getCurrentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin
}

export const DEFAULT_GOOGLE_CLIENT_ID =
  '542183516756-2q3nuh3oui4cjdvcr7hpts6b40kfhheo.apps.googleusercontent.com'
export const DEFAULT_OLLAMA_FALLBACK_URL =
  'https://filscore-ai.quantech.international/local-ai/page-assistant'

export function validateConfiguredApiBase(configuredApiBase: string): string {
  const normalizedApiBase = configuredApiBase.trim().replace(/\/$/, '')
  let parsedUrl: URL

  try {
    parsedUrl = new URL(normalizedApiBase)
  } catch {
    throw new Error('VITE_API_URL must be a valid absolute URL.')
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost') {
    throw new Error('VITE_API_URL must use HTTPS outside local development.')
  }
  if (!/^[a-z0-9.-]+$/i.test(parsedUrl.hostname)) {
    throw new Error('VITE_API_URL contains an invalid hostname.')
  }
  if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error('VITE_API_URL must not contain credentials, query parameters, or fragments.')
  }

  return normalizedApiBase
}

export function resolveApiBase(configuredApiBase: string | undefined, isDevelopment: boolean): string {
  if (configuredApiBase?.trim()) {
    return validateConfiguredApiBase(configuredApiBase)
  }

  return isDevelopment ? 'http://localhost:5000' : '/api'
}

export function resolveGoogleClientId(configuredClientId: string | undefined): string {
  return configuredClientId?.trim() || DEFAULT_GOOGLE_CLIENT_ID
}

export function resolveOllamaFallbackUrl(configuredUrl: string | undefined): string {
  return configuredUrl?.trim().replace(/\/$/, '') || DEFAULT_OLLAMA_FALLBACK_URL
}

export const APP_CONFIG = {
  get apiBase() {
    return resolveApiBase(import.meta.env.VITE_API_URL, import.meta.env.DEV)
  },
  get appleClientId() {
    return import.meta.env.VITE_APPLE_CLIENT_ID?.trim() || 'com.quantech.filscore.web'
  },
  get appleIosClientId() {
    return import.meta.env.VITE_APPLE_IOS_CLIENT_ID?.trim() || 'com.quantech.filscore'
  },
  get appleRedirect() {
    return `${getCurrentOrigin()}/auth/apple/callback`
  },
  get googleClientId() {
    return resolveGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID)
  },
  get googleIosClientId() {
  return import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID?.trim() || ''
},
  get googleRedirect() {
    return `${getCurrentOrigin()}/auth/google/callback`
  },
  get ollamaFallbackUrl() {
    return resolveOllamaFallbackUrl(import.meta.env.VITE_OLLAMA_FALLBACK_URL)
  },
  get turnstileSiteKey() {
    return import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || ''
  },
} as const
