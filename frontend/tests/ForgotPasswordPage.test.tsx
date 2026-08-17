import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequestPasswordReset } = vi.hoisted(() => ({
  mockRequestPasswordReset: vi.fn(),
}))

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess?: (token: string) => void }) => (
    <button type="button" onClick={() => onSuccess?.('turnstile-token-123')}>
      Complete security verification
    </button>
  ),
}))

vi.mock('../src/api', () => ({
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
  requestPasswordReset: mockRequestPasswordReset,
}))

import ForgotPasswordPage from '../src/pages/auth/ForgotPasswordPage'

describe('ForgotPasswordPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'turnstile-site-key')
    mockRequestPasswordReset.mockReset()
    mockRequestPasswordReset.mockResolvedValue({ message: 'Reset email sent.' })
  })

  it('requires Turnstile and sends its token with the reset request', async () => {
    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <ForgotPasswordPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    const submitButton = screen.getByRole('button', { name: 'Request Reset' }) as HTMLButtonElement
    expect(submitButton.disabled).toBe(true)

    await user.type(screen.getByLabelText('Username or email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Complete security verification' }))
    expect(submitButton.disabled).toBe(false)
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith(
        'user@example.com',
        'turnstile-token-123',
      )
    })
  })
})