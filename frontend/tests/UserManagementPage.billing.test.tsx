import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  listAdminUsers: vi.fn(),
  listAdminRoles: vi.fn(),
  listSubscriptions: vi.fn(),
  listSubscriptionPlans: vi.fn(),
  listSubscriptionPayments: vi.fn(),
}))

vi.mock('../src/api', () => ({
  ...apiMocks,
  assignAdminUserRoles: vi.fn(),
  createAdminUser: vi.fn(),
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
  updateAdminUser: vi.fn(),
}))

vi.mock('../src/autosave/useAutosaveDraft', () => ({
  useAutosaveDraft: () => ({ clear: vi.fn().mockResolvedValue(undefined), isHydrated: true }),
}))

import UserManagementPage from '../src/pages/admin/UserManagementPage'

describe('UserManagementPage payment overview', () => {
  afterEach(() => cleanup())

  it('shows each user latest successful payment and billing details', async () => {
    apiMocks.listAdminUsers.mockResolvedValue([
      {
        id: 42,
        username: 'borrower42',
        email: 'borrower42@example.com',
        is_active: true,
        account_status: 'ACTIVE',
        subscription_id: 7,
        last_login_ip: '203.0.113.42',
        roles: ['subscriber_borrower'],
        permissions: [],
      },
    ])
    apiMocks.listAdminRoles.mockResolvedValue([])
    apiMocks.listSubscriptions.mockResolvedValue([
      {
        id: 7,
        subscription_no: 'SUB-007',
        user_id: 42,
        plan_id: 3,
        status: 'ACTIVE',
        next_invoice_date: '2026-09-20',
      },
    ])
    apiMocks.listSubscriptionPlans.mockResolvedValue([
      { id: 3, plan_code: 'SINGLE_PROFILE', plan_name: 'Single Profile' },
    ])
    apiMocks.listSubscriptionPayments.mockResolvedValue([
      {
        id: 10,
        payment_reference: 'PAY-OLD',
        subscription_id: 7,
        amount: 100,
        currency: 'PHP',
        payment_method: 'PayPal Capture',
        payment_status: 'SUCCESS',
        paid_at: '2026-07-20T08:00:00Z',
        created_at: '2026-07-20T08:00:00Z',
      },
      {
        id: 11,
        payment_reference: 'PAY-LATEST',
        subscription_id: 7,
        amount: 160,
        currency: 'PHP',
        payment_method: 'GCash',
        payment_status: 'SUCCESS',
        paid_at: '2026-08-20T08:00:00Z',
        created_at: '2026-08-20T08:00:00Z',
      },
    ])

    render(<UserManagementPage />)

    const heading = await screen.findByRole('heading', { name: 'User Payment Overview' })
    const table = heading.parentElement?.querySelector('table')
    expect(table).toBeTruthy()
    const paymentTable = within(table as HTMLTableElement)
    expect(paymentTable.getByText('borrower42')).toBeTruthy()
    expect(paymentTable.getByText('borrower42@example.com')).toBeTruthy()
    expect(paymentTable.getByText('Single Profile')).toBeTruthy()
    expect(paymentTable.getByText('PHP 160.00')).toBeTruthy()
    expect(paymentTable.getByText('GCash')).toBeTruthy()
    const dateFormatter = new Intl.DateTimeFormat('en-PH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    expect(paymentTable.getByText(dateFormatter.format(new Date('2026-08-20T08:00:00Z')))).toBeTruthy()
    expect(paymentTable.getByText(dateFormatter.format(new Date('2026-09-20')))).toBeTruthy()
    expect(paymentTable.getByText('203.0.113.42')).toBeTruthy()
    expect(paymentTable.queryByText('PHP 100.00')).toBeNull()
    expect(paymentTable.getAllByRole('textbox')).toHaveLength(8)

    fireEvent.change(paymentTable.getByRole('textbox', { name: 'Filter by payment merchant or method' }), {
      target: { value: 'paypal' },
    })
    expect(paymentTable.getByText('No users match the selected filters.')).toBeTruthy()

    fireEvent.change(paymentTable.getByRole('textbox', { name: 'Filter by payment merchant or method' }), {
      target: { value: 'gcash' },
    })
    expect(paymentTable.getByText('borrower42')).toBeTruthy()
  })
})