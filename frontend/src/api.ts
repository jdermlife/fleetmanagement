import axios, { AxiosError, AxiosResponse } from 'axios'

import { clearAutosaveDraftsForToken } from './autosave/draftStorage'

const LOCAL_API_FALLBACK = 'http://localhost:5000'
const PRODUCTION_API_PROXY_FALLBACK = '/backend'
const RENDER_API_FALLBACKS = [
  'https://fleetmanagement-dq9t.onrender.com',
]
const AUTH_TOKEN_STORAGE_KEY = 'auth_token'
const REFRESH_TOKEN_STORAGE_KEY = 'refresh_token'

const configuredBaseUrls = (import.meta.env.VITE_API_URL ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)

const isDevelopment = import.meta.env.DEV
const productionProxyCandidates = isDevelopment ? [] : [PRODUCTION_API_PROXY_FALLBACK]

const apiBaseUrlCandidates = Array.from(
  new Set([
    ...productionProxyCandidates,
    ...configuredBaseUrls,
    ...(configuredBaseUrls.length === 0 && isDevelopment ? [LOCAL_API_FALLBACK] : []),
    ...RENDER_API_FALLBACKS,
  ])
)

const healthCheckClient = axios.create({
  timeout: 6000,
  headers: {
    'Content-Type': 'application/json',
  },
})

let activeApiBaseUrl =
  apiBaseUrlCandidates[0] ?? (isDevelopment ? LOCAL_API_FALLBACK : PRODUCTION_API_PROXY_FALLBACK)

let apiBaseUrlResolutionRequest: Promise<void> | null = null
let apiBaseUrlResolved = false

export const api = axios.create({
  baseURL: activeApiBaseUrl,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
})

function setActiveApiBaseUrl(url: string): void {
  if (activeApiBaseUrl === url) {
    apiBaseUrlResolved = true
    return
  }

  activeApiBaseUrl = url
  api.defaults.baseURL = url
  apiBaseUrlResolved = true
}

