import { Capacitor } from '@capacitor/core'

function getCurrentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin
}

export const APP_CONFIG = {
  get apiBase() {
    const configuredApiBase = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '')
    if (import.meta.env.DEV) {
      return configuredApiBase || 'http://localhost:5000'
    }

    if (Capacitor.isNativePlatform() && configuredApiBase) {
      return configuredApiBase
    }

    return '/api'
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