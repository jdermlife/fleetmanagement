import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import LoginPage from '../src/pages/auth/LoginPage'

describe('LoginPage registration routing', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    mockNavigate.mockReset()
  })

  it.each([
    ['Continue with Apple', 'apple'],
    ['Continue with Google', 'google'],
    ['Other Email', 'email'],
  ] as const)('routes %s to registration', async (buttonName, registrationMethod) => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: buttonName }))

    expect(mockNavigate).toHaveBeenCalledWith('/register', {
      state: { registrationMethod },
    })
  })

  it('links to the public service and dispute policies', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Returns & Refunds' }).getAttribute('href')).toBe('/return-refund-policy')
    expect(screen.getByRole('link', { name: 'Customer Service' }).getAttribute('href')).toBe('/customer-service')
    expect(screen.getByRole('link', { name: 'Dispute Resolution' }).getAttribute('href')).toBe('/dispute-resolution')
  })
})
