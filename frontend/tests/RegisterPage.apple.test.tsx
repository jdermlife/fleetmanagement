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
  createFreeSubscription: vi.fn().mockResolvedValue({}),
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginWithApple: mockLoginWithApple,
  register: vi.fn(),
}))

import RegisterPage from '../src/pages/auth/RegisterPage'

async function completeAppleRegistrationChoices() {
  const user = userEvent.setup()
  const consentBoxes = screen.getAllByRole('checkbox')

  await user.click(consentBoxes[0])
  await user.click(consentBoxes[1])
  await user.click(screen.getByRole('radio', { name: /subscriber single profile/i }))
  await user.click(screen.getByRole('checkbox', { name: /i agree to receive marketing materials/i }))

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
      'https://fleetmanagement-flame.vercel.app/backend/api/auth/apple/callback'
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

    const appleButton = screen.getByRole('button', { name: /(continue with apple|sign with apple)/i })
    await userEvent.click(appleButton)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Review and accept the terms and privacy disclosures to continue.')
    expect(appleButton.closest('.auth-panel')?.contains(alert)).toBe(true)
    expect(mockRequestAppleSignInToken).not.toHaveBeenCalled()
  })

  it('defaults subscriber type to Subscriber Single Profile', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    )

    const singleProfile = screen.getByRole('radio', { name: /subscriber single profile/i })
    const multipleProfile = screen.getByRole('radio', { name: /subscriber multiple profile/i })

    expect((singleProfile as HTMLInputElement).checked).toBe(true)
    expect((multipleProfile as HTMLInputElement).checked).toBe(false)
  })

  it('shows backend Apple 403 detail message', async () => {
    mockRequestAppleSignInToken.mockResolvedValue({ idToken: 'apple-identity-token-123' })
    mockLoginWithApple.mockRejectedValue({
      response: {
        status: 403,
        data: {
          detail: 'Account expired due to non-payment. Complete payment to reactivate access.',
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    )

    const user = await completeAppleRegistrationChoices()
    await user.click(screen.getByRole('button', { name: /(continue with apple|sign with apple)/i }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Account expired due to non-payment. Complete payment to reactivate access.')
  })

  it('exchanges the Apple token after all registration choices are completed', async () => {
    mockRequestAppleSignInToken.mockResolvedValue({ idToken: 'apple-identity-token-123' })
    mockLoginWithApple.mockResolvedValue({
      user: {
        id: 9,
        role: 'subscriber_borrower',
      },
    })

    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    )

    const user = await completeAppleRegistrationChoices()
    await user.click(screen.getByRole('button', { name: /(continue with apple|sign with apple)/i }))

    await waitFor(() => {
      expect(mockRequestAppleSignInToken).toHaveBeenCalledWith({
        clientId: 'com.quantech.filscore.web',
        redirectURI: 'https://fleetmanagement-flame.vercel.app/backend/api/auth/apple/callback',
      })
    })
    expect(mockLoginWithApple).toHaveBeenCalledWith({
      idToken: 'apple-identity-token-123',
      subscriberType: 'borrower',
      lenderDataSharingConsent: true,
    })
    expect(mockNavigate).toHaveBeenCalledWith('/financial-health-summary', { replace: true })
  })
})