async function findHealthyApiBaseUrl(): Promise<string | null> {
  for (const candidate of apiBaseUrlCandidates) {
    try {
      const response = await healthCheckClient.get('/health', {
        baseURL: candidate,
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

async function ensureHealthyApiBaseUrl(): Promise<void> {
  if (apiBaseUrlResolved) {
    return
  }

  if (apiBaseUrlResolutionRequest) {
    await apiBaseUrlResolutionRequest
    return
  }

  apiBaseUrlResolutionRequest = (async () => {
    const healthyBaseUrl = await findHealthyApiBaseUrl()
    if (healthyBaseUrl) {
      setActiveApiBaseUrl(healthyBaseUrl)
      return
    }

    apiBaseUrlResolved = true
  })().finally(() => {
    apiBaseUrlResolutionRequest = null
  })

  await apiBaseUrlResolutionRequest
}

let authToken: string | null = null
let refreshToken: string | null = null
let currentUserCache: AuthUser | null = null
let currentUserRequest: Promise<AuthUser> | null = null
let refreshTokenRequest: Promise<string> | null = null

function clearCachedAuthState() {
  currentUserCache = null
  currentUserRequest = null
}

function syncStoredSession(nextAccessToken: string | null, nextRefreshToken: string | null) {
  authToken = nextAccessToken
  refreshToken = nextRefreshToken

  if (nextAccessToken) {
    api.defaults.headers.common['Authorization'] = `Bearer ${nextAccessToken}`
  } else {
    delete api.defaults.headers.common['Authorization']
    clearCachedAuthState()
  }

  if (typeof window !== 'undefined') {
    if (nextAccessToken) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, nextAccessToken)
    } else {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    }

    if (nextRefreshToken) {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, nextRefreshToken)
    } else {
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
    }
  }
}

export function setAuthToken(token: string | null) {
  syncStoredSession(token, token ? refreshToken : null)
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined' && !authToken) {
    authToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  }
  return authToken
}

export function getRefreshToken(): string | null {
  if (typeof window !== 'undefined' && !refreshToken) {
    refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  }
  return refreshToken
}

// Initialize token from storage on load
if (typeof window !== 'undefined') {
  const storedAuthToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  if (storedAuthToken || storedRefreshToken) {
    syncStoredSession(storedAuthToken, storedRefreshToken)
  }
}

function shouldSkipSessionRefresh(url?: string): boolean {
  if (!url) {
    return false
  }

  return [
    '/api/auth/login',
    '/api/auth/google-token',
    '/api/auth/apple-token',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/logout',
  ].some((path) => url.includes(path))
}

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    await ensureHealthyApiBaseUrl()
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
  async (error: AxiosError) => {
    if (isDevelopment) {
      console.error('[API] Response error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      })
    }

    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined
    const refreshTokenCandidate = getRefreshToken()

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      refreshTokenCandidate &&
      !shouldSkipSessionRefresh(originalRequest.url)
    ) {
      originalRequest._retry = true

      try {
        const nextAccessToken = await refreshAuthToken()
        if (originalRequest.headers) {
          const requestHeaders = originalRequest.headers as Record<string, unknown>
          requestHeaders.Authorization = `Bearer ${nextAccessToken}`
        }
        return await api.request(originalRequest)
      } catch (refreshError) {
        syncStoredSession(null, null)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:session-expired'))
        }
        return Promise.reject(refreshError)
      }
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
        return 'We are securely analyzing your document. This may take up to 60 seconds depending on image quality and server load. Thank you for your patience.'
      }
      return `We are unable to connect the verification service at this time. Please try again later. Tried: ${apiBaseUrlCandidates.join(', ')}. If the problem persists, contact support.`
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

export interface GoogleLoginRequest {
  idToken: string
  subscriberType?: 'borrower' | 'lender'
  lenderDataSharingConsent?: boolean
}

export interface AppleLoginRequest {
  idToken: string
  subscriberType?: 'borrower' | 'lender'
  lenderDataSharingConsent?: boolean
}

export interface LoginResponse {
  token: string
  refreshToken: string
  user: AuthUser
}

export interface AuthUser {
  id: number
  username: string
  email: string
  role: string
  roles: string[]
  permissions: string[]
  isActive: boolean
  subscriptionId?: number | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  mfaEnabled?: boolean
  lenderDataSharingConsent?: boolean
  lenderDataSharingConsentRecordedAt?: string | null
}

function normalizeAuthUser(raw: Record<string, unknown>): AuthUser {
  const rolesFromPayload = Array.isArray(raw.roles)
    ? raw.roles.filter((role): role is string => typeof role === 'string')
    : []
  const roleFromPayload =
    typeof raw.role === 'string' && raw.role.length > 0
      ? raw.role
      : rolesFromPayload[0] ?? 'subscriber'

  const permissions = Array.isArray(raw.permissions)
    ? raw.permissions.filter((permission): permission is string => typeof permission === 'string')
    : []

  return {
    id: Number(raw.id ?? 0),
    username: String(raw.username ?? ''),
    email: String(raw.email ?? ''),
    role: roleFromPayload,
    roles: rolesFromPayload.length > 0 ? rolesFromPayload : [roleFromPayload],
    permissions,
    isActive: Boolean(raw.isActive ?? raw.is_active ?? true),
    subscriptionId: (raw.subscriptionId ?? raw.subscription_id ?? null) as number | null,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
    lastLoginAt: (raw.lastLoginAt ?? raw.last_login_at ?? null) as string | null,
    mfaEnabled: Boolean(raw.mfaEnabled ?? raw.mfa_enabled ?? false),
    lenderDataSharingConsent: Boolean(
      raw.lenderDataSharingConsent ?? raw.lender_data_sharing_consent ?? false,
    ),
    lenderDataSharingConsentRecordedAt: (
      raw.lenderDataSharingConsentRecordedAt ?? raw.lender_data_sharing_consent_recorded_at ?? null
    ) as string | null,
  }
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  subscriberType: 'borrower' | 'lender'
  lenderDataSharingConsent: boolean
}

function extractSessionTokens(responseData: Record<string, unknown>): {
  accessToken: string | null
  refreshToken: string | null
} {
  return {
    accessToken:
      (typeof responseData.token === 'string' ? responseData.token : null) ??
      (typeof responseData.access_token === 'string' ? responseData.access_token : null),
    refreshToken:
      (typeof responseData.refreshToken === 'string' ? responseData.refreshToken : null) ??
      (typeof responseData.refresh_token === 'string' ? responseData.refresh_token : null),
  }
}

function syncSessionFromAuthResponse(responseData: Record<string, unknown>): {
  accessToken: string
  refreshToken: string
} {
  const tokens = extractSessionTokens(responseData)

  if (!tokens.accessToken || !tokens.refreshToken) {
    throw new Error('Unexpected authentication tokens received from the backend.')
  }

  syncStoredSession(tokens.accessToken, tokens.refreshToken)
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  }
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  await ensureHealthyApiBaseUrl()
  const response = await api.post('/api/auth/login', credentials)
  const responseData = response.data as Record<string, unknown>
  const user = responseData.user as Record<string, unknown> | undefined

  if (!user) {
    throw new Error('Unexpected login response received from the backend.')
  }

  const { accessToken, refreshToken } = syncSessionFromAuthResponse(responseData)
  currentUserCache = normalizeAuthUser(user)
  currentUserRequest = null
  return {
    token: accessToken,
    refreshToken,
    user: currentUserCache,
  }
}

