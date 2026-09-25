import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetchCurrentUser, mockGetAuthToken, mockGetMySubscription, mockLogout, mockPrepareAutosavesForFastLogout, mockSynchronizeBuildProfileDraft } = vi.hoisted(() => ({
  mockFetchCurrentUser: vi.fn(),
  mockGetAuthToken: vi.fn(),
  mockGetMySubscription: vi.fn(),
  mockLogout: vi.fn(),
  mockPrepareAutosavesForFastLogout: vi.fn(),
  mockSynchronizeBuildProfileDraft: vi.fn(),
}))

vi.mock('../src/api', () => ({
  fetchCurrentUser: mockFetchCurrentUser,
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
  getAuthToken: mockGetAuthToken,
  getMySubscription: mockGetMySubscription,
  listPublicSubscriptionPlans: vi.fn().mockResolvedValue([]),
  logout: mockLogout,
}))

vi.mock('../src/autosave/useAutosaveDraft', () => ({
  prepareAutosavesForFastLogout: mockPrepareAutosavesForFastLogout,
}))
vi.mock('../src/autosave/buildProfileSync', () => ({
  synchronizeBuildProfileDraft: mockSynchronizeBuildProfileDraft,
}))

vi.mock('../src/components/AutosaveStatus', () => ({ default: () => null }))
vi.mock('../src/components/ai/FloatingChatbot', () => ({ default: () => null }))
vi.mock('../src/pages/auth/LoginPage', () => ({
  default: () => <h1>Login Page</h1>,
}))
vi.mock('../src/pages/scoring/LendingScorecard', () => ({
  default: () => <h1>Authenticated Lending Scorecard</h1>,
}))

import App from '../src/App'

function createStorageMock(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => data.delete(key),
    setItem: (key, value) => data.set(key, String(value)),
  }
}

