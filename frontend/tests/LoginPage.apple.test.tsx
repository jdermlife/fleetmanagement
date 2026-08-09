import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockNavigate, mockRequestAppleSignInToken, mockLogin, mockLoginWithApple, mockLoginWithGoogle } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRequestAppleSignInToken: vi.fn(),
  mockLogin: vi.fn(),
  mockLoginWithApple: vi.fn(),
  mockLoginWithGoogle: vi.fn(),
}))

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess }: { onSuccess: (response: { credential?: string }) => void }) => (
    <button type="button" onClick={() => onSuccess({ credential: 'google-identity-token-123' })}>
      Continue with Google
    </button>
  ),
}))

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess?: (token: string) => void }) => (
    <button type="button" onClick={() => onSuccess?.('turnstile-token-123')}>
      Complete security verification
    </button>
  ),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../src/appleAuth', () => ({
  requestAppleSignInToken: mockRequestAppleSignInToken,
}))

vi.mock('axios', () => ({
  default: {
    isAxiosError: (error: unknown) => {
      return Boolean(error && typeof error === 'object' && 'isAxiosError' in error)
    },
  },
}))

vi.mock('../src/api', () => ({
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
  getMySubscription: vi.fn().mockResolvedValue({ status: 'ACTIVE' }),
  login: mockLogin,
  loginWithGoogle: mockLoginWithGoogle,
  loginWithApple: mockLoginWithApple,
}))

import LoginPage from '../src/pages/auth/LoginPage'

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

describe('LoginPage Apple sign-in', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-client-id')
    vi.stubEnv('VITE_APPLE_CLIENT_ID', 'com.quantech.filscore.web')
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'turnstile-site-key')
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
    mockNavigate.mockReset()
    mockRequestAppleSignInToken.mockReset()
    mockLogin.mockReset()
    mockLoginWithApple.mockReset()
    mockLoginWithGoogle.mockReset()
  })

  it('reveals email and password login only after Other Email is selected', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    )

    expect(screen.queryByPlaceholderText('Email or username')).toBeNull()
    expect(screen.queryByPlaceholderText('Password')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Log In' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Other Email' }))

    expect(screen.getByPlaceholderText('Email or username')).toBeTruthy()
    expect(screen.getByPlaceholderText('Password')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Log In' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Log In' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Complete security verification' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Other Email' })).toBeNull()
  })

  it('links to the public service and dispute policies from the login page', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Returns & Refunds' }).getAttribute('href')).toBe('/return-refund-policy')
    expect(screen.getByRole('link', { name: 'Customer Service' }).getAttribute('href')).toBe('/customer-service')
    expect(screen.getByRole('link', { name: 'Dispute Resolution' }).getAttribute('href')).toBe('/dispute-resolution')
  })

  it('navigates immediately after email login succeeds', async () => {
    mockLogin.mockResolvedValue({
      user: {
        id: 8,
        username: 'email-user',
        email: 'email-user@example.com',
        role: 'subscriber_borrower',
        roles: ['subscriber_borrower'],
        permissions: [],
        isActive: true,
        createdAt: '2026-07-10T00:00:00Z',
        updatedAt: '2026-07-10T00:00:00Z',
        lastLoginAt: null,
      },
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Other Email' }))
    await user.type(screen.getByPlaceholderText('Email or username'), 'email-user@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Complete security verification' }))
    await user.click(screen.getByRole('button', { name: 'Log In' }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'email-user@example.com',
        password: 'password123',
        turnstileToken: 'turnstile-token-123',
      })
      expect(mockNavigate).toHaveBeenCalledWith('/financial-health-summary')
    })
  })

  it('moves an email account to registration only after login reports that it is missing', async () => {
    mockLogin.mockRejectedValue({
      response: {
        status: 404,
        data: {
          detail: 'Account not found. Continue to registration.',
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Other Email' }))
    await user.type(screen.getByPlaceholderText('Email or username'), 'new-user@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Complete security verification' }))
    await user.click(screen.getByRole('button', { name: 'Log In' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/register', {
        replace: true,
        state: {
          registrationMethod: 'email',
          email: 'new-user@example.com',
        },
      })
    })
  })

  it('shows a signing-in overlay while email authentication is pending and closes it on failure', async () => {
    let rejectLogin: (reason?: unknown) => void = () => undefined
    mockLogin.mockImplementation(() => new Promise((_resolve, reject) => {
      rejectLogin = reject
    }))

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Other Email' }))
    await user.type(screen.getByPlaceholderText('Email or username'), 'email-user@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'incorrect-password')
    await user.click(screen.getByRole('button', { name: 'Complete security verification' }))
    await user.click(screen.getByRole('button', { name: 'Log In' }))

    expect(screen.getByRole('dialog', { name: 'Signing you in' })).toBeTruthy()

    rejectLogin(new Error('Invalid credentials'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Signing you in' })).toBeNull()
      expect(screen.getByText('Unable to sign in right now.')).toBeTruthy()
    })
  })

  it('clicking Continue with Apple requests token, exchanges identity token, and redirects to financial health summary', async () => {
    mockRequestAppleSignInToken.mockResolvedValue({
      idToken: 'apple-identity-token-123',
    })
    mockLoginWithApple.mockResolvedValue({
      token: 'access-token-xyz',
      refreshToken: 'refresh-token-xyz',
      user: {
        id: 9,
        username: 'apple-user',
        email: 'apple-user@example.com',
        role: 'subscriber_lender',
        roles: ['subscriber_lender'],
        permissions: [],
        isActive: true,
        createdAt: '2026-07-10T00:00:00Z',
        updatedAt: '2026-07-10T00:00:00Z',
        lastLoginAt: null,
      },
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /continue with apple/i }))

    await waitFor(() => {
      expect(mockRequestAppleSignInToken).toHaveBeenCalledWith({
        clientId: 'com.quantech.filscore.web',
        redirectURI: `${window.location.origin}/auth/apple/callback`,
      })
    })

    expect(mockLoginWithApple).toHaveBeenCalledWith({
      idToken: 'apple-identity-token-123',
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/financial-health-summary')
    })
  })

  it('moves first-time Apple users to registration when account type selection is required', async () => {
    mockRequestAppleSignInToken.mockResolvedValue({
      idToken: 'apple-identity-token-123',
    })
    mockLoginWithApple.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          detail: 'Select borrower or lender for first-time Apple sign-in',
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /continue with apple/i }))

    await waitFor(() => {
      expect(mockRequestAppleSignInToken).toHaveBeenCalledTimes(1)
      expect(mockLoginWithApple).toHaveBeenCalledWith({
        idToken: 'apple-identity-token-123',
      })
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/register', {
        replace: true,
        state: { socialProvider: 'apple' },
      })
    })
  })

  it('moves first-time Google users to registration when account type selection is required', async () => {
    mockLoginWithGoogle.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          detail: 'Select borrower or lender for first-time Google sign-in',
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() => {
      expect(mockLoginWithGoogle).toHaveBeenCalledWith({
        idToken: 'google-identity-token-123',
      })
      expect(mockNavigate).toHaveBeenCalledWith('/register', {
        replace: true,
        state: { socialProvider: 'google' },
      })
    })
  })

  it('redirects expired trial users to the trial reminder page', async () => {
    mockRequestAppleSignInToken.mockResolvedValue({
      idToken: 'apple-identity-token-123',
    })
    mockLoginWithApple.mockRejectedValue({
      response: {
        status: 403,
        data: {
          detail: 'Account expired due to non-payment. Complete payment to reactivate access.',
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /continue with apple/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/trial-expired?source=apple')
    })
  })
})
