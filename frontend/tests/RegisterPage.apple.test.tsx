import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreateFreeSubscription,
  mockListPublicSubscriptionPlans,
  mockNavigate,
  mockRegister,
  mockRequestAppleSignInToken,
  mockLoginWithApple,
} = vi.hoisted(() => ({
  mockCreateFreeSubscription: vi.fn(),
  mockListPublicSubscriptionPlans: vi.fn(),
  mockNavigate: vi.fn(),
  mockRegister: vi.fn(),
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

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <button type="button">Sign up with Google</button>,
}))

vi.mock('../src/api', () => ({
  createFreeSubscription: mockCreateFreeSubscription,
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
  listPublicSubscriptionPlans: mockListPublicSubscriptionPlans,
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginWithApple: mockLoginWithApple,
  register: mockRegister,
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
    mockNavigate.mockReset()
    mockCreateFreeSubscription.mockReset()
    mockCreateFreeSubscription.mockResolvedValue({})
    mockListPublicSubscriptionPlans.mockReset()
    mockListPublicSubscriptionPlans.mockResolvedValue([
      { id: 2, plan_code: 'SINGLE_PROFILE' },
    ])
    mockRegister.mockReset()
    mockRegister.mockResolvedValue({
      token: 'registration-access-token',
      refreshToken: 'registration-refresh-token',
      user: { id: 10, role: 'subscriber_borrower' },
    })
    mockRequestAppleSignInToken.mockReset()
    mockLoginWithApple.mockReset()
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      get length() { return values.size },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    })
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
    expect((multipleProfile as HTMLInputElement).disabled).toBe(true)
  })

  it('allows the Starter subscription plan to be selected', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    )

    const freePlan = screen.getByRole('radio', { name: /free\s*trial for 2 days/i })
    const starterPlan = screen.getByRole('radio', { name: /starter\s*php 160\.00 per month/i })

    expect((freePlan as HTMLInputElement).checked).toBe(true)
    expect((starterPlan as HTMLInputElement).checked).toBe(false)

    await userEvent.click(starterPlan)

    expect((freePlan as HTMLInputElement).checked).toBe(false)
    expect((starterPlan as HTMLInputElement).checked).toBe(true)
  })

  it('routes a paid registration to payment without activating the free trial', async () => {
    mockRequestAppleSignInToken.mockResolvedValue({ idToken: 'apple-identity-token-123' })
    mockLoginWithApple.mockResolvedValue({
      user: { id: 9, role: 'subscriber_borrower' },
    })
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    )

    const user = await completeAppleRegistrationChoices()
    await user.click(screen.getByRole('radio', { name: /starter\s*php 160\.00 per month/i }))
    await user.click(screen.getByRole('button', { name: /(continue with apple|sign with apple)/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/subscription-payment?planId=2', { replace: true })
    })
    expect(mockCreateFreeSubscription).not.toHaveBeenCalled()
  })

  it('orders Apple before Google and reveals credential fields from Other Email', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    )

    const appleLabel = screen.getByText('Apple Account')
    const googleLabel = screen.getByText('Google Account')
    const otherEmailButton = screen.getByRole('button', { name: /other email/i })

    expect(appleLabel.compareDocumentPosition(googleLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByLabelText('Username')).toBeNull()
    expect(screen.queryByLabelText('Email')).toBeNull()
    expect(screen.queryByLabelText('Cellphone Number')).toBeNull()
    expect(screen.queryByLabelText('Password')).toBeNull()
    expect(screen.queryByLabelText('Confirm password')).toBeNull()

    await userEvent.click(otherEmailButton)

    expect(screen.getByLabelText('Username')).toBeTruthy()
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Cellphone Number')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByLabelText('Confirm password')).toBeTruthy()
    expect(screen.getByRole('button', { name: /create account/i })).toBeTruthy()
  })

  it('uses the authenticated registration response without a second password login', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    const consentBoxes = screen.getAllByRole('checkbox')
    await user.click(consentBoxes[0])
    await user.click(consentBoxes[1])
    await user.click(screen.getByRole('button', { name: /other email/i }))
    await user.type(screen.getByLabelText('Username'), 'new-user')
    await user.type(screen.getByLabelText('Email'), 'new-user@example.com')
    await user.type(screen.getByLabelText('Cellphone Number'), '09171234567')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        username: 'new-user',
        email: 'new-user@example.com',
        password: 'password123',
        subscriberType: 'borrower',
        lenderDataSharingConsent: false,
      })
      expect(mockNavigate).toHaveBeenCalledWith('/financial-health-summary', { replace: true })
    })
  })

  it('redirects expired trial users to the trial reminder page', async () => {
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

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/trial-expired?source=register-apple')
    })
  })

  it('exchanges the Apple token after all registration choices are completed', async () => {
    window.localStorage.setItem('fms:journey:minimized', '1')
    window.localStorage.setItem('fms:journey:do-not-show', '1')
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
        redirectURI: `${window.location.origin}/auth/apple/callback`,
      })
    })
    expect(mockLoginWithApple).toHaveBeenCalledWith({
      idToken: 'apple-identity-token-123',
      subscriberType: 'borrower',
      lenderDataSharingConsent: true,
    })
    expect(window.localStorage.getItem('fms:journey:minimized')).toBeNull()
    expect(window.localStorage.getItem('fms:journey:do-not-show')).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/financial-health-summary', { replace: true })
  })
})