export async function loginWithGoogle(payload: GoogleLoginRequest): Promise<LoginResponse> {
  await ensureHealthyApiBaseUrl()
  const response = await api.post('/api/auth/google-token', {
    id_token: payload.idToken,
    subscriber_type: payload.subscriberType,
    lender_data_sharing_consent: payload.lenderDataSharingConsent,
  })
  const responseData = response.data as Record<string, unknown>
  const user = responseData.user as Record<string, unknown> | undefined

  if (!user) {
    throw new Error('Unexpected Google login response received from the backend.')
  }

  const { accessToken, refreshToken } = syncSessionFromAuthResponse(responseData)
  currentUserCache = normalizeAuthUser(user)
  currentUserRequest = null

  return {
    token: accessToken,
    refreshToken,
    user: currentUserCache,
  }
}

export async function loginWithApple(payload: AppleLoginRequest): Promise<LoginResponse> {
  await ensureHealthyApiBaseUrl()
  const response = await api.post('/api/auth/apple-token', {
    identity_token: payload.idToken,
    id_token: payload.idToken,
    subscriber_type: payload.subscriberType,
    lender_data_sharing_consent: payload.lenderDataSharingConsent,
  })
  const responseData = response.data as Record<string, unknown>
  const user = responseData.user as Record<string, unknown> | undefined

  if (!user) {
    throw new Error('Unexpected Apple login response received from the backend.')
  }

  const { accessToken, refreshToken } = syncSessionFromAuthResponse(responseData)
  currentUserCache = normalizeAuthUser(user)
  currentUserRequest = null

  return {
    token: accessToken,
    refreshToken,
    user: currentUserCache,
  }
}

export async function register(data: RegisterRequest): Promise<LoginResponse['user']> {
  await ensureHealthyApiBaseUrl()
  const response = await api.post('/api/auth/register', {
    username: data.username,
    email: data.email,
    password: data.password,
    subscriber_type: data.subscriberType,
    lender_data_sharing_consent: data.lenderDataSharingConsent,
  })
  const responseData = response.data as Record<string, unknown>
  const rawUser =
    (responseData.user as Record<string, unknown> | undefined) ??
    (response.data as Record<string, unknown>)
  return normalizeAuthUser(rawUser)
}

export async function logout(): Promise<void> {
  const currentRefreshToken = getRefreshToken()
  const autosaveOwnerToken = getAuthToken() ?? currentRefreshToken

  try {
    if (currentRefreshToken) {
      await api.post('/api/auth/logout', {
        refresh_token: currentRefreshToken,
      })
    }
  } catch {
    // Clear the local session even if the backend session is already expired.
  } finally {
    clearAutosaveDraftsForToken(autosaveOwnerToken)
    syncStoredSession(null, null)
  }
}

export async function refreshAuthToken(): Promise<string> {
  if (refreshTokenRequest) {
    return refreshTokenRequest
  }

  const currentRefreshToken = getRefreshToken()
  if (!currentRefreshToken) {
    syncStoredSession(null, null)
    throw new Error('Unable to refresh the session because no refresh token is available.')
  }

  refreshTokenRequest = api
    .post<Record<string, unknown>>('/api/auth/refresh', {
      refresh_token: currentRefreshToken,
    })
    .then((response) => {
      const { accessToken } = syncSessionFromAuthResponse(response.data)
      return accessToken
    })
    .finally(() => {
      refreshTokenRequest = null
    })

  return refreshTokenRequest
}

export async function fetchCurrentUser(): Promise<LoginResponse['user']> {
  if (currentUserCache) {
    return currentUserCache
  }

  if (currentUserRequest) {
    return currentUserRequest
  }

  currentUserRequest = api
    .get<{
      user: Record<string, unknown>
    }>('/api/auth/me')
    .then((response) => {
      currentUserCache = normalizeAuthUser(response.data.user)
      return currentUserCache
    })
    .finally(() => {
      currentUserRequest = null
    })

  return currentUserRequest
}

