import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetchCurrentUser, mockListSubscriptionPlans } = vi.hoisted(() => ({
  mockFetchCurrentUser: vi.fn(),
  mockListSubscriptionPlans: vi.fn(),
}))

vi.mock('../src/api', () => ({
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
  fetchCurrentUser: mockFetchCurrentUser,
  getAuthToken: () => 'access-token',
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  listSubscriptionPlans: mockListSubscriptionPlans,
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
    Object.defineProperty(window, 'localStorage', {
      value: createStorageMock(),
      configurable: true,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the authenticated account when subscription plans are unavailable', async () => {
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
    mockListSubscriptionPlans.mockRejectedValue(new Error('Insufficient permissions'))

    render(
      <MemoryRouter initialEntries={['/account']}>
        <AccountSettingsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('signed-in-user')).toBeTruthy()
    expect(screen.getByText('user@example.com')).toBeTruthy()
    expect(screen.queryByText('Sign in to view your account details, change your password, or manage your access.')).toBeNull()
    expect(screen.queryByText('Insufficient permissions')).toBeNull()
  })
})
