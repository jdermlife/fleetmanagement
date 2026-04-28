import axios from 'axios'


const AUTH_TOKEN_KEY = 'fms.authToken'
const storedToken = typeof window === 'undefined' ? null : window.localStorage.getItem(AUTH_TOKEN_KEY)
const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'


export const api = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
})

if (storedToken) {
  api.defaults.headers.common.Authorization = `Bearer ${storedToken}`
}

export function setAuthToken(token: string) {
  api.defaults.headers.common.Authorization = `Bearer ${token}`
  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken() {
  delete api.defaults.headers.common.Authorization
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function getStoredAuthToken() {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(AUTH_TOKEN_KEY)
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data
    if (
      responseData &&
      typeof responseData === 'object' &&
      'error' in responseData &&
      typeof responseData.error === 'string'
    ) {
      return responseData.error
    }

    if (!error.response) {
      return `Unable to reach the backend at ${DEFAULT_API_BASE_URL}. Start the API and try again.`
    }
  }

  return fallback
}