describe('App account menu accordions', () => {
  beforeEach(() => {
    mockGetAuthToken.mockReturnValue('access-token')
    mockFetchCurrentUser.mockResolvedValue({
      id: 1,
      username: 'admin-user',
      email: 'admin@example.com',
      role: 'admin',
      roles: ['admin'],
      permissions: ['manage:system'],
      isActive: true,
      subscriptionId: null,
      createdAt: '2026-08-09T00:00:00Z',
      updatedAt: '2026-08-09T00:00:00Z',
      lastLoginAt: null,
    })
    mockLogout.mockResolvedValue(undefined)
    mockGetMySubscription.mockResolvedValue({
      status: 'ACTIVE',
      subscription_type: 'PAID',
    })
    mockPrepareAutosavesForFastLogout.mockResolvedValue(undefined)
    mockSynchronizeBuildProfileDraft.mockResolvedValue(undefined)
    Object.defineProperty(window, 'localStorage', {
      value: createStorageMock(),
      configurable: true,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('collapses Administration and Profile while keeping Sign Out visible', async () => {
    render(
      <MemoryRouter initialEntries={['/menu-test']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Toggle account and application menu' }))

    const billManagerLink = screen.getByRole('link', { name: 'Bill Manager' })
    const reportsLink = screen.getByRole('link', { name: 'Reports & Statements' })
    const financialDecisionsLink = screen.getByRole('link', { name: 'Financial Decisions' })
    expect(reportsLink.getAttribute('href')).toBe('/reports-statements')
    expect(billManagerLink.nextElementSibling).toBe(reportsLink)
    expect(reportsLink.nextElementSibling).toBe(financialDecisionsLink)

    const administrationToggle = screen.getByRole('button', { name: 'ADMINISTRATION' })
    expect(administrationToggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('link', { name: 'Calculation Models' })).toBeTruthy()

    fireEvent.click(administrationToggle)
    expect(administrationToggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link', { name: 'Calculation Models' })).toBeNull()

    const profileToggle = screen.getByRole('button', { name: 'PROFILE' })
    expect(screen.getByRole('link', { name: 'Account Settings' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeTruthy()

    fireEvent.click(profileToggle)
    expect(profileToggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link', { name: 'Account Settings' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Billing' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Support' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeTruthy()
  })

  it('navigates to login while logout work remains pending', async () => {
    mockPrepareAutosavesForFastLogout.mockReturnValue(new Promise<void>(() => undefined))
    mockLogout.mockReturnValue(new Promise<void>(() => undefined))

    render(
      <MemoryRouter initialEntries={['/menu-test']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Toggle account and application menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }))

    expect(mockPrepareAutosavesForFastLogout).toHaveBeenCalledTimes(1)
    expect(mockLogout).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('heading', { name: 'Login Page' })).toBeTruthy()
  })

  it('renders the fees disclosure without authentication', async () => {
    mockGetAuthToken.mockReturnValue(null)

    render(
      <MemoryRouter initialEntries={['/fees']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Subscription Fees Disclosure' })).toBeTruthy()
  })

  it('mounts authenticated content while profile synchronization runs in the background', async () => {
    mockSynchronizeBuildProfileDraft.mockReturnValue(new Promise<void>(() => undefined))

    render(
      <MemoryRouter initialEntries={['/menu-test']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: 'Toggle account and application menu' })).toBeTruthy()
    expect(mockSynchronizeBuildProfileDraft).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Synchronizing profile...')).toBeNull()
  })

  it('shows registration actions for unauthenticated Lending Scorecard access', async () => {
    mockGetAuthToken.mockReturnValue(null)

    render(
      <MemoryRouter initialEntries={['/lending-scorecard']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Register to access Credit Health Scorecard' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Register Now' }).getAttribute('href')).toBe('/register')
    expect(mockGetMySubscription).not.toHaveBeenCalled()
  })

  it.each([
    {
      username: 'multi-role-admin',
      role: 'subscriber_borrower',
      roles: ['subscriber_borrower', 'admin'],
    },
    {
      username: 'admin123',
      role: 'subscriber_borrower',
      roles: ['subscriber_borrower'],
    },
  ])('opens Lending Scorecard for effective Admin $username', async ({ username, role, roles }) => {
    mockFetchCurrentUser.mockResolvedValue({
      id: 4,
      username,
      email: `${username}@example.com`,
      role,
      roles,
      permissions: [],
      isActive: true,
      subscriptionId: null,
      createdAt: '2026-09-17T00:00:00Z',
      updatedAt: '2026-09-17T00:00:00Z',
      lastLoginAt: null,
    })

    render(
      <MemoryRouter initialEntries={['/lending-scorecard']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Authenticated Lending Scorecard' })).toBeTruthy()
    expect(mockGetMySubscription).not.toHaveBeenCalled()
  })

  it('shows monthly subscription action for a trial subscriber', async () => {
    mockFetchCurrentUser.mockResolvedValue({
      id: 2,
      username: 'trial-user',
      email: 'trial@example.com',
      role: 'subscriber_borrower',
      roles: ['subscriber_borrower'],
      permissions: [],
      isActive: true,
      subscriptionId: 2,
      createdAt: '2026-09-17T00:00:00Z',
      updatedAt: '2026-09-17T00:00:00Z',
      lastLoginAt: null,
    })
    mockGetMySubscription.mockResolvedValue({
      status: 'TRIAL',
      subscription_type: 'TRIAL',
    })

    render(
      <MemoryRouter initialEntries={['/lending-scorecard']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Subscribe to access Lending Scorecard' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View Monthly Plans' }).getAttribute('href')).toBe('/subscription-payment')
    expect(screen.queryByRole('heading', { name: 'Authenticated Lending Scorecard' })).toBeNull()
  })

  it('opens Lending Scorecard for an active paid subscriber', async () => {
    mockFetchCurrentUser.mockResolvedValue({
      id: 3,
      username: 'paid-user',
      email: 'paid@example.com',
      role: 'subscriber_borrower',
      roles: ['subscriber_borrower'],
      permissions: [],
      isActive: true,
      subscriptionId: 3,
      createdAt: '2026-09-17T00:00:00Z',
      updatedAt: '2026-09-17T00:00:00Z',
      lastLoginAt: null,
    })

    render(
      <MemoryRouter initialEntries={['/lending-scorecard']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Authenticated Lending Scorecard' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Subscribe to access Lending Scorecard' })).toBeNull()
  })
})