export async function updateAccountPreferences(payload: {
  lenderDataSharingConsent: boolean
}): Promise<{ message: string; user: LoginResponse['user'] }> {
  const response = await api.patch<{
    message: string
    user: Record<string, unknown>
  }>('/api/auth/preferences', {
    lender_data_sharing_consent: payload.lenderDataSharingConsent,
  })

  const normalizedUser = normalizeAuthUser(response.data.user)
  currentUserCache = normalizedUser

  return {
    message: response.data.message,
    user: normalizedUser,
  }
}

export interface AdminPermission {
  id: number
  name: string
  description: string | null
  resource: string
  action: string
}

export interface AdminRole {
  id: number
  name: string
  description: string | null
  is_system?: boolean
  permissions: AdminPermission[]
}

export interface AdminUser {
  id: number
  username: string
  email: string
  is_active: boolean
  is_deleted?: boolean
  account_status?: 'ACTIVE' | 'PENDING' | 'LOCKED' | 'SUSPENDED' | 'DISABLED' | 'DELETED'
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  mobile_no?: string | null
  role_id?: number | null
  subscription_id?: number | null
  api_access?: boolean
  email_verified?: boolean
  last_login_ip?: string | null
  last_login_device?: string | null
  total_login_count?: number
  mfa_enabled?: boolean
  last_login_at?: string | null
  roles: string[]
  permissions: string[]
  created_at?: string
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const response = await api.get<{ users: AdminUser[] }>('/api/admin/users')
  return response.data.users
}

export async function createAdminUser(payload: {
  username: string
  email: string
  password: string
  is_active?: boolean
  account_status?: 'ACTIVE' | 'PENDING' | 'LOCKED' | 'SUSPENDED' | 'DISABLED' | 'DELETED'
  first_name?: string
  middle_name?: string
  last_name?: string
  mobile_no?: string
  role_id?: number
  subscription_id?: number
  api_access?: boolean
  email_verified?: boolean
  roles?: string[]
}): Promise<AdminUser> {
  const response = await api.post<{ user: AdminUser }>('/api/admin/users', payload)
  return response.data.user
}

export async function updateAdminUser(
  userId: number,
  payload: {
    email?: string
    is_active?: boolean
    account_status?: 'ACTIVE' | 'PENDING' | 'LOCKED' | 'SUSPENDED' | 'DISABLED' | 'DELETED'
    first_name?: string
    middle_name?: string
    last_name?: string
    mobile_no?: string
    role_id?: number
    subscription_id?: number
    api_access?: boolean
    email_verified?: boolean
  },
): Promise<AdminUser> {
  const response = await api.patch<{ user: AdminUser }>(`/api/admin/users/${userId}`, payload)
  return response.data.user
}

export async function assignAdminUserRoles(userId: number, roles: string[]): Promise<AdminUser> {
  const response = await api.put<{ user: AdminUser }>(`/api/admin/users/${userId}/roles`, {
    roles,
  })
  return response.data.user
}

export async function listAdminRoles(): Promise<AdminRole[]> {
  const response = await api.get<{ roles: AdminRole[] }>('/api/admin/roles')
  return response.data.roles
}

export async function createAdminRole(payload: {
  name: string
  description?: string
}): Promise<AdminRole> {
  const response = await api.post<{ role: AdminRole }>('/api/admin/roles', payload)
  return response.data.role
}

export async function assignRolePermissions(roleId: number, permissions: string[]): Promise<void> {
  await api.put(`/api/admin/roles/${roleId}/permissions`, { permissions })
}

export async function listAdminPermissions(): Promise<AdminPermission[]> {
  const response = await api.get<{ permissions: AdminPermission[] }>('/api/admin/permissions')
  return response.data.permissions
}

