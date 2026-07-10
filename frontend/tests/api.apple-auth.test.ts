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
      isAxiosError: () => false,
    },
    create,
  }
})

describe('loginWithApple', () => {
  beforeEach(() => {
    const storageMock = createStorageMock()
    Object.defineProperty(window, 'localStorage', {
      value: storageMock,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(globalThis, 'localStorage', {
      value: storageMock,
      configurable: true,
      writable: true,
    })
    clients.length = 0
    vi.resetModules()
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
    })

    expect(authClient.post).toHaveBeenCalledWith('/api/auth/apple-token', {
      identity_token: 'apple-jwt-token',
      id_token: 'apple-jwt-token',
      subscriber_type: undefined,
      lender_data_sharing_consent: undefined,
    })
    expect(response.token).toBe('access-token-123')
    expect(response.user.email).toBe('apple@example.com')
    expect(window.localStorage.getItem('auth_token')).toBe('access-token-123')
    expect(window.localStorage.getItem('refresh_token')).toBe('refresh-token-123')
  })
})
