import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockFetchCurrentUser,
  mockDeleteAccount,
  mockListPublicSubscriptionPlans,
  mockListSubscriptionPayments,
  mockLogout,
  mockPrepareAutosavesForLogout,
} = vi.hoisted(() => ({
  mockFetchCurrentUser: vi.fn(),
  mockDeleteAccount: vi.fn(),
  mockListPublicSubscriptionPlans: vi.fn(),
  mockListSubscriptionPayments: vi.fn(),
  mockLogout: vi.fn(),
  mockPrepareAutosavesForLogout: vi.fn(),
}))

vi.mock('../src/api', () => ({
  changePassword: vi.fn(),
  deleteAccount: mockDeleteAccount,
  fetchCurrentUser: mockFetchCurrentUser,
  getAuthToken: () => 'access-token',
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  listPublicSubscriptionPlans: mockListPublicSubscriptionPlans,
  listSubscriptionPayments: mockListSubscriptionPayments,
  logout: mockLogout,
  updateAccountPreferences: vi.fn(),
}))

vi.mock('../src/autosave/useAutosaveDraft', () => ({
  prepareAutosavesForLogout: mockPrepareAutosavesForLogout,
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
    mockDeleteAccount.mockReset()
    mockListPublicSubscriptionPlans.mockReset()
    mockListSubscriptionPayments.mockReset()
    mockLogout.mockReset()
    mockPrepareAutosavesForLogout.mockReset()
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
    mockListSubscriptionPayments.mockResolvedValue([])
    mockLogout.mockResolvedValue(undefined)
    mockPrepareAutosavesForLogout.mockResolvedValue(undefined)
    mockDeleteAccount.mockResolvedValue({ message: 'Associated account data deleted successfully' })

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

  it('shows the latest successful payment below account status', async () => {
    mockListSubscriptionPayments.mockResolvedValue([
      {
        id: 12,
        payment_reference: 'PAY-OLD',
        subscription_id: 7,
        provider_id: 1,
        invoice_no: 'INV-OLD',
        amount: 100,
        currency: 'PHP',
        payment_method: 'PayPal',
        payment_status: 'SUCCESS',
        provider_transaction_id: 'OLD-1',
        paid_at: '2026-07-01T08:00:00Z',
        created_at: '2026-07-01T08:00:00Z',
      },
      {
        id: 13,
        payment_reference: 'PAY-LATEST',
        subscription_id: 7,
        provider_id: 2,
        invoice_no: 'INV-LATEST',
        amount: 160,
        currency: 'PHP',
        payment_method: 'PayMongo',
        payment_status: 'SUCCESS',
        provider_transaction_id: 'LATEST-1',
        paid_at: '2026-08-20T09:30:00Z',
        created_at: '2026-08-20T09:30:00Z',
      },
    ])

    render(
      <MemoryRouter initialEntries={['/account']}>
        <AccountSettingsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('PHP 160.00')).toBeTruthy()
    expect(screen.getByText(new Date('2026-08-20T09:30:00Z').toLocaleString())).toBeTruthy()
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

  it('shows the signing-out overlay until autosaves and logout finish', async () => {
    let resolveAutosaves: () => void = () => undefined
    let resolveLogout: () => void = () => undefined
    mockPrepareAutosavesForLogout.mockImplementation(() => new Promise<void>((resolve) => {
      resolveAutosaves = resolve
    }))
    mockLogout.mockImplementation(() => new Promise<void>((resolve) => {
      resolveLogout = resolve
    }))

    render(
      <MemoryRouter initialEntries={['/account']}>
        <AccountSettingsPage />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Sign Out' }))

    expect(screen.getByRole('dialog', { name: 'Signing you out' })).toBeTruthy()
    expect(mockLogout).not.toHaveBeenCalled()

    resolveAutosaves()
    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('dialog', { name: 'Signing you out' })).toBeTruthy()

    resolveLogout()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Signing you out' })).toBeNull()
    })
  })

  it('offers mutually exclusive account and data deletion options', async () => {
    render(
      <MemoryRouter initialEntries={['/account']}>
        <AccountSettingsPage />
      </MemoryRouter>,
    )

    const deletionForm = (await screen.findByRole('heading', { name: 'Deletion Options' })).closest('form')
    expect(deletionForm).toBeTruthy()
    const deletionControls = within(deletionForm as HTMLFormElement)
    const deleteAccountOption = deletionControls.getByLabelText('This action deletes account and associated data.')
    const deleteDataOption = deletionControls.getByLabelText('Delete data associated with this account but, account is retained.')
    expect((deleteAccountOption as HTMLInputElement).checked).toBe(true)
    expect((deleteDataOption as HTMLInputElement).checked).toBe(false)

    fireEvent.click(deleteDataOption)
    expect((deleteAccountOption as HTMLInputElement).checked).toBe(false)
    expect((deleteDataOption as HTMLInputElement).checked).toBe(true)

    fireEvent.change(deletionControls.getByLabelText('Current password'), { target: { value: 'password123' } })
    fireEvent.change(deletionControls.getByLabelText('Confirmation text'), { target: { value: 'DELETE' } })
    fireEvent.click(deletionControls.getByRole('button', { name: 'Delete Associated Data' }))

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledWith('password123', 'data_only'))
    expect(mockLogout).not.toHaveBeenCalled()
    expect(mockPrepareAutosavesForLogout).not.toHaveBeenCalled()
  })
})