export async function createAdminPermission(payload: {
  name: string
  description?: string
  resource: string
  action: string
}): Promise<AdminPermission> {
  const response = await api.post<{ permission: AdminPermission }>('/api/admin/permissions', payload)
  return response.data.permission
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
  }>('/api/auth/password-reset-request', {
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
    '/api/auth/password-reset-confirm',
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
  const response = await api.post<{ message: string }>('/api/auth/password/change', {
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

export interface MeetingRecord {
  id: number
  meeting_title: string
  meeting_date: string | null
  created_at: string | null
}

export interface MeetingDetailsRecord extends MeetingRecord {
  transcript: string
  summary: string
  action_items: string
}

export interface MeetingTranscriptResponse {
  transcript: string
}

export interface MeetingMinutesResponse {
  id?: number
  summary?: string
  message?: string
}

export async function transcribeMeetingAudio(audioFile: File): Promise<MeetingTranscriptResponse> {
  const formData = new FormData()
  formData.append('audio', audioFile)

  const response = await api.post<MeetingTranscriptResponse>('/ai/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export async function generateMeetingMinutes(payload: {
  meetingTitle: string
  meetingDate: string
  transcript: string
}): Promise<MeetingMinutesResponse> {
  const response = await api.post<MeetingMinutesResponse>('/ai/minutes', {
    meeting_title: payload.meetingTitle,
    meeting_date: payload.meetingDate,
    transcript: payload.transcript,
  })
  return response.data
}

export async function listMeetings(): Promise<MeetingRecord[]> {
  const response = await api.get<MeetingRecord[]>('/ai/meetings')
  return response.data
}

export async function searchMeetingsByTitle(search: string): Promise<MeetingRecord[]> {
  const response = await api.get<MeetingRecord[]>(`/ai/meetings/search/${encodeURIComponent(search)}`)
  return response.data
}

export async function fetchMeetingDetails(meetingId: string): Promise<MeetingDetailsRecord> {
  const response = await api.get<MeetingDetailsRecord>(`/ai/meetings/${meetingId}`)
  return response.data
}

export async function downloadMeetingPdf(meetingId: string): Promise<string> {
  const response = await api.get<Blob>(`/ai/meetings/${meetingId}/pdf`, {
    responseType: 'blob',
  })
  return URL.createObjectURL(response.data)
}

export interface CreditAdvisorRequestPayload {
  productType?: string
  monthlyIncome?: number
  debtObligations?: number
  loanAmount?: number
  appraisedValue?: number
  dti?: number
  dsr?: number
  ltv?: number
  finalScore?: number
  finalDecision?: string
  borrowerNotes?: string
}

export interface CreditAdvisorResult {
  provider: string
  model: string
  advice: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  latency_ms: number
}

export async function generateCreditAdvisorPlan(
  payload: CreditAdvisorRequestPayload,
): Promise<CreditAdvisorResult> {
  const response = await api.post<CreditAdvisorResult>('/ai/credit-advisor', {
    product_type: payload.productType,
    monthly_income: payload.monthlyIncome,
    debt_obligations: payload.debtObligations,
    loan_amount: payload.loanAmount,
    appraised_value: payload.appraisedValue,
    dti: payload.dti,
    dsr: payload.dsr,
    ltv: payload.ltv,
    final_score: payload.finalScore,
    final_decision: payload.finalDecision,
    borrower_notes: payload.borrowerNotes,
  })
  return response.data
}

export interface CreditCardRiskCheckPayload {
  cardIssuer: string
  cardNumberBin: string
  cardNumberLast4: string
  cardNumberLength: number
  luhnValid: boolean
  issuerFromNumber?: string | null
  issuerMatchesPrefix?: boolean | null
}

export interface CreditCardRiskCheckResult {
  provider: string
  model: string
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN'
  summary: string
  recommended_action: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  latency_ms: number
}

export async function checkCreditCardRiskWithAi(
  payload: CreditCardRiskCheckPayload,
): Promise<CreditCardRiskCheckResult> {
  const response = await api.post<CreditCardRiskCheckResult>('/ai/credit-card-risk-check', {
    card_issuer: payload.cardIssuer,
    card_number_bin: payload.cardNumberBin,
    card_number_last4: payload.cardNumberLast4,
    card_number_length: payload.cardNumberLength,
    luhn_valid: payload.luhnValid,
    issuer_from_number: payload.issuerFromNumber ?? null,
    issuer_matches_prefix: payload.issuerMatchesPrefix ?? null,
  })

  return response.data
}

export interface SubscriptionPlan {
  id: number
  plan_code: string
  plan_name: string
  description: string | null
  billing_cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  monthly_price: number | null
  yearly_price: number | null
  minimum_monthly_fee: number | null
  per_record_fee: number | null
  currency: string
  max_users: number | null
  max_vehicles: number | null
  max_drivers: number | null
  max_storage_gb: number | null
  trial_days: number
  display_order: number
  is_public: boolean
  is_custom_pricing: boolean
  max_ai_requests_per_month: number
  max_api_calls_per_month: number
  max_documents: number
  max_reports: number
  max_meetings: number
  max_storage_files: number
  storage_unit: string
  support_level: 'STANDARD' | 'PRIORITY' | 'PREMIUM' | 'ENTERPRISE'
  sla_hours: number
  color_code: string | null
  icon_name: string | null
  ai_enabled: boolean
  api_enabled: boolean
  reporting_enabled: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SubscriptionRecord {
  id: number
  subscription_no: string
  user_id: number
  plan_id: number
  status: 'PENDING' | 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'
  subscription_type: 'FREE' | 'TRIAL' | 'PAID' | 'LIFETIME'
  trial_start: string | null
  trial_end: string | null
  subscription_start: string
  subscription_end: string | null
  auto_renew: boolean
  payment_provider_id: number | null
  next_billing_date: string | null
  cancellation_reason: string | null
  cancelled_at: string | null
  cancelled_by: number | null
  grace_period_end: string | null
  renewal_count: number
  last_payment_date: string | null
  next_invoice_date: string | null
  current_users: number
  current_vehicles: number
  current_drivers: number
  current_storage_gb: number | null
  current_ai_requests: number
  current_api_calls: number
  tenant_id: number | null
  created_by: number | null
  updated_by: number | null
  deleted_by: number | null
  deleted_at: string | null
  is_deleted: boolean
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface PaymentProvider {
  id: number
  provider_code: string
  provider_name: string
  api_endpoint: string | null
  webhook_url: string | null
  is_active: boolean
  created_at: string
}

export interface SubscriptionPayment {
  id: number
  payment_reference: string
  subscription_id: number
  provider_id: number | null
  invoice_no: string | null
  amount: number | null
  currency: string | null
  payment_method: string | null
  payment_status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'
  provider_transaction_id: string | null
  paid_at: string | null
  created_at: string
}

export interface PayMongoCheckoutSession {
  checkout_id: string
  checkout_url: string
  amount: number
  currency: string
  payment: SubscriptionPayment
}

export interface SubscriptionInvoice {
  id: number
  invoice_no: string
  subscription_id: number
  invoice_date: string | null
  due_date: string | null
  subtotal: number | null
  tax: number | null
  total: number | null
  status: string | null
  pdf_url: string | null
  created_at: string
}

export interface SubscriptionUsage {
  id: number
  subscription_id: number
  usage_date: string | null
  users_used: number | null
  vehicles_used: number | null
  drivers_used: number | null
  storage_used_gb: number | null
  api_calls: number | null
  ai_requests: number | null
  created_at: string
}

export interface SubscriptionEvent {
  id: number
  subscription_id: number
  event_type: string
  event_details: Record<string, unknown>
  created_by: number
  created_at: string
}

export interface PaymentWebhook {
  id: number
  provider_id: number
  event_type: string
  payload: Record<string, unknown>
  processed: boolean
  processed_at: string | null
  created_at: string
}

export interface Feature {
  id: number
  feature_code: string
  feature_name: string
  description: string | null
}

export async function listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const response = await api.get<SubscriptionPlan[]>('/api/subscriptions/plans')
  return response.data
}

export async function listPublicSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const response = await api.get<SubscriptionPlan[]>('/api/subscriptions/public-plans')
  return response.data
}

export async function createSubscriptionPlan(payload: {
  plan_code: string
  plan_name: string
  description?: string
  billing_cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  monthly_price?: number
  yearly_price?: number
  currency?: string
  max_users?: number
  max_vehicles?: number
  max_drivers?: number
  max_storage_gb?: number
  trial_days?: number
  display_order?: number
  is_public?: boolean
  is_custom_pricing?: boolean
  max_ai_requests_per_month?: number
  max_api_calls_per_month?: number
  max_documents?: number
  max_reports?: number
  max_meetings?: number
  max_storage_files?: number
  storage_unit?: string
  support_level?: 'STANDARD' | 'PRIORITY' | 'PREMIUM' | 'ENTERPRISE'
  sla_hours?: number
  color_code?: string
  icon_name?: string
  ai_enabled?: boolean
  api_enabled?: boolean
  reporting_enabled?: boolean
  is_active?: boolean
}): Promise<SubscriptionPlan> {
  const response = await api.post<SubscriptionPlan>('/api/subscriptions/plans', payload)
  return response.data
}

export async function updateSubscriptionPlan(
  planId: number,
  payload: {
    plan_code?: string
    plan_name?: string
    description?: string
    billing_cycle?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
    monthly_price?: number
    yearly_price?: number
    currency?: string
    max_users?: number
    max_vehicles?: number
    max_drivers?: number
    max_storage_gb?: number
    trial_days?: number
    display_order?: number
    is_public?: boolean
    is_custom_pricing?: boolean
    max_ai_requests_per_month?: number
    max_api_calls_per_month?: number
    max_documents?: number
    max_reports?: number
    max_meetings?: number
    max_storage_files?: number
    storage_unit?: string
    support_level?: 'STANDARD' | 'PRIORITY' | 'PREMIUM' | 'ENTERPRISE'
    sla_hours?: number
    color_code?: string
    icon_name?: string
    ai_enabled?: boolean
    api_enabled?: boolean
    reporting_enabled?: boolean
    is_active?: boolean
  },
): Promise<SubscriptionPlan> {
  const response = await api.patch<SubscriptionPlan>(`/api/subscriptions/plans/${planId}`, payload)
  return response.data
}

export async function listSubscriptions(status?: string): Promise<SubscriptionRecord[]> {
  const response = await api.get<SubscriptionRecord[]>('/api/subscriptions', {
    params: status ? { status } : undefined,
  })
  return response.data
}

export async function getMySubscription(): Promise<SubscriptionRecord | null> {
  const response = await api.get<SubscriptionRecord | null>('/api/subscriptions/me')
  return response.data
}

export async function createFreeSubscription(payload?: { user_id?: number }): Promise<SubscriptionRecord> {
  const response = await api.post<SubscriptionRecord>('/api/subscriptions/create-free', payload ?? {})
  return response.data
}

export async function createSubscription(payload: {
  subscription_no: string
  user_id?: number
  plan_id: number
  status: 'PENDING' | 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'
  subscription_type?: 'FREE' | 'TRIAL' | 'PAID' | 'LIFETIME'
  trial_start?: string
  trial_end?: string
  subscription_start: string
  subscription_end?: string
  auto_renew?: boolean
  payment_provider_id?: number
  next_billing_date?: string
  cancellation_reason?: string
  cancelled_at?: string
  cancelled_by?: number
  grace_period_end?: string
  renewal_count?: number
  last_payment_date?: string
  next_invoice_date?: string
  current_users?: number
  current_vehicles?: number
  current_drivers?: number
  current_storage_gb?: number
  current_ai_requests?: number
  current_api_calls?: number
  tenant_id?: number
  created_by?: number
  updated_by?: number
  deleted_by?: number
  deleted_at?: string
  is_deleted?: boolean
  remarks?: string
}): Promise<SubscriptionRecord> {
  const response = await api.post<SubscriptionRecord>('/api/subscriptions', payload)
  return response.data
}

export async function updateSubscription(
  subscriptionId: number,
  payload: {
    user_id?: number
    plan_id?: number
    status?: 'PENDING' | 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'
    subscription_type?: 'FREE' | 'TRIAL' | 'PAID' | 'LIFETIME'
    trial_start?: string
    trial_end?: string
    subscription_start?: string
    subscription_end?: string
    auto_renew?: boolean
    payment_provider_id?: number
    next_billing_date?: string
    cancellation_reason?: string
    cancelled_at?: string
    cancelled_by?: number
    grace_period_end?: string
    renewal_count?: number
    last_payment_date?: string
    next_invoice_date?: string
    current_users?: number
    current_vehicles?: number
    current_drivers?: number
    current_storage_gb?: number
    current_ai_requests?: number
    current_api_calls?: number
    tenant_id?: number
    created_by?: number
    updated_by?: number
    deleted_by?: number
    deleted_at?: string
    is_deleted?: boolean
    remarks?: string
  },
): Promise<SubscriptionRecord> {
  const response = await api.patch<SubscriptionRecord>(`/api/subscriptions/${subscriptionId}`, payload)
  return response.data
}

export async function updateSubscriptionStatus(
  subscriptionId: number,
  status: 'PENDING' | 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED',
): Promise<SubscriptionRecord> {
  const response = await api.patch<SubscriptionRecord>(`/api/subscriptions/${subscriptionId}/status`, null, {
    params: { status },
  })
  return response.data
}

export async function createSubscriptionCheckout(payload: {
  plan: string
  billing_cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
}): Promise<{ checkout_url: string }> {
  const response = await api.post<{ checkout_url: string }>('/api/subscriptions/create-checkout', payload)
  return response.data
}

export async function listPaymentProviders(): Promise<PaymentProvider[]> {
  const response = await api.get<PaymentProvider[]>('/api/subscriptions/providers')
  return response.data
}

export async function createPaymentProvider(payload: {
  provider_code: string
  provider_name: string
  api_endpoint?: string
  webhook_url?: string
  is_active?: boolean
}): Promise<PaymentProvider> {
  const response = await api.post<PaymentProvider>('/api/subscriptions/providers', payload)
  return response.data
}

export async function listSubscriptionPayments(): Promise<SubscriptionPayment[]> {
  const response = await api.get<SubscriptionPayment[]>('/api/subscriptions/payments')
  return response.data
}

export async function createSubscriptionPayment(payload: {
  payment_reference: string
  subscription_id: number
  provider_id?: number
  invoice_no?: string
  amount?: number
  currency?: string
  payment_method?: string
  payment_status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'
  provider_transaction_id?: string
  paid_at?: string
}): Promise<SubscriptionPayment> {
  const response = await api.post<SubscriptionPayment>('/api/subscriptions/payments', payload)
  return response.data
}

export async function createPayMongoCheckout(payload: {
  subscription_id: number
  invoice_no?: string
}): Promise<PayMongoCheckoutSession> {
  const response = await api.post<PayMongoCheckoutSession>(
    '/api/subscriptions/payments/paymongo/checkout',
    payload,
  )
  return response.data
}

export async function updateSubscriptionPayment(
  paymentId: number,
  payload: {
    provider_id?: number
    invoice_no?: string
    amount?: number
    currency?: string
    payment_method?: string
    payment_status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'
    provider_transaction_id?: string
    paid_at?: string
  },
): Promise<SubscriptionPayment> {
  const response = await api.patch<SubscriptionPayment>(`/api/subscriptions/payments/${paymentId}`, payload)
  return response.data
}

export async function listSubscriptionInvoices(): Promise<SubscriptionInvoice[]> {
  const response = await api.get<SubscriptionInvoice[]>('/api/subscriptions/invoices')
  return response.data
}

export async function createSubscriptionInvoice(payload: {
  invoice_no: string
  subscription_id: number
  invoice_date?: string
  due_date?: string
  subtotal?: number
  tax?: number
  total?: number
  status?: string
  pdf_url?: string
}): Promise<SubscriptionInvoice> {
  const response = await api.post<SubscriptionInvoice>('/api/subscriptions/invoices', payload)
  return response.data
}

export async function listSubscriptionUsage(): Promise<SubscriptionUsage[]> {
  const response = await api.get<SubscriptionUsage[]>('/api/subscriptions/usage')
  return response.data
}

export async function createSubscriptionUsage(payload: {
  subscription_id: number
  usage_date?: string
  users_used?: number
  vehicles_used?: number
  drivers_used?: number
  storage_used_gb?: number
  api_calls?: number
  ai_requests?: number
}): Promise<SubscriptionUsage> {
  const response = await api.post<SubscriptionUsage>('/api/subscriptions/usage', payload)
  return response.data
}

export async function listSubscriptionEvents(): Promise<SubscriptionEvent[]> {
  const response = await api.get<SubscriptionEvent[]>('/api/subscriptions/events')
  return response.data
}

export async function createSubscriptionEvent(payload: {
  subscription_id: number
  event_type: string
  event_details?: Record<string, unknown>
}): Promise<SubscriptionEvent> {
  const response = await api.post<SubscriptionEvent>('/api/subscriptions/events', payload)
  return response.data
}

export async function listPaymentWebhooks(): Promise<PaymentWebhook[]> {
  const response = await api.get<PaymentWebhook[]>('/api/subscriptions/webhooks')
  return response.data
}

export async function createPaymentWebhook(payload: {
  provider_id: number
  event_type: string
  payload?: Record<string, unknown>
  processed?: boolean
  processed_at?: string
}): Promise<PaymentWebhook> {
  const response = await api.post<PaymentWebhook>('/api/subscriptions/webhooks', payload)
  return response.data
}

export async function listFeatures(): Promise<Feature[]> {
  const response = await api.get<Feature[]>('/api/subscriptions/features')
  return response.data
}

export async function createFeature(payload: {
  feature_code: string
  feature_name: string
  description?: string
}): Promise<Feature> {
  const response = await api.post<Feature>('/api/subscriptions/features', payload)
  return response.data
}

export async function listPlanFeatures(planId: number): Promise<Feature[]> {
  const response = await api.get<Feature[]>(`/api/subscriptions/plans/${planId}/features`)
  return response.data
}

export async function assignPlanFeatures(planId: number, feature_ids: number[]): Promise<{ message: string }> {
  const response = await api.put<{ message: string }>(`/api/subscriptions/plans/${planId}/features`, {
    feature_ids,
  })
  return response.data
}
