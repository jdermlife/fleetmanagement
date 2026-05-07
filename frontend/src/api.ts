import axios, { AxiosError, AxiosResponse } from 'axios'

const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export const api = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('[API] Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`[API] Response: ${response.status} ${response.statusText}`)
    return response
  },
  (error: AxiosError) => {
    console.error('[API] Response error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    })
    return Promise.reject(error)
  }
)

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data

    // Handle server-provided error messages
    if (
      responseData &&
      typeof responseData === 'object' &&
      'error' in responseData &&
      typeof responseData.error === 'string'
    ) {
      return responseData.error
    }

    // Handle network errors
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return 'Request timeout. The backend may be slow or unavailable.'
      }
      return `Unable to reach the backend at ${DEFAULT_API_BASE_URL}. Make sure the backend server is running.`
    }

    // Handle HTTP errors
    switch (error.response?.status) {
      case 400:
        return 'Invalid request. Please check your input.'
      case 401:
        return 'Unauthorized. Please log in again.'
      case 403:
        return 'You do not have permission to access this resource.'
      case 404:
        return 'Resource not found.'
      case 500:
        return 'Server error. Please try again later.'
      case 503:
        return 'Server is temporarily unavailable.'
      default:
        return `Error: ${error.response?.statusText || fallback}`
    }
  }

  return fallback
}

/**
 * Check if the backend is reachable
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await api.get('/health')
    return response.status === 200
  } catch {
    return false
  }
}

/**
 * Get the configured API base URL
 */
export function getApiBaseUrl(): string {
  return DEFAULT_API_BASE_URL
}
// src/api.ts
const API_BASE = import.meta.env.VITE_API_URL || '/api'

async function handleResponse<T>(res: Response): Promise<{ data: T }> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || 'Request failed')
  }
  return { data: await res.json() as T }
}

export const api = {
  async get<T>(url: string) {
    return handleResponse<T>(await fetch(`${API_BASE}${url}`))
  },
  async post<T>(url: string, body: unknown) {
    return handleResponse<T>(
      await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    )
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}