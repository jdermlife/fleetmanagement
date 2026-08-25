import { useEffect, useMemo, useState } from 'react'

import {
  assignAdminUserRoles,
  createAdminUser,
  getErrorMessage,
  listAdminRoles,
  listAdminUsers,
  listSubscriptionPayments,
  listSubscriptionPlans,
  listSubscriptions,
  updateAdminUser,
  type AdminRole,
  type AdminUser,
  type SubscriptionPayment,
  type SubscriptionPlan,
  type SubscriptionRecord,
} from '../../api'
import { useAutosaveDraft } from '../../autosave/useAutosaveDraft'

type AccountStatus = NonNullable<AdminUser['account_status']>

const ACCOUNT_STATUSES: AccountStatus[] = [
  'ACTIVE',
  'PENDING',
  'LOCKED',
  'SUSPENDED',
  'DISABLED',
  'DELETED',
]

function uniqueRoleList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([])
  const [payments, setPayments] = useState<SubscriptionPayment[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [mobileNo, setMobileNo] = useState('')
  const [accountStatus, setAccountStatus] = useState<'ACTIVE' | 'PENDING' | 'LOCKED' | 'SUSPENDED' | 'DISABLED' | 'DELETED'>('ACTIVE')
  const [subscriptionId, setSubscriptionId] = useState<number | ''>('')
  const [newUserRoles, setNewUserRoles] = useState('')

  const [roleDrafts, setRoleDrafts] = useState<Record<number, string>>({})
  const [statusDrafts, setStatusDrafts] = useState<Record<number, AccountStatus>>({})
  const [subscriptionDrafts, setSubscriptionDrafts] = useState<Record<number, number | ''>>({})
  const userFormAutosave = useAutosaveDraft({
    scope: 'admin-user-create',
    entityKey: 'default',
    value: {
      username,
      email,
      firstName,
      middleName,
      lastName,
      mobileNo,
      accountStatus,
      subscriptionId,
      newUserRoles,
    },
    defaults: {
      username: '',
      email: '',
      firstName: '',
      middleName: '',
      lastName: '',
      mobileNo: '',
      accountStatus: 'ACTIVE' as const,
      subscriptionId: '' as number | '',
      newUserRoles: '',
    },
    onHydrate: (draft) => {
      setUsername(draft.username)
      setEmail(draft.email)
      setFirstName(draft.firstName)
      setMiddleName(draft.middleName)
      setLastName(draft.lastName)
      setMobileNo(draft.mobileNo)
      setAccountStatus(draft.accountStatus)
      setSubscriptionId(draft.subscriptionId)
      setNewUserRoles(draft.newUserRoles)
    },
  })

  const loadData = async () => {
    setLoading(true)
    setMessage('')
    try {
      const [loadedUsers, loadedRoles, loadedSubscriptions, loadedSubscriptionPlans, loadedPayments] = await Promise.all([
        listAdminUsers(),
        listAdminRoles(),
        listSubscriptions(),
        listSubscriptionPlans(),
        listSubscriptionPayments(),
      ])
      setUsers(loadedUsers)
      setRoles(loadedRoles)
      setSubscriptions(loadedSubscriptions)
      setSubscriptionPlans(loadedSubscriptionPlans)
      setPayments(loadedPayments)
      setRoleDrafts(
        Object.fromEntries(loadedUsers.map((user) => [user.id, user.roles.join(', ')])),
      )
      setStatusDrafts(
        Object.fromEntries(
          loadedUsers.map((user) => [
            user.id,
            user.account_status ?? (user.is_active ? 'ACTIVE' : 'DISABLED'),
          ]),
        ),
      )
      setSubscriptionDrafts(
        Object.fromEntries(loadedUsers.map((user) => [user.id, user.subscription_id ?? ''])),
      )
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to load users.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const subscriptionPlanNames = useMemo(() => {
    const planNamesById = new Map(
      subscriptionPlans.map((plan) => [plan.id, plan.plan_name]),
    )

    return new Map(
      subscriptions.map((subscription) => [
        subscription.id,
        planNamesById.get(subscription.plan_id) ?? 'Plan unavailable',
      ]),
    )
  }, [subscriptionPlans, subscriptions])

  const userBillingRows = useMemo(() => {
    const plansById = new Map(subscriptionPlans.map((plan) => [plan.id, plan]))
    const subscriptionsById = new Map(subscriptions.map((subscription) => [subscription.id, subscription]))

    return users.map((user) => {
      const userSubscriptions = subscriptions.filter(
        (subscription) => subscription.user_id === user.id || subscription.id === user.subscription_id,
      )
      const userSubscriptionIds = new Set(userSubscriptions.map((subscription) => subscription.id))
      const latestPayment = payments
        .filter(
          (payment) =>
            payment.payment_status === 'SUCCESS' && userSubscriptionIds.has(payment.subscription_id),
        )
        .sort((left, right) => paymentTimestamp(right) - paymentTimestamp(left))[0] ?? null
      const paymentSubscription = latestPayment
        ? subscriptionsById.get(latestPayment.subscription_id) ?? null
        : null
      const assignedSubscription = user.subscription_id
        ? subscriptionsById.get(user.subscription_id) ?? null
        : null
      const subscription = paymentSubscription ?? assignedSubscription ?? userSubscriptions[0] ?? null
      const plan = subscription ? plansById.get(subscription.plan_id) ?? null : null

      return { user, subscription, plan, latestPayment }
    })
  }, [payments, subscriptionPlans, subscriptions, users])

  const handleCreateUser = async () => {
    setMessage('')
    try {
      await createAdminUser({
        username,
        email,
        password,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        mobile_no: mobileNo,
        account_status: accountStatus,
        subscription_id: subscriptionId ? Number(subscriptionId) : undefined,
        roles: uniqueRoleList(newUserRoles),
      })
      await userFormAutosave.clear()
      setUsername('')
      setEmail('')
      setPassword('')
      setFirstName('')
      setMiddleName('')
      setLastName('')
      setMobileNo('')
      setAccountStatus('ACTIVE')
      setSubscriptionId('')
      setNewUserRoles('')
      await loadData()
      setMessage('User created successfully.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to create user.'))
    }
  }

  const handleSaveUser = async (user: AdminUser) => {
    setMessage('')
    try {
      const accountStatus = statusDrafts[user.id] ?? 'DISABLED'
      const subscriptionId = subscriptionDrafts[user.id]
      await Promise.all([
        assignAdminUserRoles(user.id, uniqueRoleList(roleDrafts[user.id] ?? '')),
        updateAdminUser(user.id, {
          account_status: accountStatus,
          is_active: accountStatus === 'ACTIVE',
          subscription_id: subscriptionId === '' ? null : subscriptionId,
        }),
      ])
      await loadData()
      setMessage('User changes saved successfully.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to save user changes.'))
    }
  }

  const handleToggleStatus = async (user: AdminUser) => {
    setMessage('')
    try {
      const nextActive = !user.is_active
      await updateAdminUser(user.id, {
        is_active: nextActive,
        account_status: nextActive ? 'ACTIVE' : 'DISABLED',
      })
      await loadData()
      setMessage('User status updated.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to update user status.'))
    }
  }

  return (
    <div className="standalone-card">
      <h1>User Management</h1>
      <p className="intro">
        Admin-only user register for account status, access roles, and subscription plans.
      </p>

      {message ? <p className="status-message">{message}</p> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Create User</h3>
        <div className="auth-profile-grid">
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label>
            First Name
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </label>
          <label>
            Middle Name
            <input value={middleName} onChange={(event) => setMiddleName(event.target.value)} />
          </label>
          <label>
            Last Name
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </label>
          <label>
            Mobile No
            <input value={mobileNo} onChange={(event) => setMobileNo(event.target.value)} />
          </label>
          <label>
            Account Status
            <select
              value={accountStatus}
              onChange={(event) =>
                setAccountStatus(
                  event.target.value as 'ACTIVE' | 'PENDING' | 'LOCKED' | 'SUSPENDED' | 'DISABLED' | 'DELETED',
                )
              }
            >
              {ACCOUNT_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            Subscription
            <select
              value={subscriptionId}
              onChange={(event) => setSubscriptionId(event.target.value ? Number(event.target.value) : '')}
            >
              <option value="">None</option>
              {subscriptions.map((subscription) => (
                <option key={subscription.id} value={subscription.id}>
                  {subscription.subscription_no} - {subscriptionPlanNames.get(subscription.id) ?? 'Plan unavailable'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Roles (comma-separated)
            <input
              value={newUserRoles}
              onChange={(event) => setNewUserRoles(event.target.value)}
              placeholder="admin, subscriber"
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" onClick={() => void handleCreateUser()}>
            Create User
          </button>
        </div>
      </div>

      <div className="card">
        <h3>User Register</h3>
        <p className="intro">Available roles: {roles.map((role) => role.name).join(', ') || 'None'}</p>
        {loading ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p className="status-message">No users found.</p>
        ) : (
          <>
            <div className="space-y-4 md:hidden">
              {users.map((user) => (
                <article key={`mobile-${user.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{user.username}</div>
                      <div className="text-xs text-slate-500">
                        {[user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || 'N/A'}
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                      {user.account_status ?? (user.is_active ? 'ACTIVE' : 'DISABLED')}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</div>
                      <div className="break-words text-slate-700">{user.email}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Date Created</div>
                      <div className="text-slate-700">{formatDateCreated(user.created_at)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Admin Email Sent</div>
                      <div className="text-slate-700">{formatNotificationSentAt(user.admin_user_notification_sent_at)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</div>
                      <select
                        aria-label={`Status for ${user.username}`}
                        value={statusDrafts[user.id] ?? 'DISABLED'}
                        onChange={(event) =>
                          setStatusDrafts((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as AccountStatus,
                          }))
                        }
                      >
                        {ACCOUNT_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Subscription Plan</div>
                      <select
                        aria-label={`Subscription plan for ${user.username}`}
                        value={subscriptionDrafts[user.id] ?? ''}
                        onChange={(event) =>
                          setSubscriptionDrafts((prev) => ({
                            ...prev,
                            [user.id]: event.target.value ? Number(event.target.value) : '',
                          }))
                        }
                      >
                        <option value="">No Subscription</option>
                        {subscriptions.map((subscription) => (
                          <option key={subscription.id} value={subscription.id}>
                            {subscription.subscription_no} - {subscriptionPlanNames.get(subscription.id) ?? 'Plan unavailable'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Role</div>
                      <select
                        aria-label={`Role for ${user.username}`}
                        value={roleDrafts[user.id] ?? ''}
                        onChange={(event) =>
                          setRoleDrafts((prev) => ({ ...prev, [user.id]: event.target.value }))
                        }
                      >
                        <option value="">No Role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.name}>{role.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void handleSaveUser(user)}>
                      Save Changes
                    </button>
                    <button type="button" onClick={() => void handleToggleStatus(user)}>
                      {user.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </article>
              ))}
            </div>

          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Username</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Date Created</th>
                  <th className="px-3 py-2 text-left">Admin Email Sent</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Subscription Plan</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 py-2">{user.username}</td>
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateCreated(user.created_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatNotificationSentAt(user.admin_user_notification_sent_at)}</td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Status for ${user.username}`}
                        value={statusDrafts[user.id] ?? 'DISABLED'}
                        onChange={(event) =>
                          setStatusDrafts((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as AccountStatus,
                          }))
                        }
                      >
                        {ACCOUNT_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Role for ${user.username}`}
                        value={roleDrafts[user.id] ?? ''}
                        onChange={(event) =>
                          setRoleDrafts((prev) => ({ ...prev, [user.id]: event.target.value }))
                        }
                      >
                        <option value="">No Role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.name}>{role.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Subscription plan for ${user.username}`}
                        value={subscriptionDrafts[user.id] ?? ''}
                        onChange={(event) =>
                          setSubscriptionDrafts((prev) => ({
                            ...prev,
                            [user.id]: event.target.value ? Number(event.target.value) : '',
                          }))
                        }
                      >
                        <option value="">No Subscription</option>
                        {subscriptions.map((subscription) => (
                          <option key={subscription.id} value={subscription.id}>
                            {subscription.subscription_no} - {subscriptionPlanNames.get(subscription.id) ?? 'Plan unavailable'}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="form-actions">
                        <button type="button" onClick={() => void handleSaveUser(user)}>
                          Save Changes
                        </button>
                        <button type="button" onClick={() => void handleToggleStatus(user)}>
                          {user.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      <div className="card admin-user-billing-card">
        <h3>User Payment Overview</h3>
        <p className="intro">Latest successful subscription payment and billing schedule by user.</p>
        {loading ? (
          <p>Loading payment overview...</p>
        ) : users.length === 0 ? (
          <p className="status-message">No users found.</p>
        ) : (
          <div className="admin-user-billing-table-wrap">
            <table className="admin-user-billing-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Payment Plan</th>
                  <th>Payment Amount</th>
                  <th>Last Payment Date</th>
                  <th>Next Due Date</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {userBillingRows.map(({ user, subscription, plan, latestPayment }) => (
                  <tr key={`billing-${user.id}`}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>{plan?.plan_name ?? 'N/A'}</td>
                    <td>{formatPaymentAmount(latestPayment)}</td>
                    <td>{formatBillingDate(latestPayment?.paid_at ?? latestPayment?.created_at)}</td>
                    <td>{formatBillingDate(subscription?.next_invoice_date)}</td>
                    <td>{user.last_login_ip ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function paymentTimestamp(payment: SubscriptionPayment): number {
  const timestamp = new Date(payment.paid_at ?? payment.created_at).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function formatPaymentAmount(payment: SubscriptionPayment | null): string {
  if (payment?.amount == null) {
    return 'N/A'
  }

  return `${payment.currency ?? 'PHP'} ${payment.amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatBillingDate(value?: string | null): string {
  if (!value) {
    return 'N/A'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatDateCreated(value?: string): string {
  if (!value) {
    return 'N/A'
  }

  const createdAt = new Date(value)
  if (Number.isNaN(createdAt.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(createdAt)
}

function formatNotificationSentAt(value?: string | null): string {
  if (!value) {
    return 'Pending/Failed'
  }

  const sentAt = new Date(value)
  if (Number.isNaN(sentAt.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Manila',
    timeZoneName: 'short',
  }).format(sentAt)
}
