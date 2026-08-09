import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetchCurrentUser, mockLogout, mockPrepareAutosavesForLogout } = vi.hoisted(() => ({
  mockFetchCurrentUser: vi.fn(),
  mockLogout: vi.fn(),
  mockPrepareAutosavesForLogout: vi.fn(),
}))

vi.mock('../src/api', () => ({
  fetchCurrentUser: mockFetchCurrentUser,
  getAuthToken: () => 'access-token',
  logout: mockLogout,
}))

vi.mock('../src/autosave/useAutosaveDraft', () => ({
  prepareAutosavesForLogout: mockPrepareAutosavesForLogout,
}))

vi.mock('../src/components/AutosaveStatus', () => ({ default: () => null }))
vi.mock('../src/components/ai/FloatingChatbot', () => ({ default: () => null }))

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
    mockPrepareAutosavesForLogout.mockResolvedValue(undefined)
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
})
