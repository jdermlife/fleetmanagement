import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockNavigate, mockRequestAppleSignInToken, mockLoginWithApple } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRequestAppleSignInToken: vi.fn(),
  mockLoginWithApple: vi.fn(),
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
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
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
    vi.stubEnv('VITE_APPLE_CLIENT_ID', 'com.quantech.filscore.web')
    vi.stubEnv(
      'VITE_APPLE_REDIRECT_URI',
      'https://fleet.quantech.international/api/auth/apple/callback'
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
  })

  it('clicking Continue with Apple requests token, exchanges identity token, and redirects to dashboard', async () => {
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
        redirectURI: 'https://fleet.quantech.international/api/auth/apple/callback',
      })
    })

    expect(mockLoginWithApple).toHaveBeenCalledWith({
      idToken: 'apple-identity-token-123',
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows first-time Apple guidance message when backend requires account type selection', async () => {
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

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(
      await screen.findByText(
        'For first-time Apple users, please use Create Account to select account type and preferences.'
      )
    ).toBeTruthy()
  })
})
