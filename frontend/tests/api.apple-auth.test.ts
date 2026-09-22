import { beforeEach, describe, expect, it, vi } from 'vitest'

const clients: Array<{
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  request: ReturnType<typeof vi.fn>
  defaults: { headers: { common: Record<string, string> } }
  interceptors: {
    request: { use: ReturnType<typeof vi.fn> }
    response: { use: ReturnType<typeof vi.fn> }
  }
}> = []

function createStorageMock(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear() {
      data.clear()
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null
    },
    key(index: number) {
      const keys = Array.from(data.keys())
      return keys[index] ?? null
    },
    removeItem(key: string) {
      data.delete(key)
    },
    setItem(key: string, value: string) {
      data.set(key, String(value))
    },
  }
}

vi.mock('axios', () => {
  const create = vi.fn(() => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      request: vi.fn(),
      defaults: { headers: { common: {} as Record<string, string> } },
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    clients.push(client)
    return client
  })

  return {
    default: {
      create,
      isAxiosError: (error: unknown) => Boolean(
        error && typeof error === 'object' && 'isAxiosError' in error
      ),
    },
    create,
  }
})

describe('loginWithApple', () => {
  beforeEach(() => {
    const localStorageMock = createStorageMock()
    const sessionStorageMock = createStorageMock()
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageMock,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: sessionStorageMock,
      configurable: true,
      writable: true,
    })
    clients.length = 0
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('maps gateway failures to a user-safe availability message', async () => {
    const apiModule = await import('../src/api')

    expect(apiModule.getErrorMessage({
      isAxiosError: true,
      response: {
        status: 502,
        statusText: 'Bad Gateway',
        data: '<html><body><h1>502 Bad Gateway</h1></body></html>',
      },
    }, 'Unable to sign in right now.')).toBe('Server is temporarily unavailable.')
  })

  it('starts password login without waiting for backend health probes', async () => {
    vi.stubEnv('VITE_API_URL', 'https://filscore-ai.quantech.international')
    vi.stubEnv('VITE_API_FALLBACK_URL', '')
    const apiModule = await import('../src/api')
    const healthCheckClient = clients[0]
    const authClient = clients[1]
    healthCheckClient.get
      .mockRejectedValueOnce(new Error('Render timed out'))
      .mockResolvedValueOnce({ status: 200 })
    authClient.post.mockResolvedValue({
      data: {
        access_token: 'fallback-access-token',
        refresh_token: 'fallback-refresh-token',
        user: {
          id: 11,
          username: 'fallback-user',
          email: 'fallback@example.com',
          role: 'admin',
          roles: ['admin'],
          permissions: [],
          is_active: true,
        },
      },
    })

    await apiModule.login({ username: 'fallback-user', password: 'not-a-real-password' })

    expect(healthCheckClient.get).not.toHaveBeenCalled()
    expect(authClient.post).toHaveBeenCalledWith('/api/auth/login', {
      username: 'fallback-user',
      password: 'not-a-real-password',
    }, {
      baseURL: 'https://filscore-ai.quantech.international',
      timeout: 4000,
      _loginProviderAttempt: true,
    })
  })

  it('caches only the working login provider URL after fast failover', async () => {
    vi.stubEnv('VITE_API_URL', 'https://fleetmanagement-dq9t.onrender.com')
    vi.stubEnv('VITE_API_FALLBACK_URL', 'https://filscore-ai.quantech.international')
    const apiModule = await import('../src/api')
    const authClient = clients[1]
    authClient.post
      .mockRejectedValueOnce(new Error('primary unavailable'))
      .mockResolvedValueOnce({
        data: {
          access_token: 'fallback-access-token',
          refresh_token: 'fallback-refresh-token',
          user: {
            id: 12,
            username: 'fallback-user',
            email: 'fallback@example.com',
            role: 'admin',
            roles: ['admin'],
            permissions: [],
            is_active: true,
          },
        },
      })

    await apiModule.login({ username: 'fallback-user', password: 'not-a-real-password' })

    expect(authClient.post).toHaveBeenNthCalledWith(2, '/api/auth/login', expect.anything(),
      expect.objectContaining({ baseURL: 'https://filscore-ai.quantech.international' }))
    expect(JSON.parse(window.localStorage.getItem('fms:auth:login-provider') || '{}')).toMatchObject({
      baseUrl: 'https://filscore-ai.quantech.international',
    })
    expect(window.localStorage.getItem('fms:auth:login-provider')).not.toContain('not-a-real-password')
  })

  it('retries the Google token exchange on Contabo after a Render network timeout', async () => {
    vi.stubEnv('VITE_API_URL', 'https://fleetmanagement-dq9t.onrender.com')
    vi.stubEnv('VITE_API_FALLBACK_URL', 'https://filscore-ai.quantech.international')
    await import('../src/api')
    const healthCheckClient = clients[0]
    const authClient = clients[1]
    const responseErrorHandler = authClient.interceptors.response.use.mock.calls[0][1] as (
      error: unknown,
    ) => Promise<unknown>
    healthCheckClient.get.mockResolvedValue({ status: 200 })
    authClient.request.mockResolvedValue({ data: { ok: true } })
    const failedRequest = {
      baseURL: 'https://fleetmanagement-dq9t.onrender.com',
      method: 'post',
      url: '/api/auth/google-token',
      data: '{"id_token":"google-token"}',
    }

    await responseErrorHandler({
      config: failedRequest,
      message: 'timeout of 12000ms exceeded',
    })

    expect(healthCheckClient.get).toHaveBeenCalledWith('/api/health', {
      baseURL: 'https://filscore-ai.quantech.international',
    })
    expect(authClient.request).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: 'https://filscore-ai.quantech.international',
      method: 'post',
      url: '/api/auth/google-token',
      _failoverRetry: true,
    }))
  })

  it('persists standard login tokens across an app reload', async () => {
    const apiModule = await import('../src/api')
    const authClient = clients[1]

    authClient.post.mockResolvedValue({
      data: {
        access_token: 'login-access-token',
        refresh_token: 'login-refresh-token',
        user: {
          id: 9,
          username: 'mobile-user',
          email: 'mobile@example.com',
          role: 'subscriber_borrower',
          roles: ['subscriber_borrower'],
          permissions: [],
          is_active: true,
          created_at: '2026-08-23T00:00:00Z',
          updated_at: '2026-08-23T00:00:00Z',
          last_login_at: null,
        },
      },
    })

    await apiModule.login({
      username: 'mobile-user',
      password: 'not-a-real-password',
      rememberMe: true,
    })

    expect(window.localStorage.getItem('auth_token')).toBe('login-access-token')
    expect(window.localStorage.getItem('refresh_token')).toBe('login-refresh-token')

    vi.resetModules()
    const reloadedApiModule = await import('../src/api')

    expect(reloadedApiModule.getAuthToken()).toBe('login-access-token')
    expect(reloadedApiModule.getRefreshToken()).toBe('login-refresh-token')
    expect(clients.at(-1)?.defaults.headers.common.Authorization).toBe('Bearer login-access-token')
  })

  it('keeps login tokens in session storage when remember me is not selected', async () => {
    const apiModule = await import('../src/api')
    const authClient = clients[1]

    authClient.post.mockResolvedValue({
      data: {
        access_token: 'session-access-token',
        refresh_token: 'session-refresh-token',
        user: {
          id: 10,
          username: 'session-user',
          email: 'session@example.com',
          role: 'subscriber_borrower',
          roles: ['subscriber_borrower'],
          permissions: [],
          is_active: true,
          created_at: '2026-08-23T00:00:00Z',
          updated_at: '2026-08-23T00:00:00Z',
          last_login_at: null,
        },
      },
    })

    await apiModule.login({ username: 'session-user', password: 'not-a-real-password' })

    expect(window.sessionStorage.getItem('auth_token')).toBe('session-access-token')
    expect(window.sessionStorage.getItem('refresh_token')).toBe('session-refresh-token')
    expect(window.localStorage.getItem('auth_token')).toBeNull()
    expect(window.localStorage.getItem('refresh_token')).toBeNull()
  })

  it('starts public PayMongo checkout without waiting for a health probe', async () => {
    const apiModule = await import('../src/api')
    const healthCheckClient = clients[0]
    const apiClient = clients[1]
    const checkout = {
      checkout_id: 'cs_test_123',
      checkout_url: 'https://checkout.paymongo.com/test',
    }
    apiClient.post.mockResolvedValue({ data: checkout })

    await expect(apiModule.createPublicTrialPayMongoCheckout({
      account_identifier: 'subscriber@example.com',
      plan: 'single',
    })).resolves.toEqual(checkout)

    expect(healthCheckClient.get).not.toHaveBeenCalled()
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/subscriptions/public/payments/paymongo/checkout',
      {
        account_identifier: 'subscriber@example.com',
        plan: 'single',
      },
    )
  })

  it('posts identity_token to apple-token endpoint and stores session tokens', async () => {
    const apiModule = await import('../src/api')

    const healthCheckClient = clients[0]
    const authClient = clients[1]

    healthCheckClient.get.mockResolvedValue({ status: 200 })
    authClient.post.mockResolvedValue({
      data: {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        user: {
          id: 7,
          username: 'appleuser',
          email: 'apple@example.com',
          role: 'subscriber_borrower',
          roles: ['subscriber_borrower'],
          permissions: [],
          is_active: true,
          created_at: '2026-07-10T00:00:00Z',
          updated_at: '2026-07-10T00:00:00Z',
          last_login_at: null,
        },
      },
    })

    const response = await apiModule.loginWithApple({
      idToken: 'apple-jwt-token',
      rememberMe: true,
    })

    expect(authClient.post).toHaveBeenCalledWith('/api/auth/apple-token', {
      identity_token: 'apple-jwt-token',
      id_token: 'apple-jwt-token',
      subscriber_type: undefined,
      lender_data_sharing_consent: undefined,
    }, {
      baseURL: 'https://filscore-ai.quantech.international',
      timeout: 4000,
      _loginProviderAttempt: true,
    })
    expect(response.token).toBe('access-token-123')
    expect(response.user.email).toBe('apple@example.com')
    expect(window.localStorage.getItem('auth_token')).toBe('access-token-123')
    expect(window.localStorage.getItem('refresh_token')).toBe('refresh-token-123')
    expect(window.sessionStorage.getItem('fms:auth:current-user')).toContain('apple@example.com')
  })

  it('reuses the latest logged-in user during normal browser navigation', async () => {
    window.localStorage.setItem('auth_token', 'cached-access-token')
    window.localStorage.setItem('refresh_token', 'cached-refresh-token')
    window.sessionStorage.setItem('fms:auth:current-user', JSON.stringify({
      accessToken: 'cached-access-token',
      user: {
        id: 8,
        username: 'cached-user',
        email: 'cached@example.com',
        role: 'subscriber_borrower',
        roles: ['subscriber_borrower'],
        permissions: [],
        isActive: true,
        createdAt: '2026-07-10T00:00:00Z',
        updatedAt: '2026-07-10T00:00:00Z',
        lastLoginAt: null,
      },
    }))

    const apiModule = await import('../src/api')
    const authClient = clients[1]

    const user = await apiModule.fetchCurrentUser()

    expect(user.email).toBe('cached@example.com')
    expect(authClient.get).not.toHaveBeenCalled()
  })

  it('fetches and replaces the current user after a browser refresh', async () => {
    window.localStorage.setItem('auth_token', 'cached-access-token')
    window.localStorage.setItem('refresh_token', 'cached-refresh-token')
    window.sessionStorage.setItem('fms:auth:current-user', JSON.stringify({
      accessToken: 'cached-access-token',
      user: {
        id: 8,
        username: 'cached-user',
        email: 'stale@example.com',
        role: 'subscriber_borrower',
        roles: ['subscriber_borrower'],
        permissions: [],
        isActive: true,
        createdAt: '2026-07-10T00:00:00Z',
        updatedAt: '2026-07-10T00:00:00Z',
        lastLoginAt: null,
      },
    }))
    vi.spyOn(window.performance, 'getEntriesByType').mockReturnValue([
      { type: 'reload' } as PerformanceNavigationTiming,
    ])

    const apiModule = await import('../src/api')
    const authClient = clients[1]
    authClient.get.mockResolvedValue({
      data: {
        user: {
          id: 8,
          username: 'cached-user',
          email: 'fresh@example.com',
          role: 'subscriber_borrower',
          roles: ['subscriber_borrower'],
          permissions: [],
          is_active: true,
          created_at: '2026-07-10T00:00:00Z',
          updated_at: '2026-07-30T00:00:00Z',
          last_login_at: '2026-07-30T00:00:00Z',
        },
      },
    })

    const user = await apiModule.fetchCurrentUser()

    expect(authClient.get).toHaveBeenCalledOnce()
    expect(authClient.get).toHaveBeenCalledWith('/api/auth/me')
    expect(user.email).toBe('fresh@example.com')
    expect(window.sessionStorage.getItem('fms:auth:current-user')).toContain('fresh@example.com')
  })
})
