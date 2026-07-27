import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockNavigate, mockRequestAppleSignInToken, mockLoginWithApple, mockLoginWithGoogle } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRequestAppleSignInToken: vi.fn(),
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
  login: vi.fn(),
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
    vi.stubEnv(
      'VITE_APPLE_REDIRECT_URI',
      'https://fleetmanagement-flame.vercel.app/backend/api/auth/apple/callback'
    )
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
    expect(screen.queryByRole('button', { name: 'Other Email' })).toBeNull()
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
        redirectURI: 'https://fleetmanagement-flame.vercel.app/backend/api/auth/apple/callback',
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
