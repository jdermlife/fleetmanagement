import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetchCurrentUser, mockListPublicSubscriptionPlans } = vi.hoisted(() => ({
  mockFetchCurrentUser: vi.fn(),
  mockListPublicSubscriptionPlans: vi.fn(),
}))

vi.mock('../src/api', () => ({
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
  fetchCurrentUser: mockFetchCurrentUser,
  getAuthToken: () => 'access-token',
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  listPublicSubscriptionPlans: mockListPublicSubscriptionPlans,
  logout: vi.fn(),
  updateAccountPreferences: vi.fn(),
}))

vi.mock('../src/autosave/useAutosaveDraft', () => ({
  prepareAutosavesForLogout: vi.fn(),
}))

import AccountSettingsPage from '../src/pages/auth/AccountSettingsPage'

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
      return data.get(key) ?? null
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null
    },
    removeItem(key: string) {
      data.delete(key)
    },
    setItem(key: string, value: string) {
      data.set(key, String(value))
    },
  }
}

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    mockFetchCurrentUser.mockReset()
    mockListPublicSubscriptionPlans.mockReset()
    mockFetchCurrentUser.mockResolvedValue({
      id: 42,
      username: 'signed-in-user',
      email: 'user@example.com',
      role: 'subscriber_borrower',
      roles: ['subscriber_borrower'],
      permissions: [],
      isActive: true,
      subscriptionId: 7,
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
      lastLoginAt: null,
    })
    mockListPublicSubscriptionPlans.mockRejectedValue(new Error('Unable to load plans'))

    Object.defineProperty(window, 'localStorage', {
      value: createStorageMock(),
      configurable: true,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the authenticated account when subscription plans are unavailable', async () => {
    render(
      <MemoryRouter initialEntries={['/account']}>
        <AccountSettingsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('signed-in-user')).toBeTruthy()
    expect(screen.getByText('user@example.com')).toBeTruthy()
    expect(screen.queryByText('Sign in to view your account details, change your password, or manage your access.')).toBeNull()
    expect(screen.queryByText('Unable to load plans')).toBeNull()
    expect(screen.getByRole('link', { name: 'Subscription Payment' }).getAttribute('href')).toBe('/subscription-payment')
  })

  it('opens Subscription Payment with the suggested upgrade for a subscriber', async () => {
    mockListPublicSubscriptionPlans.mockResolvedValue([
      {
        id: 7,
        plan_code: 'BASIC',
        plan_name: 'Basic',
        monthly_price: 100,
        currency: 'PHP',
        support_level: 'STANDARD',
      },
      {
        id: 8,
        plan_code: 'PLUS',
        plan_name: 'Plus',
        monthly_price: 200,
        currency: 'PHP',
        support_level: 'PRIORITY',
      },
    ])

    render(
      <MemoryRouter initialEntries={['/account']}>
        <AccountSettingsPage />
      </MemoryRouter>,
    )

    const paymentLink = await screen.findByRole('link', { name: 'Subscription Payment' })
    expect(paymentLink.getAttribute('href')).toBe('/subscription-payment?planId=8')
    expect(screen.getByText(/for Plus/)).toBeTruthy()
  })

  it('restores all welcome pop-ups without clearing unrelated settings', async () => {
    const journeyKeys = [
      'fms:journey:minimized',
      'fms:journey:do-not-show',
      'fms:credit-health-journey:minimized',
      'fms:credit-health-journey:do-not-show',
      'fms:net-worth-journey:minimized',
      'fms:net-worth-journey:do-not-show',
    ]
    journeyKeys.forEach((key) => window.localStorage.setItem(key, '1'))
    window.localStorage.setItem('fms:theme', 'civic')

    render(
      <MemoryRouter initialEntries={['/account']}>
        <AccountSettingsPage />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Restore welcome pop-ups' }))

    journeyKeys.forEach((key) => expect(window.localStorage.getItem(key)).toBeNull())
    expect(window.localStorage.getItem('fms:theme')).toBe('civic')
    expect(screen.getByRole('status').textContent).toContain('Welcome pop-ups restored')
  })
})
