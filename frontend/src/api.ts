import axios, { AxiosError, AxiosResponse } from 'axios'

const DEFAULT_API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:5000'
).replace(/\/$/, '')

const isDevelopment = import.meta.env.DEV

export const api = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

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
  const response = await api.post('/auth/login', credentials)
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
  const response = await api.post('/auth/register', data)
  const responseData = response.data as Record<string, unknown>
  return (responseData.user as LoginResponse['user'] | undefined) ??
    (response.data as LoginResponse['user'])
}

export async function logout(): Promise<void> {
  setAuthToken(null)
}

export async function refreshAuthToken(): Promise<string> {
  const response = await api.post<{ token: string }>('/auth/refresh')
  setAuthToken(response.data.token)
  return response.data.token
}

export async function fetchCurrentUser(): Promise<LoginResponse['user']> {
  const response = await api.get<{
    user: LoginResponse['user']
  }>('/auth/me')
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
  const response = await api.post<{ message: string }>('/auth/password-change', {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return response.data
}

export async function deleteAccount(
  currentPassword: string,
): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>('/auth/delete-account', {
    current_password: currentPassword,
  })
  return response.data
}
