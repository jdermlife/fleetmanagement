import axios, { AxiosError, AxiosResponse } from 'axios'

const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

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
  const response = await api.post<LoginResponse>('/auth/login', credentials)
  setAuthToken(response.data.token)
  return response.data
}

export async function register(data: RegisterRequest): Promise<LoginResponse['user']> {
  const response = await api.post<LoginResponse['user']>('/auth/register', data)
  return response.data
}

export async function logout(): Promise<void> {
  setAuthToken(null)
}

export async function refreshAuthToken(): Promise<string> {
  const response = await api.post<{ token: string }>('/auth/refresh')
  setAuthToken(response.data.token)
  return response.data.token
}