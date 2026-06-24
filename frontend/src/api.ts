import axios, { AxiosError, AxiosResponse } from 'axios'

const LOCAL_API_FALLBACK = 'http://localhost:5000'
const RENDER_API_FALLBACKS = [
  'https://fleetmanagement-api.onrender.com',
  'https://fleetmanagement-dq9t.onrender.com',
]

const configuredBaseUrls = (import.meta.env.VITE_API_URL ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)

const apiBaseUrlCandidates = Array.from(
  new Set([
    ...configuredBaseUrls,
    ...(configuredBaseUrls.length === 0 ? [LOCAL_API_FALLBACK] : []),
    ...RENDER_API_FALLBACKS,
  ])
)

let activeApiBaseUrl = apiBaseUrlCandidates[0] ?? LOCAL_API_FALLBACK

const isDevelopment = import.meta.env.DEV

export const api = axios.create({
  baseURL: activeApiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

function setActiveApiBaseUrl(url: string): void {
  if (activeApiBaseUrl === url) {
    return
  }

  activeApiBaseUrl = url
  api.defaults.baseURL = url
}

async function findHealthyApiBaseUrl(): Promise<string | null> {
  for (const candidate of apiBaseUrlCandidates) {
    try {
      const response = await api.get('/health', {
        baseURL: candidate,
        timeout: 6000,
      })

      if (response.status === 200) {
        return candidate
      }
    } catch {
      // Try the next configured backend URL.
    }
  }

  return null
}

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('auth_token', token)
    } else {
      localStorage.removeItem('auth_token')
    }
  }
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined' && !authToken) {
    authToken = localStorage.getItem('auth_token')
  }
  return authToken
}

// Initialize token from storage on load
if (typeof window !== 'undefined') {
  const storedToken = localStorage.getItem('auth_token')
  if (storedToken) {
    setAuthToken(storedToken)
  }
}

// Request interceptor
api.interceptors.request.use(
  (config) => {
    if (isDevelopment) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    }
    return config
  },
  (error) => {
    if (isDevelopment) {
      console.error('[API] Request error:', error)
    }
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    if (isDevelopment) {
      console.log(`[API] Response: ${response.status} ${response.statusText}`)
    }
    return response
  },
  (error: AxiosError) => {
    if (isDevelopment) {
      console.error('[API] Response error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      })
    }
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

    if (
      responseData &&
      typeof responseData === 'object' &&
      'detail' in responseData &&
      typeof responseData.detail === 'string'
    ) {
      return responseData.detail
    }

    // Handle network errors
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return 'Request timeout. The backend may be slow or unavailable.'
      }
      return `Unable to reach the backend. Tried: ${apiBaseUrlCandidates.join(', ')}. Make sure the backend server is running.`
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
  const healthyBaseUrl = await findHealthyApiBaseUrl()
  if (!healthyBaseUrl) {
    return false
  }

  setActiveApiBaseUrl(healthyBaseUrl)
  return true
}

/**
 * Get the configured API base URL
 */
export function getApiBaseUrl(): string {
  return activeApiBaseUrl
}

// Auth API calls
export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: {
    id: number
    username: string
    email: string
    role: string
    isActive: boolean
    createdAt: string
    updatedAt: string
    lastLoginAt: string | null
  }
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await api.post('/api/auth/login', credentials)
  const responseData = response.data as Record<string, unknown>
  const token =
    (typeof responseData.token === 'string' ? responseData.token : null) ??
    (typeof responseData.access_token === 'string'
      ? responseData.access_token
      : null)
  const user = responseData.user as LoginResponse['user'] | undefined

  if (!token || !user) {
    throw new Error('Unexpected login response received from the backend.')
  }

  setAuthToken(token)
  return {
    token,
    user,
  }
}

export async function register(data: RegisterRequest): Promise<LoginResponse['user']> {
  const response = await api.post('/api/auth/register', data)
  const responseData = response.data as Record<string, unknown>
  return (responseData.user as LoginResponse['user'] | undefined) ??
    (response.data as LoginResponse['user'])
}

export async function logout(): Promise<void> {
  setAuthToken(null)
}

export async function refreshAuthToken(): Promise<string> {
  const response = await api.post<{ token: string }>('/api/auth/refresh')
  setAuthToken(response.data.token)
  return response.data.token
}

export async function fetchCurrentUser(): Promise<LoginResponse['user']> {
  const response = await api.get<{
    user: LoginResponse['user']
  }>('/api/auth/me')
  return response.data.user
}

export async function requestPasswordReset(emailOrUsername: string): Promise<{
  message: string
  reset_token?: string
  user_id?: number
}> {
  const response = await api.post<{
    message: string
    reset_token?: string
    user_id?: number
  }>('/auth/password-reset-request', {
    email_or_username: emailOrUsername,
  })
  return response.data
}

export async function confirmPasswordReset(
  userId: number,
  resetToken: string,
  newPassword: string,
): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(
    '/auth/password-reset-confirm',
    {
      user_id: userId,
      reset_token: resetToken,
      new_password: newPassword,
    },
  )
  return response.data
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>('api/auth/password-change', {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return response.data
}

export async function deleteAccount(
  currentPassword: string,
): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>('/api/auth/delete-account', {
    current_password: currentPassword,
  })
  return response.data
}
