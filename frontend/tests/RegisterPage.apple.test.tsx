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

vi.mock('../src/api', () => ({
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginWithApple: mockLoginWithApple,
  register: vi.fn(),
}))

import RegisterPage from '../src/pages/auth/RegisterPage'

async function completeAppleRegistrationChoices() {
  const user = userEvent.setup()
  const termsAndPrivacy = screen.getAllByRole('checkbox')

  await user.click(termsAndPrivacy[0])
  await user.click(termsAndPrivacy[1])
  await user.click(screen.getByRole('radio', { name: /subscriber single application/i }))
  await user.click(screen.getByRole('radio', { name: /okay to share information/i }))

  return user
}

describe('RegisterPage Apple sign-up', () => {
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
    mockNavigate.mockReset()
    mockRequestAppleSignInToken.mockReset()
    mockLoginWithApple.mockReset()
  })

  it('shows Apple validation feedback beside the Apple button', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    )

    const appleButton = screen.getByRole('button', { name: /continue with apple/i })
    await userEvent.click(appleButton)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Select borrower or lender before continuing with Apple.')
    expect(appleButton.closest('.auth-panel')?.contains(alert)).toBe(true)
    expect(mockRequestAppleSignInToken).not.toHaveBeenCalled()
  })

  it('exchanges the Apple token after all registration choices are completed', async () => {
    mockRequestAppleSignInToken.mockResolvedValue({ idToken: 'apple-identity-token-123' })
    mockLoginWithApple.mockResolvedValue({
      user: {
        role: 'subscriber_borrower',
      },
    })

    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    )

    const user = await completeAppleRegistrationChoices()
    await user.click(screen.getByRole('button', { name: /continue with apple/i }))

    await waitFor(() => {
      expect(mockRequestAppleSignInToken).toHaveBeenCalledWith({
        clientId: 'com.quantech.filscore.web',
        redirectURI: 'https://fleet.quantech.international/api/auth/apple/callback',
      })
    })
    expect(mockLoginWithApple).toHaveBeenCalledWith({
      idToken: 'apple-identity-token-123',
      subscriberType: 'borrower',
      lenderDataSharingConsent: true,
    })
    expect(mockNavigate).toHaveBeenCalledWith('/lending-scorecard', { replace: true })
  })
})
